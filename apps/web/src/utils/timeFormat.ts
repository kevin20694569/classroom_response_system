const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/**
 * 搶答計時的格式（002 FR-009、Clarification Q2）：無條件捨去到百分秒。
 * 未滿 1 小時為 `mm:ss.cc`，滿 1 小時為 `h:mm:ss.cc`；負數視為 0。
 */
export function formatElapsed(ms: number): string {
  const centiseconds = Math.floor(Math.max(0, ms) / 10);
  const cs = centiseconds % 100;
  const totalSeconds = Math.floor(centiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const tail = `${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
  return hours > 0 ? `${String(hours)}:${tail}` : tail;
}

/** 提交時間（002 FR-015）：本地時區 `HH:mm:ss.SSS`。 */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
