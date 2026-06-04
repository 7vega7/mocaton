import { createClient } from '@supabase/supabase-js';
import { TonClient, WalletContractV4, internal, toNano, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TON_CONTRACT_ADDRESS: string;
  TON_ADMIN_MNEMONIC: string;
  TON_RPC_URL: string;
  TON_API_KEY: string;
  CRON_SECRET: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');

  if (secret !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processWithdraws(env);
  return Response.json(result);
}

async function processWithdraws(env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: dueWithdraws, error } = await supabase
    .from('withdraw_requests')
    .select('*, users(telegram_id, full_name)')
    .eq('status', 'confirmed')
    .lte('scheduled_process_at', new Date().toISOString())
    .limit(10);

  if (error || !dueWithdraws || dueWithdraws.length === 0) {
    return { processed: 0, message: 'No due withdrawals' };
  }

  console.log(`Processing ${dueWithdraws.length} withdrawals`);

  const client = new TonClient({
    endpoint: env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: env.TON_API_KEY,
  });

  const mnemonic = env.TON_ADMIN_MNEMONIC.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const adminWallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
    walletId: 698983191,
  });
  const walletContract = client.open(adminWallet);

  let processed = 0;
  const errors: string[] = [];

  for (const withdraw of dueWithdraws) {
    try {
      const seqno = await walletContract.getSeqno();
      await walletContract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: withdraw.wallet_address,
            value: toNano(withdraw.amount_ton.toString()),
            body: `Mocaton Unstake - ${withdraw.id.slice(0, 8)}`,
          }),
        ],
      });

      await supabase.from('withdraw_requests').update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      }).eq('id', withdraw.id);

      await supabase.from('stakes').update({
        status: 'withdrawn',
        withdraw_processed_at: new Date().toISOString(),
      }).eq('id', withdraw.stake_id);

      const userTelegramId = (withdraw.users as any)?.telegram_id;
      if (userTelegramId) {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userTelegramId,
            text: `✅ *Unstake Processed!*\n\n💰 ${withdraw.amount_ton} TON has been sent to your wallet!\n\nThank you for staking with Mocaton 🚀`,
            parse_mode: 'Markdown',
          }),
        });
      }

      processed++;
      await new Promise(r => setTimeout(r, 3000));
    } catch (err: any) {
      console.error(`Failed to process ${withdraw.id}:`, err);
      errors.push(`${withdraw.id}: ${err.message}`);
    }
  }

  return { processed, errors, total: dueWithdraws.length };
}
