# 老師端畫面契約：匯出 CSV

**Feature**: `005-results-csv-export`

## 位置

`TeacherDashboard` 在既有的「匯出至原 Guided Notes」區塊（`ExportPanel`）**下方**新增獨立區塊 `CsvExportPanel`。
`ExportPanel` 的內容、文字與行為不變（FR-016）。

## 區塊內容

| 元素 | 文字 | 規則 |
|------|------|------|
| 區塊標題（h2） | 匯出 CSV | `section aria-label="匯出 CSV"` |
| 說明 | 下載所有組別的送出紀錄，可用 Excel 直接開啟。 | 固定顯示 |
| 按鈕 | 匯出 CSV／匯出中… | 只有 `view.status === 'CLOSED'` 而且沒有在下載中時可以按 |
| 停用提示 | 搶答結束後才能匯出 CSV。 | `status !== 'CLOSED'` 時顯示在按鈕旁（`CSV_EXPORT_NOT_CLOSED_MESSAGE`） |
| 成功訊息 | 已下載 {檔名}。 | 例如「已下載 搶答結果_20261126-1032.csv。」 |
| 錯誤訊息 | 伺服器的 `error.message`；網路錯誤為「無法連線到伺服器，請確認系統已啟動。」；其他為「匯出失敗，請稍後再試。」 | 使用既有的 `ErrorBanner`；不下載任何檔案 |

## 行為

1. `status` 經由 `session:state` 推播變成 `CLOSED` 時，按鈕在 1 秒內變成可以按，不需重新整理（FR-002）。
2. 按下按鈕 → `apiDownload(CSV_EXPORT_PATH)` → 從 `Content-Disposition` 的 `filename*` 取得檔名（沒有時用 `filename`，
   再沒有時用「搶答結果.csv」）→ 用 object URL＋`<a download>` 觸發下載 → 釋放 object URL。
3. 只有收到完整的 2xx 回應才觸發下載；任何錯誤都不下載（FR-014）。
4. 匯出 CSV 不改變其他區塊的狀態（例如 Guided Notes 的「上次匯出」不變）。

## 新增的前端模組

| 模組 | 職責 |
|------|------|
| `apps/web/src/api/http.ts` 的 `apiDownload(path)` | 帶 Bearer token 的 GET；成功時回傳 `{ blob, fileName }`；失敗時與 `apiRequest` 一樣丟出 `ApiError` |
| `apps/web/src/api/contentDisposition.ts` 的 `fileNameFromContentDisposition(header)` | 解析 `filename*=UTF-8''…`（百分比解碼）與 `filename="…"` |
| `apps/web/src/utils/download.ts` 的 `saveBlob(blob, fileName)` | 建立 object URL、觸發 `<a download>`、釋放 URL |
| `apps/web/src/pages/teacher/CsvExportPanel.tsx` | 上表的畫面與狀態 |
