// functions/api/stake/create.ts
// Endpoint untuk membuat stake baru setelah user mengirim TON

import { createClient } from '@supabase/supabase-js';
import { validateTelegramAuth } from '../../_middleware/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TON_CONTRACT_ADDRESS: string;
}

interface StakeRequest {
  amount_ton: number;
  lock_type: 'flexible' | 'weekly' | 'monthly';
  tx_hash: string;
  ton_wallet: string;
}

const POINTS_RATE: Record<string, number> = {
  flexible: 100,
  weekly: 120,
  monthly: 160,
};

const LOCK_DAYS: Record<string, number | null> = {
  flexible: null,
  weekly: 7,
  monthly: 30,
};

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Validate Telegram auth
  const telegramUser = await validateTelegramAuth(request, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: StakeRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { amount_ton, lock_type, tx_hash, ton_wallet } = body;

  // Validasi input
  if (!amount_ton || amount_ton <= 0) {
    return Response.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (!['flexible', 'weekly', 'monthly'].includes(lock_type)) {
    return Response.json({ error: 'Invalid lock type' }, { status: 400 });
  }
  if (!tx_hash || !ton_wallet) {
    return Response.json({ error: 'Missing tx_hash or ton_wallet' }, { status: 400 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (!user) {
    return Response.json({ error: 'User not found. Please /start the bot first.' }, { status: 404 });
  }

  // Cek apakah tx_hash sudah pernah dipakai
  const { data: existingStake } = await supabase
    .from('stakes')
    .select('id')
    .eq('tx_hash', tx_hash)
    .single();

  if (existingStake) {
    return Response.json({ error: 'Transaction already used' }, { status: 409 });
  }

  // Hitung points_per_day
  const pointsPerDay = POINTS_RATE[lock_type] * amount_ton;

  // Hitung lock_ends_at
  let lockEndsAt: string | null = null;
  const lockDays = LOCK_DAYS[lock_type];
  if (lockDays) {
    const lockEnd = new Date();
    lockEnd.setDate(lockEnd.getDate() + lockDays);
    lockEndsAt = lockEnd.toISOString();
  }

  // Buat stake record
  const { data: stake, error } = await supabase
    .from('stakes')
    .insert({
      user_id: user.id,
      amount_ton,
      lock_type,
      points_per_day: pointsPerDay,
      tx_hash,
      ton_wallet,
      status: 'active',
      lock_ends_at: lockEndsAt,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create stake:', error);
    return Response.json({ error: 'Failed to create stake' }, { status: 500 });
  }

  // Update wallet address user jika belum ada
  await supabase
    .from('users')
    .update({ ton_wallet })
    .eq('id', user.id);

  return Response.json({
    success: true,
    stake: {
      id: stake.id,
      amount_ton: stake.amount_ton,
      lock_type: stake.lock_type,
      points_per_day: stake.points_per_day,
      staked_at: stake.staked_at,
      lock_ends_at: stake.lock_ends_at,
      status: stake.status,
    },
    message: `Stake berhasil! Kamu akan mendapatkan ${pointsPerDay} poin/hari`,
  });
}
