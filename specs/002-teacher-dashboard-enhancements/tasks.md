---

description: "子功能 002：老師端介面優化 — 實作任務清單"
---

# Tasks: 老師端介面優化（題目預覽、搶答計時、提交時間提示、匯出模式）

**Input**: `specs/002-teacher-dashboard-enhancements/` 中的 spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（皆已完成）；
`diagrams/002-teacher-dashboard-enhancements-*.puml/.png` 為設計藍圖

**Tests**: constitution 原則 VII 要求每個功能都有自動化測試（正常＋邊界／錯誤案例），可見性要有專門測試，
匯出要以兩份版面不同的文件驗證，因此本清單包含測試任務。每個 Phase 結束時都有「品質關卡」任務：型別檢查、
lint、測試必須全部通過，並回報執行的指令與結果，才能進入下一個 Phase。

**Organization**: 依 user story 分組，依優先順序排列：US1（題目預覽，P1）、US4（匯出模式，P1）、
US2（搶答計時，P2）、US3（提交時間提示，P3）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、不依賴未完成的任務）
- **[Story]**: 所屬 user story（US1～US4，對應 spec.md）
- 每個任務都寫明檔案路徑；路徑依 plan.md 的結構（`apps/web`、`apps/server`、`packages/shared`）

## 共同約定（所有任務都適用）

- 沿用 001 tasks.md 的共同約定：TypeScript `strict`、**不得使用 `any`**；共用型別一律從 `@crs/shared` 匯入；
  `apps/server/src/domain/` 不得 import `fastify`、`socket.io`、`@googleapis/*`、`google-auth-library`、`node:fs`；
  錯誤一律以 `DomainError(code, userMessage, details?)` 拋出；重要領域規則加註解；測試不連線 Google。
- **不新增任何相依套件**（research 開頭）。
- 001 既有測試必須持續通過；修改既有函式簽章時同步更新其測試與呼叫端。
- 實作若需偏離 plan、contracts 或 `diagrams/002-*`：先更新圖表並執行 `plantuml "./diagrams/*.puml"`，再改程式（原則 VI）。

---

## Phase 1: Setup

**Purpose**: 確認基準並設定可重現的時區

- [ ] T001 在 `002-teacher-dashboard-enhancements` branch 執行 `npm run typecheck`、`npm run lint`、`npm test`，確認 001 的基準全部通過並回報結果（作為後續回歸比對）
- [ ] T002 在 `vitest.config.ts` 的 `server` 與 `web` project 加上 `env: { TZ: 'Asia/Taipei' }`，讓時間格式測試可重現（research R11）；確認既有測試仍全部通過

**Checkpoint**: 基準綠燈，時間相關測試結果與執行電腦的時區無關

---

## Phase 2: Foundational（多個 user story 共用的契約）

**Purpose**: 擴充老師端檢視資料（題目敘述欄位、`serverNow`、結果提交時間），供 US1、US2、US3 共用

**⚠️ CRITICAL**: 本 Phase 完成前不得開始任何 user story

