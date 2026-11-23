# 即時事件契約變更：老師端介面優化

**Feature**: `002-teacher-dashboard-enhancements` | 基準：[001 contracts/realtime-events.md](../../001-teacher-quiz-session/contracts/realtime-events.md)

事件名稱、room、發送時機、版本號與 `session:reset` 規則全部沿用 001，**沒有新增事件**。

## `session:state`（payload 內容擴充）

- 送往 `teachers` room 的 `TeacherView` 依 [data-model.md](../data-model.md) §2 擴充：
  - `questions[].prompt`、`questions[].blanks[].{index,label,prompt}`：題目預覽用（FR-006）。
  - `results[].receivedAt`：搶答結果的提交時間提示用（FR-014）。
  - `serverNow`：每次產生 TeacherView 時填入伺服器當下時間，前端據此校正計時（FR-012）。
  - `lastExport.mode`：顯示上次匯出的模式（FR-024）。
- 送往 `public` 與 `group:N` 的 `PublicView`／`StudentView` **不變**，不含上述任何新欄位。

## 不推播的事項

- **題目預覽**：預覽狀態只存在老師分頁本地，不送往伺服器、不產生任何事件（FR-007）。
- **計時**：伺服器不推播計時；各分頁依 `openedAt`／`closedAt`／`serverNow` 自行計算（research R5）。
