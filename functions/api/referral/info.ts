// functions/api/referral/info.ts
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

  const { data: user } = await supabase
    .from('users')
    .select('id, referral_code')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  // Hitung referral points
  const { data: points } = await supabase.rpc('calculate_user_points', {
    p_user_id: user.id
  });

  // Ambil daftar user yang direferral + info stake mereka
  const { data: referrals } = await supabase
    .from('users')
    .select(`
      id,
      username,
      full_name,
      stakes(id, amount_ton, points_per_day, status, staked_at)
    `)
    .eq('referred_by', user.id)
    .limit(20);

  const botUsername = env.BOT_USERNAME || 'YourBotUsername';
  const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

  // Hitung kontribusi poin tiap referral
  const referralsWithPoints = (referrals || []).map(ref => {
    const activeStakes = (ref.stakes as any[]).filter((s: any) =>
      ['active', 'withdraw_pending'].includes(s.status)
    );

    const totalRefPoints = activeStakes.reduce((sum: number, stake: any) => {
      const days = (Date.now() - new Date(stake.staked_at).getTime()) / (1000 * 60 * 60 * 24);
      return sum + (stake.points_per_day * days * 0.3);
    }, 0);

    return {
      username: ref.username,
      full_name: ref.full_name,
      active_stakes: activeStakes.length,
      contributed_points: Math.floor(totalRefPoints),
    };
  });

  return Response.json({
    referral_code: user.referral_code,
    referral_link: referralLink,
    referral_count: referrals?.length || 0,
    referral_points: Math.floor(points?.[0]?.referral_points || 0),
    referrals: referralsWithPoints,
  });
}