- [ ] T003 [P] 在 `packages/shared/src/domain.ts` 為 `QuestionSchema` 新增 `prompt: z.string().nullable().default(null)`、`BlankSchema` 新增 `prompt: z.string().nullable().default(null)`，加註解說明「單題為題目敘述、題組為題組說明；子題敘述放在 Blank；預設 null 以相容 001 存檔（research R2）」；`PersistedState.schemaVersion` 維持 `1`
- [ ] T004 [P] 在 `packages/shared/src/views.ts` 新增 `TeacherBlankViewSchema`（`index`、`label: string | null`、`prompt: string | null`）、`TeacherQuestionViewSchema`（`QuestionSummary` 欄位＋`prompt: string | null`＋`blanks: TeacherBlankView[]`）、`TeacherResultViewSchema`（`ResultView` 欄位＋`receivedAt: string | null`）；`TeacherViewSchema.questions` 改為 `TeacherQuestionView[]`、`results` 改為 `TeacherResultView[]`，並新增 `serverNow: z.string()`；`PublicView`、`StudentView` **不變**（data-model §2）；從 `index.ts` 匯出新型別
- [ ] T005 在 `packages/shared/tests/schemas.test.ts` 新增測試：不含 `prompt` 的 001 存檔格式可通過 `PersistedStateSchema` 且 `prompt` 為 `null`；`TeacherViewSchema` 接受新欄位；`StudentViewSchema`／`PublicViewSchema` 的 `questions` 不含 `prompt` 或 `blanks` 欄位（以 schema 的 shape 檢查）
- [ ] T006 在 `apps/server/src/domain/visibility/visibilityPolicy.ts` 將 `toTeacherView(session, strategy)` 改為 `toTeacherView(session, strategy, now: Date)`：`questions` 依 `Question` 產生 `TeacherQuestionView`（含 `prompt` 與 `blanks[].{index,label,prompt}`，不含儲存格位置）、`results` 加上搶答成功作答的 `receivedAt`（無人搶答為 `null`）、`serverNow = now.toISOString()`；`toPublicView`、`toStudentView` 不變。同步更新 `apps/server/src/transport/views.ts` 與所有呼叫端，`now` 取自 `QuizSessionService` 的 `deps.now`（必要時在 service 公開 `now()`）
- [ ] T007 更新 `apps/server/tests/unit/visibilityPolicy.test.ts`：老師檢視含 `prompt`、`blanks`、`receivedAt`、`serverNow`；結束後無人搶答的題目 `receivedAt` 為 `null`；學生與公開檢視的 JSON 字串化結果不含任何題目敘述文字（以含敘述的題目資料測試，SC-009）
- [ ] T008 [P] 更新 `apps/web/tests/viewBuilders.ts` 的 `teacherView()` 預設值（`questions[].prompt`、`blanks`、`results[].receivedAt`、`serverNow`），並修正既有前端元件與測試的型別錯誤，使行為維持 001 原樣
- [ ] T009 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 老師端收到的資料已有新欄位；學生與公開資料不變；001 行為不變

---

## Phase 3: User Story 1 — 老師預覽題目內容（Priority: P1）🎯 MVP

**Goal**: 匯入時讀取題目敘述；點題號在按鈕下方預覽題目（題組含子題），再點一次關閉，同時最多一題標示預覽中

**Independent Test**: 匯入題組範例 fixture 後，只操作「題目」段落：點第 1 題 → 預覽兩個子題；點第 3 題 → 切換；再點第 3 題 → 收起；`aria-pressed` 與「預覽中」標示同步

### Tests for User Story 1

- [ ] T010 [P] [US1] 在 `apps/server/tests/fixtures/guided-notes/` 新增 `no-prompt-header.json`：複製 `single-example.json`，把表頭列的「題目」改為空白、題目欄內容保留；既有的 `single-example.json`、`group-example.json` 已含各題與各子題敘述，直接用於測試、不修改
- [ ] T011 [P] [US1] 測試 `apps/server/tests/unit/prompts.test.ts`（依 `contracts/guided-notes-format.md` §A 的預期表）：單題範例 6 題各有 `prompt`（與 fixture 文字相同）且 `blanks[0].prompt` 為 `null`；題組範例第 1、2 題 `prompt` 為 `null`、兩個子題各有 `prompt`，第 3、4 題有 `prompt`；`no-prompt-header.json` 匯入成功且所有敘述為 `null`；敘述跨兩列合併時只取一次；題組區塊內不屬於子題列的敘述成為 `Question.prompt`（以小型 inline grid 測試）；題數、題型與填空格位置與 001 相同

### Implementation for User Story 1

