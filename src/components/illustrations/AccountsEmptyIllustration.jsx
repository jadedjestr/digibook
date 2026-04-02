const AccountsEmptyIllustration = () => (
  <svg
    width='96'
    height='88'
    viewBox='0 0 88 80'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <defs>
      <radialGradient id='coinGrad' cx='42%' cy='35%' r='60%'>
        <stop offset='0%' stopColor='rgba(147,197,253,0.5)' />
        <stop offset='100%' stopColor='rgba(59,130,246,0.12)' />
      </radialGradient>
    </defs>
    <ellipse cx='44' cy='64' rx='22' ry='5' fill='rgba(59,130,246,0.08)' />
    <ellipse cx='44' cy='63' rx='18' ry='3.5' fill='rgba(59,130,246,0.06)' />
    <circle
      cx='44'
      cy='36'
      r='22'
      fill='url(#coinGrad)'
      stroke='rgba(59,130,246,0.5)'
      strokeWidth='1'
    />
    <circle
      cx='44'
      cy='36'
      r='16'
      fill='rgba(59,130,246,0.08)'
      stroke='rgba(59,130,246,0.25)'
      strokeWidth='0.75'
    />
    <text
      x='44'
      y='41'
      textAnchor='middle'
      fontSize='14'
      fontWeight='600'
      fill='rgba(147,197,253,0.9)'
      fontFamily='system-ui'
    >
      $
    </text>
    <ellipse
      cx='44'
      cy='36'
      rx='22'
      ry='6'
      fill='none'
      stroke='rgba(59,130,246,0.15)'
      strokeWidth='0.75'
      strokeDasharray='3 4'
    />
    <circle cx='44' cy='14' r='2.5' fill='rgba(59,130,246,0.5)' />
    <circle cx='22' cy='36' r='2' fill='rgba(59,130,246,0.35)' />
    <circle cx='66' cy='36' r='2' fill='rgba(59,130,246,0.35)' />
    <circle cx='30' cy='17' r='1.5' fill='rgba(59,130,246,0.25)' />
    <circle cx='58' cy='17' r='1.5' fill='rgba(59,130,246,0.25)' />
  </svg>
);

export default AccountsEmptyIllustration;
