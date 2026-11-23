# HTTP API 契約變更：老師端介面優化

**Feature**: `002-teacher-dashboard-enhancements` | 基準：[001 contracts/http-api.md](../../001-teacher-quiz-session/contracts/http-api.md)

只列出變更；其餘端點、驗證、錯誤格式與權限規則全部沿用 001。Schema 定義在 `packages/shared/src/api.ts` 與
`views.ts`。

## `POST /api/session/export`（修改）

- 權限：老師（不變）。
- Request：
  ```text
  { "mode"?: "answers-only" | "answers-with-columns" | "answers-with-note-line" }
  ```
  - 省略 `mode`（例如送出 `{}`）等同 `"answers-only"`，與 001 的呼叫方式相容。
  - `mode` 不是三者之一、或含其他欄位 → `400 VALIDATION_FAILED`，訊息「匯出模式不正確」，不讀取也不寫入文件。
- 200：
  ```text
  {
    "mode": ExportMode,
    "writtenQuestionCount": number,   // 搶答成功、已寫入答案的題數
    "writtenCellCount": number,       // 實際寫入的儲存格數（含新增的表頭與清空的結果欄）
    "exportedAt": string
  }
  ```
- 錯誤（沿用 001）：`INVALID_TRANSITION`（非 `CLOSED`）、`SHEETS_UNAVAILABLE`、`EXPORT_LOCATE_FAILED`
  （列出題號）、`GUIDED_NOTES_INVALID`。
- 保證：
  - 寫入計畫在呼叫 Google 前完整算好；任一題無法定位時不寫入任何內容（FR-022）。
  - 所有儲存格（必要時含補足欄數）以**單一**批次請求寫入，Google 端任一請求失敗時整批都不套用。
  - 成功後 `lastExport` 更新為 `{ exportedAt, writtenQuestionCount, mode }` 並推播給老師（FR-024）。
- Log：記錄 `mode`、寫入題數與格數（不含答案內容以外的機敏資訊；不記錄試算表憑證）。

## 回傳 `TeacherView` 的端點（`GET /api/session`、`POST /api/session/import|open|close`）

回應格式不變（`{ "view": TeacherView }`），`TeacherView` 的內容依 [data-model.md](../data-model.md) §2 擴充：
`questions[].prompt`、`questions[].blanks[]`、`results[].receivedAt`、`serverNow`、`lastExport.mode`。

學生與未登入分頁取得的 `StudentView`／`PublicView` **不變**，不包含任何題目敘述（FR-007、SC-009）。