- [ ] T012 [US1] 在 `apps/server/src/domain/guidedNotes/prompts.ts` 實作題目欄定位與敘述讀取（research R1）：`findPromptColumn(grid, headerRowIndex)`（表頭列內容恰為「題目」的儲存格，合併取左上角所在欄，沒有回傳 `null`）、`promptAt(grid, row, column)`（以 `effectiveValue` 取值、去除前後空白、空字串為 `null`）、`readQuestionPrompts(grid, promptColumn, blockRows, blanks, kind)`（單題：區塊各列敘述去重後以換行合併；題組：子題作答格所在列 → `Blank.prompt`，其他列 → 題組說明）；加註解說明業務規則
- [ ] T013 [US1] 在 `apps/server/src/domain/guidedNotes/parser.ts` 組成題目時呼叫 `prompts.ts` 填入 `Question.prompt` 與 `Blank.prompt`；不改變任何 001 的錯誤判定與題目結構。讓 T011 與既有 `guidedNotesParser.test.ts` 全部通過
- [ ] T014 [US1] 整合測試 `apps/server/tests/integration/visibility.test.ts` 新增案例：匯入題組範例後，老師 socket 的 `session:state` 含敘述；學生 socket（`group:1`）與未登入 socket 收到的 `session:state`、`GET /api/session` 回應中，序列化後不含任何一句題目或子題敘述（SC-009）
- [ ] T015 [P] [US1] 整合測試 `apps/server/tests/integration/restart.test.ts` 新增兩個案例：(1) 以 001 格式（題目與子題沒有 `prompt` 欄位）的 `session.json` 啟動，可正常恢復，老師檢視的 `prompt` 皆為 `null`（research R2）；(2) 搶答進行中重啟伺服器後，老師檢視的 `openedAt` 與重啟前相同、`serverNow` 為重啟後的時間（FR-012，前端據此接續計時；此案例支援 US2，與案例 (1) 同檔故放在此任務）
- [ ] T016 [P] [US1] 在 `apps/web/src/components/QuestionPreview.tsx` 實作預覽內容（FR-006）：題號、題型（「單題」或「題組（n 子題）」）；單題顯示 `prompt`；題組依序顯示題組說明（若有）與每個子題「標記（沒有則「（序號）」）＋子題敘述」；沒有敘述顯示「文件未提供題目敘述」；以 `whitespace-pre-wrap` 保留換行、完整顯示不截斷
- [ ] T017 [US1] 在 `apps/web/src/components/QuestionList.tsx` 實作預覽切換（research R4）：匯出純函式 `togglePreview(current: number | null, clicked: number): number | null`；每個題號改為 `<button type="button" aria-pressed>`；預覽中按鈕加醒目外框與「預覽中」文字標籤（不只靠顏色，FR-005）；`previewNumber` 對應題號不存在時視為 `null`；預覽區（`aria-live="polite"`）放在按鈕清單正下方，沒有預覽時不渲染（FR-006，Clarification Q2）
- [ ] T018 [US1] 在 `apps/web/src/pages/teacher/TeacherDashboard.tsx` 以 `key={view.activityId ?? 'none'}` 掛載 `QuestionList`，重新匯入後預覽自動清除（FR-008）
- [ ] T019 [US1] 測試 `apps/web/tests/QuestionList.test.tsx`：`togglePreview` 的四種組合；點第 1 題 → 顯示兩個子題敘述且只有第 1 題 `aria-pressed="true"`；點第 3 題 → 切換；再點第 3 題 → 預覽區消失、全部 `aria-pressed="false"`；鍵盤 Enter／Space 可切換；沒有敘述顯示「文件未提供題目敘述」；題組無標記時以「（1）」「（2）」呈現；在 `READY`、`OPEN`、`CLOSED` 三種狀態下預覽行為相同（FR-007）；`activityId` 改變（重新渲染 Dashboard）後預覽清除；預覽不呼叫任何 API（mock `fetch` 未被呼叫）
- [ ] T020 [US1] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 題目預覽可獨立展示；敘述只出現在老師端

---

## Phase 4: User Story 4 — 老師選擇匯出模式並匯出（Priority: P1）

**Goal**: 匯出時可選「只有答案」「答案＋組別時間欄」「答案＋格內附註行」；組別時間與答案明確分開；可重複、全有或全無、匯出後可再匯入

**Independent Test**: 以單題與題組範例 fixture 結束活動後，三種模式各匯出一次，`FakeGuidedNotesGateway` 中的文件內容符合 `contracts/guided-notes-format.md` §B.5；同模式再匯出內容不變；匯出後文件重新匯入題數不變

### Tests for User Story 4

