---

description: "子功能 004：學生端細修（暱稱、組別人數與題目敘述）— 實作任務清單"
---

# Tasks: 學生端細修：暱稱、組別人數與題目敘述

**Input**: `specs/004-student-side-refinements/` 中的 spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（皆已完成）；
`diagrams/004-student-side-refinements-*.puml/.png` 為設計藍圖

**Tests**: constitution 原則 VII 要求每個功能都有自動化測試（正常＋邊界／錯誤案例），可見性與並發要有專門測試，
Guided Notes 匯出要用兩份版面不同的測試文件驗證，因此本清單包含測試任務。每個 Phase 結束時都有「品質關卡」：
型別檢查、lint、format、測試必須全部通過，並回報執行的指令與結果，才能進入下一個 Phase。

**Organization**: 依 user story 分組：US1（暱稱，P1）、US2（各組人數與本組成員，P1）、US3（題目敘述，P2）、
US4（送出者，P2）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、不依賴未完成的任務）
- **[Story]**: 所屬 user story（US1～US4，對應 spec.md）
- 每個任務都寫明檔案路徑；路徑依 plan.md 的結構（`apps/web`、`apps/server`、`packages/shared`、`scripts`）

## 共同約定（所有任務都適用）

- 沿用 001～003 的約定：TypeScript `strict`、**不得使用 `any`**；共用型別與規則一律從 `@crs/shared` 匯入；
  測試不連線 Google 或真實伺服器（伺服器整合測試以 `apps/server/tests/helpers/testApp.ts` 啟動的本機測試伺服器為準）。
- 唯一新增的相依套件是 `apps/web` 的 `@faker-js/faker`（T002）；不得新增其他套件。
- 001～003 既有測試必須持續通過；契約或函式簽章改變時，同步更新既有測試、`viewBuilders`、`testApp` 輔助函式與呼叫端。
  其中 `apps/server/tests/integration/visibility.test.ts` 的「學生收不到題目敘述」改為 004 的規則（READY 以前收不到、
  OPEN／CLOSED 才有），屬於刻意變更（FR-019）。
- 畫面文字依 [contracts/student-ui.md](./contracts/student-ui.md)；錯誤代碼與狀態碼依 [contracts/http-api.md](./contracts/http-api.md)；
  所有訊息使用繁體中文且不含內部細節（FR-021）。
- log 不得記錄暱稱與 token（FR-022）。
- 前端測試沿用 `apps/web/tests/fakeSocket.ts`、`mockFetch`；每個測試前清空 `sessionStorage`。
- 實作若需偏離 plan、contracts 或 `diagrams/004-*`：先更新圖表並執行 `plantuml "./diagrams/*.puml"`，再改程式（原則 VI）。

---

## Phase 1: Setup

**Purpose**: 確認基準並加入相依套件

- [X] T001 在 `004-student-side-refinements` branch 執行 `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`，確認 001～003 的基準全部通過並回報結果
- [X] T002 以 `npm install @faker-js/faker -w @crs/web` 加入相依套件（寫入 `apps/web/package.json` 與根目錄 `package-lock.json`）；確認 `npm ci` 與 `npm run build` 仍成功，並回報 web 打包大小的變化（research R1；constitution 禁止已停止維護的套件，不得改用 `unique-names-generator`）

**Checkpoint**: 基準綠燈、相依套件可用

---

## Phase 2: Foundational（多個 user story 共用的契約、身分與測試輔助）

**Purpose**: 暱稱規則、學生身分（memberId、暱稱）、所有新增的共用欄位、測試輔助函式

**⚠️ CRITICAL**: 本 Phase 完成前不得開始任何 user story

