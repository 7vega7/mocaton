// src/pages/Referral.tsx
import { useEffect, useState } from 'react';
import type { TelegramUser } from '../types';
import { getInitData } from '../lib/telegram';
import { formatPoints } from '../lib/utils';

interface ReferralPageProps {
  user: TelegramUser | null;
}

interface ReferralData {
  referral_code: string;
  referral_link: string;
  referral_count: number;
  referral_points: number;
  referrals: {
    username: string;
    full_name: string;
    active_stakes: number;
    contributed_points: number;
  }[];
}

export default function Referral({ user }: ReferralPageProps) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/referral/info', {
          headers: { 'X-Telegram-Init-Data': getInitData() },
        });
        const d = await res.json();
        setData(d);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch_();
  }, []);

  const copyCode = () => {
    if (data?.referral_code) {
      navigator.clipboard.writeText(data.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = () => {
    if (data?.referral_link) {
      navigator.clipboard.writeText(data.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = () => {
    if (data?.referral_link && window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(data.referral_link)}&text=${encodeURIComponent('🪙 Join TON Stake Airdrop dan dapatkan poin reward setiap hari!')}`
      );
    }
  };

  if (isLoading) return <div className="page-loading">Memuat referral...</div>;

  return (
    <div className="referral-page">
      <h1 className="page-title">Program Referral</h1>

      {/* Referral Info Card */}
      <div className="referral-card main-card">
        <p className="card-label">Total Poin Referral</p>
        <h2 className="points-display">{formatPoints(data?.referral_points || 0)}</h2>
        <div className="referral-stats">
          <div>
            <strong>{data?.referral_count || 0}</strong>
            <span>Referral</span>
          </div>
          <div>
            <strong>30%</strong>
            <span>Komisi</span>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="how-it-works">
        <h3>Cara Kerja</h3>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <p>Bagikan kode atau link referral kamu</p>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <p>Teman kamu daftar dan stake TON</p>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <p>Kamu dapat <strong>30% poin</strong> dari stake mereka secara real-time!</p>
          </div>
        </div>
      </div>

      {/* Kode Referral */}
      <div className="section">
        <h3 className="section-title">Kode Referral Kamu</h3>
        <div className="referral-code-box">
          <span className="referral-code">{data?.referral_code}</span>
          <button className="copy-btn" onClick={copyCode}>
            {copied ? '✅' : '📋'}
          </button>
        </div>

        <div className="referral-link-box">
          <span className="referral-link-text">{data?.referral_link}</span>
        </div>

        <div className="referral-actions">
          <button className="btn-secondary" onClick={copyLink}>
            📋 Copy Link
          </button>
          <button className="btn-primary" onClick={shareLink}>
            📤 Share ke Telegram
          </button>
        </div>
      </div>

      {/* Daftar Referral */}
      {data?.referrals && data.referrals.length > 0 && (
        <div className="section">
          <h3 className="section-title">Referral Kamu ({data.referral_count})</h3>
          <div className="referrals-list">
            {data.referrals.map((ref, i) => (
              <div key={i} className="referral-item">
                <div className="referral-avatar">
                  {ref.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="referral-info">
                  <div className="referral-name">{ref.full_name}</div>
                  <div className="referral-stakes">
                    {ref.active_stakes} stake aktif
                  </div>
                </div>
                <div className="referral-contribution">
                  +{formatPoints(ref.contributed_points)} poin
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
