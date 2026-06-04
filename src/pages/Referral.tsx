import { useEffect, useState } from 'react';
import type { TelegramUser } from '../types';
import { getInitData } from '../lib/telegram';

interface ReferralPageProps { user: TelegramUser | null; }

export default function Referral({ user }: ReferralPageProps) {
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
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

  const copyLink = () => {
    navigator.clipboard.writeText(data?.referral_link || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (data?.referral_link && window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(data.referral_link)}&text=${encodeURIComponent('🪙 Join Mocaton - Stake TON and earn $MCT tokens!')}`);
    }
  };

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="referral-page">
      <h1 className="page-title">Referral Program</h1>

      <div className="referral-card main-card">
        <p className="card-label">Referral $MCT Earned</p>
        <h2 className="points-display">{(data?.referral_mct || 0).toFixed(4)}</h2>
        <div className="points-breakdown">
          <div className="points-row"><span>⚡ Referral Rate</span><span>{(data?.referral_mct_per_hour || 0).toFixed(4)} MCT/hr</span></div>
          <div className="points-row"><span>👥 Total Referrals</span><span>{data?.referral_count || 0} users</span></div>
        </div>
      </div>

      <div className="how-it-works">
        <h3>How It Works</h3>
        <div className="steps">
          <div className="step"><span className="step-num">1</span><p>Share your referral link with friends</p></div>
          <div className="step"><span className="step-num">2</span><p>They sign up and stake TON</p></div>
          <div className="step"><span className="step-num">3</span><p>You earn <strong>30% of their $MCT</strong> in real-time!</p></div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Your Referral Code</h3>
        <div className="referral-code-box">
          <span className="referral-code">{data?.referral_code}</span>
          <button className="copy-btn" onClick={copyLink}>{copied ? '✅' : '📋'}</button>
        </div>
        <div className="referral-link-box">
          <span className="referral-link-text">{data?.referral_link}</span>
        </div>
        <div className="referral-actions">
          <button className="btn-secondary" onClick={copyLink}>📋 Copy Link</button>
          <button className="btn-primary" onClick={shareLink}>📤 Share</button>
        </div>
      </div>

      {data?.referrals?.length > 0 && (
        <div className="section">
          <h3 className="section-title">Your Referrals ({data.referral_count})</h3>
          <div className="referrals-list">
            {data.referrals.map((ref: any, i: number) => (
              <div key={i} className="referral-item">
                <div className="referral-avatar">{(ref.full_name || 'A').charAt(0).toUpperCase()}</div>
                <div className="referral-info">
                  <div className="referral-name">{ref.full_name}</div>
                  <div className="referral-stakes">{ref.active_stakes} active stake(s) · {(ref.mct_per_hour || 0).toFixed(4)} MCT/hr for you</div>
                </div>
                <div className="referral-contribution">+{(ref.contributed_mct || 0).toFixed(4)} MCT</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
