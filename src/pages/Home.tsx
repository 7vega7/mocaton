// src/pages/Home.tsx
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { TelegramUser, PointsData } from '../types';
import { formatPoints, formatTON } from '../lib/utils';
import { getInitData } from '../lib/telegram';

interface HomeProps {
  user: TelegramUser | null;
}

export default function Home({ user }: HomeProps) {
  const [points, setPoints] = useState<PointsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [livePoints, setLivePoints] = useState(0);
  const animRef = useRef<number>();
  const lastFetchRef = useRef<PointsData | null>(null);
  const fetchTimeRef = useRef<number>(0);

  // Fetch poin dari API
  const fetchPoints = async () => {
    try {
      const res = await fetch('/api/points/balance', {
        headers: { 'X-Telegram-Init-Data': getInitData() },
      });
      const data: PointsData = await res.json();
      setPoints(data);
      lastFetchRef.current = data;
      fetchTimeRef.current = Date.now();
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch points:', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
    // Refresh setiap 30 detik
    const interval = setInterval(fetchPoints, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time interpolation — update poin setiap detik
  useEffect(() => {
    const tick = () => {
      if (lastFetchRef.current) {
        const elapsed = (Date.now() - fetchTimeRef.current) / 1000; // detik
        const stakes = lastFetchRef.current.active_stakes || [];

        // Tambahkan poin yang dihasilkan sejak fetch terakhir
        let additionalPoints = 0;
        for (const stake of stakes) {
          additionalPoints += (stake.points_per_day / 86400) * elapsed;
          // 30% referral sudah dihitung di referral_points dari server
        }

        // Juga hitung tambahan referral (30% dari stake earned per detik)
        // Referral points di-update dari server, estimasi real-time sederhana
        const estimatedTotal = (lastFetchRef.current.total_points || 0) + additionalPoints;
        setLivePoints(Math.floor(estimatedTotal));
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [points]);

  if (isLoading) {
    return <div className="page-loading">Memuat dashboard...</div>;
  }

  const activeStakeCount = points?.active_stakes?.length || 0;
  const totalStakedTon = points?.active_stakes?.reduce((sum, s) => sum + s.amount_ton, 0) || 0;

  return (
    <div className="home-page">
      {/* Header */}
      <div className="page-header">
        <div className="greeting">
          <p className="greeting-sub">Selamat datang,</p>
          <h1 className="greeting-name">{user?.first_name || 'User'} 👋</h1>
        </div>
      </div>

      {/* Total Points Card */}
      <div className="points-card main-card">
        <p className="card-label">Total Poin Kamu</p>
        <h2 className="points-display">{livePoints.toLocaleString('id-ID')}</h2>
        <div className="points-breakdown">
          <div className="points-row">
            <span>💰 Dari Stake</span>
            <span>{formatPoints(points?.stake_points || 0)}</span>
          </div>
          <div className="points-row">
            <span>👥 Dari Referral</span>
            <span>{formatPoints(points?.referral_points || 0)}</span>
          </div>
        </div>
        <div className="live-indicator">
          <span className="live-dot" /> Live
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">🪙</span>
          <span className="stat-value">{formatTON(totalStakedTon)}</span>
          <span className="stat-label">TON Di-stake</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <span className="stat-value">{activeStakeCount}</span>
          <span className="stat-label">Stake Aktif</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <span className="stat-value">{points?.referral_count || 0}</span>
          <span className="stat-label">Referral</span>
        </div>
      </div>

      {/* Active Stakes */}
      {activeStakeCount > 0 && (
        <div className="section">
          <h3 className="section-title">Stake Aktif</h3>
          <div className="stakes-list">
            {points?.active_stakes?.map(stake => (
              <StakeItem key={stake.id} stake={stake} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/stake" className="action-btn primary">
          🪙 Stake TON
        </Link>
        <Link to="/referral" className="action-btn secondary">
          👥 Referral
        </Link>
      </div>
    </div>
  );
}

function StakeItem({ stake }: { stake: any }) {
  const lockLabel: Record<string, string> = {
    flexible: 'Flexible',
    weekly: '1 Minggu',
    monthly: '1 Bulan',
  };

  const rateLabel: Record<string, string> = {
    flexible: '100 poin/TON/hari',
    weekly: '120 poin/TON/hari',
    monthly: '160 poin/TON/hari',
  };

  const isWithdrawPending = stake.status === 'withdraw_pending';

  return (
    <div className={`stake-item ${isWithdrawPending ? 'stake-pending' : ''}`}>
      <div className="stake-info">
        <div className="stake-amount">{formatTON(stake.amount_ton)} TON</div>
        <div className="stake-lock">{lockLabel[stake.lock_type]} · {rateLabel[stake.lock_type]}</div>
        {isWithdrawPending && (
          <div className="stake-status-badge">⏳ Withdraw Pending</div>
        )}
      </div>
      <div className="stake-points">
        <div className="stake-points-value">{stake.points_earned?.toLocaleString('id-ID')}</div>
        <div className="stake-points-label">poin earned</div>
      </div>
    </div>
  );
}
