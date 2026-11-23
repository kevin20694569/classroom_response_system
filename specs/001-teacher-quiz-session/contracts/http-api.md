# HTTP API 契約

**Feature**: `001-teacher-quiz-session` | 對應 schema：`packages/shared/src/api.ts`、`errors.ts`

- Base path：`/api`；請求與回應皆為 JSON（UTF-8）。
- 身分：`Authorization: Bearer <token>`（token 由 `/api/auth/*` 取得，前端存於 `sessionStorage`）。
- 所有請求 body 都以 Zod 驗證；驗證失敗回 `400 VALIDATION_FAILED`。
- **任何請求都不接受客戶端提供的時間、順位或組別結果**（原則 I）。

## 錯誤格式

```text
HTTP 4xx / 5xx
{
  "error": {
    "code": ErrorCode,          // 見下表
    "message": string,          // 給老師或學生看的繁體中文訊息，不含堆疊、路徑或憑證
    "details"?: ErrorDetail[]   // 例如匯入錯誤的位置清單
  }
}

ErrorDetail = {
  "code": string,
  "message": string,
  "sheetTitle"?: string,
  "row"?: number,               // 1 起算，與 Google Sheets 畫面上的列號一致
  "column"?: string,            // 欄名，例如 "G"
  "questionNumber"?: number,
  "blankIndex"?: number
}
```

| ErrorCode | HTTP | 情境 |
|-----------|------|------|
| `VALIDATION_FAILED` | 400 | body 格式錯誤 |
| `UNAUTHORIZED` | 401 | 缺少 token、token 無效或過期、學生 token 屬於舊活動 |
| `INVALID_PASSWORD` | 401 | 老師密碼錯誤（訊息不透露任何密碼資訊） |
| `FORBIDDEN` | 403 | 角色不符（例如學生呼叫老師 API、老師呼叫送出 API） |
| `INVALID_SPREADSHEET_URL` | 400 | 不是 Google Sheets 文件網址 |
| `SHEETS_UNAVAILABLE` | 502 | 文件不存在、未分享給服務帳號、或連線失敗 |
| `GUIDED_NOTES_INVALID` | 422 | 文件格式不符，`details` 列出所有問題與位置 |
| `EXPORT_LOCATE_FAILED` | 422 | 匯出前無法定位某些題目，`details` 列出題號；未寫入任何內容 |
| `INVALID_TRANSITION` | 409 | 目前狀態不允許此操作（含 `CLOSED` 時開啟、`OPEN` 時匯入） |
| `ALREADY_IN_STATE` | 409 | 重複開啟或重複結束 |
| `CONFIRM_DISCARD_REQUIRED` | 409 | `CLOSED` 時匯入新文件但未帶 `confirmDiscard: true` |
| `NO_ACTIVE_ACTIVITY` | 409 | 尚未匯入題目時學生嘗試加入 |
| `INVALID_GROUP` | 400 | 組別編號不在 1～groupCount |
| `SESSION_NOT_OPEN` | 409 | 非 `OPEN` 狀態送出答案 |
| `QUESTION_NOT_FOUND` | 404 | 題號不存在 |
| `ANSWER_INCOMPLETE` | 400 | 題組未包含所有子題答案 |
| `ANSWER_INVALID` | 400 | 答案空白或超過 200 字，`details` 指出子題 |
| `ALREADY_SUBMITTED` | 409 | 該組已送出過此題 |
| `INTERNAL_ERROR` | 500 | 未預期錯誤（只回通用訊息，細節寫入 log） |

## 身分

### `POST /api/auth/teacher`

- Request：`{ "password": string }`（1～200 字）
- 200：`{ "token": string, "identity": { "role": "teacher", "expiresAt": string } }`
- 錯誤：`INVALID_PASSWORD`

### `POST /api/auth/student`（002 學生端與模擬腳本使用）

- Request：`{ "groupId": number }`
- 200：`{ "token": string, "identity": { "role": "student", "groupId": number, "activityId": string, "expiresAt": string } }`
- 錯誤：`NO_ACTIVE_ACTIVITY`、`INVALID_GROUP`

## 活動狀態

### `GET /api/session`

- 不帶 token：回傳 `PublicView`；帶 token：依角色回傳 `StudentView` 或 `TeacherView`
  （欄位定義見 [data-model.md](../data-model.md)「依角色產生的檢視資料」）。
- 200：`{ "view": PublicView | StudentView | TeacherView }`
- 錯誤：`UNAUTHORIZED`（帶了無效 token 時）

## 老師專屬操作（需老師 token，否則 `UNAUTHORIZED` / `FORBIDDEN`）

### `POST /api/session/import`

- Request：
  ```text
  {
    "spreadsheetUrl": string,       // Google Sheets 文件網址
    "groupCount": number,           // 2～20
    "confirmDiscard"?: boolean      // 狀態為 CLOSED 時必須為 true
  }
  ```
- 200：`{ "view": TeacherView }`（含題號清單、題組子題數、選中的工作表名稱）
- 錯誤：`INVALID_SPREADSHEET_URL`、`SHEETS_UNAVAILABLE`、`GUIDED_NOTES_INVALID`、
  `INVALID_TRANSITION`（`OPEN`）、`CONFIRM_DISCARD_REQUIRED`
- 保證：失敗時系統資料完全不變；成功時整批替換並保存後才回覆。

### `POST /api/session/open`

- Request：`{}`
- 200：`{ "view": TeacherView }`
- 錯誤：`INVALID_TRANSITION`、`ALREADY_IN_STATE`

### `POST /api/session/close`

- Request：`{}`
- 200：`{ "view": TeacherView }`
- 錯誤：`INVALID_TRANSITION`、`ALREADY_IN_STATE`

### `POST /api/session/export`

- Request：`{}`
- 200：`{ "writtenQuestionCount": number, "writtenCellCount": number, "exportedAt": string }`
  （沒有任何搶答成功的題目時，兩個數量皆為 0，前端顯示「沒有可匯出的答案」）
- 錯誤：`INVALID_TRANSITION`（非 `CLOSED`）、`SHEETS_UNAVAILABLE`、`EXPORT_LOCATE_FAILED`、`GUIDED_NOTES_INVALID`
  （匯出時文件已無法辨識）
- 保證：寫入前先完成所有目標格定位；任一題無法定位則不寫入任何內容（FR-023）。

## 學生專屬操作（需學生 token；001 提供契約，畫面於 002 實作）

### `POST /api/submissions`

- Request：
  ```text
  {
    "questionNumber": number,
    "answers": [ { "blankIndex": number, "text": string } ]
  }
  ```
  組別取自 token，請求中**不得**也**無法**指定組別。
- 200：`{ "submissionId": string, "receivedAt": string }`（**不含**順位或是否搶答成功，FR-020）
- 錯誤：`SESSION_NOT_OPEN`、`QUESTION_NOT_FOUND`、`ANSWER_INCOMPLETE`、`ANSWER_INVALID`、`ALREADY_SUBMITTED`
