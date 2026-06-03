// src/types/index.ts

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface Stake {
  id: string;
  user_id: string;
  amount_ton: number;
  lock_type: 'flexible' | 'weekly' | 'monthly';
  points_per_day: number;
  tx_hash?: string;
  ton_wallet: string;
  status: 'active' | 'withdraw_pending' | 'withdrawn';
  staked_at: string;
  lock_ends_at?: string;
  withdraw_requested_at?: string;
  withdraw_scheduled_at?: string;
  withdraw_processed_at?: string;
  points_earned?: number;
}

export interface PointsData {
  stake_points: number;
  referral_points: number;
  total_points: number;
  referral_count: number;
  active_stakes: Stake[];
  calculated_at: string;
}

export interface WithdrawRequest {
  id: string;
  stake_id: string;
  user_id: string;
  amount_ton: number;
  wallet_address: string;
  requested_at: string;
  scheduled_process_at: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'processed';
  confirmed_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  processed_at?: string;
}

// Telegram WebApp global type
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        openTelegramLink: (url: string) => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}
