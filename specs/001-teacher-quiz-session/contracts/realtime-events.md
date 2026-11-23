# 即時事件契約（Socket.IO）

**Feature**: `001-teacher-quiz-session` | 對應 schema：`packages/shared/src/events.ts`

Socket.IO 只負責**伺服器推播**；所有會改變狀態的操作都走 [HTTP API](./http-api.md)。

## 連線與身分

- 路徑：預設 `/socket.io`，與 HTTP 同一個埠。
- 客戶端連線時帶 `auth: { token?: string }`（token 取自 `sessionStorage`）。
- 伺服器在連線中介層驗證 token，並依身分加入 room：

| 身分 | 加入的 room |
|------|-------------|
| 未帶 token | `public` |
| 老師 | `teachers` |
| 學生（第 N 組） | `group:N` |

- token 無效、過期或屬於舊活動：連線以 `connect_error`（`message = "UNAUTHORIZED"`）拒絕，前端清除
  `sessionStorage` 中的 token 並回到登入／加入畫面。
- 學生**只會**加入自己組別的 room，因此伺服器不可能把他組資料送到該分頁（原則 I）。

## 伺服器 → 客戶端事件

### `session:state`

- Payload：`{ "view": PublicView | StudentView | TeacherView, "version": number }`
  - `view` 依接收者的 room 由 `VisibilityPolicy` 產生，各 room 收到的內容不同。
  - `version` 是伺服器每次狀態或作答紀錄變更後遞增的整數，客戶端忽略比目前更舊的版本。
- 發送時機：
  1. **連線建立（含自動重連）後立即**送出一次完整狀態，讓重新整理或斷線的分頁回到正確畫面（FR-014）。
  2. 匯入、開啟、結束成功後，對 `public`、`teachers`、每個 `group:N` 各送出一次。
  3. 接受送出答案後，對 `teachers` 送出（老師即時看到作答狀況，FR-018），並對送出的那一組
     `group:N` 送出（只含該組自己的已送出題號）。其他組別不會收到任何事件，避免透露作答狀況。
  4. 匯出完成後，對 `teachers` 送出（更新 `lastExport`）。
- 推播一律在資料保存成功之後發生。

### `session:reset`

- Payload：`{ "reason": "NEW_ACTIVITY" }`
- 時機：老師在 `CLOSED` 後匯入新文件（開始新的一場）時，送給所有 `group:N`。
- 學生端收到後清除 token（舊活動的學生身分已失效），回到加入畫面。

## 客戶端 → 伺服器事件

- 001 沒有客戶端送往伺服器的自訂事件。

## 時序保證

- 推播順序與伺服器處理順序一致（所有變更經同一個 mutex，見 research R9）。
- 同步目標：狀態變更後 1 秒內所有分頁顯示新階段（SC-003）。
