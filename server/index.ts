import express from 'express';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

const CRON_SECRET = process.env.CRON_SECRET || 'mocaton2024';

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/process-withdraws', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await processWithdraws();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function processWithdraws() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const now = new Date().toISOString();
  const { data: withdraws, error } = await supabase
    .from('withdraw_requests')
    .select('*, users!user_id(telegram_id, full_name)')
    .eq('status', 'confirmed')
    .lte('scheduled_process_at', now)
    .limit(10);

  if (error) throw new Error(error.message);
  if (!withdraws || withdraws.length === 0) {
    return { processed: 0, message: 'No due withdrawals' };
  }

  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY!,
  });

  const keyPair = await mnemonicToPrivateKey(process.env.TON_ADMIN_MNEMONIC!.split(' '));
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
    walletId: 698983191,
  });
  const walletContract = client.open(wallet);

  let processed = 0;
  const errors: string[] = [];

  for (const withdraw of withdraws) {
    try {
      const seqno = await walletContract.getSeqno();
      await walletContract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [internal({
          to: withdraw.wallet_address,
          value: toNano(withdraw.amount_ton.toString()),
          body: 'Mocaton Unstake',
        })],
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
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userTelegramId,
            text: `✅ *Unstake Processed!*\n\n💰 ${withdraw.amount_ton} TON sent to your wallet!\n\nThank you for staking with Mocaton 🚀`,
            parse_mode: 'Markdown',
          }),
        });
      }

      processed++;
      await new Promise(r => setTimeout(r, 3000));
    } catch (err: any) {
      errors.push(`${withdraw.id.slice(0, 8)}: ${err.message}`);
    }
  }

  return { processed, errors, total: withdraws.length };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
