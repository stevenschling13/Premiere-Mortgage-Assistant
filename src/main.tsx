import './polyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializeStorage } from './services/storageService';

const startApp = async () => {
  const storageStatus = await initializeStorage();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find root element to mount to');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App storageStatus={storageStatus} />
      </ErrorBoundary>
    </React.StrictMode>,
  );
};

void startApp();
