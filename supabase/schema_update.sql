-- Update points calculation function to MCT per hour
CREATE OR REPLACE FUNCTION calculate_user_mct(p_user_id UUID)
RETURNS TABLE (
  stake_mct NUMERIC,
  referral_mct NUMERIC,
  total_mct NUMERIC,
  mct_per_hour NUMERIC,
  referral_mct_per_hour NUMERIC
) AS $$
DECLARE
  v_stake_mct NUMERIC := 0;
  v_referral_mct NUMERIC := 0;
  v_mct_per_hour NUMERIC := 0;
  v_referral_per_hour NUMERIC := 0;
BEGIN
  -- 1 MCT per TON per hour
  SELECT COALESCE(SUM(
    amount_ton * EXTRACT(EPOCH FROM (
      COALESCE(withdraw_processed_at, now()) - staked_at
    )) / 3600.0
  ), 0),
  COALESCE(SUM(amount_ton), 0)
  INTO v_stake_mct, v_mct_per_hour
  FROM stakes
  WHERE user_id = p_user_id
    AND status IN ('active', 'withdraw_pending');

  -- 30% dari MCT referral
  SELECT COALESCE(SUM(
    0.3 * s.amount_ton * EXTRACT(EPOCH FROM (
      COALESCE(s.withdraw_processed_at, now()) - s.staked_at
    )) / 3600.0
  ), 0),
  COALESCE(SUM(0.3 * s.amount_ton), 0)
  INTO v_referral_mct, v_referral_per_hour
  FROM stakes s
  JOIN users u ON u.id = s.user_id
  WHERE u.referred_by = p_user_id
    AND s.status IN ('active', 'withdraw_pending');

  stake_mct := v_stake_mct;
  referral_mct := v_referral_mct;
  total_mct := v_stake_mct + v_referral_mct;
  mct_per_hour := v_mct_per_hour;
  referral_mct_per_hour := v_referral_per_hour;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Leaderboard view
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.full_name,
  u.referral_code,
  COALESCE((
    SELECT SUM(amount_ton * EXTRACT(EPOCH FROM (COALESCE(withdraw_processed_at, now()) - staked_at)) / 3600.0)
    FROM stakes s WHERE s.user_id = u.id AND s.status IN ('active','withdraw_pending')
  ), 0) AS stake_mct,
  COALESCE((
    SELECT SUM(0.3 * s.amount_ton * EXTRACT(EPOCH FROM (COALESCE(s.withdraw_processed_at, now()) - s.staked_at)) / 3600.0)
    FROM stakes s JOIN users ref ON ref.id = s.user_id WHERE ref.referred_by = u.id AND s.status IN ('active','withdraw_pending')
  ), 0) AS referral_mct
FROM users u
ORDER BY (stake_mct + referral_mct) DESC
LIMIT 100;
