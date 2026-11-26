---

description: "子功能 006：老師端學生分組情況面板 — 實作任務清單"
---

# Tasks: 老師端學生分組情況面板

**Input**: `specs/006-teacher-group-overview/` 中的 spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（皆已完成）；
`diagrams/006-teacher-group-overview-*.puml/.png` 為設計藍圖

**Tests**: constitution 原則 VII 要求每個功能都有自動化測試（正常＋邊界／錯誤案例），可見性規則要有專門測試，因此本清單
包含測試任務。每個 Phase 結束時都有「品質關卡」：型別檢查、lint、format、測試必須全部通過，並回報執行的指令與結果，
才能進入下一個 Phase。

**Organization**: 依 user story 分組：US1（看到各組有哪些學生，P1）、US2（標註每位組員回答了哪幾題，P2）、
US3（寬螢幕固定在右側、窄螢幕浮動按鈕＋抽屜，P3）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、不依賴未完成的任務）
- **[Story]**: 所屬 user story（US1～US3，對應 spec.md）
- 每個任務都寫明檔案路徑；路徑依 plan.md 的結構（`packages/shared`、`apps/server`、`apps/web`）

## 共同約定（所有任務都適用）

- 沿用 001～005 的約定：TypeScript `strict`、**不得使用 `any`**；共用型別與 schema 一律從 `@crs/shared` 匯入；測試不連線 Google。
  伺服器整合測試以 `apps/server/tests/helpers/testApp.ts` 的 `startTestApp`、`restartApp`、`loginTeacher`、`teacherWithImport`、
  `joinStudent`、`submitAnswers`、`call`、`connectSocket` 為準；服務單元測試用 `helpers/serviceFactory.ts` 的 `createService`；
  測試資料用 `helpers/builders.ts` 的 `readySession`、`singleQuestion`、`groupQuestion`、`submission`；
  web 測試資料用 `apps/web/tests/viewBuilders.ts` 的 `teacherView`、`studentView`、`publicView`。
- **不得新增任何相依套件**（research R9）；`package.json` 與 `package-lock.json` 不變。
- **不得改變的行為**（FR-018）：作答、送出、順位、搶答判定、Guided Notes 匯出、CSV 匯出；`exportPlan.ts`、
  `guidedNotesExporter.ts`、`domain/export/csv/*`、`ExportPanel.tsx`、`CsvExportPanel.tsx`、`SubmissionBoard.tsx` 的行為不得修改
  （它們的測試資料只允許為新欄位補值）。004 的名冊規則（30 秒緩衝、人數計算、離開只在「待開始」）不得改變。
- **可見性**（FR-016）：`groupOverview`、組員連線狀態、`submitterMemberId` 只能出現在 `TeacherView`；`StudentView`、
  `PublicView`、`OwnSubmission`、`ResultView` 不得新增欄位。
- 畫面文字依 [contracts/teacher-ui.md](./contracts/teacher-ui.md)；資料契約依 [contracts/teacher-view.md](./contracts/teacher-view.md)；
  推播依 [contracts/realtime-events.md](./contracts/realtime-events.md)；所有文字使用繁體中文（FR-020）。
- log 不得記錄暱稱或 token（FR-020、004 FR-022），以 `memberId`、`groupId` 辨識。
- 實作若需偏離 plan、contracts 或 `diagrams/006-*`：先更新圖表並執行
  `java -jar plantuml.jar -charset UTF-8 "./diagrams/006-*.puml"`，再改程式（原則 VI）。

---

## Phase 1: Setup

**Purpose**: 確認基準

- [X] T001 在 `006-teacher-group-overview` branch 執行 `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`，確認 001～005 的基準全部通過並回報結果

**Checkpoint**: 基準綠燈

---

## Phase 2: Foundational（共用契約與老師檢視簽章）

**Purpose**: 新增共用 schema、`Submission.submitterMemberId`，並讓 `toTeacherView` 取得名冊；完成後全專案可編譯

**⚠️ CRITICAL**: 本 Phase 完成前不得開始任何 user story

