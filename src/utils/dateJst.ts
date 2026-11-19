/**
 * JST (Asia/Tokyo, UTC+9) with a 05:00 AM daily boundary.
 * Any time between 00:00 and 04:59 JST belongs to the previous calendar day's Rebuild cycle.
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_BOUNDARY_SHIFT_MS = 5 * 60 * 60 * 1000;

export function getJstRebuildDateKey(date: Date = new Date()): string {
  // Convert UTC timestamp to JST, then shift back 5 hours so 05:00 JST becomes 00:00
  const shiftedMs = date.getTime() + JST_OFFSET_MS - DAY_BOUNDARY_SHIFT_MS;
  const shifted = new Date(shiftedMs);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getJstNowFormatted(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays);
  const dt = new Date(utc);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPastDateKeys(todayKey: string, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(shiftDateKey(todayKey, -i));
  }
  return keys;
}

export function formatShortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${Number(m)}/${Number(d)}`;
}
