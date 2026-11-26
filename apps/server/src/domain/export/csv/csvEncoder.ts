/** UTF-8 位元組順序記號：Excel 靠它判斷是 UTF-8，中文才不會亂碼（FR-011）。 */
const BOM = '\uFEFF';

/** 列與列之間使用 CRLF，符合 RFC 4180，Excel 與其他試算表軟體都能正確讀取。 */
const LINE_BREAK = '\r\n';

/** Excel 會把以這些字元開頭的儲存格當成公式執行 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * 公式防護（FR-013）：學生輸入的答案與暱稱可能以 = + - @ 開頭，Excel 開啟時會被當成公式執行。
 * 開頭是這些字元時在前面加上單引號，Excel 會把它當成純文字顯示；純數字如「-5」也一樣處理，
 * 以免老師看到的內容與學生送出的不同時還不知道原因。
 */
function neutralizeFormula(value: string): string {
  const first = value.charAt(0);
  return FORMULA_TRIGGERS.includes(first) ? `'${value}` : value;
}

/**
 * 引號規則（FR-012，RFC 4180）：值含逗號、雙引號、換行，或前後有空白時，用雙引號包住，
 * 值中的雙引號寫成兩個，避免欄位或列錯位。
 */
function quoteIfNeeded(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value) || value !== value.trim();
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

/** 把單一欄位的值轉成 CSV 欄位文字；null 輸出空字串。 */
export function encodeField(value: string | null): string {
  if (value === null) return '';
  return quoteIfNeeded(neutralizeFormula(value));
}

/** 產生完整的 CSV 文字：BOM、表頭、各列；每列（含最後一列）都以 CRLF 結束。 */
export function encodeCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | null)[])[],
): string {
  const lines = [headers, ...rows].map((record) => record.map(encodeField).join(','));
  return BOM + lines.map((line) => line + LINE_BREAK).join('');
}