- [ ] T021 [P] [US4] 在 `apps/server/tests/fixtures/guided-notes/` 新增 `exported-columns.json`（題組範例＋表頭列 H「搶答組別」I「提交時間」且第 1 題列有舊值）與 `exported-note-line.json`（題組範例，第 1 題第 2 子題作答格為 `（2）作業系統\n〔第 2 組｜2026/11/23 10:32:15.123〕`、第 3 題作答格為 `0\n〔第 1 組｜…〕`）
- [ ] T022 [P] [US4] 測試 `apps/server/tests/unit/submittedAt.test.ts`：`formatSubmittedAt('2026-11-23T02:32:15.123Z')` 在 `TZ=Asia/Taipei` 下為 `2026/11/23 10:32:15.123`；毫秒補零（`.005`）；跨日
- [ ] T023 [P] [US4] 測試 `apps/server/tests/unit/guidedNotesParser.test.ts` 新增：`headerRowIndex`、`usedColumnCount`（單題範例為 7）、`resultColumns`（一般範例皆 `null`；`exported-columns.json` 為 H、I 欄）；`exported-columns.json` 與 `exported-note-line.json` 解析結果的題數、題型、標記與題組範例相同（FR-023）
- [ ] T024 [P] [US4] 測試 `apps/server/tests/unit/exportPlan.test.ts` 改寫為三種模式 × 兩份範例（依 `contracts/guided-notes-format.md` §B）：
  - `answers-only`：寫入內容與 001 相同、`mutedFrom` 皆為 `null`
  - `answers-with-columns`：沒有結果欄時在 `usedColumnCount`、`+1` 新增表頭；`exported-columns.json` 沿用 H、I 不重複新增；只缺一欄時只新增該欄；搶答成功寫在題目區塊第一列（題組只寫一次）；無人搶答清空兩格；作答格只有答案
  - `answers-with-note-line`：單題作答格為 `答案\n〔第 N 組｜時間〕`、`mutedFrom` 為換行位置；題組只有最後一個子題有附註行，其他子題 `mutedFrom` 為 `null`
  - 三種模式：無人搶答題目的作答格不寫入；以同一份文件重複計算結果相同；任一題無法定位時拋出 `EXPORT_LOCATE_FAILED` 且不回傳任何寫入（含表頭）；`writtenQuestionCount` 只計搶答成功題數
- [ ] T025 [P] [US4] 測試 `apps/server/tests/unit/batchRequests.test.ts`：欄位足夠時沒有 `appendDimension`；寫入欄超出 `columnCount` 時第一個請求為 `appendDimension`（COLUMNS，補足所需欄數）；每個 `CellWrite` 對應一個 `updateCells`（正確的 `sheetId`、列欄、`fields: 'userEnteredValue,textFormatRuns'`）；`text` 為空字串時沒有 `userEnteredValue`；`mutedFrom` 為 `null` 時 `textFormatRuns` 為空陣列；否則兩段（`startIndex: 0` 的空格式與 `startIndex: mutedFrom` 的 `fontSize: 8`＋灰色）；以「=」開頭的答案仍為 `stringValue`；找不到工作表名稱時拋出 `SHEETS_UNAVAILABLE`

### Implementation for User Story 4

