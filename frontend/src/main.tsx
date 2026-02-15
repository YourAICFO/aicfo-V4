import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

// 🔍 Backend health check
fetch("https://web-production-be25.up.railway.app/health")
  .then(res => res.json())
  .then(data => {
    console.log("HEALTH CHECK RESPONSE:", data);
  })
  .catch(err => {
    console.error("HEALTH CHECK ERROR:", err);
  });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

// 🔧 Env debug
console.log("VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);
console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
