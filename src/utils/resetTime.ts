/**
 * 直近の朝5時のタイムスタンプを返す
 * - 現在が5時以降 → 今日の5:00
 * - 現在が5時より前 → 昨日の5:00
 */
export function getLastResetTime(): Date {
  const now = new Date();
  const today5am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0);

  if (now >= today5am) {
    return today5am;
  } else {
    // 昨日の5時
    return new Date(today5am.getTime() - 24 * 60 * 60 * 1000);
  }
}

/**
 * 次の朝5時のタイムスタンプを返す
 */
export function getNextResetTime(): Date {
  const last = getLastResetTime();
  return new Date(last.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * 次の朝5時までの残り時間を「X時間Y分」で返す
 */
export function getTimeUntilReset(): string {
  const next = getNextResetTime();
  const remaining = next.getTime() - Date.now();
  if (remaining <= 0) return '0分';
  const h = Math.floor(remaining / (60 * 60 * 1000));
  const m = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (h === 0) return `${m}分`;
  return `${h}時間${m}分`;
}

/**
 * 指定時刻が現在のサイクル（直近の5時以降）かどうか
 */
export function isInCurrentCycle(date: Date | string | number): boolean {
  const resetTime = getLastResetTime();
  const target = date instanceof Date ? date : new Date(date);
  return target >= resetTime;
}
