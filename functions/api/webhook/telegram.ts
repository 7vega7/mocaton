import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_IDS: string;
  MINI_APP_URL: string;
  BOT_USERNAME: string;
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
    return new Response('OK', { status: 200 });
  }
}

async function handleMessage(msg: TelegramMessage, supabase: any, env: Env, adminIds: number[]) {
  const text = msg.text || '';
  const chatId = msg.chat.id;
  const isAdmin = adminIds.includes(msg.from.id);

  if (text.startsWith('/start')) {
    await handleStart(msg, supabase, env, text.split(' ')[1] || null, chatId);
  } else if (text === '/points') {
    await handlePoints(msg, supabase, env, chatId);
  } else if (text === '/referral') {
    await handleReferral(msg, supabase, env, chatId);
  } else if (text === '/withdraw') {
    await handleWithdrawStatus(msg, supabase, env, chatId);
  } else if (text === '/help') {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, getHelpText());
  } else if (isAdmin) {
    if (text === '/admin' || text === '/pending') {
      await handleAdminPending(supabase, env, chatId);
    } else if (text.startsWith('/confirm ')) {
      const shortId = text.replace('/confirm ', '').trim();
      await handleAdminConfirm(shortId, supabase, env, chatId, msg.from.id);
    } else if (text.startsWith('/reject ')) {
      const parts = text.replace('/reject ', '').split(' ');
      const shortId = parts[0];
      const reason = parts.slice(1).join(' ') || 'Rejected by admin';
      await handleAdminReject(shortId, reason, supabase, env, chatId, msg.from.id);
    }
  }
}

// ============================================================
// Handle inline button callbacks
// ============================================================
async function handleCallbackQuery(query: TelegramCallbackQuery, supabase: any, env: Env, adminIds: number[]) {
  const chatId = query.message?.chat.id || query.from.id;
  const isAdmin = adminIds.includes(query.from.id);

  if (!isAdmin) {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id, '❌ Admin only');
    return;
  }

  const data = query.data || '';

  // Format: confirm:shortId atau reject:shortId
  if (data.startsWith('confirm:')) {
    const shortId = data.replace('confirm:', '');
    await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id, '⏳ Processing...');
    await handleAdminConfirm(shortId, supabase, env, chatId, query.from.id, query.message?.message_id);
  } else if (data.startsWith('reject:')) {
    const shortId = data.replace('reject:', '');
    await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id, '⏳ Processing...');
    await handleAdminReject(shortId, 'Rejected by admin', supabase, env, chatId, query.from.id, query.message?.message_id);
  }
}

async function handleStart(msg: TelegramMessage, supabase: any, env: Env, referralCode: string | null, chatId: number) {
  const telegramId = msg.from.id;
  let { data: user } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();

  if (!user) {
    let referredById = null;
    if (referralCode) {
      const { data: referrer } = await supabase.from('users').select('id').eq('referral_code', referralCode).single();
      if (referrer) referredById = referrer.id;
    }
    const { data: newCode } = await supabase.rpc('generate_referral_code');
    const { data: newUser } = await supabase.from('users').insert({
      telegram_id: telegramId,
      username: msg.from.username,
      full_name: `${msg.from.first_name}${msg.from.last_name ? ' ' + msg.from.last_name : ''}`,
      referral_code: newCode,
      referred_by: referredById,
    }).select().single();
    user = newUser;
  }

  const miniAppUrl = env.MINI_APP_URL || 'https://mocaton.pages.dev';
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
    `👋 Welcome${user ? ' back' : ''}, *${msg.from.first_name}*!

🪙 *Mocaton — TON Staking & $MCT Rewards*
Stake TONCOIN and earn $MCT tokens every hour!

📊 *Earning Rates:*
• Flexible: 1 MCT/TON/hr
• 1 Week lock: 1.2 MCT/TON/hr
• 1 Month lock: 1.6 MCT/TON/hr

👥 *Referral:* Earn 30% of your referrals' $MCT in real-time!

Tap the button below to open your dashboard:`,
    { inline_keyboard: [[{ text: '🚀 Open Dashboard', web_app: { url: miniAppUrl } }]] }
  );
}

