import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TON_ADMIN_MNEMONIC: string;
  TON_RPC_URL: string;
  TON_API_KEY: string;
  CRON_SECRET: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.searchParams.get('secret') !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await processWithdraws(env);
  return Response.json(result);
}

async function processWithdraws(env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const now = new Date().toISOString();

  const { data: dueWithdraws, error } = await supabase
    .from('withdraw_requests')
    .select('*, users!user_id(telegram_id, full_name)')
    .eq('status', 'confirmed')
    .lte('scheduled_process_at', now)
    .limit(10);

  if (error) return { processed: 0, error: error.message };
  if (!dueWithdraws || dueWithdraws.length === 0) {
    return { processed: 0, message: 'No due withdrawals' };
  }

  if (!env.TON_ADMIN_MNEMONIC) return { processed: 0, error: 'TON_ADMIN_MNEMONIC not set' };

  let processed = 0;
  const errors: string[] = [];

  for (const withdraw of dueWithdraws) {
    try {
      // Kirim TON via TON Center API
      const sent = await sendTonTransaction(
        env.TON_ADMIN_MNEMONIC,
        withdraw.wallet_address,
        withdraw.amount_ton,
        env.TON_API_KEY,
        env.TON_RPC_URL
      );

      if (!sent.success) throw new Error(sent.error || 'Transaction failed');

      await supabase.from('withdraw_requests').update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        process_tx_hash: sent.tx_hash || '',
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
      await new Promise(r => setTimeout(r, 2000));

    } catch (err: any) {
      errors.push(`${withdraw.id.slice(0, 8)}: ${err.message}`);
    }
  }

  return { processed, errors, total: dueWithdraws.length };
}

async function sendTonTransaction(
  mnemonic: string,
  toAddress: string,
  amountTon: number,
  apiKey: string,
  rpcUrl: string
): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
  try {
    // Import crypto functions yang compatible dengan edge runtime
    const { mnemonicToPrivateKey } = await import('@ton/crypto');
    const { WalletContractV4, TonClient, internal, toNano } = await import('@ton/ton');

    const client = new TonClient({
      endpoint: rpcUrl || 'https://toncenter.com/api/v2/jsonRPC',
      apiKey,
    });

    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
      walletId: 698983191,
    });

    const walletContract = client.open(wallet);
    const seqno = await walletContract.getSeqno();

    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: toAddress,
          value: toNano(amountTon.toString()),
          body: 'Mocaton Unstake',
        }),
      ],
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
