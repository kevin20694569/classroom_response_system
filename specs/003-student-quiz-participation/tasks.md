---

description: "子功能 003：學生端搶答作答與結果檢視 — 實作任務清單"
---

# Tasks: 學生端搶答作答與結果檢視

**Input**: `specs/003-student-quiz-participation/` 中的 spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（皆已完成）；
`diagrams/003-student-quiz-participation-*.puml/.png` 為設計藍圖

**Tests**: constitution 原則 VII 要求每個功能都有自動化測試（正常＋邊界／錯誤案例），可見性要有專門測試，
因此本清單包含測試任務。每個 Phase 結束時都有「品質關卡」任務：型別檢查、lint、format、測試必須全部通過，
並回報執行的指令與結果，才能進入下一個 Phase。

**Organization**: 依 user story 分組，依優先順序排列：US1（選組加入與階段同步，P1）、US2（作答與送出，P1）、
US3（檢視結果，P2）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、不依賴未完成的任務）
- **[Story]**: 所屬 user story（US1～US3，對應 spec.md）
- 每個任務都寫明檔案路徑；路徑依 plan.md 的結構（`apps/web`、`apps/server`、`packages/shared`）

## 共同約定（所有任務都適用）

- 沿用 001、002 tasks.md 的共同約定：TypeScript `strict`、**不得使用 `any`**；共用型別與規則一律從 `@crs/shared`
  匯入；測試不連線 Google 或真實伺服器。
- **不新增任何相依套件**（plan Technical Context）。
- 001、002 既有測試必須持續通過；修改既有函式簽章時同步更新其測試與呼叫端。
- 學生端所有畫面文字依 [contracts/student-ui.md](./contracts/student-ui.md)，使用繁體中文，不顯示堆疊、檔案路徑或
  憑證（FR-027）。
- 前端測試：`fetch` 用 `apps/web/tests/helpers.tsx` 的 `mockFetch`；socket 以 `vi.mock('../src/api/socket')` 提供
  可手動觸發 `connect`、`disconnect`、`connect_error`、`session:state`、`session:reset` 的假 socket（寫在
  `apps/web/tests/fakeSocket.ts`，T008）；每個測試前清空 `sessionStorage`。
- 實作若需偏離 plan、contracts 或 `diagrams/003-*`：先更新圖表並執行 `plantuml "./diagrams/*.puml"`，再改程式（原則 VI）。

---

## Phase 1: Setup

**Purpose**: 確認基準

- [X] T001 在 `003-student-quiz-participation` branch 執行 `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`，確認 001、002 的基準全部通過並回報結果（作為後續回歸比對）

**Checkpoint**: 基準綠燈

---

## Phase 2: Foundational（多個 user story 共用的契約與基礎）

**Purpose**: 子題標記契約、學生身分保存、失效原因回報、前端測試替身

**⚠️ CRITICAL**: 本 Phase 完成前不得開始任何 user story