- [X] T003 [P] 新增 `packages/shared/src/nickname.ts`：`NICKNAME_MAX_LENGTH = 20`；`NicknameSchema` 為「去除前後空白後 1～20 字，以 `unicodeLength` 計算；不得包含控制字元（換行、tab 等）；允許中英文、表情符號；允許重複」（data-model §1），輸出為去除前後空白後的字串，錯誤訊息「暱稱需為 1～20 字，且不能只有空白。」；在 `packages/shared/src/index.ts` 匯出
- [X] T004 修改 `packages/shared/src/api.ts`：`StudentJoinRequestSchema` 改為 strict 的 `{ groupId: z.number().int(), nickname: NicknameSchema }`；`IdentitySummarySchema` 學生分支加 `memberId: z.uuid()`、`nickname: z.string()`（data-model §2）
- [X] T005 修改 `packages/shared/src/views.ts` 與 `domain.ts`（data-model §4、§5）：新增 `GroupHeadcountSchema`（`{ groupId, memberCount: 非負整數 }`）、`GroupMemberSchema`（`{ memberId: uuid, nickname: string }`）、`QuestionTextsSchema`（`{ prompt: string | null, blankPrompts: (string | null)[] }`，`blankPrompts` 長度需等於題目的 `blankCount`）、`StudentQuestionViewSchema`（`QuestionSummary` 加 `content: QuestionTexts | null`）；`PublicViewSchema` 加 `headcounts`；`StudentViewSchema` 加 `headcounts`、`members`，`questions` 改為 `StudentQuestionView[]`；`OwnSubmissionSchema`、`ResultViewSchema` 加 `submitterNickname: z.string().nullable()`；`SubmissionSchema` 加 `submitterNickname: z.string().nullable().default(null)`（讀取舊的 `data/session.json` 缺少此欄位時為 `null`）；`errors.ts` 的 `ErrorCodeSchema` 加 `LEAVE_NOT_ALLOWED`
- [X] T006 更新 `packages/shared/tests/schemas.test.ts`：暱稱正規化（前後空白、21 字失敗、只有空白失敗、含換行失敗、表情符號以實際字元計算）；加入請求缺 `nickname` 或多餘欄位失敗；`blankPrompts` 長度不符失敗；`content` 可為 `null`；`Submission` 缺 `submitterNickname` 解析為 `null`；舊格式的 `PersistedState` 仍可解析
- [X] T007 修改 `apps/server/src/auth/tokens.ts` 與 `authService.ts`：學生 token 加 `memberId`、`nickname`；`joinAsStudent(groupId, nickname, session)` 以 `uuid()` 產生 memberId、回應的 `identity` 含 `memberId`、`nickname`；`AuthService` 建構時接受 `isMemberLeft: (memberId: string) => boolean`（預設永遠 `false`），`resolve()` 對已離開的 memberId 回傳 `null`（research R3、R4）；更新 `apps/server/tests/unit/{tokens,authService}.test.ts`（新欄位、缺新欄位的舊 token 驗證失敗、已離開回 `null`）
- [X] T008 修改 `apps/server/src/transport/http/routes/authRoutes.ts`：加入時傳入 `body.nickname`；`student.joined` log 加 `memberId`、不含暱稱；更新 `apps/server/tests/helpers/testApp.ts`：`joinStudent(app, groupId, nickname = '測試')`、`forgeStudentToken(groupId, activityId, { memberId, nickname })`；更新 `apps/server/tests/integration/auth.test.ts`（暱稱不合格回 400 `VALIDATION_FAILED`、成功回應含 memberId 與正規化後的暱稱）
- [X] T009 [P] 修改 `scripts/simulate-students.ts`：加入組別時帶入暱稱 `Sim-<組別>`（research R12），`npm run typecheck` 通過
- [X] T010 [P] 修改 `apps/web/src/api/identity.ts` 的學生身分型別與驗證（含 `memberId`、`nickname`，沿用 `IdentitySummarySchema`）；更新 `apps/web/tests/identity.test.ts`；更新 `apps/web/tests/viewBuilders.ts`：`publicView()`、`studentView()` 補 `headcounts`（預設每組 0）、`members`（預設空）、題目 `content: null`；`ownSubmissions`、`results` 補 `submitterNickname`；新增 `withContent()` 輔助，把 `teacherView()` 的題目敘述轉成 `content`
- [X] T011 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過（伺服器回傳的新欄位此時可先填空值：`headcounts` 每組 0、`members` 空、`content` null、`submitterNickname` null），回報指令與結果

