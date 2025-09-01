import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './i18n'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
)
