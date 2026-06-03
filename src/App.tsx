// src/App.tsx
import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import Home from './pages/Home';
import Stake from './pages/Stake';
import Referral from './pages/Referral';
import Admin from './pages/Admin';
import BottomNav from './components/BottomNav';
import { initTelegramApp, getTelegramUser } from './lib/telegram';
import type { TelegramUser } from './types';
import './App.css';

// TON Connect manifest URL
const MANIFEST_URL = 'https://YOUR_DOMAIN.pages.dev/tonconnect-manifest.json';

export default function App() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Init Telegram Web App
      initTelegramApp();

      const tgUser = getTelegramUser();
      if (tgUser) {
        setUser(tgUser);

        // Daftarkan user ke backend jika belum ada
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
            },
          });
          const data = await res.json();
          if (data.is_admin) setIsAdmin(true);
        } catch (err) {
          console.error('Registration error:', err);
        }
      }
      setIsLoading(false);
    };

    init();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Memuat...</p>
      </div>
    );
  }

  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <HashRouter>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/stake" element={<Stake user={user} />} />
            <Route path="/referral" element={<Referral user={user} />} />
            {isAdmin && <Route path="/admin" element={<Admin />} />}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <BottomNav isAdmin={isAdmin} />
        </div>
      </HashRouter>
    </TonConnectUIProvider>
  );
}
