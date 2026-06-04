import { useEffect, useState } from 'react';

export default function Leaderboard() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/leaderboard/index');
        const d = await res.json();
        setData(d.leaderboard || []);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    fetch_();
    const i = setInterval(fetch_, 60000);
    return () => clearInterval(i);
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  if (isLoading) return <div className="page-loading">Loading leaderboard...</div>;

  return (
    <div className="referral-page">
      <h1 className="page-title">🏆 Leaderboard</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px', fontFamily: 'Orbitron, monospace', letterSpacing: '0.05em' }}>
        Top $MCT holders — stake + referral combined
      </p>

      <div className="stakes-list">
        {data.map((entry, i) => (
          <div key={i} className="stake-item" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: i < 3 ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--bg-card2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: i < 3 ? '18px' : '12px',
                fontFamily: 'Orbitron, monospace',
                fontWeight: '700',
                color: i < 3 ? '#000' : 'var(--text-muted)',
                flexShrink: 0,
                boxShadow: i < 3 ? '0 0 12px rgba(0,245,255,0.3)' : 'none',
              }}>
                {i < 3 ? medals[i] : `#${entry.rank}`}
              </div>
              <div>
                <div className="stake-amount" style={{ fontSize: '14px' }}>
                  {entry.full_name || entry.username || 'Anonymous'}
                </div>
                <div className="stake-lock">
                  Stake: {Number(entry.stake_mct).toFixed(4)} · Ref: {Number(entry.referral_mct).toFixed(4)}
                </div>
              </div>
            </div>
            <div className="stake-points">
              <div className="stake-points-value">{Number(entry.total_mct).toFixed(4)}</div>
              <div className="stake-points-label">$MCT</div>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div className="empty-state">No data yet. Be the first to stake!</div>
        )}
      </div>
    </div>
  );
}