- [X] T002 修改 `packages/shared/src/domain.ts`：`SubmissionSchema` 新增 `submitterMemberId: z.uuid().nullable().default(null)`，附註解「送出者的學生身分，取自 token 的 memberId（006 FR-008）；只由伺服器寫入；006 之前的紀錄讀取時為 null」；在 `packages/shared/tests/schemas.test.ts` 新增測試：沒有 `submitterMemberId` 的舊送出紀錄解析為 `null`、非 uuid 字串被拒絕
- [X] T003 修改 `packages/shared/src/views.ts`（依 contracts/teacher-view.md）：新增 `MemberAnswerTagSchema`（`questionNumber` 正整數、`isWinner: boolean`）、`OverviewMemberSchema`（`memberId: z.uuid()`、`nickname: string`、`inGroup: boolean`、`disconnected: boolean`、`answered: MemberAnswerTag[]`；refine「`inGroup = false` 時 `disconnected` 必為 `false` 且 `answered` 非空」、「`answered` 題號不重複且遞增」）、`GroupOverviewSchema`（`groupId: GroupIdSchema`、`memberCount` 非負整數、`members: OverviewMember[]`；refine「`memberCount` = `inGroup` 成員數」「`inGroup = true` 的成員都排在前面」「`memberId` 不重複」），匯出對應型別；`TeacherViewSchema` 新增 `groupOverview: z.array(GroupOverviewSchema)`；每個 schema 附繁體中文註解說明業務意義；`StudentViewSchema`、`PublicViewSchema`、`OwnSubmissionSchema`、`ResultViewSchema` 不得修改。在 `packages/shared/tests/schemas.test.ts` 為每條 refine 各寫一個通過與一個失敗案例
- [X] T004 修改 `apps/server/src/domain/roster/groupRoster.ts` 的型別：`RosterReader` 改為 `Pick<GroupRoster, 'headcounts' | 'membersOf' | 'isInGrace'>`，並先新增 `isInGrace(memberId: string): boolean`（連線數為 0 且移除計時器存在時回傳 true，其餘 false）與註解（data-model §3）；事件的新增留到 T013
- [X] T005 修改 `apps/server/src/domain/visibility/visibilityPolicy.ts`：`toTeacherView(session, strategy, roster: RosterReader, now)`，回傳加上 `groupOverview: []`（暫時值，T014 改為呼叫 `buildGroupOverview`）；同步修改所有呼叫處：`apps/server/src/transport/views.ts`（`viewFor` 傳入 `roster`）、`apps/server/src/transport/http/routes/sessionRoutes.ts`（第 25 行附近，使用已注入的 `roster`）、`apps/server/src/transport/realtime/realtimeGateway.ts`（三處，傳入 `this.roster`）、`apps/server/tests/integration/concurrency.test.ts`、`apps/server/tests/unit/visibilityPolicy.test.ts`（以 `new GroupRoster()` 傳入）
- [X] T006 [P] 補齊測試資料以通過型別檢查：`apps/server/tests/helpers/builders.ts` 的 `submission(...)` 新增最後一個參數 `submitterMemberId: string | null = null` 並寫入；`apps/web/tests/viewBuilders.ts` 的 `teacherView()` 預設 `groupOverview: []`、其中的送出紀錄補 `submitterMemberId: null`；以下檔案中型別為 `Submission` 的物件字面值補 `submitterMemberId: null`（`OwnSubmission`、`ResultView` 不補）：`apps/server/tests/integration/csvExport.test.ts`、`apps/server/tests/integration/visibility.test.ts`、`apps/server/tests/unit/resultRows.test.ts`、`apps/web/tests/SubmissionBoard.test.tsx`，以及 `npm run typecheck` 指出的其他檔案
  - 實作備註：`SubmissionService` 補欄位後才能編譯，因此 T025（寫入 `submitter.memberId`）在本 Phase 提前完成
- [X] T007 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過（既有測試不得因本 Phase 改變預期值），回報指令與結果

**Checkpoint**: 新契約可用、老師檢視能取得名冊、全專案綠燈

---

## Phase 3: User Story 1 - 老師一眼看到各組有哪些學生 (Priority: P1) 🎯 MVP

**Goal**: 老師端顯示「分組情況」：每組「第 N 組」、「N 人」、組員暱稱（依加入先後）、空組「尚無組員」、未匯入提示；
斷線緩衝中標「連線中斷」；所有名冊變動 1 秒內推播到老師端

**Independent Test**: 匯入後三個學生分頁加入第 1 組（兩人）與第 2 組（一人），面板顯示標示、人數與暱稱；關閉一個分頁 →
1 秒內標「連線中斷」、30 秒後移除；學生分頁收到的資料不含他組名單與連線狀態

### Tests for User Story 1