- [X] T002 在 `packages/shared/src/views.ts` 的 `QuestionSummarySchema` 新增 `blankLabels: z.array(z.string().nullable())`，並以 `refine` 檢查 `blankLabels.length === blankCount`（data-model §1）；加註解「子題標記原文（如『（1）』），只含標記、不含任何敘述（FR-022）」；`TeacherQuestionViewSchema` 由 `.extend` 繼承，確認仍可正常 extend（若 `refine` 造成無法 extend，改為以 `superRefine` 套在使用處或改寫成不影響 extend 的寫法，並加註解說明）
- [X] T003 在 `packages/shared/tests/schemas.test.ts` 新增測試：`blankLabels` 長度等於 `blankCount` 時通過；長度不符時失敗；元素可為 `null`；`StudentViewSchema`、`PublicViewSchema`、`TeacherViewSchema` 的題目都接受 `blankLabels`
- [X] T004 在 `apps/server/src/domain/visibility/visibilityPolicy.ts` 的 `base()` 與 `toTeacherQuestion()` 產生 `blankLabels: question.blanks.map((b) => b.label)`（依子題序號排列）；加註解說明只取標記原文（research R5）
- [X] T005 更新 `apps/server/tests/unit/visibilityPolicy.test.ts`：三種檢視的題目都有 `blankLabels`，題組為 `['（1）', '（2）']`、單題為 `[null]`；以含題目與子題敘述的題目資料測試，學生與公開檢視 `JSON.stringify` 後不含任何敘述文字（FR-022、SC-004）
- [X] T006 [P] 在 `apps/web/src/api/identity.ts` 新增學生身分保存：`getStudentIdentity(): StudentIdentity | null`（讀 `sessionStorage` 鍵 `crs.identity`，以 `IdentitySummarySchema` 驗證且 `role === 'student'`，失敗回 `null`）、`setStudentIdentity(identity)`、`clearIdentity()`（同時清除 `crs.token` 與 `crs.identity`）；加註解說明只用 `sessionStorage` 的理由（research R2、data-model §2）；新增 `apps/web/tests/identity.test.ts`（正常讀寫、內容壞掉回 `null`、老師身分回 `null`、清除）
- [X] T007 在 `apps/web/src/hooks/useSessionState.ts` 將 `onUnauthorized: () => void` 改為 `onUnauthorized: (reason: InvalidationReason) => void`（`InvalidationReason = 'NEW_ACTIVITY' | 'EXPIRED'`，定義並匯出於 `useSessionState.ts`）：`session:reset` 傳 `'NEW_ACTIVITY'`、`connect_error: UNAUTHORIZED` 傳 `'EXPIRED'`（research R4）；老師端呼叫處（`apps/web/src/pages/teacher/TeacherDashboard.tsx` 等）忽略參數、行為不變
- [X] T008 [P] 新增 `apps/web/tests/fakeSocket.ts`：可被 `vi.mock('../src/api/socket')` 使用的假 socket，記錄建立時的 token，提供 `emitServer(event, payload)`、`connect()`、`disconnect()`、`connectError(message)` 等觸發方法；並在 `apps/web/tests/viewBuilders.ts` 新增 `studentView(overrides)` 與 `publicView(overrides)`（題目沿用 `teacherView()` 的 4 題：第 1、2 題題組、第 3、4 題單題，含 `blankLabels`；第 2 題標記為 `[null, null]`），`teacherView()` 的題目補上 `blankLabels`
- [X] T009 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 三種檢視都有子題標記且不含敘述；學生身分可保存；失效原因可區分；老師端行為不變

---

## Phase 3: User Story 1 — 學生選組加入並同步看到活動階段（Priority: P1）🎯 MVP

**Goal**: 學生開 `/student` 選組加入，頂端列一直顯示組別與即時階段；重新整理保留身分；只有待開始能離開組別；
身分失效回到選組並說明原因；老師身分的分頁看到提示

**Independent Test**: 老師匯入後，開兩個學生分頁分別加入第 1、2 組；老師開啟、結束搶答時兩個分頁都在 1 秒內顯示
新階段；重新整理後仍是原組別（spec US1 Independent Test、quickstart §4 步驟 1～6、21）

### Tests for User Story 1（先寫，預期失敗）

- [X] T010 [P] [US1] 新增 `apps/web/tests/useStudentAuth.test.tsx`：`join(groupId)` 呼叫 `POST /api/auth/student`，成功後保存 token 與 identity；`NO_ACTIVE_ACTIVITY`、`INVALID_GROUP` 時拋出含伺服器訊息的錯誤且不保存；`leave()` 清除身分與該分頁所有草稿鍵（`crs.draft.` 開頭）；`onInvalidated('NEW_ACTIVITY')`／`('EXPIRED')` 清除身分與草稿並記下對應訊息（research R4 訊息表）；重新建立 hook 時從 `sessionStorage` 讀回身分；以假時鐘測試到達 `identity.expiresAt` 時自動視為 `EXPIRED`，以及讀回的身分已過期時直接視為失效
- [X] T011 [P] [US1] 新增 `apps/web/tests/JoinGroupPanel.test.tsx`：`status === 'NOT_IMPORTED'` 顯示「老師尚未匯入題目，請稍候」且沒有組別按鈕；有組別時依序列出「第 1 組」～「第 N 組」，點擊呼叫 `onJoin(groupId)`；加入處理中按鈕停用；有失效訊息或加入錯誤訊息時顯示在上方
- [X] T012 [P] [US1] 新增 `apps/web/tests/PhaseBanner.test.tsx`：顯示「第 N 組」與階段文字（待開始／搶答進行中／已結束）；只有 `READY` 顯示「離開組別」且點擊呼叫 `onLeave`，`OPEN`、`CLOSED` 不顯示；`connected === false` 時顯示「連線中斷，正在重新連線」
- [X] T013 [P] [US1] 新增 `apps/web/tests/StudentPage.test.tsx`（US1 部分）：未加入時收到 public `NOT_IMPORTED` 顯示等待訊息，接著推送 `READY` 自動出現組別；選組後以新 token 重新連線並顯示頂端列；收到 `session:reset` 回到選組並顯示「老師已開始新的活動，請重新選擇組別」；`connect_error: UNAUTHORIZED` 顯示「這個分頁的組別身分已失效，請重新選擇組別」；有 token 且收到 `viewer: 'teacher'` 顯示老師身分提示、沒有選組與作答功能、不清除 token；尚未收到資料時顯示「連線中…」