**Checkpoint**: 契約、身分與測試輔助就緒；自動化測試全部通過。注意：本 Phase 起加入組別的請求必須帶暱稱，前端要到 US1（T019）才會送出暱稱，因此實際啟動時學生端無法加入組別，US1 完成後恢復；Phase 1～3 為 MVP，應一起完成後再實際操作

---

## Phase 3: User Story 1 — 學生進入學生端時取得並自訂暱稱（Priority: P1）🎯 MVP

**Goal**: 進入學生端先設定暱稱（預填隨機短英文名字，可換一個或自訂），確認後才選組；暱稱保存在分頁

**Independent Test**: 打開學生端，輸入欄已有英文短名字；按「換一個」數次名字改變；改成自訂名字確認後進入選組；重新整理暱稱保留

### Tests for User Story 1（先寫，預期失敗）

- [ ] T012 [P] [US1] 新增 `apps/web/tests/randomNickname.test.ts`：連續產生 200 次都符合 `/^[A-Za-z]{3,10}$/`；20 次至少 15 個不同（SC-002）；`randomNickname(exclude)` 不回傳 `exclude`
- [ ] T013 [P] [US1] 新增 `apps/web/tests/nicknameStore.test.ts`：存取 `sessionStorage['crs.nickname']`；內容不合格（空白、超過 20 字）時 `load()` 回 `null`；`clearIdentity()` 不會清除暱稱（FR-006）
- [ ] T014 [P] [US1] 新增 `apps/web/tests/NicknamePanel.test.tsx`：預填隨機名字；「換一個」換成不同名字；字數顯示「N / 20」；清空或輸入 21 字按確認顯示「暱稱需為 1～20 字，且不能只有空白。」且不呼叫 `onConfirm`；按 Enter 等同確認；以 `initial` 進入時顯示目前暱稱並有「取消」
- [ ] T015 [US1] 更新 `apps/web/tests/StudentPage.test.tsx` 與 `apps/web/tests/useStudentAuth.test.tsx`：沒有暱稱時先顯示暱稱頁（直接開 `/student` 也一樣，FR-001）；確認後顯示選組畫面與「暱稱：…」；重新整理保留暱稱；選組時加入請求帶 `nickname`；尚未加入時「修改暱稱」回到暱稱頁、已加入時沒有「修改暱稱」（FR-007）；身分失效、離開組別後暱稱保留；老師身分分頁不顯示暱稱頁（003 FR-008）；既有 003 測試在設好暱稱的前提下照常通過

### Implementation for User Story 1

- [ ] T016 [P] [US1] 新增 `apps/web/src/student/randomNickname.ts`：只從 `@faker-js/faker/locale/en` 匯入 `faker`（不得匯入整包多語系的 `@faker-js/faker`），`randomNickname(exclude?: string): string` 以 `faker.person.firstName()` 重複產生，直到符合 `/^[A-Za-z]{3,10}$/` 且不等於 `exclude`；不合格的名字直接丟棄重新產生，只有「合格但等於 `exclude`」才計入嘗試次數，達到上限時回傳該合格名字（research R1）
- [ ] T017 [P] [US1] 新增 `apps/web/src/student/nicknameStore.ts`：`load(): string | null`（以 `NicknameSchema` 驗證）、`save(nickname)`；只保存已確認的暱稱（research R2）
- [ ] T018 [US1] 新增 `apps/web/src/pages/student/NicknamePanel.tsx`（props：`initial: string | null`、`onConfirm(nickname)`、`onCancel?()`），文字與版面依 contracts/student-ui.md §1；驗證共用 `NicknameSchema`
- [ ] T019 [US1] 修改 `apps/web/src/hooks/useStudentAuth.ts`：`join(groupId, nickname)` 送出 `{ groupId, nickname }` 並保存回應的 identity（含 memberId、nickname）；修改 `apps/web/src/pages/student/StudentPage.tsx`：非老師分頁且 `nicknameStore.load()` 為 `null` 時顯示 `NicknamePanel`，確認後 `save` 並進入選組；選組畫面可「修改暱稱」（只在未加入時）；修改 `apps/web/src/pages/student/JoinGroupPanel.tsx` 顯示「暱稱：…」與「修改暱稱」按鈕（新增 props `nickname`、`onEditNickname`）；修改 `apps/web/src/pages/student/PhaseBanner.tsx` 顯示「第 N 組・暱稱」
- [ ] T020 [US1] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；以 3000 以外的埠和暫存 `DATA_DIR` 啟動伺服器，瀏覽器實際操作暱稱頁一次

