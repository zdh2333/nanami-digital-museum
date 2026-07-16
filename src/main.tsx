import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { LocaleProvider } from './i18n/LocaleProvider'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
