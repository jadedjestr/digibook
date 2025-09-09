import React from 'react';

import { usePrivacy } from '../contexts/PrivacyContext';

const PrivacyWrapper = ({ children, fallback = '••••••' }) => {
  const { isHidden } = usePrivacy();

  if (isHidden) {
    return (
      <span className='privacy-hidden' title='Press Cmd+H to show values'>
        {fallback}
      </span>
    );
  }

  return <>{children}</>;
};

export default PrivacyWrapper;
