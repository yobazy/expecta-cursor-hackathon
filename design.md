# Expecta backend design

Status: backend handoff draft  
Scope: production services needed by the current frontend prototype  
Frontend source of truth: `src/App.tsx` and `src/Sprout.tsx`

## 1. Product summary

Expecta is a mobile-first product checker for people who are trying to conceive, pregnant, or nursing. A user scans a barcode or enters an ingredient list. Expecta checks the product against stage-specific guidance, explains any ingredients that need attention, and links each explanation to its source.

The product gives educational guidance, not a diagnosis or an instruction to start or stop treatment. That distinction must remain visible in the API language, stored content, and UI.

The frontend currently demonstrates:

- Five life stages: trying to conceive, trimesters 1–3, and nursing.
- Barcode scanning with camera or manual barcode entry.
- Product lookup through Open Food Facts.
- Manual ingredient entry.
- Four result levels: `safe`, `caution`, `avoid`, and `unknown`.
- Explanations and source links for matched ingredients.
- A 20-item check history and user-selected favorites.
- A request flow for barcodes that are not found.
- A label-photo entry point. The prototype does not extract text from the image yet.

All product rules, demo products, and evaluation logic currently live in the frontend. History and favorites are stored in browser local storage. The backend described here replaces those prototype-only pieces.

## 2. Goals

The first production backend should:

1. Return a normalized product for a barcode, using our catalog first and an external provider as a fallback.
2. Evaluate a product or ingredient list for a selected life stage.
3. Return enough evidence for the result screen: matched ingredient, verdict, reason, source name, and source URL.
4. Store checks, favorites, user stage, and missing-product requests.
5. Keep medical rules versioned and auditable.
6. Avoid presenting incomplete ingredient coverage as a whole-product safety claim.
7. Give the frontend stable error codes and idempotent write behavior.

## 3. Non-goals for the first release

- Diagnosis, treatment recommendations, dosage advice, or drug-interaction checking.
- Personalized advice based on symptoms or medical history.
- A public clinician portal.
- A full product-catalog editing interface.
- Automatic approval of external product data as medical evidence.
- Community-authored safety rules.

An internal rule-review workflow will be needed before launch, but it can begin as controlled database migrations or an admin-only tool.

## 4. Users and stage context

The prototype shows a signed-in-style profile ("Anna") but has no authentication flow. The backend should treat identity as an integration boundary:

- User-scoped routes accept a bearer token issued by the final auth provider.
- The token subject maps to an internal `user_id`.
- Local or anonymous development may use a seeded test user.
- The frontend team still needs to choose the production auth provider and sign-in experience.

The user's current stage is persistent profile context:

- `trying`: trying to conceive / pre-pregnancy
- `trimester-1`: weeks 1–13
- `trimester-2`: weeks 14–27
- `trimester-3`: week 28 through birth
- `nursing`: breastfeeding / postpartum

Checks store the stage used at evaluation time. Changing the profile stage must not rewrite past checks. Reopening a historical check shows its original result and rule version. If the user explicitly rechecks it for another stage, the backend creates a new evaluation.

## 5. Main user flows

### 5.1 Scan a barcode

1. The frontend reads a barcode from the device camera.
2. It calls the product lookup endpoint.
3. The backend checks its product catalog.
4. On a catalog miss, the backend queries the configured external provider, initially Open Food Facts.
5. The backend normalizes and caches usable provider data.
6. If the product has an ingredient list, the frontend submits or requests an evaluation for the active stage.
7. The completed check is added to history.

The lookup and evaluation may be exposed as one convenience endpoint, but product data and evaluation records should remain separate internally.

### 5.2 Enter ingredients manually

1. The user enters an optional product name and a required ingredient list.
2. The frontend sends the raw text and active stage.
3. The backend parses and normalizes the ingredients.
4. It evaluates the parsed list and returns the result.
5. The completed check is added to history.

Comma and newline delimiters are supported by the prototype. The production parser should also preserve the original text for audit and future parser improvements.

### 5.3 Upload a label

The current frontend accepts an image and then opens the manual-entry screen; it does not upload or inspect the file.

