---

description: "子功能 005：搶答結果匯出 CSV — 實作任務清單"
---

# Tasks: 搶答結果匯出 CSV

**Input**: `specs/005-results-csv-export/` 中的 spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（皆已完成）；
`diagrams/005-results-csv-export-*.puml/.png` 為設計藍圖

**Tests**: constitution 原則 VII 要求每個功能都有自動化測試（正常＋邊界／錯誤案例），權限要有專門測試，因此本清單包含
測試任務。每個 Phase 結束時都有「品質關卡」：型別檢查、lint、format、測試必須全部通過，並回報執行的指令與結果，
才能進入下一個 Phase。

**Organization**: 依 user story 分組：US1（下載結果 CSV，P1）、US2（所有送出與無人作答完整列出，P1）、
US3（特殊字元不錯位，P2）、US4（搶答結束前無法匯出，P2）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、不依賴未完成的任務）
- **[Story]**: 所屬 user story（US1～US4，對應 spec.md）
- 每個任務都寫明檔案路徑；路徑依 plan.md 的結構（`packages/shared`、`apps/server`、`apps/web`）

## 共同約定（所有任務都適用）

- 沿用 001～004 的約定：TypeScript `strict`、**不得使用 `any`**；共用常數一律從 `@crs/shared` 匯入；測試不連線 Google。
  伺服器整合測試以 `apps/server/tests/helpers/testApp.ts` 的 `startTestApp`、`loginTeacher`、`teacherWithImport`、
  `joinStudent`、`submitAnswers`、`call`、`restartApp` 為準；服務單元測試用 `helpers/serviceFactory.ts` 的 `createService`；
  測試資料用 `helpers/builders.ts` 的 `readySession`、`singleQuestion`、`groupQuestion`、`submission`。
- **不得新增任何相依套件**（research R4）；`package.json` 與 `package-lock.json` 不變。
- 時區：server 與 web 測試已固定 `TZ=Asia/Taipei`（`vitest.config.ts`），時間字串依此撰寫預期值。
- **Guided Notes 匯出不得改變**（FR-016）：`exportPlan.ts`、`guidedNotesExporter.ts`、`ExportPanel.tsx`、
  `POST /api/session/export` 與其測試不得修改（`resultExporter.ts` 只加泛型，T003）。
- 畫面文字依 [contracts/teacher-ui.md](./contracts/teacher-ui.md)；API 依 [contracts/http-api.md](./contracts/http-api.md)；
  CSV 格式依 [contracts/csv-format.md](./contracts/csv-format.md)；所有訊息使用繁體中文且不含內部細節（FR-014）。
- log 不得記錄答案、暱稱或 token（FR-015）。
- 實作若需偏離 plan、contracts 或 `diagrams/005-*`：先更新圖表並執行 `java -jar plantuml.jar "./diagrams/005-*.puml"`，
  再改程式（原則 VI）。

---

## Phase 1: Setup

**Purpose**: 確認基準

- [X] T001 在 `005-results-csv-export` branch 執行 `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`，確認 001～004 的基準全部通過並回報結果

**Checkpoint**: 基準綠燈

---

## Phase 2: Foundational（共用契約與擴充點）

**Purpose**: 前後端共用常數、`ResultExporter` 泛型化

**⚠️ CRITICAL**: 本 Phase 完成前不得開始任何 user story

- [X] T002 [P] 新增 `packages/shared/src/csvExport.ts`：`CSV_EXPORT_PATH = '/api/session/export.csv'`、`CSV_EXPORT_NOT_CLOSED_MESSAGE = '搶答結束後才能匯出 CSV。'`、`CSV_HEADERS = ['題號','子題','組別','送出者暱稱','答案','搶答順位','送出時間','是否搶答成功'] as const`、`CSV_NO_ANSWER_TEXT = '無人作答'`（contracts/http-api.md「共用常數」）；每個常數附繁體中文註解說明業務意義；在 `packages/shared/src/index.ts` 匯出；在 `packages/shared/tests/schemas.test.ts` 新增測試：表頭恰為 8 欄且順序如上
- [X] T003 [P] 修改 `apps/server/src/domain/export/resultExporter.ts`：介面改為 `ResultExporter<TReport = ExportReport>`，`export(session, results, mode): Promise<TReport>`；更新註解說明 CSV 是第二個實作、不需要的實作可以忽略 `mode`（research R1）。`GuidedNotesExporter` 與 `QuizSessionServiceDeps.exporter` 不得修改，確認型別檢查通過
- [X] T004 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 共用常數可用、擴充點可接受 CSV 實作

