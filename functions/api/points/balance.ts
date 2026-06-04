import { createClient } from '@supabase/supabase-js';
import { validateTelegramAuth } from '../../_middleware/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const telegramUser = await validateTelegramAuth(request, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramUser.id).single();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const { data: mct } = await supabase.rpc('calculate_user_mct', { p_user_id: user.id });
  const { data: stakes } = await supabase.from('stakes').select('id,amount_ton,lock_type,staked_at,status,lock_ends_at,withdraw_requested_at,withdraw_scheduled_at').eq('user_id', user.id).in('status', ['active','withdraw_pending']).order('staked_at', { ascending: false });
  const { count: referralCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referred_by', user.id);

  const stakesWithMct = (stakes || []).map(stake => {
    const hoursStaked = (Date.now() - new Date(stake.staked_at).getTime()) / 3600000;
    return { ...stake, mct_earned: hoursStaked * stake.amount_ton, mct_per_hour: stake.amount_ton };
  });

  const result = mct?.[0];
  return Response.json({
    stake_mct: result?.stake_mct || 0,
    referral_mct: result?.referral_mct || 0,
    total_mct: result?.total_mct || 0,
    mct_per_hour: result?.mct_per_hour || 0,
    referral_mct_per_hour: result?.referral_mct_per_hour || 0,
    referral_count: referralCount || 0,
    active_stakes: stakesWithMct,
    calculated_at: new Date().toISOString(),
  });
}
