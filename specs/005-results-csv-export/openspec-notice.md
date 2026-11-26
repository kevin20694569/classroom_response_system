# 005 搶答結果匯出 CSV：對外變更摘要（給 OpenSpec 小組）

**分支**：`005-results-csv-export`　**詳細規格**：[spec.md](./spec.md)

## 一句話

老師在搶答結束後，可以在老師端按「匯出 CSV」，下載一份含所有組別所有送出紀錄的 CSV，用 Windows 版 Excel 直接開啟即可閱讀。既有的「匯出至原 Guided Notes」完全不變。

## 1. 新增的功能

- **新 API**：`GET /api/session/export.csv`，只限老師。詳見 [contracts/http-api.md](./contracts/http-api.md)。
  - 成功回 200，`Content-Type: text/csv; charset=utf-8`、`Cache-Control: no-store`，`Content-Disposition` 同時帶 ASCII `filename` 與 UTF-8 `filename*`。
  - 錯誤：401 `UNAUTHORIZED`（沒登入）、403 `FORBIDDEN`（學生）、409 `INVALID_TRANSITION`（訊息「搶答結束後才能匯出 CSV。」，狀態為尚未匯入、已匯入或搶答中）、500 `INTERNAL_ERROR`。錯誤回應不含任何答案或暱稱。
  - 唯讀：不改變活動狀態、不觸發 `session:state` 推播、不改「上次匯出」資訊；同一場活動重複匯出內容完全相同。
- **新的共用常數**（`packages/shared`）：`CSV_EXPORT_PATH`、`CSV_EXPORT_NOT_CLOSED_MESSAGE`、`CSV_HEADERS`、`CSV_NO_ANSWER_TEXT`。
- **匯出器**：`ResultExporter` 加上泛型（預設型別讓既有的 Guided Notes 匯出實作不變），新增 `CsvResultExporter`。
- **沒有改動**：`POST /api/session/export`（Guided Notes）的請求、回應與行為；資料保存格式；學生端。

## 2. CSV 欄位與格式

詳見 [contracts/csv-format.md](./contracts/csv-format.md)。

**檔案**：UTF-8 並以 BOM 開頭（Excel 中文不亂碼）、逗號分隔、CRLF 換列、每列固定 8 欄。
**檔名**：`搶答結果_YYYYMMDD-HHmm.csv`（開啟搶答的時間，伺服器所在時區）；ASCII 備用檔名 `results_YYYYMMDD-HHmm.csv`。

| 欄位 | 內容 |
|------|------|
| 題號 | 題號 |
| 子題 | 題組為「子題1」「子題2」…；單題與無人作答為空 |
| 組別 | 「第 N 組」 |
| 送出者暱稱 | 送出時記錄的暱稱；沒有記錄時為空 |
| 答案 | 答案原文（題組為該子題的答案），保留換行與所有字元 |
| 搶答順位 | 「第 N 名」，與老師端送出列表一致 |
| 送出時間 | `YYYY-MM-DD HH:mm:ss`（例如 `2026-11-26 13:11:00`），不含毫秒 |
| 是否搶答成功 | 該題第 1 名為「是」，其餘為「否」 |

**內容與排序**
- 列出所有組別的所有被採計送出（不只搶答成功者）。
- 題號由小到大，同題依順位排序；題組的每筆送出依子題拆成多列，同一筆送出的列相鄰，其他欄位相同。
- 沒有任何組別作答的題目恰好一列，答案為「無人作答」，其餘欄位為空。

**編碼規則**
- 值含逗號、雙引號、換行或前後空白時用雙引號包住，雙引號寫成兩個。
- 公式防護：答案或暱稱以 `=`、`+`、`-`、`@`、Tab 或 CR 開頭時，開頭加一個單引號 `'`。
- Excel 文字儲存格（FR-017，僅答案與暱稱欄）：只含數字與 `+ - . , / : % $ e E` 的值，以及 `TRUE`／`FALSE`，輸出為 `="值"`（例如 `="007"`），讓 Excel 顯示原樣而不轉成數字、日期或布林。
- 以文字編輯器或程式讀取時，這類值會看到 `="007"` 而不是 `007`。

**為了 Excel 直接開啟而做的調整**（人工驗證後修正）
- 子題欄不使用文件上的「（1）」：Excel 會把括號數字（半形與全形都一樣）當成負數顯示成 -1；也不用「1-1」，Excel 會轉成日期。
- 送出時間不帶毫秒：帶毫秒的寫法在 Excel 只顯示「分:秒.小數」。同一秒內的先後以「搶答順位」為準。
- 此時間格式只用於 CSV；Guided Notes 匯出仍是原本帶毫秒的格式。

## 3. 畫面變化（老師端）

詳見 [contracts/teacher-ui.md](./contracts/teacher-ui.md)。

- 在「匯出至原 Guided Notes」區塊**下方**新增獨立的「匯出 CSV」區塊；原區塊的文字與行為不變。
- 區塊內容：標題「匯出 CSV」、說明「下載所有組別的送出紀錄，可用 Excel 直接開啟。」、按鈕「匯出 CSV」（下載中顯示「匯出中…」）。
- 只有狀態為「已結束」時按鈕可按；其他狀態停用，並在旁邊顯示「搶答結束後才能匯出 CSV。」搶答結束後 1 秒內按鈕自動啟用，不需重新整理。
- 成功：瀏覽器下載檔案，顯示「已下載 搶答結果_20261126-1032.csv。」
- 失敗：顯示伺服器的錯誤訊息；網路錯誤為「無法連線到伺服器，請確認系統已啟動。」；其他為「匯出失敗，請稍後再試。」失敗時不下載任何檔案。
- 學生端沒有任何變化。

## 4. 驗證狀態

- 自動化測試：完整 `npm test` 通過（69 個檔、632 個測試）。
- 人工驗證（Windows 版 Excel）：清單見 [checklists/manual-verification.md](./checklists/manual-verification.md)，**尚未完成**（T044）。