---

## Phase 3: User Story 1 - 搶答結束後下載完整結果 CSV (Priority: P1) 🎯 MVP

**Goal**: 老師在「已結束」按下「匯出 CSV」，下載「搶答結果_YYYYMMDD-HHmm.csv」，Excel 直接開啟不亂碼，單題的每筆送出一列

**Independent Test**: 單題活動、3 組，第 2 組、第 1 組依序送出第 1 題，第 3 組送出第 2 題，結束後匯出：檔名含開啟搶答時間、
檔案以 BOM 開頭、第 1 題兩列（第 2 組第 1 名「是」、第 1 組第 2 名「否」）、第 2 題一列；重複匯出內容相同

### Tests for User Story 1

- [X] T005 [P] [US1] 新增 `apps/server/tests/unit/csvFileName.test.ts`：`csvFileName('2026-11-26T02:32:15.123Z')` 為 `搶答結果_20261126-1032.csv`、`csvAsciiFileName` 為 `results_20261126-1032.csv`；月、日、時、分補零（例如 `2026-01-02T00:03:00Z` → `20260102-0803`）；跨日依本地時區計算
- [X] T006 [P] [US1] 新增 `apps/server/tests/unit/csvEncoder.test.ts`（基本結構）：輸出以 `﻿` 開頭；第一列為 `CSV_HEADERS` 以逗號連接；每列（含最後一列）以 `\r\n` 結束；每列 8 欄；`null` 輸出空字串
- [X] T007 [P] [US1] 新增 `apps/server/tests/unit/resultRows.test.ts`（單題）：以 `readySession({ status: 'CLOSED', questions: [singleQuestion(1), singleQuestion(2)], submissions: [...] })` 與 `FirstSubmissionStrategy`、`deriveResults` 建立資料；同題依 `sequence` 排序；`rankLabel` 為「第 1 名」「第 2 名」；`groupLabel` 為「第 N 組」；`submittedAt` 等於 `formatSubmittedAt(receivedAt)`；第 1 名 `isWinner` 為「是」、其餘「否」；單題 `blankLabel` 為 `null`；`submitterNickname` 原樣帶入
- [X] T008 [P] [US1] 新增 `apps/server/tests/unit/csvResultExporter.test.ts`：對同一個 CLOSED session 呼叫兩次 `export()`，`fileName` 與 `content` 完全相同；傳入不同的 `mode`（`answers-only`、`answers-with-columns`）結果相同；`rowCount` 等於資料列數（不含表頭）；`content` 以 `CSV_HEADERS` 那一列開始（BOM 之後）
- [X] T009 [P] [US1] 在 `apps/server/tests/unit/quizSessionService.test.ts` 新增 `describe('QuizSessionService.exportCsv')`：CLOSED 時回傳 `CsvExport`；呼叫後 `getVersion()` 不變、`getSession()` 是同一個物件、`lastExport` 不變、repository 沒有被 `save`、`onChange` 監聽者沒有被呼叫（FR-004）；成功時 logger 收到 `event: 'csv_export.succeeded'` 與 `rowCount`，且 log 物件中不含任何答案文字或暱稱
- [X] T010 [P] [US1] 新增 `apps/server/tests/integration/csvExport.test.ts`（成功路徑）：以 `teacherWithImport` 匯入單題範例、`joinStudent`／`submitAnswers` 送出、`POST /api/session/close` 後，以老師 token `GET /api/session/export.csv`：狀態 200；`content-type` 為 `text/csv; charset=utf-8`；`cache-control` 為 `no-store`；`content-disposition` 含 `attachment`、`filename="results_YYYYMMDD-HHmm.csv"` 與 `filename*=UTF-8''` 加上 `encodeURIComponent('搶答結果_YYYYMMDD-HHmm.csv')`；body 以 BOM 開頭、表頭正確、列內容與送出一致；連續請求兩次 body 完全相同（SC-006）
- [X] T011 [P] [US1] 新增 `apps/web/tests/contentDisposition.test.ts`：`filename*=UTF-8''%E6%90%B6...` 解出中文檔名；同時有 `filename` 與 `filename*` 時優先 `filename*`；只有 `filename="results_x.csv"` 時回傳它；header 為 `null`、空字串或格式錯誤時回傳 `null`；百分比編碼不合法時不丟例外、改用 `filename`
- [X] T012 [P] [US1] 新增 `apps/web/tests/CsvExportPanel.test.tsx`（成功路徑）：以 `vi.stubGlobal('fetch', ...)` 回傳 `new Response('﻿題號,...', { status: 200, headers: { 'Content-Disposition': ... } })`（`mockFetch` 只支援 JSON，此處直接 stub）；mock `URL.createObjectURL`／`revokeObjectURL` 與 `HTMLAnchorElement.prototype.click`；view 為 CLOSED 時按下「匯出 CSV」：fetch 的 URL 為 `CSV_EXPORT_PATH`、帶 `Authorization: Bearer`；anchor 的 `download` 為「搶答結果_20261126-1032.csv」；顯示「已下載 搶答結果_20261126-1032.csv。」；下載中按鈕文字為「匯出中…」且停用

