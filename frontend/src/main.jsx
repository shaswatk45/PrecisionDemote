import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0d0d0d',
            color: '#ffffff',
            border: '1px solid #2a2a2a',
            borderRadius: '2px',
            fontFamily: 'Barlow, sans-serif',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 'bold',
          },
          success: { iconTheme: { primary: '#76b900', secondary: '#000000' } },
          error:   { iconTheme: { primary: '#f43f5e', secondary: '#000000' } },
        }}
      />
    </HashRouter>
  </React.StrictMode>
)