**Checkpoint**: 暱稱頁可用；選組加入帶暱稱；003 流程不受影響

---

## Phase 4: User Story 2 — 選組時看到各組人數，作答時看到本組成員（Priority: P1）

**Goal**: 伺服器依連線維護組員名冊（30 秒緩衝），推播各組人數與本組成員；離開組別立即更新

**Independent Test**: 三組、三個學生分頁 A、B（第 1 組）、C（第 2 組）；選組中的分頁看到 2／1／0 人；A 看到本組 A、B 共 2 人；B 離開後 A 在 1 秒內只剩自己

### Tests for User Story 2（先寫，預期失敗）

- [ ] T021 [P] [US2] 新增 `apps/server/tests/unit/groupRoster.test.ts`（以注入的假計時器）：第一次 `connected` 加入名冊；同一 memberId 兩個連線只算一位；連線數歸零後 29 秒仍在、30 秒移除；30 秒內重連取消移除且 `joinedSeq` 不變；`leave` 立即移除並 `hasLeft` 為真、之後 `connected` 不會再加入；`clear` 清空名冊、已離開集合與計時器；`headcounts(groups)` 對沒有人的組回 0；`membersOf` 依加入先後排序、重複暱稱都列出；名冊改變時 `onChange` 被呼叫（加入、移除、離開、清空各一次，重複連線不呼叫）
- [ ] T022 [P] [US2] 新增 `apps/server/tests/integration/roster.test.ts`（真實 Socket.IO 用戶端，`connectSocket`）：學生連線後公開分頁與同組分頁收到新的 `headcounts`／`members`（1 秒內，SC-003）；同 token 連續斷線後立即重連 20 次，每次重連後人數都不變（SC-004）；斷線 30 秒後移除（以可注入的較短緩衝時間或假計時器，不實際等待 30 秒）；`POST /api/auth/student/leave` 在 READY 回 204 且人數立即減 1、在 OPEN／CLOSED 回 409 `LEAVE_NOT_ALLOWED`、老師 token 回 403、無 token 回 401；離開後同一 token 連線收到 `UNAUTHORIZED`、送出回 401；重新匯入後名冊清空；學生收到的資料不含其他組的 `members`（FR-014、SC-006）；加入、離開、斷線逾時移除時寫出的 log 都不含暱稱與 token（以 `testApp` 收集的 `logLines` 檢查，FR-022）
- [ ] T023 [P] [US2] 更新 `apps/server/tests/integration/restart.test.ts`：伺服器重新啟動後，學生以原 token 重新連線即回到名冊，暱稱與組別相同（FR-013）
- [ ] T024 [P] [US2] 新增 `apps/web/tests/GroupMemberList.test.tsx`：標題「本組成員（K 人）」、依順序列出暱稱、自己加「（你）」、重複暱稱都列出；更新 `apps/web/tests/JoinGroupPanel.test.tsx`：每組顯示「已加入：K 人」（含 0）
- [ ] T025 [US2] 更新 `apps/web/tests/StudentPage.test.tsx` 與 `useStudentAuth.test.tsx`：推播的人數與成員更新時畫面同步；作答與結果畫面都有成員名單；「離開組別」先呼叫 `POST /api/auth/student/leave`，204 後才清除身分並回到選組；409 或網路錯誤時留在組內並顯示錯誤（contracts/student-ui.md §3）

