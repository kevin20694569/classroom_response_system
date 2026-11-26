# HTTP API 契約：匯出 CSV

**Feature**: `005-results-csv-export`

沿用 001 的認證方式（`Authorization: Bearer <token>`）與錯誤格式（`ApiErrorBodySchema`）。其他 API 不變；
`POST /api/session/export`（Guided Notes）的請求、回應與行為完全不變（FR-016）。

## GET /api/session/export.csv

下載目前這一場活動的完整結果 CSV（FR-003～FR-013）。

**權限**：只限老師（`requireTeacher`）。

**請求**：沒有 body 與查詢參數。

### 成功：200

| Header | 值 |
|--------|----|
| `Content-Type` | `text/csv; charset=utf-8` |
| `Content-Disposition` | `attachment; filename="results_20261126-1032.csv"; filename*=UTF-8''%E6%90%B6%E7%AD%94%E7%B5%90%E6%9E%9C_20261126-1032.csv` |
| `Cache-Control` | `no-store` |

- `filename*` 解碼後為「搶答結果_YYYYMMDD-HHmm.csv」（開啟搶答時間，伺服器所在時區）；`filename` 是 ASCII 的備用檔名。
- Body 是 [csv-format.md](./csv-format.md) 定義的 CSV 內容（UTF-8，開頭有 BOM）。
- 同一場活動重複呼叫，header 與 body 完全相同。
- 呼叫不會改變活動狀態，也不會觸發 `session:state` 推播。

### 錯誤

| 狀態碼 | `error.code` | `error.message` | 情境 |
|--------|--------------|-----------------|------|
| 401 | `UNAUTHORIZED` | 請先以老師身分登入。 | 沒有 token 或 token 無效 |
| 403 | `FORBIDDEN` | 只有老師可以執行這個操作。 | 學生 token |
| 409 | `INVALID_TRANSITION` | 搶答結束後才能匯出 CSV。 | 狀態為 `NOT_IMPORTED`、`READY` 或 `OPEN` |
| 500 | `INTERNAL_ERROR` | 系統發生錯誤，請稍後再試。 | 未預期的錯誤（不含堆疊或內部細節） |

錯誤回應一律是 JSON（`Content-Type: application/json`），**不含**任何送出紀錄、答案或暱稱。

## 共用常數（packages/shared）

| 名稱 | 值 | 使用者 |
|------|----|--------|
| `CSV_EXPORT_PATH` | `/api/session/export.csv` | server 路由、web 下載 |
| `CSV_EXPORT_NOT_CLOSED_MESSAGE` | `搶答結束後才能匯出 CSV。` | server 錯誤訊息、web 停用提示 |
| `CSV_HEADERS` | `['題號','子題','組別','送出者暱稱','答案','搶答順位','送出時間','是否搶答成功']` | server 編碼、測試 |
| `CSV_NO_ANSWER_TEXT` | `無人作答` | server、測試 |