- [ ] T026 [P] [US4] 在 `packages/shared/src/domain.ts` 新增 `ExportModeSchema = z.enum(['answers-only','answers-with-columns','answers-with-note-line'])`、`EXPORT_MODE_LABEL` 與 `EXPORT_MODE_DESCRIPTION`（文字依 data-model §1 表格，含「複製答案格時會一併複製這一行」的提醒）；`LastExportSchema` 新增 `mode: ExportModeSchema.default('answers-only')`。在 `packages/shared/src/api.ts` 新增 `ExportRequestSchema = z.strictObject({ mode: ExportModeSchema.default('answers-only') })`，`ExportResponseSchema` 新增 `mode`。`schemas.test.ts` 補上：`{}` 解析為 `answers-only`、未知 mode 與多餘欄位被拒、舊 `lastExport` 預設 `answers-only`
- [ ] T027 [P] [US4] 在 `apps/server/src/domain/export/submittedAt.ts` 實作 `formatSubmittedAt(iso: string): string`（本地時區、`YYYY/MM/DD HH:mm:ss.SSS`、補零），讓 T022 通過
- [ ] T028 [US4] 在 `apps/server/src/domain/guidedNotes/parser.ts` 的 `ParsedGuidedNotes` 新增 `headerRowIndex`、`usedColumnCount`（所有列最後一個非空白儲存格欄號 + 1 與所有合併 `endColumn` 的最大值）、`resultColumns: { groupColumn, timeColumn }`（表頭列內容恰為「搶答組別」「提交時間」的欄），讓 T023 通過；不改變任何既有錯誤判定
- [ ] T029 [US4] 在 `apps/server/src/infrastructure/sheets/guidedNotesGateway.ts` 將 `CellWrite.value` 改為 `text`，新增 `mutedFrom: number | null`（註解：UTF-16 索引、淡化樣式、`null` 會清除既有文字格式；空字串表示清空）；同步更新 `apps/server/tests/fakes/fakeGuidedNotesGateway.ts`：套用寫入時把 `text` 寫進 `cells`（必要時擴充列與欄）、另以 `formatLog` 記錄每格 `mutedFrom`，讓測試可檢查樣式
- [ ] T030 [US4] 在 `apps/server/src/domain/export/exportPlan.ts` 將 `planExport(session, results, fresh)` 改為 `planExport(session, results, fresh, mode)`，依 `contracts/guided-notes-format.md` §B 實作三種模式：答案值沿用 001；欄位模式計算結果欄（沿用或在 `usedColumnCount` 起新增並寫表頭）、題目區塊第一列（該題填空格最小列號）寫入 `第 N 組`（`groupName`）與 `formatSubmittedAt(winner.receivedAt)`、無人搶答清空；附註行模式產生 `答案值 + '\n' + '〔第 N 組｜時間〕'` 並設定 `mutedFrom`，題組只加在最後一個子題；先完成全部定位再產生寫入；每條規則加註解。讓 T024 通過
- [ ] T031 [US4] 在 `apps/server/src/infrastructure/sheets/batchRequests.ts` 實作純函式 `buildBatchUpdateRequests(sheets: { sheetId: number; title: string; columnCount: number }[], writes: CellWrite[]): sheets_v4.Schema$Request[]`（research R8），讓 T025 通過
- [ ] T032 [US4] 在 `apps/server/src/infrastructure/sheets/googleSheetsGateway.ts` 改寫 `writeCells`：先以 `spreadsheets.get({ fields: 'sheets.properties(sheetId,title,gridProperties.columnCount)' })` 取得工作表屬性，再以**單一** `spreadsheets.batchUpdate` 送出 `buildBatchUpdateRequests` 的結果；任何 Google 錯誤轉成 `SHEETS_UNAVAILABLE`（訊息不含原始錯誤或金鑰路徑）。更新 `apps/server/tests/unit/googleSheetsGateway.test.ts` 中與寫入相關的案例（mock client，不連線）
- [ ] T033 [US4] 將 `mode` 串接到服務：`apps/server/src/domain/export/resultExporter.ts` 的 `export(session, results, mode)`、`guidedNotesExporter.ts` 傳給 `planExport`；`apps/server/src/domain/session/quizSessionService.ts` 的 `exportResults(mode)` 保存 `lastExport: { exportedAt, writtenQuestionCount, mode }`、回傳值含 `mode`，`export.succeeded`／`export.failed` log 加上 `mode`；更新 `quizSessionService.test.ts` 與呼叫端
- [ ] T034 [US4] 在 `apps/server/src/transport/http/routes/sessionRoutes.ts` 的 `POST /api/session/export` 改以 `ExportRequestSchema` 驗證 body，將 `mode` 傳給 `exportResults`，回應含 `mode`；`mode` 不正確或含多餘欄位時回 `400 VALIDATION_FAILED`，訊息為「匯出模式不正確」（contracts/http-api.md）
- [ ] T035 [US4] 整合測試 `apps/server/tests/integration/export.test.ts` 新增：`{}` 等同 `answers-only` 且結果與 001 相同；`{ mode: 'unknown' }` 與多餘欄位回 `400 VALIDATION_FAILED`、訊息為「匯出模式不正確」，且沒有讀寫文件；三種模式在兩份範例的文件結果（比對 fake 中的儲存格與 `formatLog`）；同一模式連續匯出兩次文件完全相同（SC-006）；附註行模式後改 `answers-only` 匯出 → 附註行消失、`mutedFrom` 為 `null`；欄位模式後改其他模式 → 結果欄保留不動；匯出後的文件以 `confirmDiscard` 重新匯入成功、題數與題組判斷不變（FR-023）；刪除題目列後以欄位模式匯出 → `EXPORT_LOCATE_FAILED` 且 fake 沒有任何寫入（含表頭）；`lastExport.mode` 經 `session:state` 推播給老師
- [ ] T036 [US4] 在 `apps/web/src/pages/teacher/ExportPanel.tsx` 加入匯出模式選擇（`fieldset` + 三個 radio，名稱與說明取自 `EXPORT_MODE_LABEL`／`EXPORT_MODE_DESCRIPTION`），每次掛載預設 `answers-only`、不記憶；送出 `{ mode }`；完成訊息與「上次匯出」顯示模式名稱（FR-024）；非 `CLOSED` 時 radio 與按鈕皆停用
- [ ] T037 [US4] 更新 `apps/web/tests/ExportPanel.test.tsx`：預設選取「只有答案」且三個選項都有說明文字；選擇其他模式後送出的 body 含該 mode；完成訊息與上次匯出顯示模式名稱；非 `CLOSED` 時停用；錯誤時顯示 `details`
- [ ] T038 [US4] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 三種匯出模式可獨立展示；「只有答案」與 001 結果相同

