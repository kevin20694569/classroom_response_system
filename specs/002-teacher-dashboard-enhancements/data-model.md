# Data Model：老師端介面優化

**Feature**: `002-teacher-dashboard-enhancements` | **Date**: 2026-11-23 | **Plan**: [plan.md](./plan.md)

本文件只列出相對於 [001 data-model.md](../001-teacher-quiz-session/data-model.md) 的新增與修改；未提及的實體、
欄位、狀態機與驗證規則一律沿用 001。所有結構定義在 `packages/shared`（Zod schema 為唯一來源，原則 V）。

## 1. 領域模型（`packages/shared/src/domain.ts`）

### Question（修改）

| 欄位 | 型別 | 說明 | 規則 |
|------|------|------|------|
| `prompt` | `string \| null` | 新增。單題：題目敘述；題組：題組說明（區塊內不屬於任何子題列的敘述） | 去除前後空白；空字串存為 null；預設 null（舊存檔相容，research R2） |

### Blank（修改）

| 欄位 | 型別 | 說明 | 規則 |
|------|------|------|------|
| `prompt` | `string \| null` | 新增。題組子題的敘述（取該子題作答格所在列的題目欄）；單題一律 null | 同上 |

敘述的讀取規則見 [contracts/guided-notes-format.md](./contracts/guided-notes-format.md) §A。

### ExportMode（新增）

`'answers-only' | 'answers-with-columns' | 'answers-with-note-line'`

| 值 | 畫面名稱 | 一句說明（ExportPanel 顯示，FR-017） |
|----|----------|--------------------------------------|
| `answers-only` | 只有答案 | 只把答案寫入原本的填空格（與先前相同）。 |
| `answers-with-columns` | 答案＋組別時間欄 | 答案寫入填空格，並在表頭列新增「搶答組別」「提交時間」兩欄記錄結果。 |
| `answers-with-note-line` | 答案＋格內附註行 | 答案下方另起一行，以灰色小字記錄組別與時間；複製答案格時會一併複製這一行。 |

### LastExport（修改）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `mode` | `ExportMode` | 新增。該次匯出使用的模式；舊存檔預設 `answers-only` |

`QuizSession`、`Submission`、`PersistedState`（`schemaVersion` 仍為 1）不變。

## 2. 依角色的檢視資料（`packages/shared/src/views.ts`）

| 檢視 | 變更 |
|------|------|
| `PublicView`、`StudentView` | **不變**：`questions` 仍為 `QuestionSummary`（只有題號、題型、子題數），不含任何敘述（FR-007、SC-009） |
| `TeacherView.questions` | 改為 `TeacherQuestionView[]` |
| `TeacherView.results` | 改為 `TeacherResultView[]` |
| `TeacherView.serverNow` | 新增，`string`（ISO 時間）：伺服器產生這份資料的時間，供計時校正（research R5） |

### TeacherQuestionView（新增）

`QuestionSummary` 的欄位（`number`、`kind`、`blankCount`）加上：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `prompt` | `string \| null` | 同 `Question.prompt` |
| `blanks` | `{ index: number; label: string \| null; prompt: string \| null }[]` | 依子題順序；不含儲存格位置 |

### TeacherResultView（新增）

`ResultView` 的欄位加上：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `receivedAt` | `string \| null` | 搶答成功作答的伺服器收件時間；無人搶答為 null（FR-014） |

## 3. API 契約（`packages/shared/src/api.ts`）

| Schema | 變更 |
|--------|------|
| `ExportRequestSchema` | 新增，取代匯出路由原本使用的 `EmptyRequestSchema`：`strictObject({ mode: ExportMode 預設 'answers-only' })` |
| `ExportResponseSchema` | 新增欄位 `mode: ExportMode` |

詳見 [contracts/http-api.md](./contracts/http-api.md)。

## 4. 伺服器內部結構（不屬於共用契約）

### ParsedGuidedNotes（修改，`apps/server/src/domain/guidedNotes/parser.ts`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `headerRowIndex` | `number` | 新增。表頭列（0 起算） |
| `usedColumnCount` | `number` | 新增。工作表使用範圍的欄數（最後一個非空白儲存格或合併範圍的欄號 + 1） |
| `resultColumns` | `{ groupColumn: number \| null; timeColumn: number \| null }` | 新增。表頭列中「搶答組別」「提交時間」所在欄 |

### CellWrite（修改，`apps/server/src/infrastructure/sheets/guidedNotesGateway.ts`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `text` | `string` | 原 `value` 改名；空字串表示清空該格 |
| `mutedFrom` | `number \| null` | 新增。從這個字元位置（UTF-16 索引）起以淡化樣式（較小、灰色）顯示；null 表示整格一般樣式並清除既有文字格式 |

### 匯出寫入計畫（`planExport(session, results, fresh, mode)`）

| 模式 | 寫入的儲存格 |
|------|--------------|
| `answers-only` | 搶答成功題目的每個填空格：答案值（001 規則），`mutedFrom = null` |
| `answers-with-columns` | 同上；另外：缺少的結果欄表頭（在 `usedColumnCount` 起新增）＋每題區塊第一列的「搶答組別」「提交時間」兩格（搶答成功寫值、無人搶答寫空字串） |
| `answers-with-note-line` | 搶答成功題目的每個填空格：答案值；單題或題組最後一個子題另加 `"\n〔第 N 組｜時間〕"`，`mutedFrom` 為換行位置 |

`writtenQuestionCount` 只計搶答成功的題目；`writtenCellCount` 計入所有寫入的儲存格（含表頭與清空的結果欄）。

## 5. 前端畫面狀態（`apps/web`，不屬於共用契約）

| 狀態 | 所在元件 | 值 | 規則 |
|------|----------|----|------|
| 預覽中的題號 | `QuestionList` | `number \| null` | `togglePreview(current, clicked)`：`clicked === current` → null，否則 → clicked；活動識別改變時重建元件（null）；題號不存在視為 null（FR-003、FR-004、FR-008） |
| 計時校正 offset | `SessionTimer` | `number`（毫秒） | 每次收到 TeacherView 時以 `serverNow − Date.now()` 重新計算 |
| 匯出模式 | `ExportPanel` | `ExportMode` | 每次掛載預設 `answers-only`，不記憶（spec Assumptions） |
| 提示開啟中 | `TimeHint` | `boolean` | 滑鼠移入／聚焦開啟；移出／失焦／Esc 關閉 |