### Implementation for User Story 2

- [ ] T026 [US2] 新增 `apps/server/src/domain/roster/groupRoster.ts`：`GroupRoster`（`connected(memberId, groupId, nickname)`、`disconnected(memberId)`、`leave(memberId)`、`hasLeft(memberId)`、`headcounts(groups)`、`membersOf(groupId)`、`clear()`、`onChange(listener)`），內部 `RosterEntry` 欄位依 data-model §3；緩衝時間（預設 30 秒）與計時器函式由建構參數注入；加註解說明名冊只在記憶體、伺服器重啟後由重連重建（research R4）
- [ ] T027 [US2] 修改 `apps/server/src/domain/visibility/visibilityPolicy.ts` 與 `apps/server/src/transport/views.ts`：`toPublicView(session, roster)` 加 `headcounts`；`toStudentView(session, identity, strategy, roster)` 加 `headcounts` 與 `members`（只有 `identity.groupId`）；老師檢視不加；更新 `apps/server/tests/unit/visibilityPolicy.test.ts`
- [ ] T028 [US2] 修改 `apps/server/src/transport/realtime/realtimeGateway.ts`：學生 socket 在送出第一份 `session:state` 之前呼叫 `roster.connected`，`disconnect` 時呼叫 `roster.disconnected`；`roster.onChange` 時以目前 `version` 推播 PublicView 到 public room、StudentView 到每個 group room（不推給老師，contracts/realtime-events.md）；`reset` 變更時 `roster.clear()`；`state`／`submission` 推播的檢視也帶入名冊；斷線逾時移除時記 `student.roster.removed`（`groupId`、`memberId`）
- [ ] T029 [US2] 修改 `apps/server/src/transport/http/routes/authRoutes.ts` 新增 `POST /api/auth/student/leave`（`requireStudent`；請求為 `EmptyRequestSchema`；活動不是 READY 回 409 `LEAVE_NOT_ALLOWED`「搶答已開始，無法離開組別。」；成功 `roster.leave(memberId)` 回 204，log `student.left`）；修改 `apps/server/src/app.ts` 建立 `GroupRoster` 並注入 `AuthService`（`isMemberLeft = roster.hasLeft`）、路由、`RealtimeGateway`；`testApp.ts` 允許注入較短的緩衝時間
- [ ] T030 [P] [US2] 新增 `apps/web/src/pages/student/GroupMemberList.tsx`（props：`members`、`selfMemberId`），文字依 contracts/student-ui.md §3
- [ ] T031 [US2] 修改 `apps/web/src/pages/student/JoinGroupPanel.tsx` 顯示各組「已加入：K 人」（props 加 `headcounts`）；修改 `apps/web/src/hooks/useStudentAuth.ts`：`leave()` 改為 async，先呼叫離開 API，成功後才清除身分與草稿（暱稱保留），失敗時拋出讓畫面顯示訊息；修改 `apps/web/src/pages/student/StudentPage.tsx` 與 `PhaseBanner.tsx`：作答與結果畫面在頂端列下方顯示 `GroupMemberList`，離開失敗顯示「離開組別失敗，請確認連線後再試一次。」或伺服器訊息
- [ ] T032 [US2] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；以 3000 以外的埠和暫存 `DATA_DIR` 啟動，開兩個學生分頁確認人數與名冊即時更新

**Checkpoint**: 各組人數與本組成員即時同步；重新整理不跳動；離開立即更新

---

## Phase 5: User Story 3 — 學生端顯示每一題的題目敘述（Priority: P2）

**Goal**: OPEN／CLOSED 時學生端每題顯示題目敘述（題組含子題敘述），版面與老師端預覽相同；READY 以前完全不傳

**Independent Test**: 匯入「題組範例」並開啟搶答，學生端每題敘述與老師端預覽一致；「待開始」時學生端只有題號，收到的資料也不含敘述

### Tests for User Story 3（先寫，預期失敗）