---

## Phase 5: User Story 2 — 老師查看搶答計時（Priority: P2）

**Goal**: 活動控制段落顯示以伺服器時間為準、百分秒持續跳動的計時，結束後停在總時長

**Independent Test**: 以 `teacherView()` 建立 `OPEN` 狀態並推進假時鐘，計時顯示正確且持續更新；改為 `CLOSED` 後停止並顯示總時長

### Tests for User Story 2

- [ ] T039 [P] [US2] 測試 `apps/web/tests/timeFormat.test.ts`：`formatElapsed(0)` 為 `00:00.00`；`187420` 為 `03:07.42`；無條件捨去（`999` → `00:00.99`）；`3_600_000` 為 `1:00:00.00`；負數視為 0
- [ ] T040 [P] [US2] 測試 `apps/web/tests/SessionTimer.test.tsx`（Vitest 假時鐘＋以 `vi.stubGlobal` 替換 `requestAnimationFrame`／`cancelAnimationFrame`）：`NOT_IMPORTED`／`READY` 顯示 `00:00.00` 且不排程影格；`OPEN` 時依 `openedAt` 與 `serverNow` 計算（瀏覽器時鐘與 `serverNow` 相差 5 秒時仍顯示正確經過時間、不出現負數）並在推進時間後更新；搶答進行中每次 rAF callback 都再呼叫一次 `requestAnimationFrame`（更新頻率跟隨瀏覽器畫面更新，FR-010）；改為 `CLOSED` 後取消影格並顯示 `closedAt − openedAt`；元件卸載時取消影格

### Implementation for User Story 2

- [ ] T041 [P] [US2] 在 `apps/web/src/utils/timeFormat.ts` 實作 `formatElapsed(ms: number): string`（research R5、Clarification Q2），讓 T039 通過
- [ ] T042 [US2] 在 `apps/web/src/pages/teacher/SessionTimer.tsx` 實作計時元件（research R5）：props 為 `status`、`openedAt`、`closedAt`、`serverNow`；每次 `serverNow` 改變時重算 `offset`；`OPEN` 時以 `requestAnimationFrame` 迴圈每格由時鐘重算並只更新本元件 state；其他狀態不啟動迴圈；使用 `font-variant-numeric: tabular-nums`（Tailwind `tabular-nums`）避免數字寬度跳動；`aria-label="搶答計時"`，並以 `aria-live="off"` 避免輔助科技每格朗讀
- [ ] T043 [US2] 在 `apps/web/src/pages/teacher/SessionControls.tsx` 放入 `SessionTimer`（活動控制段落內、按鈕旁）；更新 `apps/web/tests/SessionControls.test.tsx` 確認各狀態都有計時區塊且既有按鈕行為不變
- [ ] T044 [US2] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 計時可獨立展示；重新整理後依伺服器時間接續

---

## Phase 6: User Story 3 — 老師查看各組提交時間（Priority: P3）

**Goal**: 作答狀況與搶答結果中每筆答案後有時間圖示，滑鼠移上或鍵盤聚焦時浮出提交時間與開始後經過時間

**Independent Test**: 以 `teacherView()` 建立 `OPEN`（兩筆送出）與 `CLOSED`（一題有結果、一題無人搶答）的資料，滑鼠移入與 Tab 聚焦都能看到正確時間，移出、失焦、Esc 後關閉

### Tests for User Story 3

- [ ] T045 [P] [US3] 在 `apps/web/tests/timeFormat.test.ts` 新增 `formatClock('2026-11-23T02:32:15.005Z')` 在 `TZ=Asia/Taipei` 下為 `10:32:15.005`
- [ ] T046 [P] [US3] 測試 `apps/web/tests/TimeHint.test.tsx`：按鈕有 `aria-label="查看提交時間"`；`pointerenter`／`focus` 後出現 `role="tooltip"` 且按鈕 `aria-describedby` 指向它，內容含「提交時間 10:32:15.123」與「開始後 00:12.34」；`pointerleave`、`blur`、`Escape` 後消失；小視窗渲染在 `document.body` 下（Portal，不在原本的版面容器內）；位置計算函式在按鈕靠近視窗上緣或左右邊緣時，回傳的座標仍在可視範圍內

