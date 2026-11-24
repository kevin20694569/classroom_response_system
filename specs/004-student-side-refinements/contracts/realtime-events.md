# 即時事件（004）

**不新增事件**。學生端與老師端仍只訂閱 `session:state` 與 `session:reset`（001、003）；`ClientToServerEvents` 仍為空。

## 推播時機

| 觸發 | public room | 各 group room | teachers room |
|------|-------------|---------------|---------------|
| 活動狀態改變（匯入、開啟、結束） | PublicView（含 `headcounts`） | 各組 StudentView（含 `headcounts`、`members`、`content`） | TeacherView（含送出者） |
| 送出成功 | — | 只有送出的那一組 | TeacherView |
| 名冊改變（加入、30 秒到期移除、離開組別） | PublicView | 每一組 StudentView（人數改變所有組都要更新） | 不推播（老師端不顯示名冊） |
| 新的活動（reset） | 沿用 003：各組收到 `session:reset` 並中斷連線；名冊清空 | | |

## 規則

- 名冊改變的推播使用目前的活動 `version`（不遞增）；前端只忽略比目前更舊的版本，同版本照常套用。
- 學生 socket 連線時，伺服器先把 memberId 加入名冊（或取消移除計時），再送出完整的 StudentView；
  因此重新整理後第一份資料就包含自己。
- 同一 memberId 有多個連線（例如重新整理時新舊連線重疊）時只算一位組員。
- 連線中介層拒絕已離開的 memberId（`connect_error: UNAUTHORIZED`），前端依 003 流程回到選組畫面。
