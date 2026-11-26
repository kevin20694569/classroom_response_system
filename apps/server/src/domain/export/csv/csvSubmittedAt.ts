/**
 * 結果 CSV 的送出時間格式：`YYYY-MM-DD HH:mm:ss`，以執行系統的電腦所在時區表示。
 * Excel 直接開啟時會把這個寫法辨識為日期時間並完整顯示；帶毫秒的寫法會被當成「分:秒.小數」，
 * 看不到日期與時。毫秒不輸出，同一秒內的先後以「搶答順位」欄為準。
 * （Guided Notes 匯出仍使用 `formatSubmittedAt`，不受影響。）
 */
export function formatCsvSubmittedAt(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
