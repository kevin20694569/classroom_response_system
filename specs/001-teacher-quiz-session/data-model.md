# Data Model: 使用者角色與老師端搶答活動管理

**Feature**: `001-teacher-quiz-session` | **Date**: 2026-11-23

所有實體的 schema 定義在 `packages/shared/src/domain.ts`（Zod），型別以 `z.infer` 推導；
本文件是該 schema 的說明，兩者必須一致（原則 V）。實體與關係對應
[類別圖](../../diagrams/001-teacher-quiz-session-class.png)。

## 使用者與身分

### Role（列舉）

| 值 | 說明 |
|----|------|
| `teacher` | 老師 |
| `student` | 學生，必須隸屬一個組別 |

### TabIdentity（分頁身分，存在 token 中，不寫入資料檔）

| 欄位 | 型別 | 規則 |
|------|------|------|
| `role` | `Role` | 必填 |
| `groupId` | `GroupId` | `role = student` 時必填，否則不得出現 |
| `activityId` | `string`（UUID） | `role = student` 時必填，綁定加入時的活動 |
| `issuedAt` | ISO 時間字串 | 伺服器簽發時間 |
| `expiresAt` | ISO 時間字串 | `issuedAt` + 12 小時 |

- token = `base64url(JSON payload)` + `.` + `base64url(HMAC-SHA256(payload, SESSION_SECRET))`。
- 驗證失敗、過期、或學生 token 的 `activityId` 與目前活動不同 → 視為未登入（HTTP 401）。
- 前端只存在 `sessionStorage`（FR-003a）。

### User、Teacher、Student

`User` 是由 `TabIdentity` 解析出的使用者物件；`Teacher` 與 `Student` 為其子型別（類別圖）。
本子功能不保存使用者清單：老師身分由密碼驗證取得，學生身分由選擇組別取得。

### Group

| 欄位 | 型別 | 規則 |
|------|------|------|
| `id` | `GroupId`（整數） | 1～`groupCount` |
| `name` | `string` | 固定為「第 {id} 組」 |

- `groupCount` 在匯入時設定，範圍 2～20（FR-004）；重新匯入可變更。

## 搶答活動

### SessionStatus（列舉）

| 值 | 中文 | 說明 |
|----|------|------|
| `NOT_IMPORTED` | 尚未匯入 | 系統初始狀態，沒有題目 |
| `READY` | 待開始 | 已匯入題目，尚未開啟 |
| `OPEN` | 搶答進行中 | 全部題目同時開放作答 |
| `CLOSED` | 已結束 | 不再接受作答，可檢視結果與匯出 |

### 狀態轉換（FR-012）

| 從 | 操作 | 到 | 前置條件 | 其他結果 |
|----|------|----|----------|----------|
| `NOT_IMPORTED` | 匯入 | `READY` | 文件驗證全部通過 | 建立新的 `activityId` |
| `READY` | 重新匯入 | `READY` | 文件驗證全部通過 | 題目與組別整批替換；`activityId` 換新；沒有作答紀錄需要處理 |
| `READY` | 開啟 | `OPEN` | `questions` 至少 1 題 | 記錄 `openedAt` |
| `OPEN` | 結束 | `CLOSED` | — | 記錄 `closedAt` |
| `CLOSED` | 匯入新文件 | `READY` | 請求帶 `confirmDiscard: true`，且文件驗證通過 | 清除題目、作答紀錄與匯出紀錄，換新 `activityId`（舊學生身分失效） |

- 表中以外的轉換一律拒絕（`INVALID_TRANSITION`），包括 `CLOSED → OPEN`（不可重新開啟）與 `OPEN` 時匯入。
- 對已處於目標狀態的重複操作（例如 `OPEN` 時再按開啟）回傳 `ALREADY_IN_STATE`，狀態不變。
- 驗證失敗的匯入不改變任何資料（FR-010）。

### QuizSession

| 欄位 | 型別 | 規則 |
|------|------|------|
| `activityId` | `string`（UUID） \| `null` | `NOT_IMPORTED` 時為 `null` |
| `status` | `SessionStatus` | 見上表 |
| `source` | `GuidedNotesRef` \| `null` | 匯入的文件 |
| `groups` | `Group[]` | 2～20 個 |
| `questions` | `Question[]` | 依文件順序；`READY` 之後至少 1 題 |
| `submissions` | `Submission[]` | 只在 `OPEN` 時新增 |
| `nextSequence` | 整數 | 從 1 開始，每次接受送出後加 1；跨重啟延續 |
| `openedAt`、`closedAt` | ISO 時間字串 \| `null` | 伺服器時間 |
| `lastExport` | `{ exportedAt, writtenQuestionCount }` \| `null` | 最近一次匯出結果 |

### GuidedNotesRef

| 欄位 | 型別 | 規則 |
|------|------|------|
| `spreadsheetId` | `string` | 由老師貼上的網址解析，格式 `[A-Za-z0-9-_]+` |
| `sheetTitle` | `string` | 匯入時選中的工作表名稱，僅供顯示；匯出時依規則重新選擇（FR-006a） |