- [X] T008 [P] [US1] 在 `apps/server/tests/unit/groupRoster.test.ts`（用既有的假計時器）新增：最後一個連線斷開時發出 `{ kind: 'disconnected', memberId, groupId }` 且 `isInGrace` 為 true；同一 memberId 兩個連線只斷一個時不發事件、`isInGrace` 為 false；緩衝期內 `connected` 發出 `reconnected`、`isInGrace` 變回 false、`joinedSeq` 與排序不變；緩衝到期仍發出 `removed`（004 行為不變）且 `isInGrace` 為 false；`leave`、`clear` 後 `isInGrace` 為 false；`headcounts` 在緩衝期內仍計入（FR-021）
- [X] T009 [P] [US1] 新增 `apps/server/tests/unit/groupOverview.test.ts`（組員部分）：`NOT_IMPORTED` 回傳 `[]`；4 組時依組別編號列出 4 筆；第 1 組 Milo、Ava 依加入先後、`memberCount` 2；兩位同暱稱「Milo」分別列出、`memberId` 不同；空組 `memberCount` 0、`members` 為 `[]`；緩衝中的組員 `disconnected: true`、仍計入 `memberCount`；每組 `memberCount` 等於 `roster.headcounts(groups)` 的值；結果通過 `GroupOverviewSchema` 驗證
- [X] T010 [P] [US1] 在 `apps/server/tests/unit/visibilityPolicy.test.ts` 新增（SC-005）：`toTeacherView` 含 `groupOverview` 且內容等於 `buildGroupOverview` 的結果；`toStudentView` 與 `toPublicView` 的物件沒有 `groupOverview` 鍵、沒有任何 `disconnected` 欄位，學生的 `members` 只含本組
- [X] T011 [P] [US1] 在 `apps/server/tests/integration/roster.test.ts` 新增（真實 Socket.IO）：老師 socket 在學生加入、離開組別（READY）、斷線（收到 `disconnected: true`）、緩衝內重連（變回 `false`）、緩衝到期移除（以 `startTestApp` 的 `rosterGraceMs` 縮短緩衝）、重新匯入（各組 0 人）後都收到更新的 `groupOverview`；學生與公開 socket 在 `disconnected`／`reconnected` 時**不會**收到新的 `session:state`（比較事件數），收到的 `StudentView` 不含 `groupOverview` 與他組暱稱
- [X] T012 [P] [US1] 新增 `apps/web/tests/GroupOverviewPanel.test.tsx`：未匯入（`groups: []`）顯示「匯入 Guided Notes 後會在這裡顯示各組組員。」；每組有 `section`「第 N 組」與「N 人」；組員依資料順序列出；空組顯示「尚無組員」；`disconnected: true` 的組員旁有文字「連線中斷」；面板 `aria-label="分組情況"`；暱稱元素有 `break-words` 類別（FR-015）；面板沒有任何按鈕（FR-017）

### Implementation for User Story 1

- [X] T013 [US1] 修改 `apps/server/src/domain/roster/groupRoster.ts`：`RosterChange` 新增 `{ kind: 'disconnected' | 'reconnected'; memberId; groupId }`；`disconnected()` 在連線數歸零、啟動計時器時 `emit({ kind: 'disconnected', ... })`；`connected()` 在取消既有移除計時器時 `emit({ kind: 'reconnected', ... })`（連線數由 1 增為 2 不發事件）；更新類別註解（research R3、data-model §3）；讓 T008 通過
- [X] T014 [US1] 新增 `apps/server/src/domain/overview/groupOverview.ts`：`buildGroupOverview(session: QuizSession, roster: RosterReader, results: QuestionResult[]): GroupOverview[]`，本階段只組出名冊中的組員（`roster.membersOf(groupId)`，`inGroup: true`、`disconnected: roster.isInGrace(memberId)`、`answered: []`），依 `session.groups` 順序；附註解說明業務規則（research R2、R5）；不依賴傳輸層。修改 `visibilityPolicy.ts` 的 `toTeacherView`，以 `deriveResults(session, strategy)` 的結果呼叫 `buildGroupOverview`（取代 T005 的 `[]`，同一份 results 也用於既有的 `results` 欄位）；讓 T009、T010 通過
- [X] T015 [US1] 修改 `apps/server/src/transport/realtime/realtimeGateway.ts` 的 `onRosterChange`（contracts/realtime-events.md）：`disconnected`／`reconnected` 只推播 `TeacherView` 給 `TEACHERS_ROOM`；其他 kind 維持原本的公開與各組推播，並**另外**推播 `TeacherView` 給 `TEACHERS_ROOM`；版本號不遞增；新增結構化 log `student.roster.disconnected`／`student.roster.reconnected`（只含 `groupId`、`memberId`）；更新類別與方法註解（原本「老師端不顯示名冊，不推播」改寫）；讓 T011 通過
- [X] T016 [US1] 新增 `apps/web/src/pages/teacher/GroupOverviewPanel.tsx`：props `{ view: TeacherView }`；依 contracts/teacher-ui.md 渲染標題「分組情況」、未匯入提示、每組 `<section aria-label="第 N 組">`（標示用 `groupName`、人數「N 人」）、`<ul>` 組員清單、「尚無組員」、「連線中斷」文字標籤；暱稱 `break-words [overflow-wrap:anywhere]`；外層 `<aside aria-label="分組情況">`（捲動與定位由 US3 的容器負責，面板本身不設高度）；讓 T012 通過
  - 實作備註：面板根元素改為 `<div>`（含「分組情況」標題），`<aside aria-label="分組情況">` 由外層容器提供（寬：側欄；窄：抽屜為 dialog），避免重複的 landmark；即 T034 的調整提前完成
