// functions/api/webhook/telegram.ts
// Telegram Bot Webhook Handler

import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_IDS: string;
  MINI_APP_URL: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
  date: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const update: TelegramUpdate = await request.json();
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const adminIds = env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()));

    if (update.message) {
      await handleMessage(update.message, supabase, env, adminIds);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, supabase, env, adminIds);
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('OK', { status: 200 }); // Always 200 to Telegram
  }
}

// ============================================================
// Handle text messages
// ============================================================
async function handleMessage(
  msg: TelegramMessage,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  adminIds: number[]
) {
  const text = msg.text || '';
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const isAdmin = adminIds.includes(userId);

  // /start [referral_code]
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const referralCode = parts[1] || null;
    await handleStart(msg, supabase, env, referralCode, chatId);
    return;
  }

  // /points
  if (text === '/points') {
    await handlePoints(msg, supabase, env, chatId);
    return;
  }

  // /referral
  if (text === '/referral') {
    await handleReferral(msg, supabase, env, chatId);
    return;
  }

  // /withdraw
  if (text === '/withdraw') {
    await handleWithdrawStatus(msg, supabase, env, chatId);
    return;
  }

  // /help
  if (text === '/help') {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, getHelpText());
    return;
  }

  // ADMIN COMMANDS
  if (isAdmin) {
    if (text === '/admin' || text === '/pending') {
      await handleAdminPending(supabase, env, chatId);
      return;
    }

    // /confirm <withdraw_id>
    if (text.startsWith('/confirm ')) {
      const withdrawId = text.replace('/confirm ', '').trim();
      await handleAdminConfirm(withdrawId, supabase, env, chatId, userId);
      return;
    }

    // /reject <withdraw_id> <alasan>
    if (text.startsWith('/reject ')) {
      const parts = text.replace('/reject ', '').split(' ');
      const withdrawId = parts[0];
      const reason = parts.slice(1).join(' ') || 'Ditolak oleh admin';
      await handleAdminReject(withdrawId, reason, supabase, env, chatId, userId);
      return;
    }
  }
}

// ============================================================
// /start handler
// ============================================================
async function handleStart(
  msg: TelegramMessage,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  referralCode: string | null,
  chatId: number
) {
  const telegramId = msg.from.id;

  // Cek apakah user sudah ada
  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (!user) {
    // Cari referred_by jika ada referral code
    let referredById = null;
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      if (referrer) referredById = referrer.id;
    }

    // Generate referral code unik
    const { data: newCode } = await supabase.rpc('generate_referral_code');

    // Buat user baru
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramId,
        username: msg.from.username,
        full_name: `${msg.from.first_name}${msg.from.last_name ? ' ' + msg.from.last_name : ''}`,
        referral_code: newCode,
        referred_by: referredById,
      })
      .select()
      .single();

    if (error) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Gagal mendaftar. Coba lagi.');
      return;
    }
    user = newUser;
  }

  const miniAppUrl = `${env.MINI_APP_URL}`;
  const welcomeText = user
    ? `👋 Selamat datang kembali, *${msg.from.first_name}*!`
    : `🎉 Selamat bergabung, *${msg.from.first_name}*!`;

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `${welcomeText}

🪙 *TON Stake Airdrop*
Stake TONCOIN dan dapatkan poin reward setiap hari!

📊 Rate poin:
• Flexible: 100 poin/TON/hari
• 1 Minggu: 120 poin/TON/hari  
• 1 Bulan: 160 poin/TON/hari

👥 Referral: Dapatkan 30% dari poin referral kamu!

Klik tombol di bawah untuk membuka dashboard:`, {
    inline_keyboard: [[
      { text: '🚀 Buka Dashboard', web_app: { url: miniAppUrl } }
    ]]
  });
}

