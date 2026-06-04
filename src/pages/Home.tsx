import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { TelegramUser } from '../types';
import { getInitData } from '../lib/telegram';

interface HomeProps { user: TelegramUser | null; }

interface MCTData {
  stake_mct: number;
  referral_mct: number;
  total_mct: number;
  mct_per_hour: number;
  referral_mct_per_hour: number;
  referral_count: number;
  active_stakes: any[];
  calculated_at: string;
}

export default function Home({ user }: HomeProps) {
  const [data, setData] = useState<MCTData | null>(null);
  const [liveMct, setLiveMct] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef<MCTData | null>(null);
  const fetchTimeRef = useRef<number>(0);
  const animRef = useRef<number>();

  const fetchData = async () => {
    try {
      const res = await fetch('/api/points/balance', { headers: { 'X-Telegram-Init-Data': getInitData() } });
      const d: MCTData = await res.json();
      setData(d);
      lastFetchRef.current = d;
      fetchTimeRef.current = Date.now();
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, []);

  useEffect(() => {
    const tick = () => {
      if (lastFetchRef.current) {
        const elapsed = (Date.now() - fetchTimeRef.current) / 3600000;
        const totalPerHour = (lastFetchRef.current.mct_per_hour || 0) + (lastFetchRef.current.referral_mct_per_hour || 0);
        const estimated = (lastFetchRef.current.total_mct || 0) + totalPerHour * elapsed;
        setLiveMct(estimated);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [data]);

  const totalPerHour = (data?.mct_per_hour || 0) + (data?.referral_mct_per_hour || 0);
  const totalStaked = data?.active_stakes?.reduce((s, a) => s + a.amount_ton, 0) || 0;

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="home-page">
      <div className="page-header">
        <p className="greeting-sub">Welcome back,</p>
        <h1 className="greeting-name">{user?.first_name || 'User'} 👋</h1>
      </div>

      <div className="points-card main-card">
        <p className="card-label">Total $MCT Balance</p>
        <h2 className="points-display">{liveMct.toFixed(4)}</h2>
        <div className="points-breakdown">
          <div className="points-row"><span>💰 From Staking</span><span>{(data?.stake_mct || 0).toFixed(4)} MCT</span></div>
          <div className="points-row"><span>👥 From Referrals</span><span>{(data?.referral_mct || 0).toFixed(4)} MCT</span></div>
          <div className="points-row"><span>⚡ Earning Rate</span><span>{totalPerHour.toFixed(4)} MCT/hr</span></div>
        </div>
        <div className="live-indicator"><span className="live-dot" /> Live</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><span className="stat-icon">🪙</span><span className="stat-value">{totalStaked.toFixed(2)}</span><span className="stat-label">TON Staked</span></div>
        <div className="stat-card"><span className="stat-icon">📊</span><span className="stat-value">{data?.active_stakes?.length || 0}</span><span className="stat-label">Active Stakes</span></div>
        <div className="stat-card"><span className="stat-icon">👥</span><span className="stat-value">{data?.referral_count || 0}</span><span className="stat-label">Referrals</span></div>
      </div>

      {(data?.active_stakes?.length || 0) > 0 && (
        <div className="section">
          <h3 className="section-title">Active Stakes</h3>
          <div className="stakes-list">
            {data?.active_stakes?.map(stake => (
              <div key={stake.id} className={`stake-item ${stake.status === 'withdraw_pending' ? 'stake-pending' : ''}`}>
                <div className="stake-info">
                  <div className="stake-amount">{stake.amount_ton} TON</div>
                  <div className="stake-lock">{stake.lock_type} · {stake.amount_ton} MCT/hr</div>
                  {stake.status === 'withdraw_pending' && <div className="stake-status-badge">⏳ Withdraw Pending</div>}
                </div>
                <div className="stake-points">
                  <div className="stake-points-value">{(stake.mct_earned || 0).toFixed(4)}</div>
                  <div className="stake-points-label">MCT earned</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="quick-actions">
        <Link to="/stake" className="action-btn primary">🪙 Stake TON</Link>
        <Link to="/referral" className="action-btn secondary">👥 Referral</Link>
      </div>
    </div>
  );
}
