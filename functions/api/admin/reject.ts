// functions/api/admin/reject.ts
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

  const adminIds = env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()));
  if (!adminIds.includes(telegramUser.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { withdraw_id, reason } = await request.json() as { withdraw_id: string; reason: string };
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get withdraw with stake info
  const { data: withdraw } = await supabase
    .from('withdraw_requests')
    .select('*, stakes(id), users(telegram_id, full_name)')
    .eq('id', withdraw_id)
    .eq('status', 'pending')
    .single();

  if (!withdraw) {
    return Response.json({ error: 'Withdraw not found' }, { status: 404 });
  }

  // Reject withdraw
  await supabase
    .from('withdraw_requests')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || 'Ditolak oleh admin',
    })
    .eq('id', withdraw_id);

  // Kembalikan stake ke active
  await supabase
    .from('stakes')
    .update({
      status: 'active',
      withdraw_requested_at: null,
      withdraw_scheduled_at: null,
      withdraw_rejected_at: new Date().toISOString(),
    })
    .eq('id', (withdraw.stakes as any).id);

  // Notifikasi user
  const userTelegramId = (withdraw.users as any)?.telegram_id;
  if (userTelegramId) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userTelegramId,
        text: `❌ *Withdraw Ditolak*\n\nWithdraw ${withdraw.amount_ton} TON ditolak.\nAlasan: ${reason}\n\n✅ Stake kamu tetap aktif dan poin terus berjalan!\nKamu bisa ajukan withdraw lagi kapanpun.`,
        parse_mode: 'Markdown',
      }),
    });
  }

  return Response.json({ success: true });
}
