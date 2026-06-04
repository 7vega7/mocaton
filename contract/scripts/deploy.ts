import { TonClient, WalletContractV4, internal, toNano, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { StakingPool } from '../build/StakingPool/StakingPool_StakingPool';

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function deploy() {
  const mnemonic = process.env.TON_MNEMONIC;
  const apiKey = process.env.TON_API_KEY;
  if (!mnemonic) throw new Error('TON_MNEMONIC not set');
  if (!apiKey) throw new Error('TON_API_KEY not set');

  console.log('API Key:', apiKey.slice(0, 8) + '...');

  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: apiKey,
  });

  const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
    walletId: 698983191,
  });

  const walletContract = client.open(wallet);
  const adminAddress = wallet.address;
  console.log(`Admin: ${adminAddress.toString({ bounceable: false })}`);

  await delay(1000);
  const balance = await walletContract.getBalance();
  console.log(`Balance: ${fromNano(balance)} TON`);

  if (balance < toNano('0.3')) { console.log('❌ Insufficient!'); process.exit(1); }

  await delay(1000);
  const contract = await StakingPool.fromInit(adminAddress);
  const contractAddress = contract.address;
  console.log(`Contract: ${contractAddress.toString()}`);

  await delay(1000);
  const isDeployed = await client.isContractDeployed(contractAddress);
  if (isDeployed) {
    console.log('✅ Already deployed!');
    console.log(`VITE_CONTRACT_ADDRESS=${contractAddress.toString()}`);
    return;
  }

  console.log('Deploying...');
  await delay(1000);
  const seqno = await walletContract.getSeqno();
  await walletContract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: contractAddress,
        value: toNano('0.3'),
        init: contract.init,
        body: '',
      }),
    ],
  });

  console.log('⏳ Waiting 20 seconds...');
  await delay(20000);

  const deployed = await client.isContractDeployed(contractAddress);
  if (deployed) {
    console.log('✅ Contract deployed!');
    console.log(`\nVITE_CONTRACT_ADDRESS=${contractAddress.toString()}`);
  } else {
    console.log('❌ Failed. Try again.');
  }
}

deploy().catch(console.error);