### Implementation for User Story 3

- [ ] T047 [P] [US3] 在 `apps/web/src/utils/timeFormat.ts` 新增 `formatClock(iso: string): string`（本地時區 `HH:mm:ss.SSS`），讓 T045 通過
- [ ] T048 [US3] 在 `apps/web/src/components/TimeHint.tsx` 實作時間提示（research R6）：props 為 `receivedAt`、`openedAt`；時鐘圖示（inline SVG，`aria-hidden`）按鈕；`useId` 產生 tooltip id；以 `createPortal` 渲染 `position: fixed` 的小視窗；匯出純函式 `computeTooltipPosition(anchorRect, tooltipSize, viewport)`（預設放上方，上方空間不足改放下方，水平位置夾在可視範圍內）；內容兩行：`提交時間 formatClock(receivedAt)`、`開始後 formatElapsed(receivedAt − openedAt)`
- [ ] T049 [US3] 在 `apps/web/src/pages/teacher/SubmissionBoard.tsx` 的每筆答案後加入 `TimeHint`：搶答進行中每筆送出紀錄使用 `submission.receivedAt`；已結束時使用 `result.receivedAt`，無人搶答不顯示（FR-014）；`openedAt` 取自 `view.openedAt`
- [ ] T050 [US3] 更新 `apps/web/tests/SubmissionBoard.test.tsx`：`OPEN` 時每筆紀錄各有一個時間圖示；`CLOSED` 時有結果的題目有圖示、「無人搶答」的題目沒有；滑鼠移入其中一個圖示時顯示該筆的提交時間；既有順位與「搶答成功」標示不變
- [ ] T051 [US3] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 四個 user story 都完成並各自可展示

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 文件、圖表一致性、人工驗證與最終品質關卡

- [ ] T052 [P] 更新學生端子功能編號與 README：`README.md` 子功能表改為「001 已實作；002 老師端介面優化（題目預覽、搶答計時、提交時間提示、匯出模式）已實作；003 學生端畫面待實作」，第 50 行模擬指令說明改為「學生畫面於子功能 003 提供」；「Guided Notes 準備規則」補充「題目」欄會用於預覽（可有可無）與三種匯出模式的寫入位置，連到 `specs/002-teacher-dashboard-enhancements/contracts/guided-notes-format.md`；人工驗證連結加上 002 quickstart §4；程式中仍指學生端的「子功能 002」改為「子功能 003」：`apps/web/src/App.tsx` 第 13 行畫面文字與第 18 行註解、`apps/server/src/transport/http/routes/authRoutes.ts:22` 註解、`scripts/simulate-students.ts:3` 註解；001 的 spec、plan、research、quickstart、圖表與 manual-verification 為 001 當時的紀錄，**不修改**
- [ ] T053 [P] 機敏資料與 log 檢查：`git ls-files` 不含 `.env`、金鑰或 `data/`；`git grep -nE "BEGIN PRIVATE KEY|private_key\"\\s*:|TEACHER_PASSWORD=.+|SESSION_SECRET=.+"` 沒有真實值；確認匯出 log 只新增 `mode` 欄位，沒有記錄憑證；回報結果
- [ ] T054 圖表一致性驗證（原則 VI）：依 `plan.md`「圖表對應」逐一核對 `diagrams/002-teacher-dashboard-enhancements-{component,class,sequence}.puml` 的元件、類別、欄位、方法與互動順序是否都存在於原始碼且名稱一致；結果寫入 `specs/002-teacher-dashboard-enhancements/diagram-verification.md`（每列：圖表元素、原始碼位置、是否一致、說明）；若實作偏離圖表，先更新 `.puml` 並執行 `plantuml "./diagrams/*.puml"` 重新產生 PNG
- [ ] T055 執行 `npm start` 冒煙測試：伺服器啟動、`/teacher` 可開啟、`GET /api/session` 未登入時回 `PublicView` 且不含題目敘述；回報結果
- [ ] T056 依 `quickstart.md` §4 以真實 Google Sheets 副本（單題範例、題組範例）執行 26 個人工驗證步驟，紀錄於 `specs/002-teacher-dashboard-enhancements/checklists/manual-verification.md`（可勾選的步驟清單，每步「操作 → 預期結果」，通過即勾選，不需截圖、日期或執行者；附「已完成功能與驗證對應」表）；學生端以 `npm run simulate` 模擬；此任務需組員親自執行
- [ ] T057 最終品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；確認 tasks.md 所有任務已勾選，必要時執行 `/speckit-converge`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：無前置
- **Phase 2 Foundational**：依賴 Phase 1；**阻擋所有 user story**
- **Phase 3 US1（預覽）**：依賴 Phase 2
- **Phase 4 US4（匯出模式）**：依賴 Phase 2；與 US1 都修改 `parser.ts`（T013、T028），因此建議在 US1 之後進行
- **Phase 5 US2（計時）**：依賴 Phase 2（`serverNow`）；與 US1、US4 沒有檔案衝突，可平行
- **Phase 6 US3（時間提示）**：依賴 Phase 2（`receivedAt`）與 US2 的 `timeFormat.ts`（`formatElapsed`）
- **Phase 7 Polish**：依賴所有 user story

