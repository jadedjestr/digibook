const PendingEmptyIllustration = () => (
  <svg
    width='96'
    height='88'
    viewBox='0 0 88 80'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <defs>
      <radialGradient id='sandGlow' cx='50%' cy='20%' r='60%'>
        <stop offset='0%' stopColor='rgba(147,197,253,0.25)' />
        <stop offset='100%' stopColor='rgba(59,130,246,0.0)' />
      </radialGradient>
    </defs>
    <path
      d='M28 10 L60 10 L60 14 Q60 16 56 18 L50 22 Q44 26 44 32 Q44 38 50 42 L56 46 Q60 48 60 50 L60 54 Q60 56 56 58 L44 70 L32 58 Q28 56 28 54 L28 50 Q28 48 32 46 L38 42 Q44 38 44 32 Q44 26 38 22 L32 18 Q28 16 28 14 Z'
      fill='url(#sandGlow)'
      stroke='rgba(59,130,246,0.4)'
      strokeWidth='1'
      strokeLinejoin='round'
    />
    <path
      d='M32 14 Q44 18 56 14'
      fill='none'
      stroke='rgba(59,130,246,0.5)'
      strokeWidth='0.75'
    />
    <path
      d='M32 50 Q44 46 56 50'
      fill='none'
      stroke='rgba(59,130,246,0.2)'
      strokeWidth='0.75'
    />
    <ellipse
      cx='44'
      cy='20'
      rx='10'
      ry='4'
      fill='rgba(59,130,246,0.25)'
      stroke='rgba(59,130,246,0.35)'
      strokeWidth='0.5'
    />
    <ellipse cx='44' cy='19' rx='7' ry='2.5' fill='rgba(147,197,253,0.2)' />
    <ellipse cx='44' cy='18.5' rx='4' ry='1.5' fill='rgba(147,197,253,0.35)' />
    <circle cx='44' cy='36' r='1.5' fill='rgba(59,130,246,0.4)' />
    <circle cx='44' cy='41' r='1' fill='rgba(59,130,246,0.25)' />
    <circle cx='44' cy='45' r='0.75' fill='rgba(59,130,246,0.15)' />
    <ellipse
      cx='44'
      cy='62'
      rx='6'
      ry='2'
      fill='rgba(59,130,246,0.06)'
      stroke='rgba(59,130,246,0.15)'
      strokeWidth='0.5'
    />
  </svg>
);

export default PendingEmptyIllustration;
