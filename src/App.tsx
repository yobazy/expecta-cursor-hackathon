import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock3,
  Heart,
  Home,
  ImagePlus,
  Info,
  Keyboard,
  Leaf,
  ScanLine,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { Sprout } from './Sprout'

type StageId = 'trying' | 'trimester-1' | 'trimester-2' | 'trimester-3' | 'nursing'
type Severity = 'safe' | 'caution' | 'avoid' | 'unknown'
type Screen = 'home' | 'scanner' | 'label' | 'result' | 'library' | 'no-data'
type Tab = 'history' | 'favorites'

type Stage = { id: StageId; short: string; label: string; detail: string }
type Rule = {
  name: string
  aliases: string[]
  reason: string
  source: string
  sourceUrl: string
  verdicts: Record<StageId, Severity>
}
type Product = {
  id: string
  brand: string
  name: string
  category: string
  ingredients: string[]
  barcode?: string
}
type Match = { ingredient: string; rule: Rule; severity: Severity }
type Result = {
  id: string
  product: Product
  stage: StageId
  severity: Severity
  matches: Match[]
  unknownIngredients: string[]
  createdAt: number
}

const stages: Stage[] = [
  { id: 'trying', short: 'Planning', label: 'Trying to conceive', detail: 'Pre-pregnancy' },
  { id: 'trimester-1', short: 'Trimester 1', label: 'First trimester', detail: 'Weeks 1–13' },
  { id: 'trimester-2', short: 'Trimester 2', label: 'Second trimester', detail: 'Weeks 14–27' },
  { id: 'trimester-3', short: 'Trimester 3', label: 'Third trimester', detail: 'Week 28–birth' },
  { id: 'nursing', short: 'Nursing', label: 'Breastfeeding', detail: 'Postpartum' },
]