async function handlePoints(msg: TelegramMessage, supabase: any, env: Env, chatId: number) {
  const { data: user } = await supabase.from('users').select('id').eq('telegram_id', msg.from.id).single();
  if (!user) { await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ You are not registered. Send /start first.'); return; }

  const { data: mct } = await supabase.rpc('calculate_user_mct', { p_user_id: user.id });
  if (mct && mct.length > 0) {
    const m = mct[0];
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
      `📊 *Your $MCT Balance*

💰 From Staking: \`${Number(m.stake_mct).toFixed(4)} MCT\`
👥 From Referrals: \`${Number(m.referral_mct).toFixed(4)} MCT\`
✨ *Total: ${Number(m.total_mct).toFixed(4)} MCT*

⚡ Earning Rate: \`${Number(m.mct_per_hour).toFixed(4)} MCT/hr\`
👥 Referral Rate: \`${Number(m.referral_mct_per_hour).toFixed(4)} MCT/hr\``
    );
  }
}

async function handleReferral(msg: TelegramMessage, supabase: any, env: Env, chatId: number) {
  const { data: user } = await supabase.from('users').select('id, referral_code').eq('telegram_id', msg.from.id).single();
  if (!user) { await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ You are not registered. Send /start first.'); return; }

  const botUsername = env.BOT_USERNAME || 'mocatonbot';
  const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referred_by', user.id);
  const { data: mct } = await supabase.rpc('calculate_user_mct', { p_user_id: user.id });

  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
    `👥 *Your Referral Info*

🔑 Code: \`${user.referral_code}\`
🔗 Your referral link:
\`${referralLink}\`

👤 Total Referrals: *${count || 0} users*
💰 MCT from Referrals: \`${Number(mct?.[0]?.referral_mct || 0).toFixed(4)} MCT\`
⚡ Referral Rate: \`${Number(mct?.[0]?.referral_mct_per_hour || 0).toFixed(4)} MCT/hr\`

Share your link and earn *30%* of your referrals' $MCT!`,
    { inline_keyboard: [[{ text: '📤 Share Referral Link', url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🚀 Join Mocaton - Stake TON and earn $MCT tokens!\n\nUse my referral link:')}` }]] }
  );
}

async function handleWithdrawStatus(msg: TelegramMessage, supabase: any, env: Env, chatId: number) {
  const { data: user } = await supabase.from('users').select('id').eq('telegram_id', msg.from.id).single();
  if (!user) { await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ You are not registered. Send /start first.'); return; }

  const { data: withdraws } = await supabase.from('withdraw_requests').select('*').eq('user_id', user.id).in('status', ['pending', 'confirmed']).order('created_at', { ascending: false }).limit(5);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '✅ No pending withdrawals.\n\nOpen the dashboard to request a TON unstake.');
    return;
  }

  let text = '📤 *Withdrawal Status*\n\n';
  for (const w of withdraws) {
    const scheduled = new Date(w.scheduled_process_at);
    const emoji = w.status === 'confirmed' ? '✅' : '⏳';
    text += `${emoji} *${w.amount_ton} TON*\n`;
    text += `Status: ${w.status === 'confirmed' ? 'Confirmed — awaiting 24h' : 'Awaiting admin confirmation'}\n`;
    text += `Processes at: ${scheduled.toLocaleString('en-US')}\n\n`;
  }
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text);
}

async function handleAdminPending(supabase: any, env: Env, chatId: number) {
  const { data: withdraws } = await supabase.from('withdraw_requests').select('*, users(username, full_name, telegram_id), stakes(amount_ton, lock_type)').eq('status', 'pending').order('requested_at', { ascending: true }).limit(10);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '✅ No pending withdrawals at the moment.');
    return;
  }

  for (const w of withdraws) {
    const user = w.users as any;
    const scheduled = new Date(w.scheduled_process_at);
    const shortId = w.id.slice(0, 8);
    const text = `🔔 *Unstake Request*

👤 ${user.full_name} (@${user.username || 'no_username'})
💰 ${w.amount_ton} TON → \`${w.wallet_address.slice(0, 16)}...\`
⏰ Processes: ${scheduled.toLocaleString('en-US')}
🆔 \`${shortId}\``;

    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, {
      inline_keyboard: [[
        { text: '✅ Confirm', callback_data: `confirm:${shortId}` },
        { text: '❌ Reject', callback_data: `reject:${shortId}` },
      ]]
    });
  }
}