### Question

| 欄位 | 型別 | 規則 |
|------|------|------|
| `number` | 正整數 | 題號，同一份文件中不重複（FR-007a） |
| `order` | 正整數 | 在文件中的出現順序（1 起） |
| `kind` | `"single"` \| `"group"` | 只涵蓋 1 個作答格為 `single`，2 個以上為 `group`（FR-009a） |
| `blanks` | `Blank[]` | `single` 恰 1 個；`group` ≥ 2 個；依列由上而下 |

### Blank

| 欄位 | 型別 | 規則 |
|------|------|------|
| `index` | 正整數 | 子題序號，從 1 連續編號 |
| `label` | `string` \| `null` | 原有的「（n）」標記（保留原文字形，例如「（1）」）；沒有標記為 `null` |
| `location` | `CellLocation` | 作答格位置 |

- 同一題組的 `label` 必須「全部有」或「全部沒有」；有的話數字必須等於 `index`（從 1 連號）。

### CellLocation

| 欄位 | 型別 | 規則 |
|------|------|------|
| `sheetTitle` | `string` | 工作表名稱 |
| `rowIndex` | 非負整數 | 0 起算；若為合併儲存格，指合併範圍左上角 |
| `columnIndex` | 非負整數 | 0 起算；同上 |

- 匯入時記錄的位置只用於顯示與除錯；**匯出時一律重新解析文件並重新定位**（FR-022），不使用保存的位置寫入。

### Submission

| 欄位 | 型別 | 規則 |
|------|------|------|
| `id` | `string`（UUID） | 伺服器產生 |
| `questionNumber` | 正整數 | 必須是目前題目之一 |
| `groupId` | `GroupId` | 取自送出者的 token，**不接受**請求內容指定 |
| `answers` | `BlankAnswer[]` | 恰好涵蓋該題所有 `Blank.index`，每個 index 一次 |
| `sequence` | 正整數 | 伺服器依處理順序指派，決定順位（FR-016） |
| `receivedAt` | ISO 時間字串 | 伺服器時間，僅供顯示，不用於排序 |

### BlankAnswer

| 欄位 | 型別 | 規則 |
|------|------|------|
| `blankIndex` | 正整數 | 對應 `Blank.index` |
| `text` | `string` | 去除前後空白後 1～200 字（以 Unicode 字元計）；保存去除空白後的內容（FR-017a） |

### 送出規則

1. 狀態必須是 `OPEN`，否則 `SESSION_NOT_OPEN`（FR-015）。
2. 題號必須存在，否則 `QUESTION_NOT_FOUND`。
3. `answers` 必須恰好涵蓋所有子題，否則 `ANSWER_INCOMPLETE`（FR-017）。
4. 每個答案 1～200 字，否則 `ANSWER_INVALID`，`details` 指出哪個子題（FR-017a）。
5. 同一組對同一題已有作答紀錄時拒絕，`ALREADY_SUBMITTED`（spec Assumptions：只採計第一次送出）。
6. 通過後指派 `sequence = nextSequence++`，保存成功才回覆。被拒絕的送出不產生作答紀錄、不消耗序號。

### QuestionResult（推導值，不另外保存）

| 欄位 | 型別 | 規則 |
|------|------|------|
| `questionNumber` | 正整數 | — |
| `winner` | `Submission` \| `null` | 由 `RankingStrategy` 排序後的第一筆；沒有作答為 `null`（無人搶答） |

- 預設 `FirstSubmissionStrategy`：依 `sequence` 由小到大排序。

## 依角色產生的檢視資料（VisibilityPolicy，FR-020）

| 資料 | 未登入（PublicView） | 學生（StudentView） | 老師（TeacherView） |
|------|----------------------|---------------------|---------------------|
| `status`、`groups`、題號清單（含 `kind` 與子題數） | ✔ | ✔ | ✔ |
| 自己組別已送出的題號與答案 | — | ✔（不含 `sequence`、順位、是否成功） | — |
| 所有組別的作答紀錄與順位 | — | — | ✔ |
| 每題的搶答成功組別與答案 | — | 只在 `CLOSED` 後 | ✔（`OPEN` 時為目前第一名） |
| `source`（文件資訊）、`lastExport` | — | — | ✔ |

- 學生在 `CLOSED` 之前看不到自己的順位或是否搶答成功，因為這兩項會透露其他組別的作答狀況。
- 匯入時題目只保存題號與作答格，不保存題目敘述（FR-008）。

## 保存格式（`data/session.json`）

```text
{
  "schemaVersion": 1,
  "session": QuizSession            // 不含任何 token、密碼或憑證
}
```

- 檔案不存在 → 以 `NOT_IMPORTED` 初始狀態啟動。
- 檔案存在但 schema 驗證失敗 → 啟動中止並顯示看得懂的錯誤，不覆蓋原檔（避免資料遺失）。