The production flow should:

1. Accept JPEG, PNG, HEIC, or WebP within an agreed size limit.
2. Remove image metadata that is not needed for extraction.
3. Run OCR and return extracted text plus confidence.
4. Let the user correct the text before evaluation.
5. Delete the source image after a short retention window unless a separate consent policy allows longer storage.

OCR is not required to support barcode and manual-entry launch, but the API namespace should leave room for it.

### 5.4 View results

The result screen needs:

- Product name, brand, category, and ingredient count.
- Stage used for the check.
- Overall verdict and evaluation time.
- Ingredients flagged as `avoid` or `caution`.
- The reason and source for every matched rule.
- Every supplied ingredient, with its individual verdict or `not_reviewed`.
- A clear indication when rule coverage is incomplete.
- The medical disclaimer.

### 5.5 Save and revisit checks

- History is newest first and paginated. The prototype keeps only 20 local items; the backend should retain more and let the client request 20 at a time.
- Rechecking the same product creates a new check rather than mutating an old medical result.
- Favoriting a check or product is user-scoped and idempotent.
- The current UI favorites products, then displays the most recent check for each favorite product. The API should preserve that behavior.

### 5.6 Request a missing product

If a barcode has no usable product record, the user can request it. Repeated requests from the same user for the same barcode must not create duplicate request rows, but the backend may maintain an aggregate request count for prioritization.

## 6. Verdict model

### 6.1 Ingredient verdicts

Each reviewed ingredient resolves to one verdict for the selected stage:

- `safe`: no stage-specific concern is recorded in the active rule version.
- `caution`: use may depend on dose, format, frequency, or clinician guidance.
- `avoid`: the cited guidance recommends avoiding it for that stage.
- `not_reviewed`: no active rule matched the normalized ingredient.

`unknown` is the overall result when no ingredient can be evaluated. At ingredient level, use `not_reviewed` so the API does not blur "no rule exists" with a reviewed rule whose conclusion is uncertain.

### 6.2 Overall verdict

For matched rules, severity precedence is:

`avoid` > `caution` > `safe`

The backend also returns coverage independently:

- `complete`: every parsed ingredient has a reviewed match.
- `partial`: at least one ingredient matched and at least one did not.
- `none`: no ingredient matched.

Overall verdict rules:

1. If coverage is `none`, return `unknown`.
2. Otherwise return the strongest matched verdict.
3. Never infer that an unmatched ingredient is safe.
4. When coverage is `partial`, the UI must qualify the result as applying only to reviewed ingredients. It must not make an unqualified whole-product safety claim.

This preserves the prototype's strongest-match behavior while making incomplete coverage explicit.

### 6.3 Matching and normalization

The prototype lowercases text, removes parenthetical text and punctuation, and checks whether a normalized ingredient contains a rule alias. That is acceptable for a demo but too permissive for production. For example, substring matching can produce false positives around short aliases.

Production matching should:

- Normalize Unicode, case, whitespace, and punctuation.
- Keep the raw ingredient beside its normalized form.
- Match canonical names and reviewed aliases on token boundaries.
- Record the alias and rule version that produced each match.
- Support exact matches first and reviewed pattern matches second.
- Never let a fuzzy match produce an `avoid` verdict without a reviewed mapping.
- Log unmatched normalized terms for rule-coverage analysis, without exposing cross-user data.

## 7. Domain model

### User

- `id`
- `auth_subject`
- `display_name` (optional)
- `stage`
- `created_at`
- `updated_at`

### Product

- `id`
- `barcode` (nullable for manual products)
- `name`
- `brand`
- `category`
- `source`: `internal`, `manual`, `open_food_facts`, or another provider
- `source_record_id`
- `source_updated_at`
- `ingredients_raw`
- `owner_user_id` (nullable; set for private manual products)
- `visibility`: `catalog` or `private`
- `catalog_status`: `active`, `needs_review`, `rejected`
- `created_at`
- `updated_at`

A barcode is unique per normalized barcode scheme. A manual check creates a private product so it can be revisited and favorited without adding it to the shared catalog. Keep provider payloads or hashes for traceability, but do not expose arbitrary provider fields to clients.

