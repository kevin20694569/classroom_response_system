# Data Model: 學生端細修：暱稱、組別人數與題目敘述

**Feature**: `004-student-side-refinements` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

只列出相對 001～003 新增或修改的資料。所有共用結構定義在 `packages/shared`（原則 V）。

## 1. 暱稱（Nickname）

| 欄位 | 型別 | 規則 |
|------|------|------|
| `nickname` | string | 去除前後空白後 1～`NICKNAME_MAX_LENGTH`（20）字，以 `unicodeLength` 計算；不得包含控制字元（換行、tab 等）；允許中英文、表情符號；允許重複 |

- `NicknameSchema` 輸出為去除前後空白後的字串；前端暱稱頁與伺服器加入 API 共用。
- 隨機名字（`randomNickname`）只產生 3～10 個英文字母的名字，一定符合上述規則。
- 前端保存：`sessionStorage['crs.nickname']`，只存已確認的暱稱；讀取時以 `NicknameSchema` 驗證，不合格視為沒有暱稱。

## 2. 學生身分（token 與 IdentitySummary）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `role` | `'student'` | 沿用 |
| `groupId` | GroupId | 沿用 |
| `activityId` | string | 沿用；舊活動的 token 失效 |
| `memberId` | UUID | **新增**；加入時由伺服器產生，同一分頁重新整理不變 |
| `nickname` | string | **新增**；加入時的暱稱（已正規化） |
| `issuedAt`、`expiresAt` | ISO 時間 | 沿用（12 小時） |

- token（`TabIdentitySchema` 學生分支）與 `IdentitySummary`（加入回應、`crs.identity`）都加上 `memberId`、`nickname`。
- 004 之前簽發的學生 token 缺少新欄位 → 驗證失敗 → 依 003 流程回到選組畫面（暱稱保留）。
- 已離開的 memberId（§3）即使 token 未過期也視為失效（連線回 `UNAUTHORIZED`、HTTP 回 `401`）。

## 3. 組員名冊（GroupRoster，伺服器記憶體）

`RosterEntry`：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `memberId` | UUID | 鍵 |
| `groupId` | GroupId | 所屬組別 |
| `nickname` | string | 來自 token |
| `joinedSeq` | 正整數 | 第一次出現在名冊的順序（名冊排序依據） |
| `connections` | 非負整數 | 該 memberId 目前的 socket 連線數 |
| `removeAt` | 計時器 / null | 連線數歸零時啟動，30 秒後移除 |

另有 `leftMemberIds: Set<memberId>`（本次活動已離開的組員）。

狀態轉換（每個 memberId）：

```text
（不在名冊） --connected--> 在組內（connections ≥ 1）
在組內 --disconnected 且 connections = 0--> 緩衝中（removeAt 計時）
緩衝中 --connected（30 秒內）--> 在組內（取消計時，joinedSeq 不變）
緩衝中 --30 秒到期--> （不在名冊）
在組內／緩衝中 --leave（只在 READY）--> 已離開（加入 leftMemberIds，不可再連線）
任何狀態 --活動 reset--> 清空（名冊、leftMemberIds、計時器）
```

- 「在組內」與「緩衝中」都計入人數與名冊（FR-012）。
- `headcounts(groups)`：對每個組別回傳 `{ groupId, memberCount }`，沒有人時為 0。
- `membersOf(groupId)`：依 `joinedSeq` 排序的 `{ memberId, nickname }[]`。

## 4. 檢視資料（各角色、各階段收到的欄位）

新增的共用結構：

- `GroupHeadcount = { groupId, memberCount }`
- `GroupMember = { memberId, nickname }`
- `QuestionTexts = { prompt: string | null, blankPrompts: (string | null)[] }`（`blankPrompts` 長度等於 `blankCount`）
- `StudentQuestionView = QuestionSummary & { content: QuestionTexts | null }`

| 欄位 | 未登入（PublicView） | 學生（StudentView） | 老師（TeacherView） |
|------|----------------------|---------------------|---------------------|
| `headcounts` | ✔ 各組人數 | ✔ 各組人數 | ✘（不顯示，clarify） |
| `members` | ✘ | ✔ 只有本組 | ✘ |
| 題目敘述 | ✘ 任何階段 | `content`：READY 以前 `null`；OPEN、CLOSED 才有值 | ✔ 沿用 002 |
| `ownSubmissions[].submitterNickname` | — | ✔ 本組（任何階段） | — |
| `results[].submitterNickname` | — | 只在 CLOSED（`results` 本身只在 CLOSED 有值） | ✔ 任何階段 |
| `submissions[].submitterNickname` | — | — | ✔ 任何階段 |

- 學生端永遠收不到其他組的 `members`；其他組的暱稱只會以 CLOSED 後 `results[].submitterNickname` 出現（FR-014、FR-025）。

## 5. 送出紀錄（Submission）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `submitterNickname` | string / null | **新增**；取自送出者 token 的暱稱；讀取舊的 `data/session.json` 缺少此欄位時為 `null` |

- 被拒絕的送出不產生紀錄，也不記錄送出者。
- `OwnSubmission`、`ResultView`（含 `TeacherResultView`）各加 `submitterNickname`，值來自對應的 `Submission`。

## 6. 學生端畫面狀態

```text
沒有暱稱 ──確認暱稱──> 有暱稱、未加入（選組畫面，可「修改暱稱」回到暱稱頁）
有暱稱、未加入 ──選組成功──> 已加入（作答／結果畫面，顯示本組成員）
已加入 ──離開組別（READY）──> 有暱稱、未加入
已加入 ──身分失效（新的活動、逾時、舊活動）──> 有暱稱、未加入（顯示原因）
老師身分分頁 ──> 老師身分提示（不顯示暱稱頁，沿用 003 FR-008）
```

- 在「有暱稱、未加入」且老師尚未匯入時，畫面沿用 003 的「老師尚未匯入題目，請稍候」，並顯示目前暱稱。

## 7. 批改（converge 新增，research R13）

| 欄位 | 位置 | 說明 |
|------|------|------|
| `correct` | `Submission` | 老師是否勾選答對；預設 `false`（含舊資料） |
| `gradingFinishedAt` | `QuizSession` | 老師按「批改完成」的時間；尚未完成為 `null`；重新匯入時清空 |
| `grading` | `OwnSubmission`（學生） | `PENDING`／`CORRECT`／`INCORRECT`，由 `correct`、`gradingFinishedAt` 與活動狀態推導 |
| `gradingFinished` | `StudentView` | 是否已批改完成；為 `false` 時 `results` 為 `null` |
| `gradingFinishedAt` | `TeacherView` | 同 `QuizSession` |
| `openedAt`、`closedAt`、`serverNow` | `StudentView` | 學生端搶答計時用（research R14） |

每筆送出的批改狀態（學生看到的）：

```text
（搶答進行中）PENDING
已結束 ──老師勾選──> CORRECT ──取消勾選──> PENDING（尚未批改完成）或 INCORRECT（已批改完成）
已結束、未勾選 ──批改完成──> INCORRECT
```

每題的搶答成功：「已結束」時為 `correct` 的送出中 `sequence` 最小者，沒有則無人答對；「搶答進行中」為最先送出（暫定）。
學生的結果標籤（批改完成後）：搶答成功組別「本組搶答成功」、其他答對「回答成功」、未勾「答錯」、沒有送出「本組未作答」。
