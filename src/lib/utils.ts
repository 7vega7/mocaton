// src/lib/utils.ts

export function formatPoints(points: number): string {
  return Math.floor(points).toLocaleString('id-ID');
}

export function formatTON(amount: number): string {
  return amount.toFixed(amount % 1 === 0 ? 0 : 2);
}

export function timeUntil(date: string): string {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return 'Sekarang';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours} jam ${minutes} menit lagi`;
  return `${minutes} menit lagi`;
}
