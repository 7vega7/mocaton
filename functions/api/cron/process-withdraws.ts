// functions/api/cron/process-withdraws.ts
// Dipanggil oleh Cloudflare Cron Trigger setiap menit
// Memproses withdraw yang sudah waktunya

import { createClient } from '@supabase/supabase-js';
import { TonClient, WalletContractV4, internal, toNano, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TON_CONTRACT_ADDRESS: string;
  TON_ADMIN_MNEMONIC: string;
  TON_RPC_URL: string;   // https://toncenter.com/api/v2/jsonRPC
  TON_API_KEY: string;
}

// Cloudflare Cron Handler
export async function onScheduled(event: { scheduledTime: number }, env: Env) {
  await processWithdraws(env);
}

// Juga bisa dipanggil via GET (untuk testing)
export async function onRequestGet(context: { request: Request; env: Env }) {
  // Cek secret key untuk keamanan
  const url = new URL(context.request.url);
  const secret = url.searchParams.get('secret');

  if (secret !== 'YOUR_CRON_SECRET') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processWithdraws(context.env);
  return Response.json(result);
}

async function processWithdraws(env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Ambil withdraw yang sudah confirmed & waktunya sudah tiba
  const { data: dueWithdraws, error } = await supabase
    .from('withdraw_requests')
    .select('*, users(telegram_id, full_name)')
    .eq('status', 'confirmed')
    .lte('scheduled_process_at', new Date().toISOString())
    .limit(10); // Proses max 10 per batch

  if (error || !dueWithdraws || dueWithdraws.length === 0) {
    return { processed: 0, message: 'No due withdrawals' };
  }

  console.log(`Processing ${dueWithdraws.length} due withdrawals`);

  // Setup TON client
  const client = new TonClient({
    endpoint: env.TON_RPC_URL,
    apiKey: env.TON_API_KEY,
  });

  // Load admin wallet
  const mnemonic = env.TON_ADMIN_MNEMONIC.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const adminWallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });
  const walletContract = client.open(adminWallet);

  let processed = 0;
  const errors: string[] = [];

  for (const withdraw of dueWithdraws) {
    try {
      // Kirim TON dari contract ke wallet user
      // Note: Contract harus sudah di-deploy dan punya saldo cukup
      // Untuk transfer langsung dari admin wallet:
      const seqno = await walletContract.getSeqno();

      await walletContract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: withdraw.wallet_address,
            value: toNano(withdraw.amount_ton.toString()),
            body: `Withdraw from TON Stake Airdrop - ${withdraw.id.slice(0, 8)}`,
          }),
        ],
      });

      // Update status withdraw ke processed
      await supabase
        .from('withdraw_requests')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdraw.id);

      // Update stake ke withdrawn
      await supabase
        .from('stakes')
        .update({
          status: 'withdrawn',
          withdraw_processed_at: new Date().toISOString(),
        })
        .eq('id', withdraw.stake_id);

      // Notifikasi user
      const userTelegramId = (withdraw.users as any)?.telegram_id;
      if (userTelegramId) {
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          userTelegramId,
          `✅ *Withdraw Berhasil Diproses!*

💰 ${withdraw.amount_ton} TON telah dikirim ke:
\`${withdraw.wallet_address}\`

TON kamu sudah dalam perjalanan ke wallet! 🚀
Stake ini sudah tidak aktif lagi.`
        );
      }

      processed++;

      // Delay antar transaksi untuk menghindari seqno conflict
      await new Promise(r => setTimeout(r, 3000));

    } catch (err: any) {
      console.error(`Failed to process withdraw ${withdraw.id}:`, err);
      errors.push(`${withdraw.id}: ${err.message}`);
    }
  }

  return {
    processed,
    errors,
    total: dueWithdraws.length,
  };
}

async function sendTelegramMessage(token: string, chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('Failed to send telegram message:', err);
  }
}
