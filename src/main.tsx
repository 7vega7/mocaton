import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

window.onerror = (msg, src, line, col, err) => {
  const d = document.getElementById('debug');
  if (d) {
    (d as HTMLElement).style.display = 'block';
    (d as HTMLElement).textContent = `ERROR: ${msg}\n${src}:${line}\n${err?.stack || ''}`;
  }
  return false;
};

window.onunhandledrejection = (e) => {
  const d = document.getElementById('debug');
  if (d) {
    (d as HTMLElement).style.display = 'block';
    (d as HTMLElement).textContent = `PROMISE ERROR:\n${e.reason}`;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