- [X] T017 [US1] 修改 `apps/web/src/pages/teacher/TeacherDashboard.tsx`：`view.viewer === 'teacher'` 時在既有區塊之後掛載 `<GroupOverviewPanel view={view} />`（暫時位置，US3 改為側欄／抽屜）；既有區塊的順序與內容不變
- [X] T018 [US1] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；依 quickstart.md §4.1 手動確認一次組員名單與「連線中斷」
  - 實作備註：自動化品質關卡已通過；瀏覽器人工確認尚未執行，統一列在 `checklists/manual-verification.md` 由組員實測

**Checkpoint**: US1 可獨立展示（MVP）：老師看得到各組組員與連線狀態，學生端資料不變

---

## Phase 4: User Story 2 - 標註每位組員回答了哪幾題 (Priority: P2)

**Goal**: 組員旁依題號顯示「第 N 題」，搶答成功醒目標示並附「搶答成功」文字；不在組內的送出者以灰色「不在組內」保留；
標註依送出者身分（不依暱稱），伺服器重新啟動後仍在

**Independent Test**: 搶答進行中第 1 組 Milo 送出第 1 題、Ava 送出第 2 題，第 2 組 Leo 送出第 1 題：Milo「★ 第 1 題」、
Ava「第 2 題」、Leo「第 1 題」；同組同暱稱只標實際送出者；Ava 斷線超過 30 秒後灰色「不在組內」並保留「第 2 題」

### Tests for User Story 2

- [X] T019 [P] [US2] 在 `apps/server/tests/integration/submissions.test.ts` 新增：學生送出後保存的 `Submission.submitterMemberId` 等於該學生 token 的 `memberId`（從老師 `GET /api/session` 的 `submissions` 讀取）；送出請求夾帶 `submitterMemberId` 時依既有的 `SubmitRequestSchema`（`z.strictObject`）回 400 且不建立送出紀錄（身分只能取自 token）；`restartApp` 後仍保留；學生自己的 `ownSubmissions` 不含 `submitterMemberId`
- [X] T020 [P] [US2] 在 `apps/server/tests/unit/localSessionRepository.test.ts` 新增：讀取沒有 `submitterMemberId` 欄位的舊 `session.json`（004／005 格式）成功，該欄位為 `null`
- [X] T021 [P] [US2] 在 `apps/server/tests/unit/groupOverview.test.ts` 新增（標註部分）：組員的 `answered` 依題號由小到大（送出順序為第 3 題、第 1 題時輸出 1、3）；`isWinner` 只在該送出的 `id` 等於 `deriveResults` 的 `winner.id` 時為 true（第 1 組先送、第 2 組後送同一題）；同組兩位「Milo」只有 `submitterMemberId` 相符者有標註；`submitterMemberId: null` 的舊紀錄不標註、也不產生「不在組內」成員；不在名冊但送出過的身分列在該組最後、`inGroup: false`、`disconnected: false`、暱稱取其第一筆送出的 `submitterNickname`（為 `null` 時為「（未記錄暱稱）」）、多位時依各自第一筆送出的 `sequence` 排序、不計入 `memberCount`；該身分重新加入名冊後恢復 `inGroup: true` 且標註不變；「待開始」時所有 `answered` 為 `[]`
- [X] T022 [P] [US2] 在 `apps/server/tests/integration/roster.test.ts` 新增：學生送出後老師 socket 收到的 `groupOverview` 在該學生旁有對應題號；送出者斷線超過緩衝（縮短 `rosterGraceMs`）後老師收到 `inGroup: false` 且保留題號；其他組學生 socket 沒有收到任何事件（沿用 003 規則）
- [X] T023 [P] [US2] 新增 `apps/web/tests/MemberAnswerTags.test.tsx`：依資料順序顯示「第 1 題」「第 3 題」；`isWinner: true` 的標記含「★」、`title="搶答成功"`、可被 `getByText(/搶答成功/)` 找到的隱藏文字，`isWinner: false` 沒有這些；沒有標記時不渲染任何清單；容器有 `flex-wrap`
- [X] T024 [P] [US2] 在 `apps/web/tests/GroupOverviewPanel.test.tsx` 新增：`inGroup: false` 的成員顯示文字「不在組內」並有灰色樣式類別、排在組員之後；組員下方顯示其題號標記；某組 `memberCount` 0 但有不在組內的送出者時顯示「0 人」且不顯示「尚無組員」