### Implementation for User Story 1

- [X] T013 [P] [US1] 新增 `apps/server/src/domain/export/csv/csvFileName.ts`：`csvFileName(openedAt: string): string` 回傳「搶答結果_YYYYMMDD-HHmm.csv」，`csvAsciiFileName(openedAt: string): string` 回傳「results_YYYYMMDD-HHmm.csv」；以執行系統的本地時區計算，月、日、時、分補零為兩位（contracts/csv-format.md §5、research R6）
- [X] T014 [P] [US1] 新增 `apps/server/src/domain/export/csv/csvEncoder.ts`：`encodeField(value: string | null): string`（本 Phase 只把 `null` 轉成空字串，引號與公式防護在 US3 加入）、`encodeCsv(headers: readonly string[], rows: readonly (readonly (string | null)[])[]): string`：開頭 `﻿`，欄位以 `,` 連接，每列（含最後一列）以 `\r\n` 結束（contracts/csv-format.md §1）
- [X] T015 [US1] 新增 `apps/server/src/domain/export/csv/resultRows.ts`：定義 `ResultRow`（`questionNumber: number`；`blankLabel: string | null`；`groupLabel: string | null`；`submitterNickname: string | null`；`answer: string`；`rankLabel: string | null`；`submittedAt: string | null`；`isWinner: '是' | '否' | null`，data-model.md §2）與 `toCsvRecord(row): (string | null)[]`（依 `CSV_HEADERS` 順序）；`buildResultRows(session, ranking, results): ResultRow[]`：題目依 `number` 由小到大，每題送出以 `ranking.rank()` 排序，`rankLabel` 為「第 {位置} 名」、`groupLabel` 為 `groupName(groupId)`、`submittedAt` 為 `formatSubmittedAt(receivedAt)`、`isWinner` 為 `submission.id === result.winner?.id ? '是' : '否'`；本 Phase 單題每筆送出一列、`blankLabel = null`、`answer` 為第一個子題答案（題組拆列與無人作答在 US2 加入）
- [X] T016 [US1] 新增 `apps/server/src/domain/export/csv/csvResultExporter.ts`：`interface CsvExport { fileName: string; asciiFileName: string; content: string; rowCount: number }`；`class CsvResultExporter implements ResultExporter<CsvExport>`，建構時注入 `RankingStrategy`；`export(session, results, _mode)` 忽略 `mode`，以 `buildResultRows`→`encodeCsv(CSV_HEADERS, rows.map(toCsvRecord))` 產生內容，以 `session.openedAt` 產生兩個檔名（`openedAt` 為 `null` 時丟 `DomainError('INVALID_TRANSITION', CSV_EXPORT_NOT_CLOSED_MESSAGE)`）；結果不得包含匯出當下的時間（data-model.md「不變性」）
- [X] T017 [US1] 修改 `apps/server/src/domain/session/quizSessionService.ts`：`QuizSessionServiceDeps` 新增選填 `csvExporter?: ResultExporter<CsvExport>`，預設 `new CsvResultExporter(deps.ranking)`；新增 `async exportCsv(): Promise<CsvExport>`：在 `this.mutate()` 內，非 `CLOSED` 丟出 `DomainError('INVALID_TRANSITION', CSV_EXPORT_NOT_CLOSED_MESSAGE)`，否則呼叫 `csvExporter.export(current, deriveResults(current, ranking), DEFAULT_EXPORT_MODE)` 並回傳 `{ next: current, result, changes: [] }`（不保存、不推播，research R3）；成功時 `logger.info({ event: 'csv_export.succeeded', rowCount }, '匯出 CSV 成功')`，失敗時 `logger.warn({ event: 'csv_export.failed', code }, '匯出 CSV 失敗')` 後重新丟出；log 不含答案與暱稱
- [X] T018 [US1] 修改 `apps/server/src/transport/http/routes/sessionRoutes.ts`：新增 `app.get(CSV_EXPORT_PATH, ...)`：`requireTeacher(request.identity)` → `service.exportCsv()` → 設定 `Content-Type: text/csv; charset=utf-8`、`Cache-Control: no-store`、`Content-Disposition: attachment; filename="<asciiFileName>"; filename*=UTF-8''<encodeURIComponent(fileName)>` 後送出 `content`（contracts/http-api.md）
- [X] T019 [P] [US1] 新增 `apps/web/src/api/contentDisposition.ts`：`fileNameFromContentDisposition(header: string | null): string | null`，優先解析 `filename*=UTF-8''…`（`decodeURIComponent`，失敗時略過），其次 `filename="…"`，都沒有時回傳 `null`
- [X] T020 [US1] 修改 `apps/web/src/api/http.ts`：新增 `apiDownload(path: string): Promise<{ blob: Blob; fileName: string | null }>`：GET 並帶 `Authorization: Bearer`（與 `apiRequest` 相同取得 token）；網路錯誤丟 `ApiError('NETWORK_ERROR', '無法連線到伺服器，請確認系統已啟動。')`；非 2xx 時以 `ApiErrorBodySchema` 解析 JSON，成功則丟對應 `ApiError`，否則丟 `ApiError('INTERNAL_ERROR', '系統發生錯誤，請稍後再試。')`；2xx 時 `await response.blob()` 完整讀取後才回傳，檔名取自 `fileNameFromContentDisposition(response.headers.get('Content-Disposition'))`
- [X] T021 [P] [US1] 新增 `apps/web/src/utils/download.ts`：`saveBlob(blob: Blob, fileName: string): void`：`URL.createObjectURL` → 建立 `<a download={fileName}>` 並 `click()` → 移除元素並 `URL.revokeObjectURL`
- [X] T022 [US1] 新增 `apps/web/src/pages/teacher/CsvExportPanel.tsx`：`section aria-label="匯出 CSV"`，標題「匯出 CSV」、說明「下載所有組別的送出紀錄，可用 Excel 直接開啟。」、按鈕「匯出 CSV」（下載中為「匯出中…」並停用）；按下呼叫 `apiDownload(CSV_EXPORT_PATH)` → `saveBlob(blob, fileName ?? '搶答結果.csv')` → 顯示「已下載 {檔名}。」（contracts/teacher-ui.md）；樣式比照 `ExportPanel`（`rounded-xl bg-white p-5 shadow`）
- [X] T023 [US1] 修改 `apps/web/src/pages/teacher/TeacherDashboard.tsx`：在 `<ExportPanel view={view} />` 下方掛載 `<CsvExportPanel view={view} />`；`ExportPanel` 不得修改
- [X] T024 [US1] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過；以 3000 以外的埠和暫存 `DATA_DIR` 啟動，完成一場單題活動並下載 CSV，以 Windows 版 Excel 直接開啟確認中文正常；回報指令與結果（自動化關卡已通過；Windows Excel 人工開啟與 3 秒內取得檔案無法在此環境執行，延到 T040 清單與 T043 由使用者驗證）