async function handleAdminConfirm(shortId: string, supabase: any, env: Env, chatId: number, adminTelegramId: number, messageId?: number) {
  const { data: adminUser } = await supabase.from('users').select('id').eq('telegram_id', adminTelegramId).single();

  const { data: withdraws } = await supabase.from('withdraw_requests')
    .select('*, users(telegram_id, full_name)')
    .filter('id::text', 'ilike', `${shortId}%`)
    .eq('status', 'pending')
    .limit(1);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Withdrawal \`${shortId}\` not found or already processed.`);
    return;
  }

  const withdraw = withdraws[0];
  await supabase.from('withdraw_requests').update({
    status: 'confirmed',
    confirmed_by: adminUser?.id,
    confirmed_at: new Date().toISOString(),
  }).eq('id', withdraw.id);

  const scheduled = new Date(withdraw.scheduled_process_at);

  // Edit pesan lama dengan status confirmed
  if (messageId) {
    await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
      `✅ *Confirmed!*

👤 ${(withdraw.users as any).full_name}
💰 ${withdraw.amount_ton} TON
⏰ Will process at: ${scheduled.toLocaleString('en-US')}`
    );
  } else {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
      `✅ *Withdrawal Confirmed!*\n\n💰 ${withdraw.amount_ton} TON\n👤 ${(withdraw.users as any).full_name}\n⏰ Will process at: ${scheduled.toLocaleString('en-US')}`
    );
  }

  // Notify user
  const userTelegramId = (withdraw.users as any).telegram_id;
  if (userTelegramId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, userTelegramId,
      `✅ *Unstake Confirmed!*\n\nYour unstake of ${withdraw.amount_ton} TON has been confirmed.\nTON will arrive at your wallet by:\n📅 ${scheduled.toLocaleString('en-US')}\n\n$MCT keeps earning until then! 🎯`
    );
  }
}

async function handleAdminReject(shortId: string, reason: string, supabase: any, env: Env, chatId: number, adminTelegramId: number, messageId?: number) {
  const { data: withdraws } = await supabase.from('withdraw_requests')
    .select('*, stakes(id), users(telegram_id, full_name)')
    .filter('id::text', 'ilike', `${shortId}%`)
    .eq('status', 'pending')
    .limit(1);

  if (!withdraws || withdraws.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Withdrawal \`${shortId}\` not found.`);
    return;
  }

  const withdraw = withdraws[0];
  await supabase.from('withdraw_requests').update({
    status: 'rejected',
    rejected_at: new Date().toISOString(),
    rejection_reason: reason,
  }).eq('id', withdraw.id);

  await supabase.from('stakes').update({
    status: 'active',
    withdraw_requested_at: null,
    withdraw_scheduled_at: null,
    withdraw_rejected_at: new Date().toISOString(),
  }).eq('id', (withdraw.stakes as any).id);

  // Edit pesan lama
  if (messageId) {
    await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
      `❌ *Rejected*\n\n👤 ${(withdraw.users as any).full_name}\n💰 ${withdraw.amount_ton} TON\nReason: ${reason}\nStake restored to active.`
    );
  } else {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
      `❌ Withdrawal rejected.\nReason: ${reason}\nStake restored to active.`
    );
  }

  // Notify user
  const userTelegramId = (withdraw.users as any).telegram_id;
  if (userTelegramId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, userTelegramId,
      `❌ *Unstake Rejected*\n\nYour unstake of ${withdraw.amount_ton} TON was rejected.\nReason: ${reason}\n\n✅ Your stake is active again and $MCT keeps earning!\nYou can request unstake anytime.`
    );
  }
}

async function answerCallback(token: string, callbackId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text: text || '' }),
  });
}

async function editMessage(token: string, chatId: number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' }),
  });
}

async function sendMessage(token: string, chatId: number, text: string, replyMarkup?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getHelpText(): string {
  return `🤖 *Mocaton Bot*

📋 *Commands:*
/start — Register & open dashboard
/points — Check your $MCT balance
/referral — Get your referral link
/withdraw — Check withdrawal status
/help — Show this help

📊 *Earning Rates:*
• Flexible: 1 MCT/TON/hr
• 1 Week: 1.2 MCT/TON/hr
• 1 Month: 1.6 MCT/TON/hr

👥 Earn 30% of your referrals' $MCT!`;
}
