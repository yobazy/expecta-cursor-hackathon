type SproutMode = 'clear' | 'thinking' | 'skip' | 'scanning' | 'empty'
type SproutStage = 'trying' | 'trimester-1' | 'trimester-2' | 'trimester-3' | 'nursing'

type SproutProps = {
  mode?: SproutMode
  stage?: SproutStage
  size?: number
  className?: string
}

export function Sprout({
  mode = 'clear',
  stage = 'trimester-2',
  size = 80,
  className = '',
}: SproutProps) {
  const early = stage === 'trying' || stage === 'trimester-1'
  const late = stage === 'trimester-3' || stage === 'nursing'
  const thinking = mode === 'thinking'
  const protective = mode === 'skip'
  const scanning = mode === 'scanning'

  return (
    <svg
      className={`sprout sprout-${mode} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Sprout is ${mode === 'clear' ? 'relaxed' : mode === 'skip' ? 'protective' : 'thinking'}`}
    >
      <ellipse cx="60" cy="106" rx="25" ry="4" fill="#D9A5A0" opacity=".22" />
      <g className="sprout-character">
        <path
          d="M39 54C45 44 75 43 82 56C90 71 84 99 62 104C41 104 31 76 39 54Z"
          fill="#F4EDE4"
          stroke="#494248"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        <path
          d="M66 47C75 63 76 84 62 103"
          fill="none"
          stroke="#D98E73"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {!early && (
          <g className="sprout-leaves">
            <path
              d={protective ? 'M58 49C47 44 36 32 38 17C52 18 62 31 61 47Z' : 'M58 48C42 48 25 37 21 21C40 17 57 28 62 45Z'}
              fill="#8FA888"
              stroke="#494248"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d={protective ? 'M67 48C73 35 84 24 98 25C99 42 84 51 68 52Z' : thinking ? 'M66 47C72 29 84 15 99 12C101 32 85 46 68 51Z' : 'M66 47C78 34 94 29 108 35C101 51 83 56 68 51Z'}
              fill="#8FA888"
              stroke="#494248"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M59 46C50 36 40 29 29 25M68 49C80 42 90 38 101 37" fill="none" stroke="#5E6D5A" strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
          </g>
        )}
        {early && (
          <path
            d="M63 49C60 38 63 27 73 22C79 33 72 44 65 50Z"
            fill="#8FA888"
            stroke="#494248"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}
        {late && (
          <g>
            <path d="M64 46C65 36 65 29 68 22" fill="none" stroke="#5E6D5A" strokeWidth="2.5" strokeLinecap="round" />
            {stage === 'nursing' ? (
              <path d="M68 24C60 20 61 12 68 10C75 13 76 20 68 24Z" fill="#D9A5A0" stroke="#494248" strokeWidth="1.8" />
            ) : (
              <circle cx="68" cy="21" r="5" fill="#D98E73" stroke="#494248" strokeWidth="1.8" />
            )}
          </g>
        )}
        <circle cx="51" cy="72" r="2.7" fill="#494248" />
        <circle cx="70" cy="72" r="2.7" fill="#494248" />
        <path
          d={mode === 'clear' || mode === 'empty' ? 'M55 80C59 84 64 84 68 80' : 'M57 80C60 81 63 81 66 80'}
          fill="none"
          stroke="#494248"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {scanning && (
          <g className="sprout-magnifier">
            <circle cx="30" cy="66" r="11" fill="none" stroke="#494248" strokeWidth="3" />
            <path d="M38 74L45 82" stroke="#494248" strokeWidth="4" strokeLinecap="round" />
            <path d="M43 84C38 82 35 78 36 74" fill="none" stroke="#8FA888" strokeWidth="5" strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  )
}