**Checkpoint**: MVP 完成——老師可以在搶答結束後下載單題活動的結果 CSV

---

## Phase 4: User Story 2 - 所有送出與無人作答的題目都完整列出 (Priority: P1)

**Goal**: 題組每筆送出依子題拆列、無人作答的題目恰好一列，排序為題號 → 順位 → 子題

**Independent Test**: 題組範例（第 1 題 2 個子題）、4 組：第 3 組、第 1 組依序送出第 1 題，第 2 題無人作答，第 4 組送出第 3 題；
CSV 依「第 1 題（第 3 組 (1)(2) → 第 1 組 (1)(2)）→ 第 2 題無人作答 → 第 3 題」排列

### Tests for User Story 2

- [X] T025 [P] [US2] 擴充 `apps/server/tests/unit/resultRows.test.ts`：題組（`groupQuestion`）每筆送出拆成子題數列、`blankLabel` 依序為文件標記（如「（1）」「（2）」）、同一筆送出的列相鄰且除 `blankLabel`／`answer` 外欄位相同、子題依 `blankIndex` 由小到大；子題標記為 `null` 時為「（序號）」；送出缺少某子題答案時該列 `answer` 為空字串；無人作答的題目（單題與題組）恰好一列，`answer` 為 `CSV_NO_ANSWER_TEXT`、其他欄位皆為 `null`；全部題目都無人作答時每題各一列；題號不連續（1、2、5）時依題號排序且不補不存在的題號；`questions` 陣列順序打亂時仍依 `number` 排序；`submitterNickname` 為 `null` 時保持 `null`；第 1 名的所有子題列 `isWinner` 都是「是」
- [X] T026 [P] [US2] 擴充 `apps/server/tests/integration/csvExport.test.ts`：以題組範例（`group-example.json` fixture）跑完整流程，比對 CSV 每一列與老師端 `GET /api/session` 的送出列表（組別、送出者、答案、第 N 名、搶答成功）完全一致（SC-002）；含一題無人作答