### Implementation for User Story 1

- [X] T014 [US1] 新增 `apps/web/src/hooks/useStudentAuth.ts`：`identity`、`token`、`join(groupId)`、`leave()`、`onInvalidated(reason)`、`notice`（失效原因訊息，加入成功後清空）；依 `identity.expiresAt` 設計時器，到期時呼叫 `onInvalidated('EXPIRED')`，讀回時已過期則直接視為失效（research R4；只是畫面提示，伺服器仍以 401 做最終判定）；`leave` 與 `onInvalidated` 呼叫 `clearIdentity()` 與 `AnswerDraftStore.clearAll()`；同時建立 `apps/web/src/student/answerDraftStore.ts`，本 Phase 只實作 `clearAll()`（清除所有 `crs.draft.` 開頭的鍵），其餘方法由 US2 的 T026 補齊
- [X] T015 [P] [US1] 新增 `apps/web/src/pages/student/JoinGroupPanel.tsx`（props：`status`、`groups`、`notice`、`onJoin`），依 contracts/student-ui.md §1「等待匯入」「選擇組別」
- [X] T016 [P] [US1] 新增 `apps/web/src/pages/student/PhaseBanner.tsx`（props：`groupId`、`status`、`connected`、`onLeave`），依 contracts/student-ui.md §2
- [X] T017 [US1] 新增 `apps/web/src/pages/student/StudentPage.tsx`：以 `useStudentAuth` 與 `useSessionState(token, onInvalidated)` 依 data-model §4 切換畫面（載入中／等待匯入或選組／老師身分提示／頂端列＋階段內容）；本 Phase 的階段內容先顯示「等待老師開啟搶答」（READY）、「搶答進行中」（OPEN）、「搶答已結束」（CLOSED）文字，US2、US3 再換成作答與結果元件；在 `apps/web/src/App.tsx` 新增 `/student` 路徑，首頁的學生端占位文字改為連到 `/student` 的按鈕（research R1），並更新檔頭註解
- [X] T018 [US1] FR-028：在 `apps/server/src/transport/http/routes/authRoutes.ts` 以 Fastify 的 `request.log` 於學生加入成功時記錄結構化 log（`groupId`、`activityId`，**不含 token**）；確認加入被拒（`NO_ACTIVE_ACTIVITY`、`INVALID_GROUP`）已由既有錯誤處理記錄，沒有則補上；在 `apps/server/tests/integration/auth.test.ts` 加測試確認 log 內容不含 token
- [X] T019 [US1] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 學生可加入、看到即時階段、重新整理保留、待開始可離開、失效時回到選組（MVP）

---

## Phase 4: User Story 2 — 搶答開始後依組別作答並送出（Priority: P1）

**Goal**: 所有題目一次列出並可從題號清單跳轉；單題與題組輸入、前端檢查、送出、已送出唯讀、同組分頁同步、
各種錯誤處理、草稿保留、斷線與結束時停用

**Independent Test**: 匯入「題組範例」後開啟搶答，第 1 組送出第 1 題兩個子題、第 2 組送出第 3 題；老師端即時看到
兩筆，學生端各自只看到本組內容（spec US2 Independent Test、quickstart §4 步驟 6～16）

### Tests for User Story 2（先寫，預期失敗）

