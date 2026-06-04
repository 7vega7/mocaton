import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import Home from './pages/Home';
import Stake from './pages/Stake';
import Referral from './pages/Referral';
import Leaderboard from './pages/Leaderboard';
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
        if (window.Telegram?.WebApp) { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); }
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        const initData = window.Telegram?.WebApp?.initData || '';
        if (tgUser) setUser(tgUser);
        if (initData) {
          try {
            const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData } });
            if (res.ok) { const d = await res.json(); if (d.is_admin) setIsAdmin(true); }
          } catch (e) { console.error(e); }
        }
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    setTimeout(init, 300);
  }, []);

  if (isLoading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0E1117', color:'#00B4D8', gap:'16px' }}>
      <div style={{ width:'40px', height:'40px', border:'3px solid #2A3447', borderTopColor:'#00B4D8', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <HashRouter>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/stake" element={<Stake user={user} />} />
            <Route path="/referral" element={<Referral user={user} />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            {isAdmin && <Route path="/admin" element={<Admin />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav isAdmin={isAdmin} />
        </div>
      </HashRouter>
    </TonConnectUIProvider>
  );
}