- [ ] T033 [P] [US3] 更新 `apps/server/tests/unit/visibilityPolicy.test.ts`：學生檢視在 NOT_IMPORTED／READY 時每題 `content === null`，`JSON.stringify` 不含任何敘述文字；OPEN、CLOSED 時 `content.prompt`、`content.blankPrompts` 與匯入的題目相同（含 `null` 的敘述）；PublicView 任何階段都不含敘述
- [ ] T034 [P] [US3] 更新 `apps/server/tests/integration/visibility.test.ts`：把「學生收不到題目敘述」改為「READY 以前學生與未登入分頁收到的所有推播與回應都不含敘述；OPEN 後學生（已加入）收到敘述、未登入分頁仍收不到」（FR-018、FR-019、SC-006）
- [ ] T035 [P] [US3] 新增 `apps/web/tests/QuestionContent.test.tsx`：單題顯示「第 N 題」「單題」與敘述（保留換行）；題組顯示「題組（K 子題）」、題組說明、子題標記（沒有標記時「（序號）」）與子題敘述；敘述為 `null` 時顯示「文件未提供題目敘述」；`renderBlank(index)` 的內容出現在對應子題下方；更新 `apps/web/tests/QuestionList.test.tsx`（老師端預覽改用共用元件後畫面不變）
- [ ] T036 [US3] 更新 `apps/web/tests/QuestionAnswerForm.test.tsx`、`AnswerSheet.test.tsx`、`StudentResultBoard.test.tsx`：`content` 有值時顯示敘述且每個子題輸入欄在該子題敘述下方；`content` 為 `null`（READY）時與 003 相同；已送出時敘述仍顯示；結果畫面每題顯示敘述（SC-007）

### Implementation for User Story 3

- [ ] T037 [US3] 修改 `apps/server/src/domain/visibility/visibilityPolicy.ts`：`toStudentView` 只在 `status` 為 `OPEN`、`CLOSED` 時為每題填入 `content: { prompt, blankPrompts }`（依子題序號），其他階段 `null`；`toPublicView` 的題目維持 `QuestionSummary`（不含 `content`）；更新檔案開頭的註解（取代 003 的「學生不含敘述」說明，research R7）
- [ ] T038 [US3] 新增 `apps/web/src/components/QuestionContent.tsx`（props：`number`、`kind`、`blankCount`、`prompt`、`blanks: { label, prompt }[]`、選用 `renderBlank(index)`），版面取自現有 `QuestionPreview`；修改 `apps/web/src/components/QuestionPreview.tsx` 改用 `QuestionContent`，老師端畫面不變（research R8）
- [ ] T039 [US3] 修改 `apps/web/src/pages/student/QuestionAnswerForm.tsx`、`AnswerSheet.tsx`、`StudentResultBoard.tsx`：`question.content` 有值時以 `QuestionContent` 呈現，並以 `renderBlank` 在每個子題下方放輸入欄（作答）或答案（結果）；`content` 為 `null` 時維持 003 的版面（contracts/student-ui.md §4、§5）
- [ ] T040 [US3] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 搶答開始後學生看得到題目敘述；開始前伺服器不傳敘述

---

## Phase 6: User Story 4 — 顯示每一題由誰送出（Priority: P2）

**Goal**: 送出記錄送出者暱稱；同組隨時可見、老師隨時可見、他組只在結束後看得到搶答成功答案的送出者；匯出寫入送出者

**Independent Test**: 第 1 組 Milo、Ava 與第 2 組 Leo；OPEN 時 Ava 看到「已送出（Milo）」，Leo 看不到 Milo；老師送出列表有兩位送出者；結束後所有學生看到第 1 題搶答成功答案的送出者；兩種模式匯出都寫入送出者

### Tests for User Story 4（先寫，預期失敗）