### Product ingredient

- `id`
- `product_id`
- `position`
- `raw_name`
- `normalized_name`

Order matters because the result screen mirrors the label.

### Guidance rule

- `id`
- `canonical_name`
- `reason`
- `status`: `draft`, `active`, `retired`
- `version`
- `reviewed_by`
- `reviewed_at`
- `effective_from`
- `effective_to` (nullable)
- `created_at`
- `updated_at`

### Rule alias

- `id`
- `rule_id`
- `alias`
- `normalized_alias`
- `match_type`: `exact`, `token`, or `reviewed_pattern`

### Rule stage verdict

- `rule_id`
- `stage`
- `verdict`: `safe`, `caution`, or `avoid`
- `reason_override` (nullable)

### Evidence source

- `id`
- `organization`
- `title` (optional)
- `url`
- `published_at` (nullable)
- `accessed_at`

A rule may cite more than one source even though the prototype currently shows one.

### Check

- `id`
- `user_id`
- `product_id`
- `input_type`: `barcode`, `manual`, or `label`
- `input_name`
- `input_ingredients_raw`
- `stage`
- `overall_verdict`
- `coverage`
- `rule_set_version`
- `created_at`

### Check ingredient result

- `id`
- `check_id`
- `position`
- `raw_name`
- `normalized_name`
- `verdict`: `safe`, `caution`, `avoid`, or `not_reviewed`
- `rule_id` (nullable)
- `rule_version` (nullable)
- `matched_alias` (nullable)
- `reason_snapshot` (nullable)
- `evidence_snapshot` (nullable JSON containing the displayed source records)

Snapshot user-visible rule text and citations with the check. Medical guidance will change; a historical check must remain explainable.

### Favorite

- `user_id`
- `product_id`
- `created_at`

Unique on `(user_id, product_id)`.

### Product request

- `id`
- `user_id`
- `barcode`
- `status`: `requested`, `in_review`, `resolved`, or `closed`
- `created_at`
- `updated_at`

Unique on `(user_id, barcode)`.

## 8. HTTP API

Use `/v1`, JSON, UTC ISO 8601 timestamps, opaque IDs, and lower-case enum values. User-scoped routes require `Authorization: Bearer <token>`.

### Profile

`GET /v1/me`

Returns the current profile and stage.

`PATCH /v1/me`

Accepted body:

```json
{
  "stage": "trimester-2"
}
```

### Product lookup

`GET /v1/products/by-barcode/{barcode}`

Success:

```json
{
  "data": {
    "id": "prd_01...",
    "barcode": "049000042559",
    "name": "Coca-Cola Zero Sugar",
    "brand": "Coca-Cola",
    "category": "Food & drink",
    "ingredients": [
      {
        "position": 0,
        "name": "Carbonated water"
      }
    ],
    "source": {
      "provider": "open_food_facts",
      "updatedAt": "2026-07-22T18:00:00Z"
    }
  }
}
```

If the barcode exists externally but lacks a usable ingredient list, return a typed `PRODUCT_INCOMPLETE` error rather than a product that cannot be checked.

### Create a check

`POST /v1/checks`

Barcode input:

```json
{
  "input": {
    "type": "barcode",
    "barcode": "049000042559"
  },
  "stage": "trimester-1"
}
```

Manual input:

```json
{
  "input": {
    "type": "manual",
    "name": "Night renewal serum",
    "ingredientsText": "Water, glycerin, retinol, niacinamide"
  },
  "stage": "trimester-1"
}
```

Response:

```json
{
  "data": {
    "id": "chk_01...",
    "createdAt": "2026-07-22T19:30:00Z",
    "stage": "trimester-1",
    "verdict": "avoid",
    "coverage": "partial",
    "ruleSetVersion": "2026.07.1",
    "product": {
      "id": "prd_01...",
      "name": "Night renewal serum",
      "brand": "Label scan",
      "category": "Custom"
    },
    "ingredients": [
      {
        "position": 0,
        "name": "Water",
        "verdict": "not_reviewed",
        "match": null
      },
      {
        "position": 1,
        "name": "Retinol",
        "verdict": "avoid",
        "match": {
          "ruleId": "rul_retinol",
          "canonicalName": "Retinol",
          "reason": "Topical retinoids are generally avoided during pregnancy as a precaution.",
          "matchedAlias": "retinol",
          "sources": [
            {
              "organization": "American Academy of Dermatology",
              "url": "https://www.aad.org/public/diseases/acne/derm-treat/pregnancy"
            }
          ]
        }
      }
    ],
    "disclaimer": "This is educational guidance, not medical advice. For medicines or symptoms, check with your care team."
  }
}
```

Send an `Idempotency-Key` header for check creation so camera retries do not create duplicate history records.

### History and a single check

`GET /v1/checks?limit=20&cursor=<opaque>`

Returns newest-first check summaries plus `nextCursor`.

`GET /v1/checks/{checkId}`

Returns the full snapshotted check response.

### Favorites

`GET /v1/favorites?limit=20&cursor=<opaque>`

Returns favorite products with each product's most recent check for the current user.

`PUT /v1/favorites/{productId}`

Idempotently adds a favorite.

`DELETE /v1/favorites/{productId}`

Idempotently removes a favorite.

### Missing-product requests

`PUT /v1/product-requests/{barcode}`

Creates or returns the user's existing request.

### Label extraction

Proposed after the manual-entry release:

`POST /v1/label-extractions`

Accept multipart image upload and return:

```json
{
  "data": {
    "id": "ext_01...",
    "status": "completed",
    "text": "Water, glycerin, retinol, niacinamide",
    "confidence": 0.93,
    "expiresAt": "2026-07-23T19:30:00Z"
  }
}
```

Extraction and evaluation stay separate so users can correct OCR errors.

## 9. Error contract

