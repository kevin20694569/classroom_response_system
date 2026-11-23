# 即時事件契約（003 相對於 001、002 的變更）

**Feature**: `003-student-quiz-participation` | 基準：[001 contracts/realtime-events.md](../../001-teacher-quiz-session/contracts/realtime-events.md)

本子功能**不新增、不刪除任何事件**，連線驗證、room 劃分與推播時機都沿用 001。

## 1. 學生端訂閱的事件

| 事件／情況 | 學生端處理 | 需求 |
|------------|------------|------|
| 連線成功後的 `session:state` | 以 `view` 決定畫面：`public` → 等待匯入或選組；`student` → 依 `status` 顯示待開始／作答／結果；`teacher` → 老師身分提示 | FR-002、FR-008、FR-009 |
| `session:state`（狀態改變、本組送出） | 更新階段、`ownSubmissions`、`results`；舊的 `version` 忽略（001 既有邏輯） | FR-006、FR-009、FR-023 |
| `session:reset { reason: 'NEW_ACTIVITY' }` | 身分失效（reason `NEW_ACTIVITY`），清除身分與草稿，回到選組畫面 | FR-007 |
| `connect_error: UNAUTHORIZED` | 身分失效（reason `EXPIRED`） | FR-007 |
| `disconnect`／重連中 | 顯示「連線中斷，正在重新連線」，停用送出；重連後由 `session:state` 還原 | FR-010 |

## 2. 推播範圍（沿用 001，本子功能以測試再確認）

- 學生分頁只加入 `group:{groupId}` room；沒有 token 的分頁加入 `public` room。
- 某組送出成功時，只有老師與**送出的那一組**收到 `session:state`；其他組別收不到任何事件（FR-021）。
- 活動「已結束」時才在 `StudentView.results` 放入每題搶答成功答案；其他組未搶到的答案永遠不會送給學生
  （Clarifications Q1）。
- `session:state` 中的 `QuestionSummary` 多了 `blankLabels`（見 [http-api.md §2](./http-api.md)）。