- [ ] T041 [P] [US4] 更新 `apps/server/tests/integration/submissions.test.ts`：送出後 `Submission.submitterNickname` 為 token 的暱稱；請求附帶名字欄位回 400（strict）；被拒絕的送出不產生紀錄；重新啟動後送出者仍保留（FR-023）；送出時寫出的 log 不含暱稱（FR-022）
- [ ] T042 [P] [US4] 更新 `apps/server/tests/integration/visibility.test.ts`：OPEN 時同組 StudentView 的 `ownSubmissions[].submitterNickname` 有值；他組收到的所有資料不含該暱稱；CLOSED 後所有學生的 `results[].submitterNickname` 為搶答成功答案的送出者；老師檢視任何階段都含所有送出者；舊資料（`submitterNickname` 為 null）顯示為 null（FR-024～FR-026、SC-008）
- [ ] T043 [P] [US4] 更新 `apps/server/tests/unit/exportPlan.test.ts` 與 `apps/server/tests/unit/guidedNotesParser.test.ts`，用兩份版面不同的測試文件（`apps/server/tests/fixtures/guided-notes/` 既有的兩份）：附註行為「〔第 N 組｜暱稱｜時間〕」、送出者為 null 時與 002 相同；組別時間欄模式辨識與新增「搶答送出者」表頭（已有兩欄只缺送出者時只新增一欄）、無人搶答或 null 寫入空字串；重複匯出寫入內容相同；未搶到的送出者不出現在任何寫入（contracts/guided-notes-export.md §4、FR-027）；同步更新 `apps/server/tests/integration/export.test.ts`
- [ ] T044 [P] [US4] 更新 `apps/web/tests/QuestionAnswerForm.test.tsx`、`StudentResultBoard.test.tsx`、`SubmissionBoard.test.tsx`：已送出顯示「已送出（暱稱）」、null 時「已送出」；結果的搶答成功答案顯示「第 N 組・暱稱」、本組未搶到顯示「本組（暱稱）」；老師送出列表顯示「第 N 組・暱稱」

### Implementation for User Story 4