### Implementation for User Story 2

- [X] T027 [US2] 修改 `apps/server/src/domain/export/csv/resultRows.ts`：題組每筆送出依 `blankIndex` 由小到大拆成 `question.blanks.length` 列，`blankLabel` 為 `question.blanks[i].label ?? \`（${i + 1}）\``，`answer` 為該子題的 `text`（缺少時為空字串），其他欄位與該筆送出相同；沒有送出的題目產生一列：`questionNumber` 為題號、`answer` 為 `CSV_NO_ANSWER_TEXT`、其餘欄位 `null`（FR-007、FR-008）；排序以送出為單位，送出內依子題順序（FR-006）
- [X] T028 [US2] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過；以題組範例實際匯出一次並以 Excel 確認子題列與「無人作答」列；回報指令與結果（自動化關卡已通過；Excel 人工確認延到 T040 清單與 T043）

**Checkpoint**: CSV 內容完整、排序正確

---

## Phase 5: User Story 3 - 特殊字元不使欄位錯位 (Priority: P2)

**Goal**: 含逗號、換行、雙引號或前後空白的值正確加引號；以 `= + - @ Tab CR` 開頭的值加 `'`

**Independent Test**: 答案「蘋果, 香蕉」、含換行的答案、`他說"好"`、「=1+1」、「-5」與暱稱「A,B」各一筆，匯出後每個值都在正確欄位、沒有公式被計算

### Tests for User Story 3

- [X] T029 [P] [US3] 擴充 `apps/server/tests/unit/csvEncoder.test.ts`：逐一驗證 contracts/csv-format.md §2 表格的每一列（`甲`→`甲`；`蘋果, 香蕉`→`"蘋果, 香蕉"`；`他說"好"`→`"他說""好"""`；含 LF 的值加引號且保留 LF；含 CR 的值加引號；`=1+1`→`'=1+1`；`-5`→`'-5`；`+3`、`@A`、以 Tab 開頭的值都加 `'`；`=SUM(A1, B1)`→`"'=SUM(A1, B1)"`；` 前後空白 `→`" 前後空白 "`；`A,B`→`"A,B"`；`null`→空字串）；中間含 `=` 或 `-` 的值（如 `a=b`、`1-2`）不加 `'`；含表情符號與中日韓文字的值原樣輸出
- [X] T030 [P] [US3] 擴充 `apps/server/tests/integration/csvExport.test.ts`：以 API 直接送出含逗號、換行（`第一行\n第二行`）、雙引號與 `=1+1` 的答案，暱稱設為 `A,B`；下載的 CSV 以簡單的 RFC 4180 解析器（測試內撰寫，處理引號與 `""`）解析後，每列恰好 8 欄、值等於原文（以 `=` 開頭者多一個 `'`），換行保留在同一欄內（SC-004）。`AnswerTextSchema` 與 `validateAnswers` 只去除前後空白、不限制內部換行，因此可以直接經由送出 API 送出含換行的答案（學生端輸入欄是單行，人工驗證無法輸入換行）

### Implementation for User Story 3

- [X] T031 [US3] 修改 `apps/server/src/domain/export/csv/csvEncoder.ts` 的 `encodeField`：先做公式防護——值的第一個字元是 `=`、`+`、`-`、`@`、`\t` 或 `\r` 時在開頭加 `'`（FR-013，純數字如 `-5` 也一樣）；再做引號——值含 `,`、`"`、`\r`、`\n`，或開頭／結尾是空白時，以 `"` 包住並把值中的 `"` 寫成 `""`（FR-012）；其他值原樣輸出；為兩個規則各加一段註解說明業務意義（避免 Excel 執行學生輸入的公式、避免欄位錯位）
- [X] T032 [US3] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過；實際送出「蘋果, 香蕉」、`他說"好"`、「=1+1」與暱稱 `A,B` 後匯出，以 Excel 確認不錯位、公式未被計算；回報指令與結果

**Checkpoint**: 任何內容都不會造成欄位或列錯位

---

## Phase 6: User Story 4 - 搶答結束前無法匯出並說明原因 (Priority: P2)

