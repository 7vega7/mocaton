// functions/_middleware/auth.ts
// Validasi Telegram Mini App init data

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export async function validateTelegramAuth(
  request: Request,
  botToken: string
): Promise<TelegramUser | null> {
  // Ambil init data dari header
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) return null;

  try {
    const isValid = await verifyTelegramWebAppData(initData, botToken);
    if (!isValid) return null;

    // Parse user dari init data
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;

    return JSON.parse(decodeURIComponent(userStr)) as TelegramUser;
  } catch {
    return null;
  }
}

async function verifyTelegramWebAppData(
  initData: string,
  botToken: string
): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  // Buat data-check-string
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // HMAC-SHA256
  const encoder = new TextEncoder();
  const secretKeyData = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const secretKey = await crypto.subtle.sign(
    'HMAC',
    secretKeyData,
    encoder.encode(botToken)
  );

  const secretKeyImported = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKeyImported,
    encoder.encode(dataCheckString)
  );

  const computedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHash === hash;
}
