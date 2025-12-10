import './polyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = (() => {
  const existing = document.getElementById('root');
  if (existing) return existing;

  // Ensure we always have a mount point, even in unconventional host shells
  const created = document.createElement('div');
  created.id = 'root';
  document.body.appendChild(created);
  return created;
})();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);