// functions/api/admin/confirm.ts
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

  // Cek apakah admin
  const adminIds = env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()));
  if (!adminIds.includes(telegramUser.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { withdraw_id } = await request.json() as { withdraw_id: string };
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get admin user record
  const { data: adminUser } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUser.id)
    .single();

  // Update withdraw status
  const { data: withdraw, error } = await supabase
    .from('withdraw_requests')
    .update({
      status: 'confirmed',
      confirmed_by: adminUser?.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', withdraw_id)
    .eq('status', 'pending')
    .select('*, users(telegram_id, full_name)')
    .single();

  if (error || !withdraw) {
    return Response.json({ error: 'Withdraw not found or already processed' }, { status: 404 });
  }

  // Notifikasi user
  const userTelegramId = (withdraw.users as any)?.telegram_id;
  if (userTelegramId) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userTelegramId,
        text: `✅ *Withdraw Dikonfirmasi!*\n\nWithdraw ${withdraw.amount_ton} TON kamu dikonfirmasi.\nAkan diproses pada: ${new Date(withdraw.scheduled_process_at).toLocaleString('id-ID')}\n\nPoin kamu tetap berjalan selama menunggu! 🎯`,
        parse_mode: 'Markdown',
      }),
    });
  }

  return Response.json({ success: true, withdraw });
}