const rules: Rule[] = [
  {
    name: 'Retinol',
    aliases: ['retinol', 'retinal', 'retinyl palmitate'],
    reason: 'Topical retinoids are generally avoided during pregnancy as a precaution.',
    source: 'American Academy of Dermatology',
    sourceUrl: 'https://www.aad.org/public/diseases/acne/derm-treat/pregnancy',
    verdicts: {
      trying: 'avoid',
      'trimester-1': 'avoid',
      'trimester-2': 'avoid',
      'trimester-3': 'avoid',
      nursing: 'caution',
    },
  },
  {
    name: 'Ibuprofen',
    aliases: ['ibuprofen'],
    reason: 'NSAIDs should be avoided at 20 weeks or later unless specifically advised.',
    source: 'U.S. Food & Drug Administration',
    sourceUrl: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-recommends-avoiding-use-nsaid-pregnancy-20-weeks-or-later-because-they-can-result-low-amniotic',
    verdicts: {
      trying: 'caution',
      'trimester-1': 'caution',
      'trimester-2': 'avoid',
      'trimester-3': 'avoid',
      nursing: 'safe',
    },
  },
  {
    name: 'Salicylic acid',
    aliases: ['salicylic acid', 'beta hydroxy acid', 'bha'],
    reason: 'Limited topical use is generally considered low risk; high-dose or large-area use needs review.',
    source: 'American College of Obstetricians and Gynecologists',
    sourceUrl: 'https://www.acog.org/womens-health/faqs/skin-conditions-during-pregnancy',
    verdicts: {
      trying: 'safe',
      'trimester-1': 'caution',
      'trimester-2': 'caution',
      'trimester-3': 'caution',
      nursing: 'safe',
    },
  },
  {
    name: 'Acetaminophen',
    aliases: ['acetaminophen', 'paracetamol'],
    reason: 'Commonly used in pregnancy when needed; dose and duration still matter.',
    source: 'MotherToBaby',
    sourceUrl: 'https://mothertobaby.org/fact-sheets/acetaminophen-pregnancy/',
    verdicts: {
      trying: 'safe',
      'trimester-1': 'caution',
      'trimester-2': 'caution',
      'trimester-3': 'caution',
      nursing: 'safe',
    },
  },
  {
    name: 'Ashwagandha',
    aliases: ['ashwagandha', 'withania somnifera'],
    reason: 'Reliable pregnancy and nursing safety data is limited, so avoidance is advised.',
    source: 'National Center for Complementary and Integrative Health',
    sourceUrl: 'https://www.nccih.nih.gov/health/ashwagandha',
    verdicts: {
      trying: 'caution',
      'trimester-1': 'avoid',
      'trimester-2': 'avoid',
      'trimester-3': 'avoid',
      nursing: 'caution',
    },
  },
  {
    name: 'Folic acid',
    aliases: ['folic acid', 'folate'],
    reason: 'Recommended before and during pregnancy to help prevent neural tube defects.',
    source: 'Centers for Disease Control and Prevention',
    sourceUrl: 'https://www.cdc.gov/folic-acid/about/index.html',
    verdicts: {
      trying: 'safe',
      'trimester-1': 'safe',
      'trimester-2': 'safe',
      'trimester-3': 'safe',
      nursing: 'safe',
    },
  },
  {
    name: 'Niacinamide',
    aliases: ['niacinamide', 'nicotinamide'],
    reason: 'Standard topical use is not commonly restricted during pregnancy or nursing.',
    source: 'American Academy of Dermatology',
    sourceUrl: 'https://www.aad.org/public/diseases/acne/derm-treat/pregnancy',
    verdicts: {
      trying: 'safe',
      'trimester-1': 'safe',
      'trimester-2': 'safe',
      'trimester-3': 'safe',
      nursing: 'safe',
    },
  },
  {
    name: 'Glycerin',
    aliases: ['glycerin', 'glycerol'],
    reason: 'A common moisturizing ingredient without a known stage-specific restriction.',
    source: 'Cosmetic Ingredient Review',
    sourceUrl: 'https://www.cir-safety.org/ingredients',
    verdicts: {
      trying: 'safe',
      'trimester-1': 'safe',
      'trimester-2': 'safe',
      'trimester-3': 'safe',
      nursing: 'safe',
    },
  },
  {
    name: 'Caffeine',
    aliases: ['caffeine'],
    reason: 'ACOG recommends keeping total caffeine intake below 200 mg per day during pregnancy.',
    source: 'American College of Obstetricians and Gynecologists',
    sourceUrl: 'https://www.acog.org/womens-health/infographics/reducing-caffeine-intake-during-pregnancy',
    verdicts: {
      trying: 'caution',
      'trimester-1': 'caution',
      'trimester-2': 'caution',
      'trimester-3': 'caution',
      nursing: 'caution',
    },
  },
  {
    name: 'Aspartame',
    aliases: ['aspartame'],
    reason: 'Approved sweetener at typical intake levels; people with PKU need to avoid phenylalanine.',
    source: 'U.S. Food & Drug Administration',
    sourceUrl: 'https://www.fda.gov/food/food-additives-petitions/aspartame-and-other-sweeteners-food',
    verdicts: {
      trying: 'safe',
      'trimester-1': 'safe',
      'trimester-2': 'safe',
      'trimester-3': 'safe',
      nursing: 'safe',
    },
  },
  {
    name: 'Carbonated water',
    aliases: ['carbonated water', 'sparkling water'],
    reason: 'Plain carbonated water has no known pregnancy- or nursing-specific restriction.',
    source: 'U.S. Department of Agriculture',
    sourceUrl: 'https://www.myplate.gov/eat-healthy/water',
    verdicts: {
      trying: 'safe',
      'trimester-1': 'safe',
      'trimester-2': 'safe',
      'trimester-3': 'safe',
      nursing: 'safe',
    },
  },
]