// ============================================================
// /points handler
// ============================================================
async function handlePoints(
  msg: TelegramMessage,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  chatId: number
) {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', msg.from.id)
    .single();

  if (!user) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Kamu belum terdaftar. Ketik /start');
    return;
  }

  const { data: points } = await supabase.rpc('calculate_user_points', {
    p_user_id: user.id
  });

  if (points && points.length > 0) {
    const p = points[0];
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📊 *Poin Kamu*

💰 Poin Stake: ${formatPoints(p.stake_points)}
👥 Poin Referral: ${formatPoints(p.referral_points)}
✨ *Total: ${formatPoints(p.total_points)} poin*

Buka dashboard untuk detail lebih lanjut.`);
  }
}

// ============================================================
// /referral handler
// ============================================================
async function handleReferral(
  msg: TelegramMessage,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  chatId: number
) {
  const { data: user } = await supabase
    .from('users')
    .select('id, referral_code')
    .eq('telegram_id', msg.from.id)
    .single();

  if (!user) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Kamu belum terdaftar. Ketik /start');
    return;
  }

  const botUsername = 'YourBotUsername'; // Ganti dengan username bot kamu
  const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

  // Hitung jumlah referral
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', user.id);

  const { data: points } = await supabase.rpc('calculate_user_points', {
    p_user_id: user.id
  });

  const refPoints = points?.[0]?.referral_points || 0;

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `👥 *Program Referral*

🔗 Kode Referral: \`${user.referral_code}\`
🔗 Link Referral:
\`${referralLink}\`

👤 Total Referral: ${count || 0} orang
💰 Poin dari Referral: ${formatPoints(refPoints)}

Bagikan link ini ke teman kamu!
Kamu dapat *30%* dari poin stake mereka secara real-time.`);
}

// ============================================================
// /withdraw status handler
// ============================================================
async function handleWithdrawStatus(
  msg: TelegramMessage,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  chatId: number
) {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', msg.from.id)
    .single();

  if (!user) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Kamu belum terdaftar. Ketik /start');
    return;
  }

  const { data: withdraws } = await supabase
    .from('withdraw_requests')
    .select('*, stakes(amount_ton, lock_type)')
    .eq('user_id', user.id)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '✅ Tidak ada withdraw yang sedang diproses.\n\nBuka dashboard untuk ajukan withdraw.');
    return;
  }

  let text = '📤 *Status Withdraw*\n\n';
  for (const w of withdraws) {
    const scheduledTime = new Date(w.scheduled_process_at);
    const statusEmoji = w.status === 'confirmed' ? '✅' : '⏳';
    text += `${statusEmoji} ${w.amount_ton} TON\n`;
    text += `Status: ${w.status === 'confirmed' ? 'Dikonfirmasi Admin' : 'Menunggu Konfirmasi'}\n`;
    text += `Akan diproses: ${scheduledTime.toLocaleString('id-ID')}\n\n`;
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text);
}

// ============================================================
// ADMIN: List pending withdraws
// ============================================================
async function handleAdminPending(
  supabase: ReturnType<typeof createClient>,
  env: Env,
  chatId: number
) {
  const { data: withdraws } = await supabase
    .from('withdraw_requests')
    .select('*, users(username, full_name, telegram_id), stakes(amount_ton, lock_type)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(10);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '✅ Tidak ada withdraw pending saat ini.');
    return;
  }

  let text = `📋 *Withdraw Pending (${withdraws.length})*\n\n`;
  for (const w of withdraws) {
    const user = w.users as any;
    const scheduledTime = new Date(w.scheduled_process_at);
    text += `🆔 \`${w.id.slice(0, 8)}...\`\n`;
    text += `👤 ${user.full_name} (@${user.username || 'no_username'})\n`;
    text += `💰 ${w.amount_ton} TON → \`${w.wallet_address.slice(0, 12)}...\`\n`;
    text += `📅 Diajukan: ${new Date(w.requested_at).toLocaleString('id-ID')}\n`;
    text += `⏰ Proses: ${scheduledTime.toLocaleString('id-ID')}\n`;
    text += `\n/confirm ${w.id.slice(0, 8)}\n`;
    text += `/reject ${w.id.slice(0, 8)} <alasan>\n`;
    text += '───────────────\n';
  }

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text);
}

