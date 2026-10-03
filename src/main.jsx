import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { loadScript as preloadGoogleMaps } from '@/lib/googleMapsLoader'
import '@/index.css'
import { initScreenOrientation } from '@/lib/screenOrientation'

if (typeof window !== 'undefined') {
  preloadGoogleMaps().catch(() => {});
  initScreenOrientation();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