All errors use one shape:

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "No product was found for this barcode.",
    "requestId": "req_01...",
    "details": {}
  }
}
```

Initial stable codes:

- `INVALID_REQUEST`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `PRODUCT_NOT_FOUND`
- `PRODUCT_INCOMPLETE`
- `INGREDIENTS_REQUIRED`
- `UNSUPPORTED_IMAGE`
- `IMAGE_TOO_LARGE`
- `EXTRACTION_FAILED`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `INTERNAL_ERROR`

Provider timeouts and malformed provider payloads must not leak as raw upstream errors. A catalog miss is not a server error. The frontend uses `PRODUCT_NOT_FOUND` to show the request-product screen and `PROVIDER_UNAVAILABLE` to show a retry message.

## 10. External product data

The prototype calls Open Food Facts directly from the browser. Production lookup should go through the backend to provide:

- A stable response independent of provider schema changes.
- Timeouts, retries, and circuit breaking.
- Response caching and rate-limit control.
- Provenance and last-updated timestamps.
- Validation before external data reaches evaluation.
- A path to add other providers without a frontend release.

External catalog data supplies product identity and label ingredients only. It does not supply Expecta's medical verdicts.

Suggested lookup policy:

1. Return a reviewed internal product when present.
2. Return a fresh cached provider product when present.
3. Query the provider with a short timeout.
4. Normalize and cache records that contain a name and ingredient text.
5. Return `PRODUCT_NOT_FOUND` for a true miss.
6. Return `PRODUCT_INCOMPLETE` when identity exists but ingredients are absent.
7. Return `PROVIDER_UNAVAILABLE` when no cached result exists and the provider cannot be reached.

## 11. Guidance governance

This is the highest-risk part of the system. Rules must not be edited as ordinary product content.

Required controls:

- Only authorized reviewers can activate or retire rules.
- Every activation records reviewer, timestamp, source, and version.
- Published rule versions are immutable.
- Checks record the exact rule-set version and user-visible snapshots.
- Source URLs are validated and monitored for broken links.
- Rule changes have an audit log.
- A rollback can restore the previous active rule set without rewriting historical checks.
- The team defines who is qualified to approve medical language before production launch.

The eleven rules hardcoded in the prototype are demo content. They should be imported as draft records and reviewed before any production use.

## 12. Privacy and security

- Treat stage, check history, and uploaded labels as sensitive user data even if local law does not classify every field as protected health information.
- Encrypt data in transit and at rest.
- Enforce ownership checks on every user-scoped record.
- Do not log raw access tokens, full label images, or complete ingredient text in routine request logs.
- Use signed, short-lived object-storage URLs for label uploads.
- Strip EXIF metadata from uploaded images.
- Apply file signature checks, size limits, malware scanning where available, and per-user rate limits.
- Provide account deletion that removes user-scoped history, favorites, requests, and retained images.
- Keep aggregate, de-identified rule-coverage metrics separate from user records.
- Document retention periods before launch.

## 13. Reliability and performance

Targets for the first release:

- Cached barcode lookup: p95 under 300 ms.
- New external barcode lookup: p95 under 2.5 seconds, excluding a clearly surfaced provider outage.
- Evaluation of up to 200 parsed ingredients: p95 under 500 ms after product lookup.
- History and favorites reads: p95 under 500 ms.
- Availability target: 99.9% monthly for first-party APIs.

Operational requirements:

- Structured logs with request IDs.
- Metrics for endpoint latency, error code, external-provider outcome, evaluation coverage, and OCR failure.
- Tracing around external lookups and OCR.
- Alerts on elevated `INTERNAL_ERROR`, provider failure, and rule-loading failure.
- Database backups and tested restore procedures.
- A health check that verifies the active rule set can load.

## 14. Backend component boundaries

A modular service is sufficient for the first release. Separate deployables are not required.

- API/auth module: token validation, request validation, response envelope.
- Catalog module: internal products, external-provider adapters, normalization, caching.
- Evaluation module: ingredient parsing, alias matching, rule loading, verdict and coverage calculation.
- User library module: profile stage, history, favorites.
- Request module: missing-product demand.
- Extraction module: image storage and OCR when label upload is enabled.
- Guidance module: versioned rules, sources, activation, audit.

The evaluation module must be deterministic for a given normalized ingredient list, stage, and rule-set version.

## 15. Delivery phases

### Phase 1: backend parity

- Auth integration seam and seeded development user.
- Profile stage.
- Barcode proxy/cache.
- Manual and barcode check creation.
- Versioned rule storage and deterministic evaluation.
- History, favorites, and missing-product requests.
- Import prototype rules as unapproved drafts, then complete medical review.

### Phase 2: label extraction

- Secure image upload.
- OCR provider integration.
- User correction flow.
- Retention and deletion jobs.

### Phase 3: editorial operations

- Internal product review queue.
- Rule authoring and approval workflow.
- Source-link monitoring.
- Coverage reporting for common unmatched ingredients.

## 16. Acceptance criteria

The backend handoff is complete when:

- The frontend can replace every in-browser data mutation with a documented API call.
- Scanning a known barcode returns a normalized product and a stage-specific check.
- A missing barcode produces a typed miss that can be requested once per user.
- Manual ingredient text returns ordered per-ingredient results.
- Every matched verdict contains a reason and at least one source.
- Unmatched ingredients are returned as `not_reviewed`; they are never silently classified as safe.
- Overall verdict and coverage follow the rules in section 6.
- A check remains unchanged after its source rule is updated.
- Changing profile stage affects new checks but not history.
- History is paginated and newest first.
- Favorites are idempotent and user-scoped.
- External-provider outages return a retryable typed error.
- Unauthorized users cannot read or mutate another user's data.
- Audit records identify who activated each production rule version.

## 17. Decisions still needed

These choices are not established by the prototype:

- Production auth provider and whether anonymous use is supported.
- Who approves medical guidance and what review evidence is required.
- Whether a favorite points to a product, a specific check, or both. This document follows the current product-level behavior.
- Product catalog providers beyond Open Food Facts, especially for medication and skincare coverage.
- OCR provider, image size limit, and image retention window.
- Data residency, deletion SLA, and regulatory review.
- Whether the API will localize product text and guidance in the first release.
- Whether users can delete individual history entries in addition to deleting their account.

Until these are resolved, the backend can implement the contracts above behind configuration and keep auth, provider, and OCR adapters replaceable.