### Implementation for User Story 2

- [X] T025 [US2] 修改 `apps/server/src/domain/submission/submissionService.ts`：建立 `Submission` 時寫入 `submitterMemberId: submitter.memberId`，更新註解（送出者身分只取自 token，006 FR-008）；讓 T019、T020 通過
- [X] T026 [US2] 修改 `apps/server/src/domain/overview/groupOverview.ts`：依 research R4、R5 加入 `answered`（只計 `submitterMemberId` 不為 `null` 的送出、依題號排序、`isWinner` 以 `results` 的 `winner.id` 判斷）與「不在組內的送出者」（排序、暱稱來源、`（未記錄暱稱）` 後備文字、不計入 `memberCount`）；附註解說明每條規則對應的 FR；讓 T021、T022 通過
- [X] T027 [P] [US2] 新增 `apps/web/src/pages/teacher/MemberAnswerTags.tsx`：props `{ tags: MemberAnswerTag[] }`；`<ul className="flex flex-wrap gap-1">` 每個標記為膠囊「第 N 題」；`isWinner` 時琥珀色底、「★」前綴、`title="搶答成功"`、`<span className="sr-only">（搶答成功）</span>`；沒有標記時回傳 `null`；讓 T023 通過
- [X] T028 [US2] 修改 `apps/web/src/pages/teacher/GroupOverviewPanel.tsx`：每位成員下方渲染 `MemberAnswerTags`；`inGroup: false` 的成員整列灰色（`text-slate-400`）並加文字標籤「不在組內」；「尚無組員」只在 `members` 為空時顯示；讓 T024 通過
- [X] T029 [US2] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過（含既有 Guided Notes／CSV 匯出與送出測試，SC-006），回報指令與結果；依 quickstart.md §4.2 手動確認一次
  - 實作備註：自動化品質關卡已通過；瀏覽器人工確認尚未執行，統一列在 `checklists/manual-verification.md` 由組員實測

**Checkpoint**: US1＋US2 可展示：組員名單加上回答標註、搶答成功與不在組內

---

## Phase 5: User Story 3 - 寬螢幕固定在右側、內容多時可捲動 (Priority: P3)

**Goal**: 視窗 ≥ 1280 px 時面板為右側 sticky 側欄、面板內捲動；< 1280 px 時收合為右上角浮動按鈕，按下展開右側抽屜，
可用「關閉」、點背景、Esc 關閉；跨過門檻立即切換

**Independent Test**: 1440 px 捲動主畫面面板不動、20 組 × 5 人時面板內可捲到底；1024 px 時只有右上角按鈕，展開抽屜看到相同資訊，
三種方式都能關閉；拉寬拉窄立即切換

### Tests for User Story 3

- [X] T030 [P] [US3] 新增 `apps/web/tests/useWideLayout.test.tsx`：以 `vi.stubGlobal('matchMedia', ...)` 建立可觸發 `change` 事件的假 `MediaQueryList`；查詢字串為 `(min-width: 1280px)`；初始值反映 `matches`；觸發 `change` 後回傳值立即更新；卸載時移除監聽
- [X] T031 [P] [US3] 新增 `apps/web/tests/TeacherDashboard.test.tsx`：以 `vi.mock('../src/hooks/useSessionState')` 回傳 `teacherView()`（含兩組、各一位組員）與 `connected: true`，以假 `matchMedia` 控制寬窄。寬：存在 `aside[aria-label="分組情況"]` 且有 `sticky`、`h-screen`、`overflow-y-auto`、`overscroll-contain` 類別，沒有「分組情況」浮動按鈕、沒有收起按鈕（FR-011）。窄：沒有側欄，有 `button` 名稱「分組情況」且有 `fixed` 類別；按下後出現 `role="dialog"`（`aria-label="分組情況"`）內含相同組員，焦點在「關閉」按鈕；分別以「關閉」按鈕、點背景、按 Esc 關閉，焦點回到浮動按鈕；展開中重新渲染新的 view（多一位組員）時抽屜內立即出現（US3-6）。跨斷點：窄且展開時切到寬 → 顯示側欄、沒有 dialog；再切回窄 → 收合（沒有 dialog）

