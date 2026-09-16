const LoansEmptyIllustration = () => (
  <svg
    width='96'
    height='88'
    viewBox='0 0 88 80'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <defs>
      <radialGradient id='landmarkGlow' cx='50%' cy='30%' r='70%'>
        <stop offset='0%' stopColor='rgba(129, 178, 214, 0.3)' />
        <stop offset='100%' stopColor='rgba(96, 148, 191, 0.05)' />
      </radialGradient>
    </defs>
    <circle
      cx='44'
      cy='40'
      r='30'
      fill='url(#landmarkGlow)'
      stroke='rgba(96, 148, 191, 0.3)'
      strokeWidth='1'
    />
    {/* Pediment */}
    <path
      d='M44 20 L62 32 H26 Z'
      fill='rgba(96, 148, 191, 0.15)'
      stroke='rgba(129, 178, 214, 0.45)'
      strokeWidth='1'
      strokeLinejoin='round'
    />
    {/* Columns */}
    <rect x='28' y='34' width='3' height='20' fill='rgba(129, 178, 214, 0.3)' />
    <rect x='36' y='34' width='3' height='20' fill='rgba(129, 178, 214, 0.3)' />
    <rect
      x='44.5'
      y='34'
      width='3'
      height='20'
      fill='rgba(129, 178, 214, 0.3)'
    />
    <rect x='53' y='34' width='3' height='20' fill='rgba(129, 178, 214, 0.3)' />
    <rect x='61' y='34' width='3' height='20' fill='rgba(129, 178, 214, 0.3)' />
    {/* Base */}
    <rect
      x='24'
      y='56'
      width='40'
      height='4'
      rx='1'
      fill='rgba(129, 178, 214, 0.35)'
      stroke='rgba(129, 178, 214, 0.45)'
      strokeWidth='0.75'
    />
    <circle cx='24' cy='18' r='2' fill='rgba(129, 178, 214, 0.3)' />
    <circle cx='64' cy='18' r='2' fill='rgba(129, 178, 214, 0.3)' />
  </svg>
);

export default LoansEmptyIllustration;
