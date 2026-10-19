import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initScreenOrientation } from '@/lib/screenOrientation'

if (typeof window !== 'undefined') {
  initScreenOrientation();

  // Register the service worker up front so browsers offer to install
  // MotoVeya as an app. Push notifications register the same worker.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)