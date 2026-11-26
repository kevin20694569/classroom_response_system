/** 以執行系統的本地時區，把開啟搶答的時刻轉成 YYYYMMDD-HHmm（月、日、時、分補零為兩位）。 */
function stamp(openedAt: string): string {
  const date = new Date(openedAt);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${String(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

/**
 * 結果 CSV 的檔名（FR-010）：「搶答結果_YYYYMMDD-HHmm.csv」。
 * 使用開啟搶答的時間而不是匯出當下的時間，同一場活動多次匯出的檔名才會相同（SC-006）。
 */
export function csvFileName(openedAt: string): string {
  return `搶答結果_${stamp(openedAt)}.csv`;
}

/** 純 ASCII 的備用檔名，給不支援 UTF-8 檔名的瀏覽器使用（Content-Disposition 的 filename）。 */
export function csvAsciiFileName(openedAt: string): string {
  return `results_${stamp(openedAt)}.csv`;
}
