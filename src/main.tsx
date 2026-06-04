import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// Global error handler
window.onerror = (msg, src, line, col, err) => {
  document.body.innerHTML = `
    <div style="color:white;padding:20px;font-family:monospace;background:#0E1117;min-height:100vh">
      <h3 style="color:#ef4444">JS Error</h3>
      <p>${msg}</p>
      <p>${src}:${line}:${col}</p>
      <pre style="font-size:11px;color:#888">${err?.stack || ''}</pre>
    </div>
  `;
};

window.onunhandledrejection = (e) => {
  document.body.innerHTML = `
    <div style="color:white;padding:20px;font-family:monospace;background:#0E1117;min-height:100vh">
      <h3 style="color:#ef4444">Unhandled Promise</h3>
      <pre style="font-size:11px;color:#888">${e.reason}</pre>
    </div>
  `;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
