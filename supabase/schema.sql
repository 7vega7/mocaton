-- ============================================================
-- TON STAKE AIRDROP — Supabase Schema
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  full_name TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ton_wallet TEXT,                          -- wallet address user
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);

-- ============================================================
-- TABLE: stakes
-- ============================================================
CREATE TABLE stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount_ton NUMERIC(18,9) NOT NULL CHECK (amount_ton > 0),
  lock_type TEXT NOT NULL CHECK (lock_type IN ('flexible','weekly','monthly')),
  points_per_day NUMERIC NOT NULL,
  -- 100 * amount_ton (flexible)
  -- 120 * amount_ton (weekly)
  -- 160 * amount_ton (monthly)

  tx_hash TEXT,                             -- hash transaksi TON masuk ke contract
  ton_wallet TEXT NOT NULL,                 -- wallet user yang di-stake

  status TEXT DEFAULT 'active' CHECK (
    status IN ('active','withdraw_pending','withdrawn','rejected_withdraw')
  ),

  staked_at TIMESTAMPTZ DEFAULT now(),
  lock_ends_at TIMESTAMPTZ,                 -- NULL untuk flexible

  withdraw_requested_at TIMESTAMPTZ,
  withdraw_scheduled_at TIMESTAMPTZ,        -- withdraw_requested_at + 24 jam
  withdraw_confirmed_at TIMESTAMPTZ,
  withdraw_rejected_at TIMESTAMPTZ,
  withdraw_processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stakes_user_id ON stakes(user_id);
CREATE INDEX idx_stakes_status ON stakes(status);
CREATE INDEX idx_stakes_withdraw_scheduled ON stakes(withdraw_scheduled_at)
  WHERE status = 'withdraw_pending';

-- ============================================================
-- TABLE: withdraw_requests
-- ============================================================
CREATE TABLE withdraw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id UUID REFERENCES stakes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount_ton NUMERIC(18,9) NOT NULL,
  wallet_address TEXT NOT NULL,

  requested_at TIMESTAMPTZ DEFAULT now(),
  scheduled_process_at TIMESTAMPTZ NOT NULL,   -- requested_at + INTERVAL '24 hours'

  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending','confirmed','rejected','processed')
  ),

  confirmed_by UUID REFERENCES users(id),      -- admin user id
  confirmed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  processed_at TIMESTAMPTZ,

  -- hash transaksi TON keluar ke wallet user
  process_tx_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_withdraw_status ON withdraw_requests(status);
CREATE INDEX idx_withdraw_scheduled ON withdraw_requests(scheduled_process_at)
  WHERE status = 'confirmed';
CREATE INDEX idx_withdraw_user ON withdraw_requests(user_id);

-- ============================================================
-- FUNCTION: generate referral code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    -- Cek apakah sudah ada
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = result) THEN
      RETURN result;
    END IF;
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Cannot generate unique referral code';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: hitung poin real-time seorang user
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_user_points(p_user_id UUID)
RETURNS TABLE (
  stake_points NUMERIC,
  referral_points NUMERIC,
  total_points NUMERIC
) AS $$
DECLARE
  v_stake_points NUMERIC := 0;
  v_referral_points NUMERIC := 0;
BEGIN
  -- Hitung poin dari stake sendiri (active + withdraw_pending)
  SELECT COALESCE(SUM(
    points_per_day *
    EXTRACT(EPOCH FROM (
      COALESCE(withdraw_processed_at, now()) - staked_at
    )) / 86400.0
  ), 0)
  INTO v_stake_points
  FROM stakes
  WHERE user_id = p_user_id
    AND status IN ('active', 'withdraw_pending');

  -- Hitung 30% dari poin stake semua user yang referred_by = p_user_id
  SELECT COALESCE(SUM(
    0.3 *
    s.points_per_day *
    EXTRACT(EPOCH FROM (
      COALESCE(s.withdraw_processed_at, now()) - s.staked_at
    )) / 86400.0
  ), 0)
  INTO v_referral_points
  FROM stakes s
  JOIN users u ON u.id = s.user_id
  WHERE u.referred_by = p_user_id
    AND s.status IN ('active', 'withdraw_pending');

  stake_points := v_stake_points;
  referral_points := v_referral_points;
  total_points := v_stake_points + v_referral_points;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: proses withdraw yang sudah waktunya
-- Dipanggil oleh cron/scheduled worker
-- ============================================================
CREATE OR REPLACE FUNCTION process_due_withdraws()
RETURNS TABLE (
  withdraw_id UUID,
  stake_id UUID,
  user_id UUID,
  amount_ton NUMERIC,
  wallet_address TEXT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE withdraw_requests wr
  SET
    status = 'processed',
    processed_at = now(),
    updated_at = now()
  FROM stakes s
  WHERE wr.stake_id = s.id
    AND wr.status = 'confirmed'
    AND wr.scheduled_process_at <= now()
  RETURNING
    wr.id AS withdraw_id,
    wr.stake_id,
    wr.user_id,
    wr.amount_ton,
    wr.wallet_address;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: update updated_at otomatis
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER stakes_updated_at
  BEFORE UPDATE ON stakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER withdraw_requests_updated_at
  BEFORE UPDATE ON withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdraw_requests ENABLE ROW LEVEL SECURITY;

-- Service role (backend) bisa akses semua
-- Anon tidak bisa akses langsung (semua via API)
CREATE POLICY "service_role_users" ON users
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_stakes" ON stakes
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_withdraw" ON withdraw_requests
  FOR ALL TO service_role USING (true);
