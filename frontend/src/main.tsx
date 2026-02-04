import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
fetch("https://web-production-be25.up.railway.app/")
  .then(res => res.json())
  .then(data => {
    console.log("BACKEND RESPONSE:", data);
  })
  .catch(err => {
    console.error("BACKEND ERROR:", err);
  });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
console.log("API URL:", import.meta.env.VITE_API_BASE_URL);
console.log('API URL:', import.meta.env.VITE_API_URL)