**Goal**: 非「已結束」時按鈕停用並顯示提示；伺服器拒絕非老師與非 CLOSED 的請求；錯誤時顯示訊息且不下載

**Independent Test**: 在尚未匯入、待開始、搶答進行中三個階段，按鈕停用並顯示「搶答結束後才能匯出 CSV。」；直接呼叫 API 得到 409；學生 403；未登入 401

### Tests for User Story 4

- [X] T033 [P] [US4] 擴充 `apps/server/tests/integration/csvExport.test.ts`（權限與狀態）：`NOT_IMPORTED`、`READY`、`OPEN` 各以老師 token 請求 → 409、`error.code` 為 `INVALID_TRANSITION`、`error.message` 為 `CSV_EXPORT_NOT_CLOSED_MESSAGE`、`content-type` 為 JSON；不帶 token → 401 `UNAUTHORIZED`；學生 token（OPEN 與 CLOSED 各一次）→ 403 `FORBIDDEN`，回應 body 不含任何已送出的答案文字或暱稱（SC-005）；錯誤請求後活動狀態不變
- [X] T034 [P] [US4] 擴充 `apps/server/tests/integration/csvExport.test.ts`（重新啟動與既有功能）：CLOSED 後 `restartApp` 再匯出，body 與重新啟動前完全相同；匯出 CSV 前後 `GET /api/session` 的 `lastExport` 相同；匯出 CSV 後 `POST /api/session/export` 仍成功，且 fake gateway 只收到 Guided Notes 的寫入（CSV 匯出不呼叫 gateway）
- [X] T035 [P] [US4] 在 `apps/server/tests/unit/quizSessionService.test.ts` 的 `exportCsv` 區塊新增：`NOT_IMPORTED`、`READY`、`OPEN` 各丟出 `DomainError` `INVALID_TRANSITION` 與 `CSV_EXPORT_NOT_CLOSED_MESSAGE`，且 logger 收到 `event: 'csv_export.failed'`、`code: 'INVALID_TRANSITION'`
- [X] T036 [P] [US4] 擴充 `apps/web/tests/CsvExportPanel.test.tsx`：`status` 為 `NOT_IMPORTED`、`READY`、`OPEN` 時按鈕停用並顯示「搶答結束後才能匯出 CSV。」；以 `rerender` 把 view 改成 `CLOSED` 後按鈕可按、提示消失；伺服器回 409 JSON 錯誤時以 `ErrorBanner` 顯示伺服器訊息，且 `URL.createObjectURL` 與 anchor `click` 都沒有被呼叫；fetch 被拒絕（網路錯誤）時顯示「無法連線到伺服器，請確認系統已啟動。」且沒有下載；錯誤後可以再按一次

### Implementation for User Story 4

- [X] T037 [US4] 修改 `apps/web/src/pages/teacher/CsvExportPanel.tsx`：`view.status !== 'CLOSED'` 時按鈕停用並在旁顯示 `CSV_EXPORT_NOT_CLOSED_MESSAGE`；`ApiError` 以 `ErrorBanner` 顯示 `{ message, details }`，其他錯誤顯示「匯出失敗，請稍後再試。」；錯誤時不呼叫 `saveBlob`；每次按下前清除上一次的訊息與錯誤（contracts/teacher-ui.md）
- [X] T038 [US4] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過；實際確認三個階段的停用提示、結束搶答後 1 秒內啟用、停止伺服器後按下的錯誤訊息；回報指令與結果（自動化關卡已通過；三個階段的畫面確認、1 秒內啟用與停止伺服器的錯誤訊息延到 T040 清單與 T043 由使用者驗證）

