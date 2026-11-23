# Data Model：學生端搶答作答與結果檢視

**Feature**: `003-student-quiz-participation` | **Plan**: [plan.md](./plan.md)

本子功能不改變伺服器保存的資料（`data/session.json` 的 `QuizSession` 與 `schemaVersion` 都不變）。
只有一個共用契約欄位新增（§1），其餘都是學生端分頁內的資料（§2～§4）。001、002 的實體定義見
[001 data-model.md](../001-teacher-quiz-session/data-model.md)、[002 data-model.md](../002-teacher-dashboard-enhancements/data-model.md)。

## 1. 共用契約的變更（`packages/shared`）

### QuestionSummary（修改）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `number` | 正整數 | 題號（不變） |
| `kind` | `'single' \| 'group'` | 單題或題組（不變） |
| `blankCount` | 正整數 | 子題數（不變） |
| `blankLabels` | `(string \| null)[]` | **新增**。依子題序號排列，取自 `Blank.label`（「（n）」標記原文）；沒有標記為 `null`。長度 MUST 等於 `blankCount`（research R5） |

驗證規則：

- `blankLabels.length === blankCount`（schema 以 `refine` 檢查）。
- 只含標記原文，MUST NOT 含題目或子題敘述（FR-022）；敘述仍只在 `TeacherQuestionView.prompt`、
  `TeacherBlankView.prompt`。
- 由 `VisibilityPolicy.base()` 產生，公開、學生、老師三種檢視一致；`TeacherQuestionView` 繼承此欄位。

### 沿用、不變的契約

`StudentView`、`OwnSubmission`、`ResultView`、`SubmitRequest`、`SubmitResponse`、`AuthResponse`、
`IdentitySummary`、`ErrorCode` 皆不變。可見性規則（001 FR-020、003 FR-021、Clarifications Q1）：

| 階段 | `StudentView.ownSubmissions` | `StudentView.results` |
|------|------------------------------|------------------------|
| 待開始／搶答進行中 | 只有本組送出的題號與答案 | `null` |
| 已結束 | 只有本組送出的題號與答案 | 每題搶答成功組別與答案；無人搶答為 `null` |

學生資料在任何階段都不含：其他組別的答案或是否送出、`sequence`、順位、`receivedAt`、題目敘述。

## 2. 分頁內保存（`sessionStorage`，research R2、R6）

| 鍵 | 值 | 寫入 | 清除 |
|----|----|------|------|
| `crs.token` | 不透明 token 字串（沿用 001） | 加入組別成功 | 離開組別、身分失效 |
| `crs.identity` | `IdentitySummary` JSON（`role: 'student'`、`groupId`、`activityId`、`expiresAt`） | 加入組別成功 | 離開組別、身分失效 |
| `crs.draft.{activityId}.{groupId}.{questionNumber}` | `string[]` JSON，依子題序號排列的未送出文字 | 每次輸入 | 該題送出成功、`ownSubmissions` 已含該題、離開組別、身分失效 |

讀取 `crs.identity` 與草稿時 MUST 以 schema 驗證（原則 V）；內容壞掉時視為不存在（身分）或空白（草稿）。

## 3. 學生端型別（`apps/web`）

### StudentIdentity

即 `IdentitySummary` 中 `role: 'student'` 的分支：`groupId`、`activityId`、`expiresAt`。

### InvalidationReason

`'NEW_ACTIVITY' | 'EXPIRED'`（research R4）。

### AnswerDraft

某一題的未送出文字：`string[]`，長度等於該題 `blankCount`；缺少的子題以空字串補齊。

### DraftIssue（`validateDraft` 的回傳項目）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `blankIndex` | 正整數 | 子題序號 |
| `kind` | `'EMPTY' \| 'TOO_LONG'` | 去除前後空白後為 0 字，或超過 `ANSWER_MAX_LENGTH`（200）字 |
| `message` | string | 例：「（2）尚未填寫」「（1）超過 200 字」 |

字數以 shared 的 `unicodeLength`（`Array.from(text).length`）計算，與伺服器 `validateAnswers` 一致。

### SubmitOutcome（`QuestionAnswerForm.submit()` 的結果）

| `kind` | 說明 |
|--------|------|
| `SUBMITTED` | 送出成功，帶去除前後空白後的答案 |
| `INVALID_DRAFT` | 前端檢查不通過，帶 `DraftIssue[]`，沒有送出 |
| `REJECTED` | 伺服器拒絕，帶錯誤代碼、訊息與 `details` |
| `IGNORED` | 送出處理中或作答停用，這次點擊被忽略 |

### GroupOutcome（research R11）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `questionNumber` | 正整數 | 題號 |
| `kind` | `OutcomeKind` | `WON`、`SUBMITTED_NOT_WON`、`NOT_SUBMITTED` |
| `ownAnswers` | `BlankAnswer[] \| null` | 本組送出的答案；未送出為 `null` |
| `winnerGroupId` | 組別 \| `null` | 搶答成功組別；無人搶答為 `null` |
| `winnerAnswers` | `BlankAnswer[] \| null` | 搶答成功的答案；無人搶答為 `null` |

畫面文字：`WON` →「本組搶答成功」；`SUBMITTED_NOT_WON` →「已送出，未搶到」；`NOT_SUBMITTED` →「本組未作答」；
`winnerGroupId === null` 時題目結果顯示「無人搶答」。

## 4. 學生端畫面狀態

```text
             ┌──────────────┐  老師匯入（推播）  ┌──────────────┐
 無 token ─▶ │ 等待匯入      │ ────────────────▶ │ 選擇組別      │
             └──────────────┘                   └──────┬───────┘
                                                       │ 加入成功（token）
                                                       ▼
                ┌──────────────────────── 依 StudentView.status ───────────────────────┐
                │ READY：題目清單、輸入停用、可離開組別                                  │
                │ OPEN：可作答與送出                                                     │
                │ CLOSED：結果與本組成績                                                 │
                └──────────────────────────────────────────────────────────────────────┘
   離開組別（只有 READY）／身分失效（NEW_ACTIVITY、EXPIRED）─▶ 選擇組別（顯示原因）
   view.viewer === 'teacher' ─▶ 老師身分提示（不顯示作答功能，research R3）
```

畫面狀態完全由伺服器推播的 `view` 與分頁內的身分決定；學生端不自行改變活動階段（原則 II）。
