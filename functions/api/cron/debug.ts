import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  CRON_SECRET: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.searchParams.get('secret') !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const now = new Date().toISOString();

  const { data: all } = await supabase
    .from('withdraw_requests')
    .select('id, status, scheduled_process_at')
    .eq('status', 'confirmed');

  const { data: due } = await supabase
    .from('withdraw_requests')
    .select('id, status, scheduled_process_at')
    .eq('status', 'confirmed')
    .lte('scheduled_process_at', now);

  return Response.json({ server_now: now, confirmed_total: all?.length, due_count: due?.length, confirmed: all, due });
}