### Implementation for User Story 3

- [X] T032 [P] [US3] 新增 `apps/web/src/hooks/useWideLayout.ts`：匯出 `WIDE_LAYOUT_MIN_WIDTH = 1280` 與 `useWideLayout(): boolean`，以 `window.matchMedia('(min-width: 1280px)')` 初始化並監聽 `change`（卸載時移除）；附註解說明 1280 px 對應 spec Assumptions 與 Tailwind `xl`；讓 T030 通過
- [X] T033 [US3] 新增 `apps/web/src/pages/teacher/GroupOverviewToggle.tsx`（research R6、contracts/teacher-ui.md「窄版面」）：狀態 `open` 預設 `false`（只存在元件內）；浮動按鈕「分組情況」`fixed top-4 right-4 z-30`；展開時渲染半透明背景（點擊關閉）與右側抽屜 `fixed inset-y-0 right-0 z-40 w-[min(22rem,100vw)] overflow-y-auto overscroll-contain`，`role="dialog"`、`aria-modal="true"`、`aria-label="分組情況"`，內含「關閉」按鈕與 `GroupOverviewPanel`；開啟時焦點移到「關閉」，Esc 關閉，關閉後焦點回到浮動按鈕
- [X] T034 [US3] 修改 `apps/web/src/pages/teacher/TeacherDashboard.tsx`：以 `useWideLayout()` 只渲染一種版面。寬：外層 `flex items-start`；主畫面 `min-w-0 flex-1`，內部保留原本的 `mx-auto max-w-5xl space-y-6 p-6` 與所有既有區塊；右側容器 `sticky top-0 h-screen w-80 shrink-0 overflow-y-auto overscroll-contain border-l bg-white`（或等效樣式）內放 `GroupOverviewPanel`，沒有收起按鈕。窄：主畫面外層加 `pr-28`（保留浮動按鈕欄，FR-012），渲染 `GroupOverviewToggle`。移除 T017 的暫時掛載；調整 `GroupOverviewPanel` 外層標記，避免與抽屜重複 `aside`／`aria-label`（抽屜內面板不再包 `aside`）；讓 T031 通過
- [X] T035 [US3] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；依 quickstart.md §4.3 在瀏覽器實際確認 sticky、面板內捲動不帶動主畫面、浮動按鈕不遮擋內容（jsdom 無法驗證版面）
  - 實作備註：自動化品質關卡已通過；2026-11-26 以正式建置的真實伺服器與老師端在瀏覽器實測 §4.3 全部項目（1680／1600／1440 px、面板內捲動、浮動按鈕不遮擋、抽屜三種關閉方式、跨門檻切換），結果記錄於 `checklists/manual-verification.md`「AI 瀏覽器驗證紀錄」

**Checkpoint**: 三個 user story 全部完成

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] 新增 `specs/006-teacher-group-overview/diagram-verification.md`：逐一比對 `diagrams/006-teacher-group-overview-{component,class,sequence}.puml` 的元素與 plan.md「圖表對應」的原始碼位置（函式名稱、簽章、推播對象、事件 kind）；不一致時先改圖並重新產生 PNG，再記錄結果（原則 VI）
- [X] T037 [P] 新增 `specs/006-teacher-group-overview/checklists/manual-verification.md`：依 quickstart.md §4 列出老師＋至少兩組學生的人工驗證步驟與勾選欄、預期結果，留給組員實測填寫（原則 VII）
- [X] T038 [P] 新增 `specs/006-teacher-group-overview/openspec-notice.md`：給 OpenSpec 小組的對外變更摘要（老師端新增分組情況面板、`TeacherView.groupOverview`、`Submission.submitterMemberId`、名冊變更推播老師；學生端與匯出不變），比照 005 的格式
- [X] T039 [P] 更新 `README.md` 的功能說明（若有老師端功能列表）：加入「分組情況」面板與 1280 px 版面行為的一兩句說明；不改其他段落
- [X] T040 依 quickstart.md §3 執行完整自動化驗證（`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`），全部通過並回報；確認 `package.json`／`package-lock.json` 沒有變更、`git diff` 中 FR-018 列出的匯出與送出列表原始碼沒有行為修改

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → **Phase 2 Foundational**（阻擋所有 user story）→ **Phase 3 US1** → **Phase 4 US2** → **Phase 5 US3** → **Phase 6 Polish**
- US2 依賴 US1：`groupOverview.ts` 與 `GroupOverviewPanel.tsx` 在 US1 建立，US2 在其上加標註。
- US3 依賴 US1 的 `GroupOverviewPanel`（只需要元件存在，不依賴 US2）；若要平行開發，US3 可在 US1 完成後與 US2 同時進行，
  但 T034 與 T028 都會碰 `GroupOverviewPanel.tsx` 的外層標記，需協調合併。

