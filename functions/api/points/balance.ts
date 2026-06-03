// functions/api/points/balance.ts
// Real-time points calculation endpoint

import { createClient } from '@supabase/supabase-js';
import { validateTelegramAuth } from '../../_middleware/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Validate Telegram auth
  const telegramUser = await validateTelegramAuth(request, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, referral_code, referred_by')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  // Calculate points via SQL function (real-time)
  const { data: points, error } = await supabase.rpc('calculate_user_points', {
    p_user_id: user.id
  });

  if (error) {
    return Response.json({ error: 'Failed to calculate points' }, { status: 500 });
  }

  // Get active stakes detail
  const { data: stakes } = await supabase
    .from('stakes')
    .select('id, amount_ton, lock_type, points_per_day, staked_at, status, lock_ends_at, withdraw_requested_at, withdraw_scheduled_at')
    .eq('user_id', user.id)
    .in('status', ['active', 'withdraw_pending'])
    .order('staked_at', { ascending: false });

  // Get referral stats
  const { count: referralCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', user.id);

  // Calculate per-stake points for display
  const stakesWithPoints = (stakes || []).map(stake => {
    const daysSinceStake = (Date.now() - new Date(stake.staked_at).getTime()) / (1000 * 60 * 60 * 24);
    const stakePoints = stake.points_per_day * daysSinceStake;
    return {
      ...stake,
      points_earned: Math.floor(stakePoints),
      points_per_day: stake.points_per_day,
    };
  });

  const result = points[0];

  return Response.json({
    stake_points: Math.floor(result.stake_points),
    referral_points: Math.floor(result.referral_points),
    total_points: Math.floor(result.total_points),
    referral_count: referralCount || 0,
    active_stakes: stakesWithPoints,
    // Timestamp untuk client-side interpolation
    calculated_at: new Date().toISOString(),
  });
}