**Checkpoint**: 所有 user story 完成

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] 新增 `specs/005-results-csv-export/diagram-verification.md`：逐一比對 `diagrams/005-results-csv-export-{component,class,sequence}.puml` 的每個元素與 plan.md「圖表對應」中的原始碼位置、方法簽章與呼叫順序，列出一致／不一致；不一致時先更新圖表並重新產生 PNG（原則 VI 實作階段驗證）
- [X] T040 [P] 新增 `specs/005-results-csv-export/checklists/manual-verification.md`：依 quickstart.md §5（A 單題範例、B 題組範例、C 錯誤處理與既有功能）建立可勾選的人工驗證清單，包含老師端與至少兩組學生端
- [X] T041 [P] 更新 `README.md`：在匯出說明處加入「匯出 CSV」（搶答結束後下載、欄位、Excel 直接開啟）；子功能表新增「005 | 搶答結果匯出 CSV（所有送出紀錄、題組逐子題、無人作答、Excel 相容） | 已實作」
- [X] T042 檢查 `apps/server/src/domain/export/csv/*.ts` 與 `CsvExportPanel.tsx` 的對外函式都有明確型別註記、重要規則有繁體中文註解；確認沒有 `any`、沒有新增相依套件（`git diff main -- package.json package-lock.json apps/*/package.json` 無變更）、Guided Notes 匯出相關檔案沒有變更（`git diff main -- apps/server/src/domain/export/exportPlan.ts apps/server/src/domain/export/guidedNotesExporter.ts apps/web/src/pages/teacher/ExportPanel.tsx` 無變更）
- [X] T043 最終品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build` 全部通過；依 `checklists/manual-verification.md` 完成人工驗證（老師＋兩組學生，單題與題組範例各一次）並記錄結果；回報指令與結果（自動化與 build 已通過；人工驗證尚未執行，待使用者依 checklists/manual-verification.md 完成）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup（Phase 1）**：沒有依賴
- **Foundational（Phase 2）**：依賴 Setup；完成前不得開始任何 user story
- **US1（Phase 3）**：依賴 Foundational；建立 CSV 匯出的完整路徑（編碼骨架、列產生、匯出器、服務、路由、前端）
- **US2（Phase 4）**：依賴 US1 的 `resultRows.ts`（擴充同一個檔案）
- **US3（Phase 5）**：依賴 US1 的 `csvEncoder.ts`（擴充同一個檔案）；與 US2 互相獨立，可平行進行
- **US4（Phase 6）**：依賴 US1 的 `CsvExportPanel.tsx`、路由與服務；與 US2、US3 互相獨立，可平行進行
- **Polish（Phase 7）**：依賴所有 user story

### User Story Dependencies

```text
Setup → Foundational → US1 ─┬─> US2 ─┐
                            ├─> US3 ─┼─> Polish
                            └─> US4 ─┘
```

US2、US3、US4 修改的檔案不重疊（`resultRows.ts`／`csvEncoder.ts`／`CsvExportPanel.tsx`），US1 完成後可以由不同人平行實作；
但三者都會擴充 `apps/server/tests/integration/csvExport.test.ts`，平行時請各自新增獨立的 `describe` 區塊以減少衝突。

### Within Each User Story

- 先寫測試並確認失敗，再實作
- 伺服器：純函式模組（檔名、編碼、列）→ 匯出器 → 服務 → 路由
- 前端：解析與下載工具 → `apiDownload` → `CsvExportPanel` → 掛載
- 每個 Phase 以品質關卡結束

### Parallel Opportunities

- Phase 2：T002（shared）與 T003（server 介面）
- US1 測試：T005～T012 全部可平行（不同檔案）
- US1 實作：T013、T014、T019、T021 可平行；T015 → T016 → T017 → T018 依序；T020 依賴 T019；T022 依賴 T020、T021；T023 依賴 T022
- US1 完成後：US2、US3、US4 三條線可平行
- Polish：T039、T040、T041 可平行

## Parallel Example: User Story 1

```text
# 先平行寫好 US1 的測試：
Task: "T005 csvFileName.test.ts"
Task: "T006 csvEncoder.test.ts（基本結構）"
Task: "T007 resultRows.test.ts（單題）"
Task: "T008 csvResultExporter.test.ts"
Task: "T009 quizSessionService.test.ts 的 exportCsv"
Task: "T010 integration/csvExport.test.ts（成功路徑）"
Task: "T011 contentDisposition.test.ts"
Task: "T012 CsvExportPanel.test.tsx（成功路徑）"

