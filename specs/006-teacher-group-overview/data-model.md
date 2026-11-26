# Data Model：老師端學生分組情況面板

**Feature**: `006-teacher-group-overview` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

只列出本子功能新增或修改的資料；其餘沿用 001～005。所有共用結構定義在 `packages/shared`，以 Zod schema 為唯一來源
（原則 V）。

## 1. Submission（修改，保存於 `data/session.json`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `submitterMemberId` | `string (uuid) \| null`，預設 `null` | **新增**。送出者的學生身分，取自 token 的 `memberId`（R1）。006 之前的紀錄載入時為 `null`，不標註到任何組員（FR-008） |

其他欄位（`id`、`questionNumber`、`groupId`、`answers`、`sequence`、`receivedAt`、`submitterNickname`）不變。

驗證規則：

- 只由伺服器寫入；送出請求（`SubmitRequest`）不含此欄位，客戶端無法指定（原則 I）。
- 不影響順位、搶答判定、Guided Notes 匯出與 CSV 匯出（FR-018）。

## 2. GroupOverview（新增，只出現在 `TeacherView`）

```text
TeacherView
└── groupOverview: GroupOverview[]        依組別編號由小到大；尚未匯入時為 []
    ├── groupId: GroupId
    ├── memberCount: number               只算目前在組內（名冊）的組員，等於該組 headcount
    └── members: OverviewMember[]         先在組內（依加入先後），後不在組內（依第一筆送出先後）
        ├── memberId: string (uuid)
        ├── nickname: string              在組內：名冊暱稱；不在組內：第一筆送出的 submitterNickname
        ├── inGroup: boolean              false →「不在組內」（FR-009）
        ├── disconnected: boolean         true →「連線中斷」；只有 inGroup = true 時可能為 true（FR-021）
        └── answered: MemberAnswerTag[]   依題號由小到大
            ├── questionNumber: number
            └── isWinner: boolean         該題 deriveResults 的 winner.id = 此送出 id（FR-010）
```

不變式（以 schema `superRefine` 與單元測試保證）：

- `memberCount` = `members` 中 `inGroup = true` 的數量。
- `inGroup = false` 的成員 `disconnected` 必為 `false`，且 `answered` 至少一筆（不在組內又沒送出過的人不會出現）。
- 同一 `groupOverview` 內 `memberId` 不重複；`answered` 的題號不重複且遞增。
- `inGroup = true` 的成員都排在 `inGroup = false` 之前。

## 3. 名冊（GroupRoster，記憶體，修改）

不寫入 `data/session.json`（沿用 004）。

| 項目 | 變更 |
|------|------|
| `isInGrace(memberId): boolean` | **新增**。連線數為 0 且移除計時器存在 → true |
| `RosterChange.kind` | **新增** `disconnected`（連線數歸零、開始緩衝）、`reconnected`（緩衝期內重新連線） |
| `RosterReader` | 加入 `isInGrace`（`Pick<GroupRoster, 'headcounts' \| 'membersOf' \| 'isInGrace'>`） |

組員狀態轉換（單一 memberId）：

```text
(不在名冊) --connected--> 連線中 --(最後一個連線斷開)--> 緩衝中 [emit disconnected]
緩衝中 --connected--> 連線中 [emit reconnected]
緩衝中 --30 秒到期--> (不在名冊) [emit removed]
連線中 / 緩衝中 --leave（只在 READY）--> (不在名冊，已離開) [emit left]
任何狀態 --clear（新的活動）--> (不在名冊) [emit cleared]
```

`joined`、`removed`、`left`、`cleared` 的行為與 004 相同；人數規則不變（緩衝中仍計入，FR-003、FR-021）。

## 4. 前端畫面狀態（只在瀏覽器）

| 狀態 | 位置 | 說明 |
|------|------|------|
| `wide` | `TeacherDashboard` 中 `useWideLayout()` 的結果 | `matchMedia('(min-width: 1600px)')` 的結果，跨過門檻立即更新（FR-014） |
| `open` | `GroupOverviewToggle` | 窄視窗抽屜是否展開；預設 `false`；元件卸載（變寬）或重新整理後回到 `false` |
