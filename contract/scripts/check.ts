import { TonClient, WalletContractV4, WalletContractV3R2, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

async function check() {
  const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC' });
  const mnemonic = process.env.TON_MNEMONIC;
  if (!mnemonic) throw new Error('TON_MNEMONIC not set');

  const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));

  // V4 dengan workchain dan subwallet berbeda
  const configs = [
    { name: 'V3R2 wc0', w: WalletContractV3R2.create({ publicKey: keyPair.publicKey, workchain: 0 }) },
    { name: 'V4 wc0 sub698', w: WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0, walletId: 698983191 }) },
    { name: 'V4 wc0 sub0', w: WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0, walletId: 0 }) },
    { name: 'V4 wc0 default', w: WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 }) },
  ];

  for (const { name, w } of configs) {
    try {
      const addr = w.address.toString({ bounceable: false });
      const bal = fromNano(await client.open(w as any).getBalance());
      console.log(`${name}: ${addr} | ${bal} TON`);
    } catch (e: any) {
      console.log(`${name}: error - ${e.message}`);
    }
  }
}

check().catch(console.error);
