import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initScreenOrientation } from '@/lib/screenOrientation'

if (typeof window !== 'undefined') {
  initScreenOrientation();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)