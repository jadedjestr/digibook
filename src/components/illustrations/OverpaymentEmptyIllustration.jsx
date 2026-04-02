const OverpaymentEmptyIllustration = () => (
  <svg
    width='96'
    height='88'
    viewBox='0 0 80 72'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <defs>
      <radialGradient id='trophyGlow' cx='50%' cy='30%' r='65%'>
        <stop offset='0%' stopColor='rgba(147,197,253,0.3)' />
        <stop offset='100%' stopColor='rgba(59,130,246,0.05)' />
      </radialGradient>
    </defs>
    <path
      d='M28 12 L52 12 L52 36 Q52 50 40 56 Q28 50 28 36 Z'
      fill='url(#trophyGlow)'
      stroke='rgba(59,130,246,0.4)'
      strokeWidth='1'
      strokeLinejoin='round'
    />
    <path
      d='M52 20 Q62 20 62 30 Q62 38 52 40'
      fill='none'
      stroke='rgba(59,130,246,0.3)'
      strokeWidth='1'
      strokeLinecap='round'
    />
    <path
      d='M28 20 Q18 20 18 30 Q18 38 28 40'
      fill='none'
      stroke='rgba(59,130,246,0.3)'
      strokeWidth='1'
      strokeLinecap='round'
    />
    <path
      d='M35 33 L39 37 L46 27'
      stroke='#93c5fd'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <rect
      x='34'
      y='56'
      width='12'
      height='5'
      rx='2'
      fill='rgba(59,130,246,0.2)'
      stroke='rgba(59,130,246,0.35)'
      strokeWidth='0.75'
    />
    <rect
      x='28'
      y='61'
      width='24'
      height='4'
      rx='2'
      fill='rgba(59,130,246,0.25)'
      stroke='rgba(59,130,246,0.4)'
      strokeWidth='0.75'
    />
    <circle
      cx='40'
      cy='8'
      r='3'
      fill='rgba(59,130,246,0.2)'
      stroke='rgba(59,130,246,0.4)'
      strokeWidth='0.75'
    />
    <circle cx='30' cy='10' r='2' fill='rgba(59,130,246,0.15)' />
    <circle cx='50' cy='10' r='2' fill='rgba(59,130,246,0.15)' />
  </svg>
);

export default OverpaymentEmptyIllustration;
