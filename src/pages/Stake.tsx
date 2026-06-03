// src/pages/Stake.tsx
import { useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { toNano } from '@ton/ton';
import type { TelegramUser } from '../types';
import { getInitData } from '../lib/telegram';

interface StakePageProps {
  user: TelegramUser | null;
}

const LOCK_TYPES = [
  {
    id: 'flexible',
    label: 'Flexible',
    desc: 'Cancel kapanpun\n(tunggu 24 jam)',
    rate: 100,
    color: '#4CAF50',
  },
  {
    id: 'weekly',
    label: '1 Minggu',
    desc: 'Lock 7 hari\nBonus +20%',
    rate: 120,
    color: '#2196F3',
  },
  {
    id: 'monthly',
    label: '1 Bulan',
    desc: 'Lock 30 hari\nBonus +60%',
    rate: 160,
    color: '#9C27B0',
  },
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

  const selectedRate = LOCK_TYPES.find(t => t.id === lockType)?.rate || 100;
  const estimatedPoints = parseFloat(amount || '0') * selectedRate;

  const handleStake = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Masukkan jumlah TON yang valid');
      return;
    }
    if (!userAddress) {
      tonConnectUI.openModal();
      return;
    }

    setIsStaking(true);
    setError('');

    try {
      // Kirim TON ke contract
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 menit
        messages: [
          {
            address: CONTRACT_ADDRESS,
            amount: toNano(amount).toString(),
            // Payload: message "Stake" ke contract
            payload: buildStakePayload(lockType),
          },
        ],
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      const txHash = result.boc; // Boc = transaction hash di TON

      // Daftarkan stake ke backend
      const res = await fetch('/api/stake/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': getInitData(),
        },
        body: JSON.stringify({
          amount_ton: parseFloat(amount),
          lock_type: lockType,
          tx_hash: txHash,
          ton_wallet: userAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat stake');

      setSuccess(true);
      setAmount('');
    } catch (err: any) {
      if (err.message?.includes('User rejects')) {
        setError('Transaksi dibatalkan');
      } else {
        setError(err.message || 'Terjadi kesalahan');
      }
    } finally {
      setIsStaking(false);
    }
  };

  if (success) {
    return (
      <div className="stake-success">
        <div className="success-icon">🎉</div>
        <h2>Stake Berhasil!</h2>
        <p>TON kamu sudah di-stake dan poin mulai berjalan sekarang.</p>
        <p className="success-detail">
          Estimasi: <strong>{estimatedPoints.toLocaleString('id-ID')} poin/hari</strong>
        </p>
        <button className="btn-primary" onClick={() => setSuccess(false)}>
          Stake Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="stake-page">
      <h1 className="page-title">Stake TON</h1>

      {/* Wallet Connection */}
      {!userAddress ? (
        <div className="wallet-connect-banner">
          <p>Hubungkan wallet TON kamu untuk mulai stake</p>
          <button className="btn-primary" onClick={() => tonConnectUI.openModal()}>
            Hubungkan Wallet
          </button>
        </div>
      ) : (
        <div className="wallet-connected">
          <span className="wallet-dot" />
          <span className="wallet-addr">{userAddress.slice(0, 8)}...{userAddress.slice(-6)}</span>
        </div>
      )}

      {/* Lock Type Selection */}
      <div className="section">
        <h3 className="section-title">Pilih Durasi Stake</h3>
        <div className="lock-types">
          {LOCK_TYPES.map(lt => (
            <button
              key={lt.id}
              className={`lock-type-card ${lockType === lt.id ? 'selected' : ''}`}
              onClick={() => setLockType(lt.id as any)}
              style={{ '--accent': lt.color } as any}
            >
              <div className="lock-rate">{lt.rate}</div>
              <div className="lock-unit">poin/TON/hari</div>
              <div className="lock-label">{lt.label}</div>
              <div className="lock-desc">{lt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="section">
        <h3 className="section-title">Jumlah TON</h3>
        <div className="amount-input-wrap">
          <input
            type="number"
            className="amount-input"
            placeholder="0.0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="0.1"
            step="0.1"
          />
          <span className="amount-unit">TON</span>
        </div>

        {/* Quick amounts */}
        <div className="quick-amounts">
          {['1', '5', '10', '50'].map(a => (
            <button key={a} className="quick-amount-btn" onClick={() => setAmount(a)}>
              {a} TON
            </button>
          ))}
        </div>
      </div>

      {/* Estimasi */}
      {parseFloat(amount) > 0 && (
        <div className="estimate-card">
          <h4>Estimasi Penghasilan</h4>
          <div className="estimate-row">
            <span>Per Hari</span>
            <strong>{(parseFloat(amount) * selectedRate).toLocaleString('id-ID')} poin</strong>
          </div>
          <div className="estimate-row">
            <span>Per Minggu</span>
            <strong>{(parseFloat(amount) * selectedRate * 7).toLocaleString('id-ID')} poin</strong>
          </div>
          <div className="estimate-row">
            <span>Per Bulan</span>
            <strong>{(parseFloat(amount) * selectedRate * 30).toLocaleString('id-ID')} poin</strong>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="info-box">
        {lockType === 'flexible' && (
          <p>ℹ️ Flexible: Bisa cancel kapanpun, tapi perlu 24 jam untuk TON kembali ke wallet kamu.</p>
        )}
        {lockType === 'weekly' && (
          <p>🔒 1 Minggu: TON terkunci 7 hari, tidak bisa withdraw sebelum waktunya.</p>
        )}
        {lockType === 'monthly' && (
          <p>🔒 1 Bulan: TON terkunci 30 hari, rate poin terbaik!</p>
        )}
      </div>

      {error && <div className="error-msg">❌ {error}</div>}

      {/* Stake Button */}
      <button
        className="btn-primary btn-full"
        onClick={handleStake}
        disabled={isStaking || !amount}
      >
        {isStaking ? '⏳ Memproses...' : userAddress ? '🚀 Stake Sekarang' : '🔗 Hubungkan Wallet'}
      </button>
    </div>
  );
}

// Build payload untuk contract message
function buildStakePayload(lockType: string): string {
  // Encode message "Stake" ke format yang bisa dibaca contract Tact
  // Implementasi sesuai ABI contract yang di-generate Tact
  // Placeholder — implementasi nyata bergantung pada compiled contract ABI
  return '';
}
