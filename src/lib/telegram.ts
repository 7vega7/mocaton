// src/lib/telegram.ts

export function initTelegramApp() {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
}

export function getTelegramUser() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

export function getInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

export function getStartParam(): string | undefined {
  return window.Telegram?.WebApp?.initDataUnsafe?.start_param;
}

export function isDarkMode(): boolean {
  return window.Telegram?.WebApp?.colorScheme === 'dark';
}