# 再平行實作互不依賴的模組：
Task: "T013 csvFileName.ts"
Task: "T014 csvEncoder.ts"
Task: "T019 contentDisposition.ts"
Task: "T021 download.ts"
```

## Implementation Strategy

### MVP First（只做 User Story 1）

1. 完成 Phase 1（T001）與 Phase 2（T002～T004）
2. 完成 Phase 3（T005～T024）
3. **停下來驗證**：單題活動能下載正確的 CSV，Excel 開啟不亂碼
4. 可以先展示

### Incremental Delivery

1. Setup＋Foundational → 擴充點就緒
2. US1 → 單題 CSV 下載（MVP）
3. US2 → 題組拆列與無人作答（內容完整）
4. US3 → 引號與公式防護（任何內容都不錯位）
5. US4 → 停用提示、權限與錯誤處理的完整測試
6. Polish → 圖表驗證、人工驗證、README

每一步都不影響 Guided Notes 匯出，也不破壞前一步的功能。

## Notes

- [P] = 不同檔案、不依賴未完成的任務
- [Story] 對應 spec.md 的 user story，方便追蹤
- 伺服器端的狀態檢查（非 CLOSED 拒絕）在 US1 的 T017 就實作，因為匯出路徑必須正確；US4 補上完整的測試與前端提示
- 每個任務或一組邏輯相關的任務完成後再 commit
- 任何 Phase 的品質關卡沒有全部通過，不得進入下一個 Phase

---

## Phase 8: Convergence

- [X] T044 依 `specs/005-results-csv-export/checklists/manual-verification.md`（A 單題、B 題組、C 錯誤處理與既有功能，老師＋兩組學生）完成人工驗證：以 Windows 版 Excel 直接開啟確認中文無亂碼、從按下「匯出 CSV」到存下檔案在 3 秒內、結束搶答後 1 秒內按鈕啟用、停止伺服器後的錯誤訊息；逐項勾選並在清單末尾記錄日期、環境與結果（T024、T028、T038、T043 的人工部分尚未執行） per SC-001, SC-003, T043 (partial)
- [X] T045 擴充 `apps/server/tests/integration/csvExport.test.ts`：以「單題範例」（`single-example`）與「題組範例」（`group-example`）各跑一場、皆設定 4 組並各含至少一題無人作答，將 CSV 每一列（題號、子題、組別、送出者、答案、第 N 名、搶答成功）與老師端 `GET /api/session` 的送出列表逐筆比對；子題預期值取自 view 中題目的子題標記（`label ?? （序號）`），不自行組字串（目前只有題組範例、3 組的比對，單題範例只對照寫死的預期值） per SC-002 (partial)
- [X] T046 [P] 在 `apps/server/tests/unit/resultRows.test.ts` 新增大量資料案例：20 組 × 30 題（單題）全部作答，列數恰為 600、每題 20 列且依順位排序、沒有截斷；並以 `CsvResultExporter` 確認 `rowCount` 為 600 per spec Edge Cases「20 組 × 30 題」 (partial)
- [X] T047 [P] 在 `apps/server/tests/integration/csvExport.test.ts` 新增案例：一場活動結束並可匯出後，老師重新匯入（`confirmDiscard: true`）開始新的一場，此時 `GET /api/session/export.csv` 回 409 `CSV_EXPORT_NOT_CLOSED_MESSAGE`；新的一場結束後匯出的 CSV 只含新一場的送出、檔名使用新一場的開啟時間 per spec Edge Cases「重新匯入新文件」 (partial)
- [X] T048 依 constitution 將本子功能的對外行為變更（新增 `GET /api/session/export.csv`、老師端「匯出 CSV」區塊、CSV 格式）整理成摘要，連結 `contracts/http-api.md`、`contracts/csv-format.md`、`contracts/teacher-ui.md`，記錄於 `specs/005-results-csv-export/openspec-notice.md` 並告知 OpenSpec 小組 per plan: 開發流程「需告知 OpenSpec 小組」 (missing)

## Phase 9: Convergence

- [X] T049 CRITICAL：依 constitution 原則 VI 先更新 `diagrams/005-results-csv-export-class.puml`（`blankLabelOf` 改為「子題N」、新增 `csvSubmittedAt` 的 `formatCsvSubmittedAt`、`resultRows` 改依賴它而非 `formatSubmittedAt`、`csvEncoder` 新增 `CsvCell`／`ExcelTextCell`／`toExcelText`，`toCsvRecord` 回傳 `CsvCell[]`），必要時一併檢查 component 與 sequence 圖，重新產生 `.png`（`java -jar plantuml.jar "./diagrams/005-*.puml"`），並更新 `specs/005-results-csv-export/diagram-verification.md` 的比對結果 per Constitution VI (contradicts)
- [X] T050 修正 `spec.md` 的 FR 編號重複：把「Excel 文字儲存格」規則由第二個 FR-014 改為未使用的編號（建議 FR-017），保留「匯出失敗處理」為 FR-014；同步更新 `spec.md` 內的引用（Clarifications、SC-004）、`contracts/csv-format.md`、`openspec-notice.md` 與其他文件中指向該規則的 `FR-014`（程式碼中指匯出失敗處理的 `FR-014` 引用不動） per spec FR-014 (partial)
- [X] T051 更新 `plan.md` 的原始碼結構清單與圖表對應表：csv 模組新增 `csvSubmittedAt.ts`（`formatCsvSubmittedAt`）與 `csvEncoder.ts` 的 `toExcelText`、`CsvCell`，並移除「formatSubmittedAt（沿用）」的說法 per plan: 專案結構 (partial)
