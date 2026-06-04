import { createClient } from '@supabase/supabase-js';
import { validateTelegramAuth } from '../../_middleware/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_IDS: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const telegramUser = await validateTelegramAuth(request, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const adminIds = env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()));

  // Ambil referral_code dari request body
  let referralCode = '';
  try {
    const body = await request.json() as { referral_code?: string };
    referralCode = body.referral_code || '';
  } catch {}

  // Cek apakah user sudah ada
  let { data: user } = await supabase
    .from('users')
    .select('id, referral_code, is_admin, referred_by')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (!user) {
    // Cari referrer jika ada referral code
    let referredById = null;
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      if (referrer) referredById = referrer.id;
    }

    const { data: newCode } = await supabase.rpc('generate_referral_code');
    const { data: newUser } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        full_name: `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`,
        referral_code: newCode,
        referred_by: referredById,
        is_admin: adminIds.includes(telegramUser.id),
      })
      .select('id, referral_code, is_admin')
      .single();
    user = newUser;
  } else if (!user.referred_by && referralCode) {
    // User sudah ada tapi belum punya referral — update jika ada kode
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCode)
      .neq('id', user.id) // Tidak bisa refer diri sendiri
      .single();

    if (referrer) {
      await supabase
        .from('users')
        .update({ referred_by: referrer.id })
        .eq('id', user.id);
    }
  }

  return Response.json({
    success: true,
    user_id: user?.id,
    referral_code: user?.referral_code,
    is_admin: user?.is_admin || adminIds.includes(telegramUser.id),
  });
}