- [ ] T045 [US4] 修改 `apps/server/src/domain/submission/submissionService.ts`：`submit(identity, request)` 接收學生身分（`groupId`、`memberId`、`nickname`），建立的 `Submission` 加 `submitterNickname: identity.nickname`；log 不含暱稱；修改 `apps/server/src/transport/http/routes/submissionRoutes.ts` 傳入 `requireStudent` 取得的身分（research R9）
- [ ] T046 [US4] 修改 `apps/server/src/domain/visibility/visibilityPolicy.ts`：`ownSubmissions` 與 `toResultView`（含老師的 `toTeacherResult`）帶 `submitterNickname`；學生的 `results` 仍只在 CLOSED 有值
- [ ] T047 [US4] 修改 `apps/server/src/domain/guidedNotes/parser.ts` 與 `apps/server/src/domain/export/exportPlan.ts`：表頭辨識加「搶答送出者」（`resultColumns.submitterColumn`）；`attribution()` 有送出者時為 `〔第 N 組｜暱稱｜時間〕`；`resultColumnWrites` 依序確保三欄並寫入送出者（無人搶答或 null 為空字串）；更新相關註解（contracts/guided-notes-export.md）
- [ ] T048 [US4] 修改 `apps/web/src/pages/student/QuestionAnswerForm.tsx`、`StudentResultBoard.tsx` 與 `apps/web/src/pages/teacher/SubmissionBoard.tsx` 顯示送出者（contracts/student-ui.md §4～§6）
- [ ] T049 [US4] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 送出者依角色與階段正確顯示；匯出寫入送出者

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T050 [P] 更新 `README.md`：子功能表加入 004；學生端說明加入暱稱頁、各組人數與成員、題目敘述、送出者；匯出說明加入送出者
- [ ] T051 [P] 新增 `specs/004-student-side-refinements/diagram-verification.md`：依 plan.md「圖表對應」逐項核對三張 004 圖表的元件、類別、欄位、方法與互動順序是否都存在於原始碼且名稱一致；有差異時先更新圖表並執行 `plantuml "./diagrams/*.puml"`（原則 VI）
- [ ] T052 新增 `specs/004-student-side-refinements/checklists/manual-verification.md`：把 quickstart.md §4 的 26 步轉成可勾選的步驟清單（只要步驟與勾選框，不需截圖、日期或執行者），開頭附上用新的暫存 `DATA_DIR` 啟動的準備方式
- [ ] T053 最終品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build` 全部通過；以 3000 以外的埠和暫存 `DATA_DIR` 啟動，依 quickstart.md §4 走一次主要流程（暱稱 → 加入 → 人數 → 開啟搶答看到敘述 → 送出看到送出者 → 結束 → 匯出前的結果畫面），回報結果
- [ ] T054 人工驗證：使用者依 `checklists/manual-verification.md` 逐步操作並勾選；全部通過後勾選本任務

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：沒有相依
- **Phase 2 Foundational**：依賴 Setup；阻擋所有 user story
- **Phase 3 US1**：依賴 Phase 2
- **Phase 4 US2**：依賴 Phase 2；畫面整合（T031）建議在 US1 之後，因為共用 `StudentPage.tsx`、`JoinGroupPanel.tsx`、`useStudentAuth.ts`
- **Phase 5 US3**：依賴 Phase 2；伺服器部分可與 US1／US2 平行，畫面部分與 US4 共用 `QuestionAnswerForm.tsx`、`StudentResultBoard.tsx`，需在 US4 之前完成
- **Phase 6 US4**：依賴 Phase 2；與 US3 共用 `visibilityPolicy.ts` 與學生作答／結果元件，排在 US3 之後
- **Phase 7 Polish**：依賴所有 user story

### User Story Dependencies

```text
Setup → Foundational → US1 暱稱 → US2 人數與成員 → US3 題目敘述 → US4 送出者 → Polish
```

每個 story 完成時都能展示並有自己的測試：US1 暱稱頁；US2 人數與成員名單；US3 題目敘述；US4 送出者與匯出。

### Within Each User Story

- 測試任務先寫（預期失敗），再實作讓測試通過
- 共用契約 → 伺服器領域模組 → 傳輸層 → 前端規則模組 → 元件 → 頁面整合
- 每個 Phase 最後一個任務是品質關卡，未通過不得進入下一個 Phase（原則 VII）

### Parallel Opportunities

- Phase 2：T003 可先行；T009、T010 可與 T007、T008 平行
- US1：T012～T014 可平行；T016、T017 可平行
- US2：T021～T024 可平行；T030 可與 T026～T029 平行
- US3：T033～T035 可平行
- US4：T041～T044 可平行
- Polish：T050、T051 可平行

---

## Parallel Example: User Story 2

```bash
# 先平行建立測試：
Task: "T021 groupRoster.test.ts"
Task: "T022 roster.test.ts（整合）"
Task: "T023 restart.test.ts 名冊重建"
Task: "T024 GroupMemberList / JoinGroupPanel 測試"

# 伺服器實作與前端元件可平行：
Task: "T026 groupRoster.ts"
Task: "T030 GroupMemberList.tsx"
```

---

## Implementation Strategy

### MVP First（User Story 1）

1. 完成 Phase 1 Setup 與 Phase 2 Foundational
2. 完成 Phase 3 US1：學生進入學生端先設定暱稱
3. **停下來驗證**：品質關卡通過，實際操作暱稱頁與選組一次

### Incremental Delivery

1. Setup + Foundational → 契約與身分（畫面行為不變）
2. ＋US1 → 暱稱頁（MVP）
3. ＋US2 → 各組人數與本組成員
4. ＋US3 → 題目敘述
5. ＋US4 → 送出者與匯出
6. Polish → README、圖表一致性驗證、人工驗證清單、最終品質關卡

---

## Notes

- [P] 任務 = 不同檔案、沒有未完成的相依
- [Story] 標籤對應 spec.md 的 user story，方便追蹤
- 每個 Phase 品質關卡通過後 commit
- 實作若需偏離 plan、contracts 或圖表：需求改變 → 先改 spec 與圖表；只是程式寫錯 → 直接修程式（constitution 開發流程）
- 避免：模糊任務、多個任務同時修改同一檔案、破壞 story 獨立性的跨 story 相依