- [X] T020 [P] [US2] 新增 `apps/web/tests/answerDraftStore.test.ts`：`save`／`load` 以 `crs.draft.{activityId}.{groupId}.{questionNumber}` 保存；`load` 在沒有資料或內容壞掉時回傳長度為 `blankCount` 的空字串陣列；不同活動或組別互不影響；`clear` 只清該題；`clearAll` 清除所有 `crs.draft.` 鍵且不動 `crs.token`；`hasUnsent(activityId, groupId)` 在該活動與組別有任一題草稿去除前後空白後不是空白時回 `true`，只有空白或沒有草稿時回 `false`，不受其他組別影響
- [X] T021 [P] [US2] 新增 `apps/web/tests/validateDraft.test.ts`：全部填寫時回傳空陣列；去除前後空白後為空回 `EMPTY`（訊息「尚未填寫」）；超過 200 字回 `TOO_LONG`；剛好 200 字通過；表情符號以 `unicodeLength` 計算（例如 200 個表情符號通過、201 個不通過）；題組只填一個子題時指出缺少的子題序號
- [X] T022 [P] [US2] 新增 `apps/web/tests/QuestionAnswerForm.test.tsx`：單題一個輸入欄、無標記；題組依子題顯示標記（有標記顯示原文、無標記顯示「（n）」）；顯示「m／200」字數；輸入時寫入草稿、重新掛載時讀回；前端檢查不通過時不呼叫 fetch 並在子題下方顯示原因；送出內容為去除前後空白的文字；送出中按鈕顯示「送出中…」且連點只送出一次；成功後顯示「已送出」與唯讀答案、清除草稿、不顯示順位；`SESSION_NOT_OPEN`、`ALREADY_SUBMITTED`、`ANSWER_INVALID`（依 `details.blankIndex` 標示）、`NETWORK_ERROR`、`UNAUTHORIZED`（呼叫 `onInvalidated('EXPIRED')`）各一個案例，訊息依 contracts/http-api.md §3；伺服器回 500 且內容無法解析時只顯示「系統發生錯誤，請稍後再試。」，不顯示任何原始內容（FR-027）；`enabled === false` 時輸入與送出停用；`SESSION_NOT_OPEN` 被拒絕後草稿保留（供結果畫面判斷，FR-018）
- [X] T023 [P] [US2] 新增 `apps/web/tests/AnswerSheet.test.tsx`：一次列出全部題目，每題標示「單題」或「題組（k 子題）」；題號清單每題顯示「未作答」或「已送出」（依 `ownSubmissions`）；點題號會捲到該題（`scrollIntoView` 以 `vi.fn` 替身）並聚焦第一個輸入欄；`ownSubmissions` 新增某題時該題變為已送出並清除該題草稿（同組其他分頁先送出）；`READY` 時輸入停用並顯示「等待老師開啟搶答」；`connected === false` 時送出停用但仍可輸入
- [X] T024 [P] [US2] 在 `apps/server/tests/integration/visibility.test.ts` 新增測試（SC-004、FR-021）：兩組各一個學生 socket 加上一個老師分頁，第 1 組送出後第 2 組的 socket 沒有收到任何事件；各階段學生收到的所有 `session:state` 與 `GET /api/session` 回應只含 `status`、`groups`、`questions`（含 `blankLabels`）、`groupId`、本組 `ownSubmissions`、`results`（結束前為 `null`），不含其他組答案、`sequence`、`receivedAt` 或任何敘述
- [X] T025 [P] [US2] 在 `apps/server/tests/integration/concurrency.test.ts` 新增「同組兩個身分同時送出同一題（重複 100 次）」：每次只接受一筆，另一筆回 `409 ALREADY_SUBMITTED`；推播後兩個身分看到的 `ownSubmissions` 都是被接受的那一筆（SC-005、FR-006）

### Implementation for User Story 2

- [X] T026 [P] [US2] 在 `apps/web/src/student/answerDraftStore.ts` 補齊：`load(activityId, groupId, questionNumber, blankCount)`、`save(...)`、`clear(activityId, groupId, questionNumber)`、`clearAll()`、`hasUnsent(activityId, groupId)`（FR-018）；讀取時以 `z.array(z.string())` 驗證（research R6、data-model §2）
- [X] T027 [P] [US2] 新增 `apps/web/src/student/validateDraft.ts`：`validateDraft(question: QuestionSummary, texts: string[]): DraftIssue[]`，使用 shared 的 `unicodeLength`、`ANSWER_MAX_LENGTH`（research R8、data-model §3）；並在同目錄定義 `DraftIssue`、`SubmitOutcome` 型別與子題名稱函式 `blankLabelOf(question, index)`（有標記用原文、題組無標記用「（n）」、單題回 `null`，research R5）
- [X] T028 [US2] 新增 `apps/web/src/pages/student/QuestionAnswerForm.tsx`（props：`question`、`submitted: OwnSubmission | null`、`enabled`（`status === 'OPEN'`）、`canSubmit`、`identity`、`onInvalidated`），`submit(): Promise<SubmitOutcome>` 依 research R8 的流程與錯誤對應；送出呼叫 `apiRequest('/api/submissions', SubmitResponseSchema, …)`
- [X] T029 [US2] 新增 `apps/web/src/pages/student/AnswerSheet.tsx`（props：`questions`、`ownSubmissions`、`status`、`connected`、`identity`、`onInvalidated`），`jumpTo(number)` 依 research R7；每題一個 `QuestionAnswerForm`，各題區塊加上 `id="question-{n}"`；`ownSubmissions` 包含某題時（例如同組其他分頁先送出）清除該題草稿（FR-020、research R6）
- [X] T030 [US2] 在 `apps/web/src/pages/student/StudentPage.tsx` 的 `READY`、`OPEN` 階段改為顯示 `AnswerSheet`；`CLOSED` 但仍保留 US1 的文字（US3 再換）；在 `apps/web/tests/StudentPage.test.tsx` 加測試：`READY` 輸入停用、推送 `OPEN` 後可作答、推送含本組送出的 `session:state` 後該題變為已送出
- [X] T031 [US2] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 學生可完整作答與送出；同組分頁同步；錯誤訊息正確；他組收不到任何作答資料

