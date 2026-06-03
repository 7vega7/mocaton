// functions/api/admin/withdraws.ts
import { createClient } from '@supabase/supabase-js';
import { validateTelegramAuth } from '../../_middleware/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_IDS: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const telegramUser = await validateTelegramAuth(request, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const adminIds = env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()));
  if (!adminIds.includes(telegramUser.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: withdraws } = await supabase
    .from('withdraw_requests')
    .select('*, users(username, full_name, telegram_id), stakes(amount_ton, lock_type)')
    .in('status', ['pending', 'confirmed'])
    .order('requested_at', { ascending: true })
    .limit(50);

  return Response.json({ withdraws: withdraws || [] });
}
