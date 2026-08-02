import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DisclaimerGate } from './components/DisclaimerGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DisclaimerGate>
      <App />
    </DisclaimerGate>
  </StrictMode>,
)
