import { createClient } from '@supabase/supabase-js';
import { validateTelegramAuth } from '../../_middleware/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  BOT_USERNAME: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const telegramUser = await validateTelegramAuth(request, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await supabase.from('users').select('id, referral_code').eq('telegram_id', telegramUser.id).single();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const { data: mct } = await supabase.rpc('calculate_user_mct', { p_user_id: user.id });
  const { data: referrals } = await supabase.from('users').select('id, username, full_name, stakes(id, amount_ton, status, staked_at)').eq('referred_by', user.id).limit(20);

  const botUsername = env.BOT_USERNAME || 'mocatonbot';
  const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

  const referralsWithMct = (referrals || []).map(ref => {
    const activeStakes = ((ref.stakes as any[]) || []).filter((s: any) => ['active','withdraw_pending'].includes(s.status));
    const mctPerHour = activeStakes.reduce((sum: number, s: any) => sum + s.amount_ton, 0);
    const totalMct = activeStakes.reduce((sum: number, s: any) => {
      const hours = (Date.now() - new Date(s.staked_at).getTime()) / 3600000;
      return sum + s.amount_ton * hours * 0.3;
    }, 0);
    return {
      username: ref.username || 'Anonymous',
      full_name: ref.full_name || 'Anonymous',
      active_stakes: activeStakes.length,
      mct_per_hour: mctPerHour * 0.3,
      contributed_mct: totalMct,
    };
  });

  return Response.json({
    referral_code: user.referral_code,
    referral_link: referralLink,
    referral_count: referrals?.length || 0,
    referral_mct: mct?.[0]?.referral_mct || 0,
    referral_mct_per_hour: mct?.[0]?.referral_mct_per_hour || 0,
    referrals: referralsWithMct,
  });
}
