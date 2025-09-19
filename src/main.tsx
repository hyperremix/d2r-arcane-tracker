import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Suspense fallback={<img src="/logo.svg" alt="logo" />}>
      <App />
    </Suspense>
  </React.StrictMode>
)