const products: Product[] = [
  {
    id: 'retinol',
    brand: 'Glow Theory',
    name: 'Renewal Night Serum',
    category: 'Skincare',
    ingredients: ['Water', 'Glycerin', 'Retinol', 'Niacinamide'],
  },
  {
    id: 'cleanser',
    brand: 'Moon Dew',
    name: 'Clarifying BHA Cleanser',
    category: 'Skincare',
    ingredients: ['Water', 'Glycerin', 'Salicylic acid'],
  },
  {
    id: 'advil',
    brand: 'Advil',
    name: 'Ibuprofen 200 mg',
    category: 'Medication',
    ingredients: ['Ibuprofen'],
    barcode: '305730150201',
  },
  {
    id: 'tylenol',
    brand: 'Tylenol',
    name: 'Extra Strength Pain Relief',
    category: 'Medication',
    ingredients: ['Acetaminophen'],
    barcode: '300450449026',
  },
  {
    id: 'prenatal',
    brand: 'NestWell',
    name: 'Complete Prenatal',
    category: 'Supplement',
    ingredients: ['Folic acid'],
    barcode: '818760020263',
  },
  {
    id: 'calm',
    brand: 'Botanical Ease',
    name: 'Stress Support Gummies',
    category: 'Supplement',
    ingredients: ['Ashwagandha'],
  },
]

const rank: Record<Severity, number> = { safe: 0, unknown: 1, caution: 2, avoid: 3 }
const verdictLabel: Record<Severity, string> = {
  safe: 'Looks good',
  caution: 'Use with care',
  avoid: 'Best to avoid',
  unknown: 'Not enough data',
}
const verdictCopy: Record<Severity, string> = {
  safe: 'No stage-specific concerns found in the ingredients we reviewed.',
  caution: 'One or more ingredients may depend on dose, format, or how often you use it.',
  avoid: 'We found an ingredient that experts generally recommend avoiding at this stage.',
  unknown: 'We could not review enough of this product to give you a confident answer yet.',
}
const sproutCopy: Record<Severity, string> = {
  safe: "This one's good.",
  caution: "Let's take a closer look.",
  avoid: "Let's skip this one.",
  unknown: "Let's see what we know.",
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9\s-]/g, '').trim()
}

function findRule(ingredient: string) {
  const value = normalize(ingredient)
  return rules.find((rule) => rule.aliases.some((alias) => value.includes(normalize(alias))))
}

function evaluate(product: Product, stage: StageId): Result {
  const matches = product.ingredients.flatMap((ingredient) => {
    const rule = findRule(ingredient)
    return rule ? [{ ingredient, rule, severity: rule.verdicts[stage] }] : []
  })
  const unknownIngredients = product.ingredients.filter((ingredient) => !findRule(ingredient))
  const matchedSeverity = matches.reduce<Severity>(
    (current, item) => (rank[item.severity] > rank[current] ? item.severity : current),
    'safe',
  )
  const severity = matches.length === 0 ? 'unknown' : matchedSeverity
  return {
    id: `${product.id}-${stage}-${Date.now()}`,
    product,
    stage,
    severity,
    matches,
    unknownIngredients,
    createdAt: Date.now(),
  }
}

type OpenFoodFactsResponse = {
  status: number
  product?: {
    code?: string
    product_name?: string
    brands?: string
    categories?: string
    ingredients_text?: string
  }
}

