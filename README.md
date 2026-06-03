# TON Stake Airdrop

Telegram Mini App untuk staking TONCOIN dengan sistem reward poin dan referral.

## 🌟 Fitur
- **Stake TON** dengan 3 pilihan: Flexible (100 poin/TON/hari), 1 Minggu (120), 1 Bulan (160)
- **Dashboard real-time** — poin terupdate setiap detik via client interpolation
- **Sistem Referral** — 30% dari poin stake referral kamu, real-time
- **Withdraw otomatis** — 24 jam setelah pengajuan, dengan konfirmasi admin
- **Admin panel** — konfirmasi/tolak withdraw via Mini App atau Telegram bot command
- **Smart Contract Tact** di TON blockchain dengan admin key

---

## 📋 Setup Step-by-Step

### 1. Buat Repository GitHub
```bash
# Di PC/laptop (bukan Termux karena keterbatasan Android)
# Atau langsung di GitHub website: New Repository > "tonstake-airdrop"
```

### 2. Buat Bot Telegram
1. Chat [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot`
3. Ikuti instruksi, catat **Bot Token**
4. Kirim `/setmenubutton` → pilih bot → set URL ke `https://tonstake-airdrop.pages.dev`
5. Aktifkan Mini App: `/newapp` → pilih bot → isi form

### 3. Setup Supabase
1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor**
3. Copy-paste isi file `supabase/schema.sql` dan jalankan
4. Catat **Project URL** dan **Service Role Key** (Settings → API)

### 4. Setup Cloudflare Pages
1. Buka [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pages → Create Project → Connect to Git → pilih repo ini
3. Build settings:
   - Build command: `npm run build`
   - Build output: `dist`
4. Environment Variables (Settings → Environment Variables):
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_ADMIN_IDS=123456789  (telegram ID kamu)
   BOT_USERNAME=YourBotUsername
   TON_CONTRACT_ADDRESS=(isi setelah deploy contract)
   TON_ADMIN_MNEMONIC=word1 word2 ... word24
   TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
   TON_API_KEY=(dari toncenter.com)
   ```

### 5. Deploy Smart Contract
```bash
cd contract
npm install

# Set env
export TON_ADMIN_MNEMONIC="word1 word2 ... word24"

# Deploy ke testnet dulu
npm run deploy:testnet

# Setelah test OK, deploy ke mainnet
npm run deploy:mainnet
```

Catat contract address dan update `TON_CONTRACT_ADDRESS` di Cloudflare.

### 6. Set Telegram Webhook
Setelah deploy Cloudflare Pages, jalankan:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://tonstake-airdrop.pages.dev/api/webhook/telegram
```

### 7. GitHub Actions Secrets
Di GitHub repo → Settings → Secrets:
```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
SUPABASE_URL
SUPABASE_ANON_KEY
TON_CONTRACT_ADDRESS
```

---

## 🔧 Cara Set Admin

Setelah kamu daftar via bot (`/start`), jalankan di Supabase SQL Editor:
```sql
UPDATE users SET is_admin = true WHERE telegram_id = YOUR_TELEGRAM_ID;
```

Ganti `YOUR_TELEGRAM_ID` dengan Telegram ID kamu (bisa cek di @userinfobot).

---

## 📁 Struktur File

```
tonstake-airdrop/
├── contract/          # Tact Smart Contract TON
├── src/               # React Frontend
│   ├── pages/         # Home, Stake, Referral, Admin
│   ├── components/    # BottomNav, dll
│   └── lib/           # telegram.ts, utils.ts
├── functions/         # Cloudflare Pages Functions (API)
│   ├── api/webhook/   # Telegram bot webhook
│   ├── api/stake/     # Stake create/cancel
│   ├── api/withdraw/  # Withdraw request/status
│   ├── api/points/    # Real-time points
│   ├── api/referral/  # Referral info
│   ├── api/admin/     # Admin confirm/reject
│   └── api/cron/      # Auto-process withdrawals
└── supabase/
    └── schema.sql     # Database schema lengkap
```

---

## 💡 Logic Penting

### Withdraw Flow
```
User ajukan withdraw jam 01:00
→ scheduled_process_at = 02:00 KEESOKAN HARINYA (+ 24 jam)
→ Admin bisa confirm kapanpun sebelum itu
→ Pada jam 02:00 esok hari → otomatis transfer TON
→ Jika admin reject → stake kembali active, poin tetap jalan
```

### Poin Referral
```
Realtime: 30% × poin_stake_user_referral
Update setiap 30 detik dari server
Client interpolation untuk tampilan smooth
```

### Lock Period
- **Flexible**: Bisa withdraw kapanpun (tunggu 24 jam proses)
- **Weekly**: Tidak bisa withdraw 7 hari pertama
- **Monthly**: Tidak bisa withdraw 30 hari pertama

---

## ⚠️ Catatan Penting

- `TON_ADMIN_MNEMONIC` sangat sensitif — jangan pernah commit ke GitHub!
- Gunakan Cloudflare environment variables untuk semua secret
- Test dulu di TON testnet sebelum mainnet
- Backup mnemonic admin wallet di tempat aman
- Cron job (process-withdraws) perlu diaktifkan manual di Cloudflare Scheduled Workers

---

## 🚀 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Smart Contract | Tact (TON blockchain) |
| Frontend | React + Vite |
| Backend | Cloudflare Pages Functions |
| Database | Supabase (PostgreSQL) |
| Bot | Telegram Bot API |
| Wallet | TON Connect v2 |
| Deploy | GitHub Actions → Cloudflare Pages |
