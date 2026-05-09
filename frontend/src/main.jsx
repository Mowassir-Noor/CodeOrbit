import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

import LandingPage from './landing/LandingPage.jsx'

import { BrowserRouter } from 'react-router-dom'

const appRoot = document.getElementById('app-root');
if (appRoot) {
  ReactDOM.createRoot(appRoot).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

const landingRoot = document.getElementById('landing-react-root');
if (landingRoot) {
  ReactDOM.createRoot(landingRoot).render(
    <React.StrictMode>
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    </React.StrictMode>,
  )
}
