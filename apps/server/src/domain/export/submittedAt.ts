/**
 * 匯出用的提交時間格式（002 FR-018）：`YYYY/MM/DD HH:mm:ss.SSS`，以執行系統的電腦所在時區表示。
 * 毫秒保留三位，讓幾乎同時送出的兩組也能分辨先後。
 */
export function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return (
    `${String(date.getFullYear())}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
    pad(date.getMilliseconds(), 3)
  );
}