async function fetchProductByBarcode(code: string): Promise<Product | null> {
  const normalizedCode = code.replace(/\D/g, '')
  if (!normalizedCode) return null

  const fields = 'code,product_name,brands,categories,ingredients_text'
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${normalizedCode}.json?fields=${fields}`,
  )
  if (!response.ok) throw new Error('Product database is unavailable')

  const payload = (await response.json()) as OpenFoodFactsResponse
  const product = payload.product
  if (payload.status !== 1 || !product?.product_name) return null

  const ingredients = (product.ingredients_text ?? '')
    .split(',')
    .map((item) => item.replace(/[_*]/g, '').trim())
    .filter(Boolean)

  if (!ingredients.length) return null

  return {
    id: `off-${product.code ?? normalizedCode}`,
    brand: product.brands?.split(',')[0]?.trim() || 'Unknown brand',
    name: product.product_name,
    category: product.categories?.split(',')[0]?.trim() || 'Food & drink',
    ingredients,
    barcode: product.code ?? normalizedCode,
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [previousScreen, setPreviousScreen] = useState<Screen>('home')
  const [stage, setStage] = useState<StageId>('trimester-1')
  const [stageOpen, setStageOpen] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [history, setHistory] = useState<Result[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('expecta-history') || '[]') as Result[]
    } catch {
      return []
    }
  })
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('expecta-favorites') || '[]') as string[]
    } catch {
      return []
    }
  })
  const [tab, setTab] = useState<Tab>('history')
  const [manualName, setManualName] = useState('')
  const [manualIngredients, setManualIngredients] = useState('')
  const [barcode, setBarcode] = useState('')
  const [requestSent, setRequestSent] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const scannedCodeRef = useRef('')
  const lookupBarcodeRef = useRef<(code: string) => void>(() => undefined)

  const activeStage = useMemo(
    () => stages.find((item) => item.id === stage) ?? stages[1],
    [stage],
  )
  const isFavorite = result ? favorites.includes(result.product.id) : false

  useEffect(() => {
    localStorage.setItem('expecta-history', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    localStorage.setItem('expecta-favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    if (screen !== 'scanner' || !videoRef.current) return
    const reader = new BrowserMultiFormatReader()
    scannedCodeRef.current = ''
    setCameraError('')

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (scanResult) => {
        if (!scanResult) return
        const code = scanResult.getText()
        if (code === scannedCodeRef.current) return
        scannedCodeRef.current = code
        setBarcode(code)
        lookupBarcodeRef.current(code)
      })
      .then((controls) => {
        scannerControlsRef.current = controls
      })
      .catch(() => {
        setCameraError('Camera scanning is unavailable. Enter the barcode below instead.')
      })

    return () => {
      scannerControlsRef.current?.stop()
      scannerControlsRef.current = null
    }
  }, [screen])

  const openScreen = (next: Screen) => {
    setPreviousScreen(screen)
    setScreen(next)
    setStageOpen(false)
  }

  const showResult = (product: Product) => {
    const next = evaluate(product, stage)
    setResult(next)
    setHistory((items) => [next, ...items.filter((item) => item.product.id !== product.id)].slice(0, 20))
    setScreen('result')
  }

  const lookupBarcode = async (value = barcode) => {
    const cleanCode = value.replace(/\D/g, '')
    if (!cleanCode || isLookingUp) return
    setIsLookingUp(true)
    setLookupError('')

    try {
      const localProduct = products.find((product) => product.barcode === cleanCode)
      const liveProduct = localProduct ?? (await fetchProductByBarcode(cleanCode))
      if (liveProduct) {
        showResult(liveProduct)
        return
      }
      setRequestSent(false)
      setScreen('no-data')
    } catch {
      scannedCodeRef.current = ''
      setLookupError('We could not reach the product database. Check your connection and try again.')
    } finally {
      setIsLookingUp(false)
    }
  }
  lookupBarcodeRef.current = (code: string) => {
    void lookupBarcode(code)
  }

  const analyzeLabel = () => {
    const ingredients = manualIngredients
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (!ingredients.length) return
    showResult({
      id: `custom-${Date.now()}`,
      brand: 'Label scan',
      name: manualName.trim() || 'Custom product',
      category: 'Custom',
      ingredients,
    })
  }

  const openSavedResult = (item: Result) => {
    setStage(item.stage)
    setResult(item)
    setScreen('result')
  }

  const toggleFavorite = () => {
    if (!result) return
    setFavorites((items) =>
      items.includes(result.product.id)
        ? items.filter((id) => id !== result.product.id)
        : [...items, result.product.id],
    )
  }

  const back = () => {
    if (screen === 'result' || screen === 'no-data') setScreen(previousScreen)
    else setScreen('home')
  }

  const renderStagePicker = () =>
    stageOpen && (
      <div className="sheet-backdrop" role="presentation" onClick={() => setStageOpen(false)}>
        <section className="stage-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-title">
            <div>
              <span className="overline">Your current stage</span>
              <h2>Personalize your checks</h2>
            </div>
            <button className="icon-button" onClick={() => setStageOpen(false)} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="stage-list">
            {stages.map((item) => (
              <button
                key={item.id}
                className={item.id === stage ? 'stage-option selected' : 'stage-option'}
                onClick={() => {
                  setStage(item.id)
                  setStageOpen(false)
                  if (result) setResult(evaluate(result.product, item.id))
                }}
              >
                <span className="stage-dot" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    )

  const renderHome = () => (
    <>
      <header className="home-header">
        <div className="brand-mark"><Leaf size={20} /><span>expecta</span></div>
        <button className="avatar" aria-label="Profile">AM</button>
      </header>
      <section className="welcome">
        <span className="overline">Good evening, Anna</span>
        <h1>What can we check together?</h1>
        <p>Clear, research-backed guidance for the products you use every day.</p>
      </section>
      <button className="scan-card" onClick={() => openScreen('scanner')}>
        <span className="scan-orbit"><ScanLine size={32} /></span>
        <span className="scan-copy">
          <strong>Scan a product</strong>
          <small>Point your camera at a barcode</small>
        </span>
        <ChevronRight size={22} />
      </button>
      <div className="secondary-actions">
        <button onClick={() => fileRef.current?.click()}>
          <span><ImagePlus size={21} /></span>
          <strong>Upload label</strong>
          <small>Photo or screenshot</small>
        </button>
        <button onClick={() => openScreen('label')}>
          <span><Keyboard size={21} /></span>
          <strong>Enter ingredients</strong>
          <small>Paste a label</small>
        </button>
      </div>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={() => openScreen('label')}
      />
      <section className="section-block">
        <div className="section-heading">
          <div><span className="overline">Try the demo</span><h2>Popular checks</h2></div>
          <span className="count">{products.length}</span>
        </div>
        <div className="quick-list">
          {products.slice(0, 4).map((product) => (
            <button key={product.id} onClick={() => showResult(product)}>
              <span className={`product-icon ${product.category.toLowerCase()}`}>{product.name.charAt(0)}</span>
              <span><strong>{product.name}</strong><small>{product.brand} · {product.category}</small></span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </section>
      <aside className="trust-note">
        <BookOpen size={20} />
        <p><strong>Built for clarity, not diagnosis.</strong> Expecta explains the evidence and shows where it came from.</p>
      </aside>
    </>
  )

  const renderScanner = () => (
    <section className="scanner-screen">
      <div className="screen-header transparent">
        <button className="icon-button glass" onClick={back} aria-label="Back"><ArrowLeft size={21} /></button>
        <span>Scan barcode</span>
        <button className="icon-button glass" onClick={() => fileRef.current?.click()} aria-label="Upload"><ImagePlus size={20} /></button>
      </div>
      <div className="camera-view">
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="camera-fallback"><Camera size={44} /><span>{cameraError || 'Allow camera access to scan a barcode'}</span></div>
        <div className="scan-frame"><i /><i /><i /><i /><span /></div>
      </div>
      <div className="scanner-copy">
        <Sprout mode="scanning" stage={stage} size={54} />
        <strong>{isLookingUp ? 'Looking up product…' : 'Center the barcode in the frame'}</strong>
        <p>Live product data is provided by Open Food Facts.</p>
      </div>
      <div className="barcode-entry">
        <input
          inputMode="numeric"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          placeholder="Or enter a barcode"
          onKeyDown={(event) => event.key === 'Enter' && void lookupBarcode()}
        />
        <button disabled={isLookingUp} onClick={() => void lookupBarcode()}>
          <Search size={18} /> {isLookingUp ? 'Finding' : 'Check'}
        </button>
      </div>
      {lookupError && <p className="lookup-error">{lookupError}</p>}
      <div className="demo-barcodes">
        <span>Demo barcodes</span>
        <button onClick={() => { setBarcode('049000042559'); void lookupBarcode('049000042559') }}>
          Coke Zero · live
        </button>
        {products.filter((item) => item.barcode).map((product) => (
          <button key={product.id} onClick={() => { setBarcode(product.barcode ?? ''); showResult(product) }}>
            {product.name}
          </button>
        ))}
      </div>
    </section>
  )

  const renderLabel = () => (
    <>
      <div className="screen-header">
        <button className="icon-button" onClick={back} aria-label="Back"><ArrowLeft size={21} /></button>
        <span>Check a label</span>
        <span className="header-spacer" />
      </div>
      <section className="form-intro">
        <span className="illustration"><Sparkles size={26} /></span>
        <h1>What’s on the label?</h1>
        <p>Paste the ingredient list below. We’ll separate what needs attention from the full list.</p>
      </section>
      <div className="label-form">
        <label>Product name <span>optional</span>
          <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="e.g. Night renewal serum" />
        </label>
        <label>Ingredients
          <textarea
            value={manualIngredients}
            onChange={(event) => setManualIngredients(event.target.value)}
            placeholder="Water, glycerin, retinol, niacinamide..."
            rows={8}
          />
        </label>
        <button className="primary-button" disabled={!manualIngredients.trim()} onClick={analyzeLabel}>
          <Sparkles size={18} /> Check ingredients
        </button>
        <button className="text-button" onClick={() => setManualIngredients('Water, glycerin, retinol, niacinamide')}>
          Fill with a demo label
        </button>
      </div>
    </>
  )

  const renderResult = () => {
    if (!result) return null
    const flagged = result.matches.filter((item) => item.severity === 'avoid' || item.severity === 'caution')
    return (
      <>
        <div className="screen-header">
          <button className="icon-button" onClick={back} aria-label="Back"><ArrowLeft size={21} /></button>
          <span>Product check</span>
          <button className={isFavorite ? 'icon-button favorite' : 'icon-button'} onClick={toggleFavorite} aria-label="Favorite">
            <Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <section className={`verdict-hero ${result.severity}`}>
          <Sprout
            mode={result.severity === 'safe' ? 'clear' : result.severity === 'avoid' ? 'skip' : 'thinking'}
            stage={result.stage}
            size={78}
          />
          <span className="overline">{result.product.category} · checked now</span>
          <h1>{sproutCopy[result.severity]}</h1>
          <p>{verdictCopy[result.severity]}</p>
        </section>
        <section className="product-summary">
          <span className={`product-icon ${result.product.category.toLowerCase()}`}>{result.product.name.charAt(0)}</span>
          <div><strong>{result.product.name}</strong><small>{result.product.brand}</small></div>
          <span className="ingredient-count">{result.product.ingredients.length} ingredients</span>
        </section>
        {flagged.length > 0 && (
          <section className="detail-section">
            <div className="section-heading">
              <div><span className="overline">Here’s why</span><h2>Ingredients to notice</h2></div>
              <span className="count flagged">{flagged.length}</span>
            </div>
            <div className="flagged-list">
              {flagged.map((item) => (
                <article key={item.rule.name} className={item.severity}>
                  <div className="flagged-head">
                    <strong>{item.rule.name}</strong>
                    <span>{item.severity === 'avoid' ? 'Avoid' : 'Use with care'}</span>
                  </div>
                  <p>{item.rule.reason}</p>
                  <a href={item.rule.sourceUrl} target="_blank" rel="noreferrer">
                    <BookOpen size={14} /> {item.rule.source} <ChevronRight size={14} />
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="detail-section">
          <div className="section-heading">
            <div><span className="overline">Transparency</span><h2>Full ingredient list</h2></div>
            <span className="count">{result.product.ingredients.length}</span>
          </div>
          <div className="full-list">
            {result.product.ingredients.map((ingredient) => {
              const match = result.matches.find((item) => item.ingredient === ingredient)
              return (
                <div key={ingredient}>
                  <span className={`ingredient-dot ${match?.severity ?? 'unknown'}`} />
                  <span>{ingredient}</span>
                  <small>{match ? verdictLabel[match.severity] : 'Not yet reviewed'}</small>
                </div>
              )
            })}
          </div>
        </section>
        <aside className="medical-note"><Info size={18} /><p>This is educational guidance, not medical advice. For medicines or symptoms, check with your care team.</p></aside>
      </>
    )
  }

  const renderNoData = () => (
    <>
      <div className="screen-header">
        <button className="icon-button" onClick={back} aria-label="Back"><ArrowLeft size={21} /></button>
        <span>Product lookup</span><span className="header-spacer" />
      </div>
      <section className="no-data">
        <Sprout mode="thinking" stage={stage} size={140} />
        <h1>We don’t know this one yet</h1>
        <p>That doesn’t mean it’s unsafe. It only means this barcode isn’t in our demo database yet.</p>
        <div className="unknown-code">{barcode || 'Unknown product'}</div>
        {requestSent ? (
          <div className="request-success"><Sparkles size={20} /><div><strong>Request received</strong><p>We’ll prioritize products people scan most.</p></div></div>
        ) : (
          <button className="primary-button" onClick={() => setRequestSent(true)}><Send size={18} /> Request this product</button>
        )}
        <button className="secondary-button" onClick={() => setScreen('label')}><Keyboard size={18} /> Check ingredients manually</button>
      </section>
    </>
  )

  const renderLibrary = () => {
    const items = tab === 'history' ? history : history.filter((item) => favorites.includes(item.product.id))
    return (
      <>
        <header className="library-header"><div><span className="overline">Your library</span><h1>Saved checks</h1></div></header>
        <div className="tabs">
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><Clock3 size={17} /> History</button>
          <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}><Heart size={17} /> Favorites</button>
        </div>
        <div className="library-list">
          {items.length ? items.map((item) => (
            <button key={item.id} onClick={() => openSavedResult(item)}>
              <span className={`status-bar ${item.severity}`} />
              <span className={`product-icon ${item.product.category.toLowerCase()}`}>{item.product.name.charAt(0)}</span>
              <span><strong>{item.product.name}</strong><small>{stages.find((stageItem) => stageItem.id === item.stage)?.short} · {verdictLabel[item.severity]}</small></span>
              <ChevronRight size={18} />
            </button>
          )) : (
            <section className="library-empty"><Sprout mode="empty" stage={stage} size={112} /><h2>Nothing saved yet</h2><p>Tap the heart on any result to keep it close.</p></section>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="page-shell">
      <main className="phone-app">
        {screen !== 'scanner' && (
          <button className="context-bar" onClick={() => setStageOpen(true)}>
            <span className="context-icon"><Sprout mode="clear" stage={stage} size={30} /></span>
            <span><small>Checking for</small><strong>{activeStage.short}</strong></span>
            <ChevronDown size={16} />
          </button>
        )}
        <div className={screen === 'scanner' ? 'screen-content flush' : 'screen-content'}>
          {screen === 'home' && renderHome()}
          {screen === 'scanner' && renderScanner()}
          {screen === 'label' && renderLabel()}
          {screen === 'result' && renderResult()}
          {screen === 'no-data' && renderNoData()}
          {screen === 'library' && renderLibrary()}
        </div>
        {screen !== 'scanner' && screen !== 'label' && screen !== 'no-data' && (
          <nav className="bottom-nav">
            <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}><Home size={20} /><span>Home</span></button>
            <button className="scan-nav" onClick={() => openScreen('scanner')}><ScanLine size={25} /></button>
            <button className={screen === 'library' ? 'active' : ''} onClick={() => setScreen('library')}><Clock3 size={20} /><span>Saved</span></button>
          </nav>
        )}
        {renderStagePicker()}
      </main>
      <aside className="demo-side">
        <span className="brand-mark"><Leaf size={21} /> expecta</span>
        <h2>Confidence at the shelf.</h2>
        <p>A stage-aware product safety companion for pregnancy and nursing.</p>
        <div><span>Demo tip</span><p>Try the retinol serum, then switch the stage to Nursing from the persistent context bar.</p></div>
      </aside>
    </div>
  )
}

export default App
