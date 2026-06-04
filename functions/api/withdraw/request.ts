import { createClient } from '@supabase/supabase-js';
import { validateTelegramAuth } from '../../_middleware/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_IDS: string;
}

interface WithdrawRequest {
  stake_id: string;
  wallet_address: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const telegramUser = await validateTelegramAuth(request, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: WithdrawRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { stake_id, wallet_address } = body;
  if (!stake_id || !wallet_address) {
    return Response.json({ error: 'Missing stake_id or wallet_address' }, { status: 400 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const { data: stake } = await supabase
    .from('stakes')
    .select('*')
    .eq('id', stake_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!stake) return Response.json({ error: 'Stake not found or not active' }, { status: 404 });

  if (stake.lock_ends_at && new Date(stake.lock_ends_at) > new Date()) {
    const lockEnd = new Date(stake.lock_ends_at);
    return Response.json({
      error: `Stake is locked until ${lockEnd.toLocaleString('en-US')}. Cannot unstake before lock period ends.`,
    }, { status: 400 });
  }

  const requestedAt = new Date();
  const scheduledAt = new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000);

  const { data: withdrawReq, error: withdrawError } = await supabase
    .from('withdraw_requests')
    .insert({
      stake_id: stake.id,
      user_id: user.id,
      amount_ton: stake.amount_ton,
      wallet_address,
      requested_at: requestedAt.toISOString(),
      scheduled_process_at: scheduledAt.toISOString(),
      status: 'pending',
    })
    .select()
    .single();

  if (withdrawError) {
    return Response.json({ error: 'Failed to create withdrawal request' }, { status: 500 });
  }

  await supabase
    .from('stakes')
    .update({
      status: 'withdraw_pending',
      withdraw_requested_at: requestedAt.toISOString(),
      withdraw_scheduled_at: scheduledAt.toISOString(),
    })
    .eq('id', stake.id);

  // Notify admins in English
  const adminIds = env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim());
  const adminMsg = `🔔 *New Unstake Request*

👤 User: ${telegramUser.first_name} (@${telegramUser.username || 'no_username'})
💰 Amount: ${stake.amount_ton} TON
📍 Wallet: \`${wallet_address}\`
🔒 Type: ${stake.lock_type}
⏰ Processes at: ${scheduledAt.toLocaleString('en-US')}

ID: \`${withdrawReq.id.slice(0, 8)}\`
/confirm ${withdrawReq.id.slice(0, 8)}
/reject ${withdrawReq.id.slice(0, 8)} <reason>`;

  for (const adminId of adminIds) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: adminId, text: adminMsg, parse_mode: 'Markdown' }),
    });
  }

  return Response.json({
    success: true,
    withdraw_request: {
      id: withdrawReq.id,
      amount_ton: withdrawReq.amount_ton,
      wallet_address: withdrawReq.wallet_address,
      requested_at: withdrawReq.requested_at,
      scheduled_process_at: withdrawReq.scheduled_process_at,
      status: withdrawReq.status,
    },
    message: `Unstake requested! TON will be returned to your wallet at ${scheduledAt.toLocaleString('en-US')}. $MCT keeps earning until then!`,
  });
}
