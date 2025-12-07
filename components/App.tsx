import React from 'react';

// This file is deprecated and was causing application loading errors.
// The main application entry component is located at the root level in `App.tsx`.
const DeprecatedAppComponent: React.FC = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#777' }}>
      This component is deprecated. Please use the main App.tsx.
    </div>
  );
};

export default DeprecatedAppComponent;
