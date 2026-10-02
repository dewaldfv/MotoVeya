import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { loadScript as preloadGoogleMaps } from '@/lib/googleMapsLoader'
import '@/index.css'

if (typeof window !== 'undefined') {
  preloadGoogleMaps().catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
