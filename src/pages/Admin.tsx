// src/pages/Admin.tsx
import { useEffect, useState } from 'react';
import { getInitData } from '../lib/telegram';

interface WithdrawRequest {
  id: string;
  amount_ton: number;
  wallet_address: string;
  requested_at: string;
  scheduled_process_at: string;
  status: string;
  users: { full_name: string; username: string; telegram_id: number };
  stakes: { lock_type: string };
}

export default function Admin() {
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchWithdraws = async () => {
    try {
      const res = await fetch('/api/admin/withdraws', {
        headers: { 'X-Telegram-Init-Data': getInitData() },
      });
      const data = await res.json();
      setWithdraws(data.withdraws || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdraws();
    const interval = setInterval(fetchWithdraws, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirm = async (withdrawId: string) => {
    setActionLoading(withdrawId);
    try {
      const res = await fetch('/api/admin/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': getInitData(),
        },
        body: JSON.stringify({ withdraw_id: withdrawId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchWithdraws();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (withdrawId: string) => {
    if (!rejectReason.trim()) {
      alert('Masukkan alasan penolakan');
      return;
    }
    setActionLoading(withdrawId);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': getInitData(),
        },
        body: JSON.stringify({ withdraw_id: withdrawId, reason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        setRejectingId(null);
        setRejectReason('');
        await fetchWithdraws();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) return <div className="page-loading">Memuat admin panel...</div>;

  const pendingWithdraws = withdraws.filter(w => w.status === 'pending');
  const confirmedWithdraws = withdraws.filter(w => w.status === 'confirmed');

  return (
    <div className="admin-page">
      <h1 className="page-title">⚙️ Admin Panel</h1>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{pendingWithdraws.length}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{confirmedWithdraws.length}</span>
          <span className="stat-label">Confirmed</span>
        </div>
      </div>

      {/* Pending Withdraws */}
      <div className="section">
        <h3 className="section-title">Withdraw Pending ({pendingWithdraws.length})</h3>

        {pendingWithdraws.length === 0 ? (
          <div className="empty-state">✅ Tidak ada withdraw pending</div>
        ) : (
          <div className="admin-list">
            {pendingWithdraws.map(w => (
              <div key={w.id} className="admin-withdraw-card">
                <div className="withdraw-header">
                  <div>
                    <div className="withdraw-user">{w.users.full_name}</div>
                    <div className="withdraw-username">@{w.users.username || 'no_username'}</div>
                  </div>
                  <div className="withdraw-amount">{w.amount_ton} TON</div>
                </div>

                <div className="withdraw-detail">
                  <span>Wallet:</span>
                  <span className="mono">{w.wallet_address.slice(0, 12)}...{w.wallet_address.slice(-6)}</span>
                </div>

                <div className="withdraw-detail">
                  <span>Diajukan:</span>
                  <span>{new Date(w.requested_at).toLocaleString('id-ID')}</span>
                </div>

                <div className="withdraw-detail">
                  <span>Proses otomatis:</span>
                  <span>{new Date(w.scheduled_process_at).toLocaleString('id-ID')}</span>
                </div>

                {rejectingId === w.id ? (
                  <div className="reject-form">
                    <input
                      type="text"
                      placeholder="Alasan penolakan..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="reject-input"
                    />
                    <div className="reject-actions">
                      <button className="btn-danger" onClick={() => handleReject(w.id)} disabled={!!actionLoading}>
                        Konfirmasi Tolak
                      </button>
                      <button className="btn-ghost" onClick={() => setRejectingId(null)}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-actions">
                    <button
                      className="btn-success"
                      onClick={() => handleConfirm(w.id)}
                      disabled={actionLoading === w.id}
                    >
                      {actionLoading === w.id ? '...' : '✅ Konfirmasi'}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => setRejectingId(w.id)}
                      disabled={!!actionLoading}
                    >
                      ❌ Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmed (menunggu proses otomatis) */}
      {confirmedWithdraws.length > 0 && (
        <div className="section">
          <h3 className="section-title">Menunggu Proses Otomatis ({confirmedWithdraws.length})</h3>
          <div className="admin-list">
            {confirmedWithdraws.map(w => (
              <div key={w.id} className="admin-withdraw-card confirmed">
                <div className="withdraw-header">
                  <div>
                    <div className="withdraw-user">{w.users.full_name}</div>
                  </div>
                  <div className="withdraw-amount">{w.amount_ton} TON</div>
                </div>
                <div className="withdraw-detail">
                  <span>Proses pada:</span>
                  <span>{new Date(w.scheduled_process_at).toLocaleString('id-ID')}</span>
                </div>
                <div className="confirmed-badge">✅ Dikonfirmasi</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
