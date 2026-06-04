import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import Home from './pages/Home';
import Stake from './pages/Stake';
import Referral from './pages/Referral';
import Admin from './pages/Admin';
import BottomNav from './components/BottomNav';
import type { TelegramUser } from './types';
import './App.css';

const MANIFEST_URL = 'https://mocaton.pages.dev/tonconnect-manifest.json';

export default function App() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Init Telegram WebApp
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        }

        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        const initData = window.Telegram?.WebApp?.initData || '';

        if (tgUser) {
          setUser(tgUser);
        }

        // Register user — jika initData kosong tetap lanjut
        if (initData) {
          try {
            const res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData,
              },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.is_admin) setIsAdmin(true);
            }
          } catch (e) {
            console.error('Register error:', e);
          }
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        // Selalu selesai loading, tidak pernah stuck
        setIsLoading(false);
      }
    };

    // Tunggu sebentar agar Telegram SDK load
    setTimeout(init, 300);
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0E1117',
        color: '#00B4D8',
        fontFamily: 'sans-serif',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #2A3447',
          borderTopColor: '#00B4D8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: '#8892A4', margin: 0 }}>Memuat...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav isAdmin={isAdmin} />
        </div>
      </HashRouter>
    </TonConnectUIProvider>
  );
}
