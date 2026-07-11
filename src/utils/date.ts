/**
 * Unified Date & Time Utility
 * Prevents client-side manipulation of the local device clock
 */

let serverTimeOffset = 0;
let hasSynced = false;

/**
 * Synchronizes client clock with the server to prevent streak manipulation
 */
export async function syncServerTime(getApiUrl: (path: string) => string): Promise<void> {
  try {
    const resp = await fetch(getApiUrl('/api/time'));
    if (resp.ok) {
      const data = await resp.json();
      const serverTime = data.timestamp;
      const clientTime = Date.now();
      serverTimeOffset = serverTime - clientTime;
      hasSynced = true;
    }
  } catch (err) {
    console.warn("Failed to sync server time, falling back to local clock:", err);
  }
}

/**
 * Returns a Date object adjusted to match the real server clock
 */
export function getServerDate(): Date {
  if (hasSynced) {
    return new Date(Date.now() + serverTimeOffset);
  }
  return new Date();
}

/**
 * Formats a Date as YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the current date in YYYY-MM-DD format based on server time
 */
export function getTodayString(): string {
  return formatDate(getServerDate());
}

/**
 * Returns yesterday's date in YYYY-MM-DD format based on server time
 */
export function getYesterdayString(): string {
  const d = getServerDate();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

/**
 * Returns start of current week Monday based on server time
 */
export function getStartOfCurrentWeekMonday(): Date {
  const now = getServerDate();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