---

## Phase 5: User Story 3 — 搶答結束後檢視結果（Priority: P2）

**Goal**: 結束後自動切到結果：每題搶答成功組別與答案或「無人搶答」、本組成績標籤、本組搶答成功題數

**Independent Test**: 兩組各送出幾題後老師結束搶答，兩個學生分頁都在 1 秒內顯示結果，與老師端一致，各自正確標示
本組成績（spec US3 Independent Test、quickstart §4 步驟 16～20）

### Tests for User Story 3（先寫，預期失敗）

- [X] T032 [P] [US3] 新增 `apps/web/tests/groupOutcomes.test.ts`：本組搶答成功 → `WON`；本組有送出但他組搶到 → `SUBMITTED_NOT_WON`（帶本組答案與搶答成功答案）；本組未送出 → `NOT_SUBMITTED`；無人搶答 → `winnerGroupId` 與 `winnerAnswers` 為 `null`；依題號排序；搶答成功題數計算正確（含 0 題）
- [X] T033 [P] [US3] 新增 `apps/web/tests/StudentResultBoard.test.tsx`：上方顯示「本組搶答成功 N 題」；每題顯示搶答成功組別與答案（題組依子題分列並顯示標記）或「無人搶答」；三種成績標籤文字依 contracts/student-ui.md §4；「已送出，未搶到」另外列出本組答案；`showUnsentNotice` 為 true 時最上方顯示「搶答已結束，尚未送出的答案不會被採計」，false 時不顯示（FR-018）；畫面不出現其他組未搶到的答案、順序或時間

### Implementation for User Story 3

- [X] T034 [P] [US3] 新增 `apps/web/src/student/groupOutcomes.ts`：`OutcomeKind`、`GroupOutcome` 型別與 `groupOutcomes(results, ownSubmissions, groupId): GroupOutcome[]`、`wonCount(outcomes)`（research R11、data-model §3）
- [X] T035 [US3] 新增 `apps/web/src/pages/student/StudentResultBoard.tsx`（props：`questions`、`results`、`ownSubmissions`、`groupId`、`showUnsentNotice`），使用 `groupOutcomes` 與 `blankLabelOf`
- [X] T036 [US3] 在 `apps/web/src/pages/student/StudentPage.tsx` 的 `CLOSED` 階段改為顯示 `StudentResultBoard`，`showUnsentNotice` 取自 `AnswerDraftStore.hasUnsent(identity.activityId, identity.groupId)`；在 `apps/web/tests/StudentPage.test.tsx` 加測試：推送 `CLOSED`（含 `results`）後自動顯示結果；`OPEN` 時有一題輸入內容未送出，推送 `CLOSED` 後結果上方顯示「搶答已結束，尚未送出的答案不會被採計」，沒有未送出內容時不顯示（FR-018）；以同一份 `CLOSED` 檢視重新掛載（模擬重新整理）仍顯示相同結果且沒有「離開組別」
- [X] T037 [US3] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 三個 user story 都可獨立運作

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 文件、圖表一致性、人工驗證與最終品質關卡

