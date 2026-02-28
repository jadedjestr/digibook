import PropTypes from 'prop-types';

import { usePrivacy } from '../contexts/PrivacyContext';

const PrivacyWrapper = ({ children, fallback = '••••••' }) => {
  const { isHidden } = usePrivacy();

  if (isHidden) {
    return (
      <span className='privacy-hidden' title='Press Cmd+Shift+H to show values'>
        {fallback}
      </span>
    );
  }

  return <>{children}</>;
};

PrivacyWrapper.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.string,
};

export default PrivacyWrapper;
