// 子功能 005：搶答結果匯出 CSV 的前後端共用契約（constitution 原則 V）

/** 下載結果 CSV 的 HTTP 路徑；只有老師可以呼叫，且搶答結束後才能匯出 */
export const CSV_EXPORT_PATH = '/api/session/export.csv';

/** 搶答尚未結束時，伺服器拒絕匯出與老師端按鈕旁顯示的同一句提示（FR-003、FR-014） */
export const CSV_EXPORT_NOT_CLOSED_MESSAGE = '搶答結束後才能匯出 CSV。';

/** CSV 表頭：每一列是一筆送出紀錄（題組為每個子題一列），欄位順序固定（FR-005） */
export const CSV_HEADERS = [
  '題號',
  '子題',
  '組別',
  '送出者暱稱',
  '答案',
  '搶答順位',
  '送出時間',
  '是否搶答成功',
] as const;

/** 沒有任何組別作答的題目，答案欄顯示的文字（FR-008） */
export const CSV_NO_ANSWER_TEXT = '無人作答';
