import { useState, useEffect } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import type { TelegramUser } from '../types';
import { getInitData } from '../lib/telegram';

interface StakePageProps { user: TelegramUser | null; }

const LOCK_TYPES = [
  { id: 'flexible', label: 'Flexible', desc: 'Cancel anytime\n(24h cooldown)', rate: 1, color: '#00F5FF' },
  { id: 'weekly', label: '1 Week', desc: 'Locked 7 days\n+20% bonus', rate: 1.2, color: '#2196F3' },
  { id: 'monthly', label: '1 Month', desc: 'Locked 30 days\n+60% bonus', rate: 1.6, color: '#9C27B0' },
];

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

export default function Stake({ user }: StakePageProps) {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [amount, setAmount] = useState('');
  const [lockType, setLockType] = useState<'flexible' | 'weekly' | 'monthly'>('flexible');
  const [isStaking, setIsStaking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [activeStakes, setActiveStakes] = useState<any[]>([]);
  const [loadingStakes, setLoadingStakes] = useState(true);
  const [unstakeModal, setUnstakeModal] = useState<any>(null);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [unstakeSuccess, setUnstakeSuccess] = useState(false);

  const selectedRate = LOCK_TYPES.find(t => t.id === lockType)?.rate || 1;
  const amountNum = parseFloat(amount) || 0;

  const fetchStakes = async () => {
    try {
      const res = await fetch('/api/points/balance', {
        headers: { 'X-Telegram-Init-Data': getInitData() }
      });
      const d = await res.json();
      setActiveStakes(d.active_stakes || []);
    } catch (e) { console.error(e); }
    finally { setLoadingStakes(false); }
  };

  useEffect(() => { fetchStakes(); }, [success, unstakeSuccess]);

  const handleStake = async () => {
    if (!amount || amountNum <= 0) { setError('Enter a valid TON amount'); return; }
    if (!userAddress) { tonConnectUI.openModal(); return; }
    setIsStaking(true);
    setError('');
    try {
      const amountNano = BigInt(Math.floor(amountNum * 1e9)).toString();
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: CONTRACT_ADDRESS, amount: amountNano }],
      });
      const res = await fetch('/api/stake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': getInitData() },
        body: JSON.stringify({ amount_ton: amountNum, lock_type: lockType, tx_hash: result.boc, ton_wallet: userAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create stake');
      setSuccess(true);
      setAmount('');
    } catch (err: any) {
      setError(err.message?.includes('User rejects') ? 'Transaction cancelled' : err.message || 'An error occurred');
    } finally { setIsStaking(false); }
  };

  const handleUnstake = async () => {
    if (!unstakeModal) return;
    setIsUnstaking(true);
    try {
      const walletAddr = userAddress || unstakeModal.ton_wallet;
      const res = await fetch('/api/withdraw/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': getInitData() },
        body: JSON.stringify({ stake_id: unstakeModal.id, wallet_address: walletAddr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request unstake');
      setUnstakeModal(null);
      setUnstakeSuccess(true);
      setTimeout(() => setUnstakeSuccess(false), 5000);
      fetchStakes();
    } catch (err: any) {
      setError(err.message || 'Failed to unstake');
      setUnstakeModal(null);
    } finally { setIsUnstaking(false); }
  };

  const lockLabel: Record<string, string> = {
    flexible: 'Flexible', weekly: '1 Week', monthly: '1 Month'
  };

  const canUnstake = (stake: any) => {
    if (stake.status === 'withdraw_pending') return false;
    if (stake.lock_type === 'flexible') return true;
    if (stake.lock_ends_at && new Date(stake.lock_ends_at) <= new Date()) return true;
    return false;
  };

  const lockEndsIn = (stake: any) => {
    if (!stake.lock_ends_at) return null;
    const diff = new Date(stake.lock_ends_at).getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  return (
    <div className="stake-page">
      <h1 className="page-title">Stake TON</h1>

      {/* Active Stakes */}
      {!loadingStakes && activeStakes.length > 0 && (
        <div className="section" style={{ marginBottom: '24px' }}>
          <h3 className="section-title">Your Active Stakes</h3>
          <div className="stakes-list">
            {activeStakes.map(stake => {
              const unstakeable = canUnstake(stake);
              const timeLeft = lockEndsIn(stake);
              return (
                <div key={stake.id} className={`stake-item ${stake.status === 'withdraw_pending' ? 'stake-pending' : ''}`}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: unstakeable ? 'var(--success)' : 'var(--warning)', borderRadius: '3px 0 0 3px' }} />
                  <div className="stake-info" style={{ paddingLeft: '8px' }}>
                    <div className="stake-amount">{stake.amount_ton} TON</div>
                    <div className="stake-lock">{lockLabel[stake.lock_type]} · {stake.amount_ton} MCT/hr</div>
                    {stake.status === 'withdraw_pending' && (
                      <div className="stake-status-badge">⏳ Unstake Pending — Processing in 24h</div>
                    )}
                    {!unstakeable && timeLeft && (
                      <div style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '3px' }}>
                        🔒 Locked for {timeLeft}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <div className="stake-points">
                      <div className="stake-points-value">{(stake.mct_earned || 0).toFixed(4)}</div>
                      <div className="stake-points-label">MCT earned</div>
                    </div>
                    {unstakeable && (
                      <button
                        onClick={() => setUnstakeModal(stake)}
                        style={{
                          padding: '5px 12px',
                          background: 'rgba(255,59,92,0.1)',
                          border: '1px solid rgba(255,59,92,0.3)',
                          borderRadius: '6px',
                          color: 'var(--danger)',
                          fontSize: '11px',
                          fontFamily: 'Orbitron, monospace',
                          fontWeight: '700',
                          cursor: 'pointer',
                          letterSpacing: '0.05em',
                        }}
                      >
                        UNSTAKE
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unstake success */}
      {unstakeSuccess && (
        <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--success)' }}>
          ✅ Unstake requested! TON will be returned to your wallet within 24 hours after admin confirmation.
        </div>
      )}

      {/* New Stake Form */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
        <h3 className="section-title" style={{ marginBottom: '16px' }}>New Stake</h3>

        {!userAddress ? (
          <div className="wallet-connect-banner">
            <p>Connect your TON wallet to start staking</p>
            <button className="btn-primary" onClick={() => tonConnectUI.openModal()}>Connect Wallet</button>
          </div>
        ) : (
          <div className="wallet-connected">
            <span className="wallet-dot" />
            <span className="wallet-addr">{userAddress.slice(0, 8)}...{userAddress.slice(-6)}</span>
          </div>
        )}

        <div className="section">
          <h3 className="section-title">Lock Period</h3>
          <div className="lock-types">
            {LOCK_TYPES.map(lt => (
              <button key={lt.id} className={`lock-type-card ${lockType === lt.id ? 'selected' : ''}`} onClick={() => setLockType(lt.id as any)}>
                <div className="lock-rate">{lt.rate}</div>
                <div className="lock-unit">MCT/TON/hr</div>
                <div className="lock-label">{lt.label}</div>
                <div className="lock-desc">{lt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Amount</h3>
          <div className="amount-input-wrap">
            <input type="number" className="amount-input" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)} min="0.1" step="0.1" />
            <span className="amount-unit">TON</span>
          </div>
          <div className="quick-amounts">
            {['1', '5', '10', '50'].map(a => (
              <button key={a} className="quick-amount-btn" onClick={() => setAmount(a)}>{a} TON</button>
            ))}
          </div>
        </div>

        {amountNum > 0 && (
          <div className="estimate-card">
            <h4>Estimated Earnings</h4>
            <div className="estimate-row"><span>Per Hour</span><strong>{(amountNum * selectedRate).toFixed(4)} $MCT</strong></div>
            <div className="estimate-row"><span>Per Day</span><strong>{(amountNum * selectedRate * 24).toFixed(4)} $MCT</strong></div>
            <div className="estimate-row"><span>Per Week</span><strong>{(amountNum * selectedRate * 24 * 7).toFixed(2)} $MCT</strong></div>
            <div className="estimate-row"><span>Per Month</span><strong>{(amountNum * selectedRate * 24 * 30).toFixed(2)} $MCT</strong></div>
          </div>
        )}

        <div className="info-box">
          {lockType === 'flexible' && <p>ℹ️ Flexible: Unstake anytime. TON returns to wallet within 24h after admin confirmation.</p>}
          {lockType === 'weekly' && <p>🔒 1 Week: Cannot unstake for 7 days. +20% $MCT rate!</p>}
          {lockType === 'monthly' && <p>🔒 1 Month: Cannot unstake for 30 days. Best $MCT rate!</p>}
        </div>

        {error && <div className="error-msg">❌ {error}</div>}
        {success && (
          <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '12px', fontSize: '13px', color: 'var(--success)' }}>
            🎉 Stake successful! $MCT is now accumulating.
          </div>
        )}

        <button className="btn-primary btn-full" onClick={handleStake} disabled={isStaking || !amount}>
          {isStaking ? '⏳ Processing...' : userAddress ? '🚀 Stake Now' : '🔗 Connect Wallet'}
        </button>
      </div>

      {/* Unstake Confirmation Modal */}
      {unstakeModal && (
        <div onClick={() => setUnstakeModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#080D14', border: '1px solid rgba(255,59,92,0.3)', borderRadius: '20px', padding: '28px', maxWidth: '340px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ fontFamily: 'Orbitron, monospace', fontSize: '18px', marginBottom: '8px', color: 'var(--danger)' }}>Unstake TON</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '8px' }}>
              You are about to unstake:
            </p>
            <div style={{ background: 'rgba(255,59,92,0.05)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '20px', fontWeight: '900', color: 'var(--text)' }}>{unstakeModal.amount_ton} TON</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Flexible stake</div>
            </div>
            <div style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '20px' }}>
              <p style={{ color: 'var(--warning)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                ⏰ TON will be returned within <strong>24 hours</strong> after admin confirmation.<br />
                $MCT keeps earning until TON is returned!
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-ghost" onClick={() => setUnstakeModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={handleUnstake}
                disabled={isUnstaking}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,59,92,0.15)', border: '1px solid rgba(255,59,92,0.4)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '13px', fontFamily: 'Orbitron, monospace', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.05em' }}
              >
                {isUnstaking ? '⏳...' : 'UNSTAKE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