// ============================================================
// ADMIN: Konfirmasi withdraw
// ============================================================
async function handleAdminConfirm(
  shortId: string,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  chatId: number,
  adminTelegramId: number
) {
  // Cari admin user
  const { data: adminUser } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', adminTelegramId)
    .single();

  // Cari withdraw request (short ID)
  const { data: withdraws } = await supabase
    .from('withdraw_requests')
    .select('*, users(telegram_id, full_name, username)')
    .like('id', `${shortId}%`)
    .eq('status', 'pending')
    .limit(1);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Withdraw \`${shortId}\` tidak ditemukan atau sudah dikonfirmasi.`);
    return;
  }

  const withdraw = withdraws[0];

  // Update status ke confirmed
  await supabase
    .from('withdraw_requests')
    .update({
      status: 'confirmed',
      confirmed_by: adminUser?.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', withdraw.id);

  const scheduledTime = new Date(withdraw.scheduled_process_at);
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `✅ Withdraw dikonfirmasi!

💰 ${withdraw.amount_ton} TON
👤 ${(withdraw.users as any).full_name}
⏰ Akan diproses otomatis pada:
${scheduledTime.toLocaleString('id-ID')}`);

  // Notifikasi ke user
  const userTelegramId = (withdraw.users as any).telegram_id;
  if (userTelegramId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, userTelegramId, `✅ *Withdraw Dikonfirmasi!*

Withdraw ${withdraw.amount_ton} TON kamu telah dikonfirmasi admin.
TON akan dikirim ke wallet kamu pada:
📅 ${scheduledTime.toLocaleString('id-ID')}

Selama menunggu, poin kamu tetap berjalan! 🎯`);
  }
}

// ============================================================
// ADMIN: Tolak withdraw
// ============================================================
async function handleAdminReject(
  shortId: string,
  reason: string,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  chatId: number,
  adminTelegramId: number
) {
  const { data: withdraws } = await supabase
    .from('withdraw_requests')
    .select('*, stakes(id), users(telegram_id, full_name)')
    .like('id', `${shortId}%`)
    .eq('status', 'pending')
    .limit(1);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Withdraw \`${shortId}\` tidak ditemukan.`);
    return;
  }

  const withdraw = withdraws[0];

  // Update withdraw status
  await supabase
    .from('withdraw_requests')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', withdraw.id);

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

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Withdraw ditolak.
Alasan: ${reason}
Stake dikembalikan ke active.`);

  // Notifikasi ke user
  const userTelegramId = (withdraw.users as any).telegram_id;
  if (userTelegramId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, userTelegramId, `❌ *Withdraw Ditolak*

Withdraw ${withdraw.amount_ton} TON kamu ditolak admin.
Alasan: ${reason}

✅ Stake kamu tetap aktif dan poin terus berjalan!
Kamu bisa ajukan withdraw lagi kapanpun.`);
  }
}

// ============================================================
// Handle callback query (inline buttons)
// ============================================================
async function handleCallbackQuery(
  query: TelegramCallbackQuery,
  supabase: ReturnType<typeof createClient>,
  env: Env,
  adminIds: number[]
) {
  // Placeholder untuk callback queries jika diperlukan
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: query.id }),
  });
}

// ============================================================
// Utility: Send Telegram message
// ============================================================
async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: object
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formatPoints(points: number): string {
  return Math.floor(points).toLocaleString('id-ID');
}

function getHelpText(): string {
  return `🤖 *TON Stake Airdrop Bot*

📋 *Perintah:*
/start — Daftar & buka dashboard
/points — Cek poin kamu
/referral — Kode & link referral
/withdraw — Status withdraw
/help — Bantuan ini

💡 *Cara Stake:*
1. Buka dashboard via /start
2. Pilih jumlah TON & durasi
3. Konfirmasi transaksi di TON wallet
4. Poin langsung berjalan!

📊 *Rate Poin:*
• Flexible: 100 poin/TON/hari
• 1 Minggu: 120 poin/TON/hari
• 1 Bulan: 160 poin/TON/hari

👥 *Referral:*
Dapatkan 30% dari poin stake teman!`;
}
