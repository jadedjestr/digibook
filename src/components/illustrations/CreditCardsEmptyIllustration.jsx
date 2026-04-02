const CreditCardsEmptyIllustration = () => (
  <svg
    width='96'
    height='88'
    viewBox='0 0 88 80'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <defs>
      <radialGradient id='shieldGlow' cx='50%' cy='30%' r='70%'>
        <stop offset='0%' stopColor='rgba(147,197,253,0.3)' />
        <stop offset='100%' stopColor='rgba(59,130,246,0.05)' />
      </radialGradient>
    </defs>
    <path
      d='M44 10 L66 20 L66 42 Q66 58 44 68 Q22 58 22 42 L22 20 Z'
      fill='url(#shieldGlow)'
      stroke='rgba(59,130,246,0.45)'
      strokeWidth='1'
      strokeLinejoin='round'
    />
    <path
      d='M44 16 L60 24 L60 42 Q60 54 44 62 Q28 54 28 42 L28 24 Z'
      fill='rgba(59,130,246,0.1)'
      stroke='rgba(59,130,246,0.25)'
      strokeWidth='0.75'
      strokeLinejoin='round'
    />
    <circle
      cx='44'
      cy='38'
      r='10'
      fill='rgba(59,130,246,0.15)'
      stroke='rgba(59,130,246,0.35)'
      strokeWidth='0.75'
    />
    <path
      d='M40 37 L43 41 L49 33'
      stroke='#93c5fd'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <circle cx='32' cy='16' r='2' fill='rgba(59,130,246,0.3)' />
    <circle cx='56' cy='16' r='2' fill='rgba(59,130,246,0.3)' />
    <circle cx='22' cy='28' r='1.5' fill='rgba(59,130,246,0.2)' />
    <circle cx='66' cy='28' r='1.5' fill='rgba(59,130,246,0.2)' />
  </svg>
);

export default CreditCardsEmptyIllustration;