- [X] T038 [P] 更新 `README.md`：子功能表 003 改為「已實作」並說明學生端網址 `/student`；第 55 行模擬指令說明改為「模擬學生送出（自動化與壓力測試用；學生畫面見 `/student`）」；人工驗證連結加上 003 quickstart §4；更新 `scripts/simulate-students.ts` 檔頭註解中「學生畫面於子功能 003 提供」的說法為「學生畫面已於子功能 003 提供，本腳本保留作為測試輔助」
- [X] T039 圖表一致性驗證（原則 VI）：依 `plan.md`「圖表對應」逐一核對 `diagrams/003-student-quiz-participation-{component,class,sequence}.puml` 的元件、類別、欄位、方法與互動順序是否都存在於原始碼且名稱一致；結果寫入 `specs/003-student-quiz-participation/diagram-verification.md`（每列：圖表元素、原始碼位置、是否一致、說明）；若實作偏離圖表，先更新 `.puml` 並執行 `plantuml "./diagrams/*.puml"` 重新產生 PNG
- [ ] T040 建立 `specs/003-student-quiz-participation/checklists/manual-verification.md`：依 `quickstart.md` §4 的 23 個步驟寫成可勾選的步驟清單（每步「操作 → 預期結果」，通過即勾選，不需截圖、日期或執行者），附「已完成功能與驗證對應」表；由組員以真實 Google Sheets 副本（單題範例、題組範例）親自執行並勾選
- [ ] T041 最終品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build` 全部通過；`npm run build` 後，以 3000 以外的埠和暫存資料夾作為 `DATA_DIR` 啟動伺服器，用瀏覽器開 `/student` 確認可以載入，結束後停止伺服器；回報指令與結果

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：無前置
- **Phase 2 Foundational**：依賴 Phase 1；**阻擋所有 user story**
- **Phase 3 US1**：依賴 Phase 2
- **Phase 4 US2**：依賴 Phase 2 與 US1 的 `StudentPage`、`useStudentAuth`（作答需要學生身分）
- **Phase 5 US3**：依賴 Phase 2 與 US1 的 `StudentPage`；與 US2 只共用 `StudentPage.tsx` 與 `validateDraft.ts` 的
  `blankLabelOf`，建議在 US2 之後進行
- **Phase 6 Polish**：依賴所有 user story

### User Story Dependencies

```text
Setup → Foundational → US1 選組與階段同步 → US2 作答與送出 → US3 檢視結果 → Polish
```

每個 story 完成時都能展示並有自己的測試：US1 示範加入與階段同步；US2 示範作答送出；US3 示範結果。

### Within Each User Story

- 測試任務先寫（預期失敗），再實作讓測試通過
- 共用契約 → 不依賴畫面的規則模組 → 元件 → 頁面整合
- 每個 Phase 最後一個任務是品質關卡，未通過不得進入下一個 Phase（原則 VII）

### Parallel Opportunities

- Phase 2：T006、T008 可與 T002～T005 平行
- US1：T010～T013 可平行；T015、T016 可平行
- US2：T020～T025 可平行；T026、T027 可平行
- US3：T032、T033 可平行；T034 可先行
- Polish：T038 可與 T039 平行

---

## Parallel Example: User Story 2

```bash
# 先平行建立測試：
Task: "T020 answerDraftStore.test.ts"
Task: "T021 validateDraft.test.ts"
Task: "T022 QuestionAnswerForm.test.tsx"
Task: "T023 AnswerSheet.test.tsx"
Task: "T024 visibility.test.ts 學生資料範圍"
Task: "T025 concurrency.test.ts 同組同時送出"

# 再平行實作規則模組：
Task: "T026 answerDraftStore.ts"
Task: "T027 validateDraft.ts"
```

---

## Implementation Strategy

### MVP First（User Story 1）

1. 完成 Phase 1 Setup 與 Phase 2 Foundational
2. 完成 Phase 3 US1：學生可加入並看到即時階段
3. **停下來驗證**：品質關卡通過，開兩個學生分頁與老師分頁實際操作一次
4. 可先展示「學生加入與階段同步」

### Incremental Delivery

1. Setup + Foundational → 子題標記、學生身分保存（老師端行為不變）
2. ＋US1 → 加入與階段同步（MVP）
3. ＋US2 → 作答與送出
4. ＋US3 → 結果與本組成績
5. Polish → README、圖表一致性驗證、人工驗證、最終品質關卡

---

## Notes

- [P] 任務 = 不同檔案、沒有未完成的相依
- [Story] 標籤對應 spec.md 的 user story，方便追蹤
- 每個 Phase 品質關卡通過後 commit
- 實作若需偏離 plan、contracts 或圖表：需求改變 → 先改 spec 與圖表；只是程式寫錯 → 直接修程式（constitution 開發流程）
- 避免：模糊任務、多個任務同時修改同一檔案、破壞 story 獨立性的跨 story 相依
