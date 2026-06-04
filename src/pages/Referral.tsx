import { useEffect, useState } from 'react';
import type { TelegramUser } from '../types';
import { getInitData } from '../lib/telegram';

interface ReferralPageProps { user: TelegramUser | null; }

export default function Referral({ user }: ReferralPageProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/referral/info', { headers: { 'X-Telegram-Init-Data': getInitData() } });
        setData(await res.json());
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    fetch_();
  }, []);

  const openBot = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/mocatonbot`);
    }
  };

  const shareViaBot = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(data?.referral_link || '')}&text=${encodeURIComponent('🚀 Join Mocaton - Stake TON and earn $MCT tokens daily!\n\nUse my referral link to get started:')}`
      );
    }
  };

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="referral-page">
      <h1 className="page-title">Referral</h1>

      <div className="main-card" style={{ marginBottom: '16px' }}>
        <p className="card-label">Referral $MCT Earned</p>
        <h2 className="points-display">{(data?.referral_mct || 0).toFixed(4)}</h2>
        <div className="points-breakdown">
          <div className="points-row"><span>⚡ Earning Rate</span><span>{(data?.referral_mct_per_hour || 0).toFixed(4)} MCT/hr</span></div>
          <div className="points-row"><span>👥 Total Referrals</span><span>{data?.referral_count || 0} users</span></div>
        </div>
      </div>

      <div className="how-it-works" style={{ marginBottom: '16px' }}>
        <h3>How It Works</h3>
        <div className="steps">
          <div className="step"><span className="step-num">1</span><p>Get your referral link from the bot</p></div>
          <div className="step"><span className="step-num">2</span><p>Share it with friends via Telegram</p></div>
          <div className="step"><span className="step-num">3</span><p>Earn <strong>30% of their $MCT</strong> in real-time!</p></div>
        </div>
      </div>

      {/* Get link via bot */}
      <div className="section">
        <h3 className="section-title">Your Referral Link</h3>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(0,245,255,0.2)',
          borderRadius: 'var(--radius)',
          padding: '20px',
          textAlign: 'center',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🤖</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.6' }}>
            Get your personal referral link directly from the bot. Type <span style={{ color: 'var(--accent)', fontFamily: 'Orbitron, monospace', fontSize: '12px' }}>/referral</span> in the bot chat.
          </p>
          <button className="btn-primary btn-full" onClick={openBot}>
            Open @mocatonbot
          </button>
        </div>

        {/* Share button jika referral_link sudah ada */}
        {data?.referral_link && (
          <button
            onClick={shareViaBot}
            style={{
              width: '100%',
              padding: '13px',
              background: 'rgba(0,245,255,0.05)',
              border: '1px solid rgba(0,245,255,0.2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent)',
              fontSize: '13px',
              fontWeight: '700',
              fontFamily: 'Orbitron, monospace',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            📤 Share Referral Link
          </button>
        )}
      </div>

      {/* Referral code info */}
      {data?.referral_code && (
        <div className="section">
          <h3 className="section-title">Your Code</h3>
          <div className="referral-code-box">
            <span className="referral-code">{data.referral_code}</span>
          </div>
        </div>
      )}

      {/* Daftar referral */}
      {data?.referrals?.length > 0 && (
        <div className="section">
          <h3 className="section-title">Your Referrals ({data.referral_count})</h3>
          <div className="referrals-list">
            {data.referrals.map((ref: any, i: number) => (
              <div key={i} className="referral-item">
                <div className="referral-avatar">{(ref.full_name || 'A').charAt(0).toUpperCase()}</div>
                <div className="referral-info">
                  <div className="referral-name">{ref.full_name || ref.username || 'Anonymous'}</div>
                  <div className="referral-stakes">{ref.active_stakes} stake(s) · +{(ref.mct_per_hour || 0).toFixed(4)} MCT/hr</div>
                </div>
                <div className="referral-contribution">{(ref.contributed_mct || 0).toFixed(4)} MCT</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
