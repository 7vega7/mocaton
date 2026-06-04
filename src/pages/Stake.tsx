import { useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import type { TelegramUser } from '../types';
import { getInitData } from '../lib/telegram';

interface StakePageProps { user: TelegramUser | null; }

const LOCK_TYPES = [
  { id: 'flexible', label: 'Flexible', desc: 'Cancel anytime\n(24h cooldown)', rate: 1, color: '#4CAF50' },
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

  const selectedRate = LOCK_TYPES.find(t => t.id === lockType)?.rate || 1;
  const amountNum = parseFloat(amount) || 0;

  const handleStake = async () => {
    if (!amount || amountNum <= 0) { setError('Enter a valid TON amount'); return; }
    if (!userAddress) { tonConnectUI.openModal(); return; }
    setIsStaking(true);
    setError('');
    try {
      const amountNano = BigInt(Math.floor(amountNum * 1e9)).toString();
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: CONTRACT_ADDRESS, amount: amountNano }],
      };
      const result = await tonConnectUI.sendTransaction(transaction);
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
    } finally {
      setIsStaking(false);
    }
  };

  if (success) {
    return (
      <div className="stake-success">
        <div className="success-icon">🎉</div>
        <h2>Stake Successful!</h2>
        <p>Your TON is now staked and $MCT is accumulating.</p>
        <p className="success-detail">
          Earning <strong>{(amountNum * selectedRate).toFixed(2)} MCT/hr</strong>
        </p>
        <button className="btn-primary" onClick={() => setSuccess(false)}>Stake More</button>
      </div>
    );
  }

  return (
    <div className="stake-page">
      <h1 className="page-title">Stake TON</h1>

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
        <h3 className="section-title">Select Lock Period</h3>
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
        {lockType === 'flexible' && <p>ℹ️ Flexible: Withdraw anytime, but TON takes 24 hours to return to your wallet after request.</p>}
        {lockType === 'weekly' && <p>🔒 1 Week: TON is locked for 7 days. Cannot withdraw before lock period ends.</p>}
        {lockType === 'monthly' && <p>🔒 1 Month: TON is locked for 30 days. Best $MCT rate!</p>}
      </div>

      {error && <div className="error-msg">❌ {error}</div>}

      <button className="btn-primary btn-full" onClick={handleStake} disabled={isStaking || !amount}>
        {isStaking ? '⏳ Processing...' : userAddress ? '🚀 Stake Now' : '🔗 Connect Wallet'}
      </button>
    </div>
  );
}