### Within Each User Story

- 測試任務先寫、確認失敗，再做實作任務讓它通過。
- 伺服器：名冊（T013）→ 組裝（T014）→ 推播（T015）；送出身分（T025）→ 標註組裝（T026）。
- 前端：元件 → 掛載到 `TeacherDashboard`。

### Parallel Opportunities

- Phase 2：T006 可與 T004、T005 平行（不同檔案）；T002 → T003 都在 shared，依序做。
- US1 測試：T008～T012 全部 [P]（五個不同檔案）。
- US2 測試：T019～T024 全部 [P]（T021 與 T009 同檔案，但 T009 屬於已完成的 US1）；實作 T027 [P] 可與 T025、T026 平行。
- US3：T030、T031、T032 [P]；T033 → T034 依序。
- Polish：T036～T039 全部 [P]。

### Parallel Example: User Story 1

```text
# 同時寫 US1 的五個測試：
Task: "T008 groupRoster.test.ts 新增 disconnected/reconnected 與 isInGrace 測試"
Task: "T009 groupOverview.test.ts 組員部分"
Task: "T010 visibilityPolicy.test.ts 老師含 groupOverview、學生/公開不含"
Task: "T011 roster.test.ts 老師推播與學生不收連線狀態"
Task: "T012 GroupOverviewPanel.test.tsx 面板文字"
```

### Parallel Example: User Story 2

```text
Task: "T019 submissions.test.ts 保存 submitterMemberId"
Task: "T020 localSessionRepository.test.ts 舊檔相容"
Task: "T023 MemberAnswerTags.test.tsx"
Task: "T027 MemberAnswerTags.tsx"
```

### Parallel Example: User Story 3

```text
Task: "T030 useWideLayout.test.tsx"
Task: "T031 TeacherDashboard.test.tsx"
Task: "T032 useWideLayout.ts"
```

---

## Implementation Strategy

### MVP First（只做 US1）

1. Phase 1 → Phase 2（契約、簽章、測試資料補值，全專案綠燈）
2. Phase 3：名冊事件、`buildGroupOverview`（組員部分）、老師推播、`GroupOverviewPanel`
3. **停下來驗證**：quickstart §4.1；老師端已能看到各組組員與「連線中斷」，可先展示

### Incremental Delivery

1. US1 → 展示組員名單（MVP）
2. US2 → 加上題號標註、搶答成功、不在組內
3. US3 → 版面定案（側欄／浮動按鈕＋抽屜）
4. Polish → 圖表驗證、人工驗證清單、OpenSpec 通知、README

### 後續流程（constitution 開發流程）

- 本清單完成後先執行 `/speckit-analyze`，確認 spec、plan、tasks 之間沒有衝突或缺漏，再進入 `/speckit-implement`。
- implement 完成後執行 `/speckit-converge` 補齊遺漏。

---

## Phase 7: Convergence

使用者於 2026-11-26 調整寬版面需求（主畫面置中、分組情況放在主畫面右緣到視窗右緣之間的框架並置中；因 1280 px 時右側只剩
128 px 放不下面板，使用者選擇把寬版面門檻提高到 1600 px）。依憲章「需求變了先改 spec 與圖表，再改程式碼」排序。

