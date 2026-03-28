import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { flushPendingQueue } from './api/supabase.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

// Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW Registered:', reg.scope);
      if (reg.sync) {
        navigator.serviceWorker.ready.then(swRegistration => {
          return swRegistration.sync.register('sync-meals');
        }).catch(err => console.log('Sync registration failed:', err));
      }
    });
  });
}

// オンライン復帰時に未送信キューを自動フラッシュ
window.addEventListener('online', () => {
  flushPendingQueue().catch(() => {});
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