### User Story Dependencies

```text
Setup → Foundational ─┬─ US1 預覽 → US4 匯出模式 ─┐
                      └─ US2 計時 → US3 時間提示 ──┴─ Polish
```

每個 story 完成時都能獨立展示並有自己的測試：US1 示範預覽；US4 示範三種匯出模式；US2 示範計時；
US3 示範時間提示。

### Within Each User Story

- 測試任務先寫（預期失敗），再實作讓測試通過
- 共用契約 → 領域純函式 → 服務 → HTTP 傳輸 → 前端畫面
- 每個 Phase 最後一個任務是品質關卡，未通過不得進入下一個 Phase（原則 VII）

### Parallel Opportunities

- Phase 2：T003、T004 可平行；T008 可與 T006、T007 平行
- US1：T010、T011 可平行；T015、T016 可與 T012～T014 平行
- US4：T021～T025 可平行；T026、T027 可平行
- US2：T039、T040 可平行；T041 可先行
- US3：T045、T046 可平行；T047 可先行
- 跨 story：Foundational 完成後，「US1 → US4」與「US2 → US3」兩條線可由兩人同時進行
- Polish：T052、T053 可平行

---

## Parallel Example: User Story 4

```bash
# 先平行建立測試：
Task: "T021 exported-columns.json、exported-note-line.json fixtures"
Task: "T022 submittedAt.test.ts"
Task: "T023 guidedNotesParser.test.ts 的表頭列與結果欄案例"
Task: "T024 exportPlan.test.ts 三種模式"
Task: "T025 batchRequests.test.ts"

# 再平行實作契約與純函式：
Task: "T026 shared ExportMode／ExportRequest"
Task: "T027 submittedAt.ts"
```

## Parallel Example: 兩人分工

```bash
# 組員 A（後端為主）：
Task: "Phase 3 US1 → Phase 4 US4"

# 組員 B（前端為主）：
Task: "Phase 5 US2 → Phase 6 US3"
```

---

## Implementation Strategy

### MVP First（User Story 1）

1. 完成 Phase 1 Setup 與 Phase 2 Foundational
2. 完成 Phase 3 US1：匯入後可預覽題目
3. **停下來驗證**：品質關卡通過，並以真實 Google Sheets 副本人工預覽一次
4. 可先展示「題目預覽」

### Incremental Delivery

1. Setup + Foundational → 老師檢視資料擴充（行為不變）
2. ＋US1 → 題目預覽（MVP）
3. ＋US4 → 三種匯出模式
4. ＋US2 → 搶答計時
5. ＋US3 → 提交時間提示
6. Polish → README、圖表一致性驗證、人工驗證、最終品質關卡

---

## Notes

- [P] 任務 = 不同檔案、沒有未完成的相依
- [Story] 標籤對應 spec.md 的 user story，方便追蹤
- 每完成一個任務或一組相關任務就 commit
- 實作若需偏離 plan、contracts 或圖表：需求改變 → 先改 spec 與圖表；只是程式寫錯 → 直接修程式（constitution 開發流程）
- 避免：模糊任務、多個任務同時修改同一檔案、破壞 story 獨立性的跨 story 相依