- [X] T041 更新 `specs/006-teacher-group-overview/spec.md`：Clarifications 新增本次問答；FR-011 改為「視窗寬度至少 1600 px 時，主畫面內容（最寬 1024 px）MUST 在視窗中水平置中；面板的框架 MUST 為主畫面右緣到視窗右緣之間的區域，固定在視窗中、不隨主畫面捲動；面板 MUST 在框架內水平置中；主畫面 MUST NOT 被遮住；不提供收起操作」；FR-012、FR-014、US3 情境 1、4、5、Independent Test（1440 px 改為 1680 px）、Assumptions 的門檻改為 1600 px；`checklists/requirements.md` 附註同步 per FR-011（contradicts）
- [X] T042 [P] 更新 `plan.md`（Summary、圖表對應）、`research.md` R6（固定框架取代 sticky 側欄、門檻 1600 px 的理由）、`data-model.md` §4、`contracts/teacher-ui.md`「寬版面」、`quickstart.md` §4.3、`checklists/manual-verification.md` C 節、`openspec-notice.md`、`README.md` 的 006 段落，所有 1280 px 改為 1600 px 並描述置中框架 per plan: research R6（contradicts）
- [X] T043 依原則 VI 先更新 `diagrams/006-teacher-group-overview-{component,class,sequence}.puml`（門檻 1600 px、寬版面為置中 main＋右側固定框架、面板在框架內置中），重新產生 PNG，並在 `diagram-verification.md` 記錄 per Constitution VI（contradicts）
- [X] T044 修改 `apps/web/src/hooks/useWideLayout.ts`：`WIDE_LAYOUT_MIN_WIDTH = 1600`，更新註解（1600 = 主畫面 1024 px ＋ 兩側各 288 px） per FR-011、FR-014（contradicts）
- [X] T045 修改 `apps/web/src/pages/teacher/TeacherDashboard.tsx` 寬版面：主畫面維持 `mx-auto max-w-5xl` 在視窗置中（不再以 flex 讓出右側欄）；分組情況改為 `<aside aria-label="分組情況">` 固定框架 `fixed top-0 right-0 bottom-0 left-[calc(50%+32rem)] overflow-y-auto overscroll-contain`，內部以 `mx-auto w-full max-w-xs` 讓面板水平置中；更新 `GroupOverviewToggle.tsx` 註解的門檻 per FR-011、FR-013（contradicts）
  - 實作備註：瀏覽器量測發現框架出現捲軸時面板偏左（左 16 px、右 31 px），框架另加 `[scrollbar-gutter:stable_both-edges]` 修正
- [X] T046 更新 `apps/web/tests/useWideLayout.test.tsx`（查詢字串 `(min-width: 1600px)`）與 `apps/web/tests/TeacherDashboard.test.tsx`（寬版面：`aside` 有 `fixed`、`left-[calc(50%+32rem)]`、`right-0`、`overflow-y-auto`、`overscroll-contain`；主畫面容器有 `mx-auto` 與 `max-w-5xl`；面板外層有 `mx-auto`、`max-w-xs`） per FR-011、SC-003（partial）
- [X] T047 品質關卡：`npm run typecheck`、`npm run lint`、`npx prettier --check . --end-of-line auto`、`npm test`、`npm run build` 全部通過並回報；以瀏覽器在 1680 px 與 1440 px 實際檢查置中與框架位置 per Constitution VII（partial）
  - 實作備註：因登入需要真實老師密碼，瀏覽器檢查以正式建置的 CSS 與相同 DOM 結構的量測頁進行：1680 px 主畫面置中（左右各 320 px）、框架左緣與主畫面右緣間距 0、右緣貼齊視窗、捲動後框架不動、面板左右間距 30／31 px；1600 px 框架 281 px、面板 219 px、無重疊。實際老師端畫面仍待 `checklists/manual-verification.md` C 節人工確認

---

## Phase 8: Convergence

- [X] T048 在 `apps/server/tests/integration/roster.test.ts` 的 006 測試中，以 `SessionStatePayloadSchema.safeParse` 驗證老師 socket 收到的每一份 `session:state`（含加入、斷線、重連、移除、送出、不在組內、重新匯入各階段）都通過共用契約，證明前端不會因 `groupOverview` 不變式而丟棄推播 per Constitution V、SC-002（partial）
- [X] T049 [P] 讓 `specs/006-teacher-group-overview/data-model.md` §4 的狀態名稱與程式碼一致（`TeacherDashboard` 中 `useWideLayout()` 的結果為 `wide`） per plan: data-model §4（partial）

---

## Phase 9: Convergence

- [X] T050 [P] 在 `apps/web/tests/MemberAnswerTags.test.tsx` 斷言搶答成功與一般標記共用相同的膠囊樣式（`inline-flex`、`items-center`、`px-2.5`、`py-0.5`），搶答成功的 `li` 有 `gap-1` 且「★」與「第 N 題」為兩個獨立元素；在 `apps/web/tests/TeacherDashboard.test.tsx` 寬版面測試中斷言框架內卡片有 `rounded-2xl`、`ring-1` 與陰影 class，在 `apps/web/tests/GroupOverviewPanel.test.tsx` 斷言各組卡片有 `bg-white`、`shadow-sm` per contracts/teacher-ui.md、Constitution VII（partial）
