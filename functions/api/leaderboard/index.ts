import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { env } = context;
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*');

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const ranked = (data || []).map((row, i) => ({
      rank: i + 1,
      username: row.username || 'Anonymous',
      full_name: row.full_name || 'Anonymous',
      stake_mct: row.stake_mct || 0,
      referral_mct: row.referral_mct || 0,
      total_mct: (row.stake_mct || 0) + (row.referral_mct || 0),
    }));

    return Response.json({ leaderboard: ranked });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
