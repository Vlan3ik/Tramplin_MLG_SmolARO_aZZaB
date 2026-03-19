import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CityProvider } from './contexts/CityContext'
import './styles/main.scss'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CityProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CityProvider>
  </StrictMode>,
)
