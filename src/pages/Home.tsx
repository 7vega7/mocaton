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
  const [showWithdrawInfo, setShowWithdrawInfo] = useState(false);
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
        setLiveMct((lastFetchRef.current.total_mct || 0) + totalPerHour * elapsed);
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

        {/* Withdraw MCT Button */}
        <button
          onClick={() => setShowWithdrawInfo(true)}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            color: '#8892A4',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontFamily: 'inherit',
          }}
        >
          <span>💸 Withdraw $MCT</span>
          <span style={{
            fontSize: '10px',
            background: 'rgba(245,158,11,0.2)',
            color: '#F59E0B',
            padding: '2px 8px',
            borderRadius: '20px',
            fontWeight: '700',
            letterSpacing: '0.05em',
          }}>COMING SOON</span>
        </button>

        <div className="live-indicator" style={{ marginTop: '10px' }}>
          <span className="live-dot" /> Live
        </div>
      </div>

      {/* Coming Soon Modal */}
      {showWithdrawInfo && (
        <div
          onClick={() => setShowWithdrawInfo(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#161B26', border: '1px solid #2A3447',
              borderRadius: '20px', padding: '28px', maxWidth: '340px', width: '100%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
            <h3 style={{ fontSize: '20px', marginBottom: '8px', color: '#F0F4FF' }}>
              $MCT Withdrawal
            </h3>
            <p style={{ color: '#8892A4', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              $MCT token withdrawal is coming soon!<br /><br />
              Keep staking to accumulate your $MCT balance.
              When the token launches, you'll be able to withdraw directly to your TON wallet.
            </p>
            <div style={{
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '10px', padding: '12px', marginBottom: '20px',
            }}>
              <p style={{ color: '#F59E0B', fontSize: '13px', margin: 0 }}>
                💡 Your $MCT is being recorded and will be claimable at launch!
              </p>
            </div>
            <button
              onClick={() => setShowWithdrawInfo(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

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
