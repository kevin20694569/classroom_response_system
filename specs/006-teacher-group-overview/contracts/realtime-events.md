# 即時事件（006）

**不新增事件**。各端仍只訂閱 `session:state` 與 `session:reset`（001、003）；`ClientToServerEvents` 仍為空。
`session:state` 的 `TeacherView` 多了 `groupOverview`（見 [teacher-view.md](./teacher-view.md)）。

## 推播時機（粗體為本子功能的變更）

| 觸發 | public room | 各 group room | teachers room |
|------|-------------|---------------|---------------|
| 活動狀態改變（匯入、開啟、結束） | PublicView | 各組 StudentView | TeacherView（**含 `groupOverview`**） |
| 送出成功 | — | 只有送出的那一組 | TeacherView（**標註同步更新**） |
| 名冊改變：加入、30 秒到期移除、離開組別 | PublicView | 每一組 StudentView | **TeacherView**（004 不推播） |
| **名冊改變：`disconnected`（連線歸零、開始緩衝）** | — | — | **TeacherView** |
| **名冊改變：`reconnected`（緩衝期內重連）** | — | — | **TeacherView** |
| 名冊改變：`cleared`（新的活動） | 沿用 004 | 沿用 004 | **TeacherView**（各組 0 人） |
| 新的活動（reset） | 沿用 003：各組收到 `session:reset` 並中斷連線；名冊清空 | | |

## 規則

- 名冊改變的推播使用目前的活動 `version`（不遞增，沿用 004）；前端只忽略比目前更舊的版本，同版本照常套用。
- `disconnected`、`reconnected` **只**推播給 teachers room：學生與公開分頁的人數、成員名單沒有改變，且組員連線狀態
  只給老師（spec FR-016、FR-021）。
- 老師 socket 連線（含重新整理、自動重連）後立即收到完整的 TeacherView，面板回到目前正確狀態（FR-019）。
- 同一 memberId 有多個連線時，只有最後一個連線斷開才發出 `disconnected`；重新整理時新舊連線重疊不會發出事件。
- 推播的 TeacherView 由 `toTeacherView(session, ranking, roster, now)` 產生，與 HTTP `GET /api/session` 的老師回應
  使用同一個函式（`transport/views.ts` 的 `viewFor`），兩邊的資料一致。
