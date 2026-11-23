---

description: "子功能 001：使用者角色與老師端搶答活動管理 — 實作任務清單"
---

# Tasks: 使用者角色與老師端搶答活動管理

**Input**: `specs/001-teacher-quiz-session/` 中的 spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（皆已完成）

**Tests**: constitution 原則 VII 要求每個功能都有自動化測試（正常＋邊界／錯誤案例），並發、權限與可見性
要有專門測試，因此本清單包含測試任務。每個 Phase 結束時都有「品質關卡」任務：型別檢查、lint、測試必須
全部通過，並回報執行的指令與結果，才能進入下一個 Phase。

**Organization**: 依 user story 分組；US1、US2 為 P1，US3、US4 為 P2。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、不依賴未完成的任務）
- **[Story]**: 所屬 user story（US1～US4）
- 每個任務都寫明檔案路徑；路徑依 plan.md 的 monorepo 結構（`apps/web`、`apps/server`、`packages/shared`）

## 共同約定（所有任務都適用）

- 所有程式以 TypeScript（`strict`）撰寫，**不得使用 `any`**（原則 V）；識別字與檔名使用英文，註解與使用者
  看到的訊息使用繁體中文。
- 前後端共用的型別一律從 `@crs/shared` 匯入，不得在 `apps/*` 重複定義（原則 V）。
- `apps/server/src/domain/` 不得 import `fastify`、`socket.io`、`@googleapis/*`、`google-auth-library`、`node:fs`
  （原則 IV）。
- 錯誤一律以 `DomainError(code, userMessage, details?)` 拋出，`code` 來自 `@crs/shared` 的 `ErrorCode`。
- 重要的領域規則要加註解說明業務意義（技術限制章節）。
- 自動化測試不得連線 Google 或讀取真實金鑰，Guided Notes 一律使用 `FakeGuidedNotesGateway` 與 fixtures。

---

## Phase 1: Setup（專案初始化）

**Purpose**: 建立 npm workspaces monorepo、TypeScript、lint／format 與測試框架

- [X] T001 建立根目錄 `package.json`：`"private": true`、`"workspaces": ["apps/*", "packages/*"]`、`"engines": { "node": ">=26 <27" }`；scripts：`build`（依序建置 shared → web → server）、`start`（先 `build` 再 `node apps/server/dist/main.js`）、`dev`（concurrently 啟動 `npm run dev -w apps/server` 與 `npm run dev -w apps/web`）、`test`（`vitest run`）、`typecheck`（各 workspace `tsc --noEmit`）、`lint`（`eslint .`）、`format`（`prettier --write .`）、`simulate`（`tsx scripts/simulate-students.ts`）；devDependencies：`typescript@~6.0`、`vitest@^5`、`eslint@^10`、`typescript-eslint@^8`、`prettier@^3`、`eslint-config-prettier`、`tsx`、`concurrently`
- [X] T002 建立 `tsconfig.base.json`：`strict: true`、`noUncheckedIndexedAccess: true`、`noImplicitOverride: true`、`exactOptionalPropertyTypes: true`、`isolatedModules: true`、`skipLibCheck: true`、`target: "ES2024"`
- [X] T003 [P] 建立 `eslint.config.js`（flat config，`typescript-eslint` 的 `strictTypeChecked` 規則、`@typescript-eslint/no-explicit-any: "error"`、`eslint-config-prettier`；忽略 `dist/`、`coverage/`、`node_modules/`）、`.prettierrc`（`singleQuote: true`、`semi: true`、`printWidth: 100`）、`.prettierignore`
- [X] T004 [P] 建立共用契約套件 `packages/shared/package.json`（名稱 `@crs/shared`、`"type": "module"`、dependency `zod@^4`、`exports` 指向 `src/index.ts` 供開發與 `dist/` 供建置）、`packages/shared/tsconfig.json`（繼承 base）、`packages/shared/src/index.ts`（暫時空匯出）
- [X] T005 [P] 建立後端套件 `apps/server/package.json`（`"type": "module"`；dependencies：`@crs/shared`、`fastify@^5`、`@fastify/static`、`socket.io@^4`、`@googleapis/sheets`、`google-auth-library`、`pino`、`zod@^4`；devDependencies：`socket.io-client@^4`；scripts：`dev`＝`tsx watch src/main.ts`、`build`＝`tsc -p tsconfig.build.json`）、`apps/server/tsconfig.json`、`apps/server/tsconfig.build.json`（`module`／`moduleResolution` 為 `NodeNext`）
- [X] T006 [P] 建立前端套件 `apps/web/package.json`（dependencies：`@crs/shared`、`react@^19`、`react-dom@^19`、`socket.io-client@^4`；devDependencies：`vite@^8`、`@vitejs/plugin-react`、`tailwindcss@^4`、`@tailwindcss/vite`、`@testing-library/react`、`@testing-library/user-event`、`jsdom`）、`apps/web/tsconfig.json`（`jsx: "react-jsx"`、`moduleResolution: "Bundler"`）、`apps/web/index.html`（`lang="zh-Hant"`）、`apps/web/vite.config.ts`（React 與 Tailwind 外掛；dev server proxy `/api` 與 `/socket.io`（`ws: true`）到 `http://localhost:3000`）、`apps/web/src/index.css`（內容 `@import "tailwindcss";`）
- [X] T007 建立根目錄 `vitest.config.ts`，以 `test.projects` 定義 `shared`（`packages/shared/tests/**/*.test.ts`）、`server`（`apps/server/tests/**/*.test.ts`，environment `node`）、`web`（`apps/web/tests/**/*.test.tsx`，environment `jsdom`）三個專案
- [X] T008 在 Node 26 下執行 `npm install` 產生並保留 `package-lock.json`；確認 `npm run typecheck`、`npm run lint`、`npm test` 在空專案上都能執行（沒有測試時 `vitest run --passWithNoTests`）；檢查 `npm install` 輸出沒有 `npm warn deprecated` 警告（constitution：不得使用已停止維護的套件），若有則改用替代套件；回報指令與結果

**Checkpoint**: 專案骨架可以安裝、型別檢查、lint 與執行測試

---

## Phase 2: Foundational（所有 user story 的共同前置）

**Purpose**: 共用契約、設定、log、錯誤模型、保存、身分驗證、狀態機、可見性、HTTP／即時骨架、前端骨架

**⚠️ CRITICAL**: 本 Phase 完成前不得開始任何 user story

### 共用契約（packages/shared）

- [X] T009 [P] 在 `packages/shared/src/errors.ts` 定義 `ErrorCode`（Zod enum），值完全依 `contracts/http-api.md` 錯誤表：`VALIDATION_FAILED`、`UNAUTHORIZED`、`INVALID_PASSWORD`、`FORBIDDEN`、`INVALID_SPREADSHEET_URL`、`SHEETS_UNAVAILABLE`、`GUIDED_NOTES_INVALID`、`EXPORT_LOCATE_FAILED`、`INVALID_TRANSITION`、`ALREADY_IN_STATE`、`CONFIRM_DISCARD_REQUIRED`、`NO_ACTIVE_ACTIVITY`、`INVALID_GROUP`、`SESSION_NOT_OPEN`、`QUESTION_NOT_FOUND`、`ANSWER_INCOMPLETE`、`ANSWER_INVALID`、`ALREADY_SUBMITTED`、`INTERNAL_ERROR`；另定義 `GuidedNotesIssueCode`（`HEADER_NOT_FOUND`、`MULTIPLE_HEADER_ROWS`、`MULTIPLE_GUIDED_NOTES_SHEETS`、`INVALID_QUESTION_NUMBER`、`DUPLICATE_QUESTION_NUMBER`、`NO_QUESTIONS`、`PARTIAL_BLANK_MARKERS`、`INVALID_BLANK_MARKERS`），以及 `ErrorDetail` schema（`code`、`message`、選填 `sheetTitle`、`row`（1 起算）、`column`（欄名如 `"G"`）、`questionNumber`、`blankIndex`）與 `ApiErrorBody`（`{ error: { code, message, details? } }`）
- [X] T010 [P] 在 `packages/shared/src/domain.ts` 依 `data-model.md` 定義 Zod schema 與推導型別：`Role`（`teacher` | `student`）；`SessionStatus`（`NOT_IMPORTED` | `READY` | `OPEN` | `CLOSED`）；`GroupId`（整數 1～20）；`Group`（`id`、`name` 固定為「第 {id} 組」）；`GuidedNotesRef`（`spreadsheetId` 格式 `[A-Za-z0-9-_]+`、`sheetTitle`）；`CellLocation`（`sheetTitle`、`rowIndex`／`columnIndex` 為 0 起算非負整數）；`Blank`（`index` 從 1 連號、`label: string | null`、`location`）；`Question`（`number` 正整數、`order`、`kind: "single" | "group"`、`blanks`：single 恰 1 個、group ≥ 2 個）；`BlankAnswer`（`blankIndex`、`text`「去除前後空白後 1～200 字（以 Unicode 字元計）」，schema 先 trim 再檢查長度）；`Submission`（`id` UUID、`questionNumber`、`groupId`、`answers`、`sequence` 正整數、`receivedAt` ISO 字串）；`QuizSession`（`activityId: string | null`、`status`、`source`、`groups`（2～20 個）、`questions`、`submissions`、`nextSequence`（從 1 開始）、`openedAt`、`closedAt`、`lastExport: { exportedAt, writtenQuestionCount } | null`）；`QuestionResult`（`questionNumber`、`winner: Submission | null`）；`PersistedState`（`{ schemaVersion: 1, session: QuizSession }`）
- [X] T011 [P] 在 `packages/shared/src/views.ts` 依 `data-model.md`「依角色產生的檢視資料」定義 `QuestionSummary`（`number`、`kind`、`blankCount`）、`PublicView`（`status`、`groups`、`questions: QuestionSummary[]`）、`StudentView`（PublicView ＋ `groupId`、`ownSubmissions`：只含 `questionNumber` 與 `answers`，**不含 `sequence`、順位、是否成功**、`results: QuestionResultView[] | null`（只有 `CLOSED` 才有值））、`TeacherView`（PublicView ＋ `activityId`、`source`、`submissions`（含 `sequence`）、`results`（`OPEN` 時為目前第一名）、`openedAt`、`closedAt`、`lastExport`）；`results` 中每筆含 `questionNumber`、`winnerGroupId: number | null`、`answers: BlankAnswer[] | null`
- [X] T012 [P] 在 `packages/shared/src/api.ts` 依 `contracts/http-api.md` 定義所有請求與回應 schema：`TeacherLoginRequest`（`password` 1～200 字）、`StudentJoinRequest`（`groupId`）、`AuthResponse`（`token`、`identity`）、`SessionViewResponse`、`ImportRequest`（`spreadsheetUrl`、`groupCount` 2～20、選填 `confirmDiscard: boolean`）、`ExportResponse`（`writtenQuestionCount`、`writtenCellCount`、`exportedAt`）、`SubmitRequest`（`questionNumber`、`answers: { blankIndex, text }[]`，**不含任何組別或時間欄位**）、`SubmitResponse`（`submissionId`、`receivedAt`，**不含順位**）
- [X] T013 [P] 在 `packages/shared/src/events.ts` 依 `contracts/realtime-events.md` 定義事件名稱常數 `SESSION_STATE = "session:state"`、`SESSION_RESET = "session:reset"`，payload schema `SessionStatePayload`（`{ view: PublicView | StudentView | TeacherView, version: number }`）、`SessionResetPayload`（`{ reason: "NEW_ACTIVITY" }`），以及 Socket.IO 的 `ServerToClientEvents` 型別
- [X] T014 更新 `packages/shared/src/index.ts` 匯出 errors／domain／views／api／events；新增 `packages/shared/tests/schemas.test.ts` 測試邊界：`BlankAnswer.text` 為空白、1 字、200 字、201 字、前後空白；`GroupId` 0／1／20／21；`Question` single 有 2 個 blank 時失敗；`SubmitRequest` 帶多餘的 `groupId` 欄位時被 strict schema 拒絕

### 後端基礎（apps/server）

- [X] T015 [P] 在 `apps/server/src/config/config.ts` 實作 `loadConfig(env)`：以 Zod 驗證 `TEACHER_PASSWORD`（至少 8 字）、`SESSION_SECRET`（至少 32 字）、`GOOGLE_SERVICE_ACCOUNT_KEY_FILE`（絕對路徑）、`PORT`（預設 3000）、`DATA_DIR`（預設 `./data`）；失敗時拋出只列出「變數名稱與原因」的錯誤（**不得包含變數值**）；`main.ts` 會在讀檔前另外確認金鑰檔存在。測試 `apps/server/tests/unit/config.test.ts`：缺變數、太短、預設值、錯誤訊息不含值
- [X] T016 [P] 在 `apps/server/src/infrastructure/logger.ts` 建立 pino logger，`redact` 遮蔽 `password`、`token`、`authorization`、`*.password`、`req.headers.authorization`、`GOOGLE_SERVICE_ACCOUNT_KEY_FILE`；匯出事件名稱常數 `session.transition`、`submission.accepted`、`submission.rejected`、`import.succeeded`、`import.failed`、`export.succeeded`、`export.failed`
- [X] T017 [P] 在 `apps/server/src/domain/errors.ts` 實作 `DomainError`（`code: ErrorCode`、`userMessage`、`details?: ErrorDetail[]`）與 `httpStatusOf(code)` 對照表（依 `contracts/http-api.md`）
- [X] T018 [P] 在 `apps/server/src/domain/mutex.ts` 實作 `AsyncMutex.runExclusive(fn)`（FIFO，例外時也會釋放鎖）；註解說明它是順位判定公平性的基礎（research R9）。測試 `apps/server/tests/unit/mutex.test.ts`：執行順序與呼叫順序一致、例外不會卡死
- [X] T019 [P] 在 `apps/server/src/infrastructure/persistence/sessionRepository.ts` 定義 `SessionRepository` 介面（`load(): Promise<QuizSession | null>`、`save(session): Promise<void>`），在 `localSessionRepository.ts` 實作：寫入 `${DATA_DIR}/session.json.tmp` 後 `fs.rename` 成 `session.json`、目錄不存在時自動建立；載入時以 `PersistedState` 驗證，檔案不存在回傳 `null`，驗證失敗拋出看得懂的錯誤且**不覆蓋原檔**；檔案內容不得含 token、密碼或憑證。另在 `apps/server/tests/fakes/inMemorySessionRepository.ts` 實作記憶體版本。測試 `apps/server/tests/unit/localSessionRepository.test.ts`（使用暫存目錄）
- [X] T020 [P] 在 `apps/server/src/auth/tokens.ts` 實作 `signToken(payload, secret)`／`verifyToken(token, secret, now)`：格式 `base64url(JSON)` + `.` + `base64url(HMAC-SHA256)`，payload 為 `TabIdentity`（`role`、學生必填 `groupId` 與 `activityId`、`issuedAt`、`expiresAt` = 簽發時間 + 12 小時），比對簽章使用 `crypto.timingSafeEqual`。測試 `apps/server/tests/unit/tokens.test.ts`：竄改、過期、錯誤密鑰、格式錯誤
- [X] T021 在 `apps/server/src/auth/authService.ts` 實作 `AuthService`：`loginAsTeacher(password)`（兩邊先做 SHA-256 再 `timingSafeEqual`，錯誤拋 `INVALID_PASSWORD`，訊息不透露任何密碼資訊）、`resolve(token, currentActivityId)`（無效、過期、學生 `activityId` 與目前活動不同 → `null`）；在 `apps/server/src/auth/roleGuard.ts` 實作 `requireTeacher(identity)`、`requireStudent(identity)`（未登入 `UNAUTHORIZED`、角色不符 `FORBIDDEN`）。測試 `apps/server/tests/unit/authService.test.ts`
- [X] T022 [P] 在 `apps/server/src/domain/session/quizSession.ts` 實作純函式狀態機：`initialSession()`（`NOT_IMPORTED`、`nextSequence: 1`）與 `assertTransition(from, action)`，只允許 `data-model.md` 轉換表：`NOT_IMPORTED`→匯入→`READY`；`READY`→重新匯入→`READY`；`READY`→開啟→`OPEN`（至少 1 題）；`OPEN`→結束→`CLOSED`；`CLOSED`→匯入新文件（需 `confirmDiscard: true`，否則 `CONFIRM_DISCARD_REQUIRED`）→`READY`。重複操作（`OPEN` 時開啟、`CLOSED` 時結束）拋 `ALREADY_IN_STATE`；其他（含 `CLOSED`→開啟、`OPEN`→匯入）拋 `INVALID_TRANSITION`。測試 `apps/server/tests/unit/quizSession.test.ts` 逐格測試 4 狀態 × 3 操作
- [X] T023 [P] 在 `apps/server/src/domain/ranking/rankingStrategy.ts` 定義 `RankingStrategy` 介面，在 `firstSubmissionStrategy.ts` 實作「依 `sequence` 由小到大」；在 `apps/server/src/domain/ranking/results.ts` 實作 `deriveResults(session, strategy)`：每題 `winner` 為排序後第一筆，沒有作答為 `null`。測試 `apps/server/tests/unit/ranking.test.ts`（不依 `receivedAt` 排序、無人搶答）
- [X] T024 在 `apps/server/src/domain/visibility/visibilityPolicy.ts` 實作 `toPublicView`、`toStudentView(session, groupId)`、`toTeacherView(session)`，完全依 T011 定義：學生在 `CLOSED` 之前只拿得到自己組別的 `questionNumber` 與 `answers`，**拿不到 `sequence`、順位、是否搶答成功與任何他組資料**；`CLOSED` 後才有 `results`；匯入只保存題號與作答格、不保存題目敘述。測試 `apps/server/tests/unit/visibilityPolicy.test.ts`
- [X] T025 [P] 在 `apps/server/src/infrastructure/sheets/guidedNotesGateway.ts` 定義 `GuidedNotesGateway` 介面（`read(ref): Promise<SpreadsheetSnapshot>`、`writeCells(ref, writes: CellWrite[]): Promise<void>`）與 `SpreadsheetSnapshot`／`SheetGrid`（`sheetTitle`、`cells: string[][]`（formatted value，空格為 `""`）、`merges: { startRow, endRow, startColumn, endColumn }[]`（end 為不含））／`CellWrite`（`sheetTitle`、`rowIndex`、`columnIndex`、`value`）型別；在 `googleSheetsGateway.ts` 建立 `GoogleSheetsGateway` 類別骨架（建構子以 `google-auth-library` 讀取金鑰檔、scope `https://www.googleapis.com/auth/spreadsheets`；`read`／`writeCells` 暫時拋出「尚未實作」，分別於 US1、US4 完成）；在 `apps/server/tests/fakes/fakeGuidedNotesGateway.ts` 實作記憶體版本：以 spreadsheetId 對應 fixture、`writeCells` 會修改記憶體內容並記錄每次寫入、可設定讓下一次呼叫拋出 `SHEETS_UNAVAILABLE`
- [X] T026 在 `apps/server/src/domain/session/quizSessionService.ts` 建立 `QuizSessionService` 骨架：建構時注入 `SessionRepository`、`GuidedNotesGateway`（T025）、`RankingStrategy`、logger、`now()`、`uuid()`；`init()` 從 repository 載入（沒有則 `initialSession()`）；私有 `mutate(fn)` 以 `AsyncMutex` 序列化：`fn` 接收目前狀態、**回傳新的狀態物件**（不得直接修改目前狀態）→ `repository.save(新狀態)` 成功 → 才把記憶體狀態替換為新狀態 → `version++` → 通知 `onChange` 監聽者（payload 含變更類型，例如 `state`、`submission`、`export`、`reset`）；`save` 失敗時記憶體狀態不變、操作拋出錯誤（FR-028「保存完成才回覆」）；提供 `getSession()`、`getVersion()`。測試 `apps/server/tests/unit/quizSessionService.test.ts`：讓 repository 的 `save` 拋出錯誤時，`getSession()` 與 `getVersion()` 不變，也不會觸發 `onChange`
- [X] T027 在 `apps/server/src/transport/http/errorHandler.ts` 實作 Fastify 錯誤處理：`DomainError` → `httpStatusOf(code)` 與 `ApiErrorBody`；Zod 錯誤 → `400 VALIDATION_FAILED`；其他 → `500 INTERNAL_ERROR` 與通用訊息「系統發生錯誤，請稍後再試」，堆疊只寫入 log；在 `apps/server/src/transport/http/auth.ts` 實作從 `Authorization: Bearer` 取出 token 並以 `AuthService.resolve` 解析身分的 preHandler
- [X] T028 在 `apps/server/src/transport/http/routes/authRoutes.ts` 實作 `POST /api/auth/teacher`；在 `apps/server/src/transport/http/routes/sessionRoutes.ts` 實作 `GET /api/session`（不帶 token 回 `PublicView`、老師回 `TeacherView`、學生回 `StudentView`、帶無效 token 回 `401 UNAUTHORIZED`）；所有 body 以 `@crs/shared` schema 驗證
- [X] T029 在 `apps/server/src/transport/realtime/realtimeGateway.ts` 實作 Socket.IO：掛在同一個 HTTP 伺服器；連線中介層讀 `auth.token`，無效時以 `connect_error`（`message = "UNAUTHORIZED"`）拒絕；依身分加入 `public`／`teachers`／`group:{id}`；連線（含重連）後立即送出該身分的 `session:state`；訂閱 `QuizSessionService.onChange`，`state` 變更時對 `public`、`teachers`、每個 `group:N` 各送對應 view，`submission` 變更時只送 `teachers` 與送出的那一組，`export` 變更只送 `teachers`，`reset` 時對所有 `group:N` 送 `session:reset` 並中斷這些學生連線（讓舊身分離開舊 room）；payload 皆帶 `version`
- [X] T030 在 `apps/server/src/app.ts` 實作 `buildApp({ config, gateway, repository, logger, now, uuid })` 組裝 Fastify、錯誤處理、路由、`QuizSessionService`、`RealtimeGateway`，並在 `apps/web/dist` 存在時以 `@fastify/static` 提供前端（非 `/api`、`/socket.io` 的路徑回傳 `index.html`）；在 `apps/server/src/main.ts`：`loadConfig(process.env)`（自動讀取根目錄 `.env`，可用 `process.loadEnvFile` 並在檔案不存在時略過）→ 確認金鑰檔存在 → 建立 `GoogleSheetsGateway`（T025）→ `service.init()` → 監聽 `PORT`；任何設定錯誤以看得懂的訊息印出並 `process.exit(1)`
- [X] T031 整合測試 `apps/server/tests/integration/auth.test.ts`（以 `buildApp` + `FakeGuidedNotesGateway` + `InMemorySessionRepository`）：老師登入成功／密碼錯誤 `INVALID_PASSWORD`；`GET /api/session` 不帶 token、帶老師 token、帶無效 token；以 socket.io-client 連線：不帶 token 收到 PublicView、帶老師 token 收到 TeacherView、帶無效 token 收到 `connect_error UNAUTHORIZED`；兩個不同 token 的連線互不影響；另在測試中註冊一個會拋出一般例外的測試路由，確認回應為 `500 INTERNAL_ERROR` 與通用訊息，回應內容不含堆疊、檔案路徑或例外原文（FR-026、constitution 原則 VIII）

### 前端基礎（apps/web）

- [X] T032 [P] 在 `apps/web/src/api/identity.ts` 實作以 **`sessionStorage`**（不得使用 cookie 或 `localStorage`）保存／讀取／清除 token；在 `apps/web/src/api/http.ts` 實作 `apiRequest(path, schema, init)`：自動帶 `Authorization: Bearer`、以 `@crs/shared` schema 驗證回應、錯誤時解析 `ApiErrorBody` 並拋出含 `code`、`message`、`details` 的 `ApiError`
- [X] T033 [P] 在 `apps/web/src/api/socket.ts` 建立 socket.io-client 連線（`auth: { token }`），在 `apps/web/src/hooks/useSessionState.ts` 實作 hook：保存最新 `view`，忽略比目前更舊的 `version`；收到 `connect_error UNAUTHORIZED` 時清除 token 並通知呼叫端回到登入畫面
- [X] T034 在 `apps/web/src/main.tsx` 與 `apps/web/src/App.tsx` 依 `location.pathname` 切換：`/teacher` → 老師端、`/` → 簡單首頁（連到老師端；學生端標示「子功能 002 提供」）、其他 → 404 文字；全站文字使用繁體中文
- [X] T035 [P] 在 `apps/web/src/components/ErrorBanner.tsx` 實作錯誤顯示元件（顯示 `message`，若有 `details` 以清單列出工作表、列、欄、題號）；在 `apps/web/src/components/StatusBadge.tsx` 顯示「尚未匯入／待開始／搶答進行中／已結束」
- [X] T036 在 `apps/web/src/hooks/useTeacherAuth.ts` 與 `apps/web/src/pages/teacher/TeacherLoginPage.tsx` 實作老師密碼登入（成功存 token、失敗顯示 `INVALID_PASSWORD` 訊息）；在 `apps/web/src/pages/teacher/TeacherPage.tsx` 依是否有 token 顯示登入頁或 `TeacherDashboard`；`apps/web/src/pages/teacher/TeacherDashboard.tsx` 先顯示 `StatusBadge` 與題目區、控制區、作答區、匯出區的版面骨架。測試 `apps/web/tests/TeacherLoginPage.test.tsx`（成功、密碼錯誤、token 只寫入 sessionStorage）
- [X] T037 品質關卡：執行 `npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報執行的指令與結果

**Checkpoint**: 老師可以登入、看到即時狀態；身分以分頁為單位；伺服器能保存與恢復狀態

---

## Phase 3: User Story 1 — 老師匯入 Guided Notes 題目（Priority: P1）🎯 MVP

**Goal**: 老師貼上 Google Sheets 網址並設定組數，系統依內容動態辨識題號與填空格（含題組），建立與文件一致的題目清單

**Independent Test**: 以「單題範例」與「題組範例」fixtures 匯入，分別得到 6 題與 4 題（第 1、2 題為題組各 2 子題）；各種錯誤 fixtures 被拒絕並指出位置，且系統資料不變

### Tests for User Story 1

- [X] T038 [P] [US1] 在 `apps/server/tests/fixtures/guided-notes/` 建立 `SpreadsheetSnapshot` JSON（題目一律為簡答題）：`single-example.json`（重現課程單題範例：工作表「學習單」、標題列合併 B2:G3、第 4 列表頭 B「題號」C:F「題目」G「作答」、題號 1～6 各佔兩列且 B、G 欄跨兩列合併）、`group-example.json`（重現題組範例：第 1、2 題在相鄰兩列重複題號、G 欄分別為「（1）」「（2）」，第 3、4 題為單題，題目間有空白列）；變體：`group-no-markers.json`（題組作答格無標記）、`varied-numbers.json`（題號為 `Q1`、`第2題`、`３`、`4.`、`5、`）、`extra-sheets.json`（另有一張沒有表頭的「說明」工作表）、`merged-group-number.json`（題組題號以合併儲存格跨兩列）；錯誤：`no-header.json`、`header-wrong-word.json`（「答案」取代「作答」）、`multiple-header-sheets.json`、`multiple-header-rows.json`、`invalid-number.json`（題號「A-1」）、`duplicate-number.json`（題號 2 出現在不相鄰兩處）、`no-questions.json`、`partial-markers.json`、`invalid-markers.json`（（1）（3））
- [X] T039 [P] [US1] 測試 `apps/server/tests/unit/guidedNotesParser.test.ts`：依 `contracts/guided-notes-format.md` §8 驗收基準，單題範例 6 題（皆 `single`、作答格各 1 個且位置為 G 欄合併左上角）、題組範例 4 題（1、2 為 `group` 各 2 子題、`label` 為「（1）」「（2）」；3、4 為 `single`）；每個變體與錯誤 fixture 的預期結果與 `GuidedNotesIssueCode`；錯誤需包含工作表名稱、1 起算列號、欄名；有多個錯誤時一次全部回報

### Implementation for User Story 1

- [X] T040 [P] [US1] 在 `apps/server/src/domain/guidedNotes/questionNumber.ts` 實作 `parseQuestionNumber(raw)`，依 FR-007a：去除前後空白後接受「純數字（如「1」）、數字加句點或頓號（如「1.」「1、」）、「Q」加數字（大小寫皆可）、「第…題」，數字可為半形或全形」，轉成正整數；空白回傳 `"empty"`；其他（含 `0`、`A-1`、`一`）回傳 `"invalid"`。測試 `apps/server/tests/unit/questionNumber.test.ts`
- [X] T041 [P] [US1] 在 `apps/server/src/domain/guidedNotes/grid.ts` 實作合併儲存格處理：`effectiveValue(grid, row, col)`（合併範圍內任一格取左上角的值）、`anchorOf(grid, row, col)`（回傳左上角位置）、`columnName(index)`（0→`A`、25→`Z`、26→`AA`）。測試 `apps/server/tests/unit/grid.test.ts`
- [X] T042 [P] [US1] 在 `apps/server/src/domain/guidedNotes/markers.ts` 實作 `readBlankMarker(text)`：文字開頭為 `（n）` 或 `(n)`（全形或半形括號、`n` 半形或全形數字、括號內可有空白）時回傳 `{ label: 原文, number }`，否則 `null`。測試 `apps/server/tests/unit/markers.test.ts`
- [X] T043 [US1] 在 `apps/server/src/domain/guidedNotes/parser.ts` 實作 `selectSheet(snapshot)` 與 `parseGuidedNotes(snapshot)`，嚴格依 `contracts/guided-notes-format.md` §2～§6：表頭列＝同一列同時有內容恰為「題號」與「作答」的儲存格（「題目」欄可有可無）；同一工作表兩列以上表頭 → `MULTIPLE_HEADER_ROWS`；候選工作表 0 張 `HEADER_NOT_FOUND`、2 張以上 `MULTIPLE_GUIDED_NOTES_SHEETS`（列出名稱）；不依工作表名稱、順序或網址分頁編號；連續且題號相同的列組成題目區塊（合併或相鄰列重複），空白列結束區塊；不相鄰的重複題號 → `DUPLICATE_QUESTION_NUMBER`；作答格依合併左上角去重、依列排序，1 個為 `single`、2 個以上為 `group`；題組標記「全部沒有」或「全部有且從 1 連號」，部分有 → `PARTIAL_BLANK_MARKERS`、不連號 → `INVALID_BLANK_MARKERS`；單題作答格的標記只當一般文字；沒有題目 → `NO_QUESTIONS`；**收集所有錯誤一次回報**；回傳 `{ sheetTitle, questions }` 或拋出 `DomainError(GUIDED_NOTES_INVALID, details)`。每條規則旁加註解說明業務意義。讓 T039 全部通過
- [X] T044 [P] [US1] 在 `apps/server/src/infrastructure/sheets/spreadsheetUrl.ts` 實作 `parseSpreadsheetUrl(url)`：只接受 `https://docs.google.com/spreadsheets/d/{id}/...`，取出 `id`（`[A-Za-z0-9-_]+`），其他一律 `INVALID_SPREADSHEET_URL`。測試 `apps/server/tests/unit/spreadsheetUrl.test.ts`（含課程兩份範例網址格式、帶 `#gid=` 的網址、非 Google 網址）
- [X] T045 [US1] 在 `apps/server/src/infrastructure/sheets/googleSheetsGateway.ts` 完成 `GoogleSheetsGateway.read(ref)`：呼叫 `@googleapis/sheets` 的 `spreadsheets.get`（`includeGridData: true`、`fields: "sheets(properties(sheetId,title),merges,data(startRow,startColumn,rowData(values(formattedValue))))"`），轉成 `SpreadsheetSnapshot`（缺值補 `""`）並以 Zod 驗證；403／404／網路錯誤一律轉成 `SHEETS_UNAVAILABLE`（訊息提示「請確認文件已分享給服務帳號」，不含金鑰路徑或原始錯誤）；`writeCells` 維持「尚未實作」，於 US4 完成
- [X] T046 [US1] 在 `QuizSessionService`（`apps/server/src/domain/session/quizSessionService.ts`）實作 `importQuestions({ spreadsheetUrl, groupCount, confirmDiscard })`：在 mutex 內 `assertTransition` → `parseSpreadsheetUrl` → `gateway.read` → `parseGuidedNotes` → 全部成功才**整批替換**：新的 `activityId`（UUID）、`groups` 為 `groupCount`（2～20）組「第 {id} 組」、`questions`、清空 `submissions`、`nextSequence = 1`、`openedAt`／`closedAt`／`lastExport` 為 `null`、`source`；保存成功才回傳；任何失敗都不改變資料；記錄 `import.succeeded`（題數、工作表名稱）／`import.failed`（錯誤代碼，不含網址以外的機敏資訊）；`activityId` 換新時（含 `READY` 重新匯入與 `CLOSED` 後匯入）觸發 `reset` 變更。測試 `apps/server/tests/unit/importQuestions.test.ts`：兩份範例成功、錯誤時資料不變、`OPEN` 時 `INVALID_TRANSITION`、`CLOSED` 未確認 `CONFIRM_DISCARD_REQUIRED`、`READY` 重新匯入取代題目與組數、`SHEETS_UNAVAILABLE`
- [X] T047 [US1] 在 `apps/server/src/transport/http/routes/sessionRoutes.ts` 新增 `POST /api/session/import`（`requireTeacher`，body 為 `ImportRequest`，回 `{ view: TeacherView }`）。整合測試 `apps/server/tests/integration/import.test.ts`：老師匯入兩份範例成功且 socket 收到新狀態；格式錯誤回 `422 GUIDED_NOTES_INVALID` 且 `details` 含位置；無效網址 `400`；不帶 token `401`、學生 token `403`（學生 token 可用 T020 的 `signToken` 直接產生）
- [X] T048 [P] [US1] 在 `apps/web/src/pages/teacher/ImportPanel.tsx` 實作匯入表單：網址輸入、組數（2～20，預設 2）、送出中狀態；成功後由 `session:state` 更新畫面；失敗以 `ErrorBanner` 顯示所有 `details`；狀態為 `CLOSED` 時先跳確認對話框「重新匯入會開始新的一場，目前結果將被清除，請確認已匯出」，確認後帶 `confirmDiscard: true`；狀態為 `READY` 時，在匯入按鈕旁固定顯示提示「重新匯入會開始新的一場，已加入的學生需重新選擇組別加入」（spec 邊界案例：重新匯入後學生身分全部失效）；狀態為 `OPEN` 時停用表單並說明原因
- [X] T049 [P] [US1] 在 `apps/web/src/components/QuestionList.tsx` 顯示題號清單：題號、題組標籤與子題數、匯入的工作表名稱與題數
- [X] T050 [US1] 將 `ImportPanel` 與 `QuestionList` 接入 `TeacherDashboard.tsx`。測試 `apps/web/tests/ImportPanel.test.tsx`：成功顯示題數、錯誤清單顯示位置、`CLOSED` 時出現確認對話框並送出 `confirmDiscard`、`READY` 時顯示「已加入的學生需重新選擇組別加入」提示、`OPEN` 時停用
- [X] T051 [US1] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 匯入功能可獨立運作與展示（MVP）

---

## Phase 4: User Story 2 — 老師開啟與結束搶答（Priority: P1）

**Goal**: 老師開啟、結束搶答，所有已連線分頁即時同步；重新整理、重連與伺服器重啟都回到正確狀態

**Independent Test**: 一個老師 socket 與兩個未登入 socket 連線，開啟、結束時三者 1 秒內收到新狀態；重連後收到完整狀態；以同一個資料目錄重建伺服器後狀態不變；`CLOSED` 後再開啟被拒絕

### Tests for User Story 2

- [X] T052 [P] [US2] 整合測試 `apps/server/tests/integration/sessionLifecycle.test.ts`：匯入後由老師 A 的 token 開啟 → 4 個 socket（老師 A、老師 B、2 個未登入）都在 1 秒內收到 `OPEN`（老師 B 驗證多個老師分頁同步）；重複開啟 `ALREADY_IN_STATE`；結束 → 收到 `CLOSED`；`CLOSED` 後開啟 `INVALID_TRANSITION`；未匯入就開啟 `INVALID_TRANSITION`；學生 token 呼叫開啟／結束 `403`；socket 斷線重連後立即收到目前完整狀態，且從重新連線到收到 `session:state` 的耗時小於 3 秒（SC-004）
- [X] T053 [P] [US2] 整合測試 `apps/server/tests/integration/restart.test.ts`：使用暫存 `DATA_DIR` 與 `LocalSessionRepository`，分別在 (a)「待開始」與 (b)「搶答進行中」關閉伺服器，以同一目錄重建 `buildApp` → 狀態、題目、`activityId`、`nextSequence` 與重啟前完全相同；同一個老師 token 仍可呼叫老師 API（FR-003a）。（有作答紀錄與已匯出的重啟情境分別在 T062、T071 依本檔模式補測，合起來涵蓋 SC-010「任一階段」）

### Implementation for User Story 2

- [X] T054 [US2] 在 `QuizSessionService` 實作 `open()`、`close()`：在 mutex 內 `assertTransition`，`open` 需至少 1 題並記錄 `openedAt`，`close` 記錄 `closedAt`；保存成功後觸發 `state` 變更；記錄 `session.transition`（from、to）。測試 `apps/server/tests/unit/openClose.test.ts`
- [X] T055 [US2] 在 `apps/server/src/transport/http/routes/sessionRoutes.ts` 新增 `POST /api/session/open`、`POST /api/session/close`（`requireTeacher`，回 `{ view: TeacherView }`），讓 T052、T053 通過
- [X] T056 [P] [US2] 在 `apps/web/src/pages/teacher/SessionControls.tsx` 實作「開啟搶答」「結束搶答」按鈕：只在允許的狀態啟用（`READY` 可開啟、`OPEN` 可結束），結束前確認對話框「結束後各組無法再作答，也不能重新開啟」；`CLOSED` 時顯示「要再進行搶答請重新匯入」；錯誤以 `ErrorBanner` 顯示
- [X] T057 [US2] 將 `SessionControls` 接入 `TeacherDashboard.tsx`。測試 `apps/web/tests/SessionControls.test.tsx`：各狀態按鈕啟用情況、結束確認、`CLOSED` 提示文字
- [X] T058 [US2] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 匯入＋開啟／結束可完整展示，狀態在所有分頁同步

---

## Phase 5: User Story 3 — 老師檢視作答狀況與搶答結果（Priority: P2）

**Goal**: 學生（以 API／模擬腳本）加入組別並送出答案；老師即時看到每題送出紀錄、順位與搶答成功組別，結束後看到結果；學生在結束前看不到他組資料

**Independent Test**: 以模擬學生 token 送出答案驅動活動，老師 socket 即時收到正確順位與搶答成功組別；並發測試只產生一個搶答成功組別；學生 socket 與 HTTP 回應在結束前不含他組作答

### Tests for User Story 3

- [X] T059 [P] [US3] 整合測試 `apps/server/tests/integration/concurrency.test.ts`（SC-005）：20 組學生 token 以 `Promise.all` 同時送出同一題，重複 100 次（每次重新匯入），每次只有 1 個搶答成功組別、`sequence` 1～20 不重複且與 mutex 處理順序一致、老師 view 的 `results` 與 `deriveResults` 一致。另測試「結束」與「送出」同時發生（Edge Case：以伺服器處理「結束」的時間點為界）：開啟後以 `Promise.all` 同時發出 `POST /api/session/close` 與 10 組送出，重複 100 次；每次在結束之前處理的送出（`sequence` 小於結束時的 `nextSequence`）全部被接受，結束之後處理的全部回 `SESSION_NOT_OPEN`，且被拒絕的送出不出現在結果中
- [X] T060 [P] [US3] 整合測試 `apps/server/tests/integration/visibility.test.ts`（FR-020、SC-006）：第 1、2 組各自連線 socket 並送出答案；在 `CLOSED` 之前，第 1 組收到的所有 `session:state` payload 與 `GET /api/session`、`POST /api/submissions` 回應，序列化後都不含第 2 組的答案文字、`sequence`、`winnerGroupId`；第 2 組送出時第 1 組不會收到任何事件；`CLOSED` 後兩組都收到 `results`；另測試第 1、2 組的學生 socket 在老師開啟與結束搶答後，都在 1 秒內收到新的 `session:state`（SC-003 的「學生分頁」部分；老師與未登入分頁已由 T052 驗證）
- [X] T061 [P] [US3] 整合測試 `apps/server/tests/integration/permissions.test.ts`（FR-002）：集中驗證所有老師專屬 API 的完整權限清單（各 story 的整合測試已各自檢查自己新增的 API，本任務確保沒有遺漏）：學生 token 呼叫 `import`／`open`／`close`／`export` 全部 `403`；不帶 token 全部 `401`；老師 token 呼叫 `POST /api/submissions` 為 `403`
- [X] T062 [P] [US3] 整合測試 `apps/server/tests/integration/submissions.test.ts`：正常送出（單題、題組）；`SESSION_NOT_OPEN`（`READY`、`CLOSED`）；`QUESTION_NOT_FOUND`；題組缺子題 `ANSWER_INCOMPLETE`；空白、只有空格、201 字 `ANSWER_INVALID` 且 `details` 指出子題；同組同題第二次 `ALREADY_SUBMITTED`；被拒絕的送出不產生紀錄、不消耗 `sequence`；學生加入時 `NO_ACTIVE_ACTIVITY`、`INVALID_GROUP`；老師從 `CLOSED` 匯入新文件後，舊學生 token 變成 `401` 且收到 `session:reset`；`READY` 重新匯入後，已加入的學生 token 同樣變成 `401`、收到 `session:reset`、連線被中斷，之後收不到新活動的 `session:state`；依 `restart.test.ts` 模式，在已有 2 組送出時重啟伺服器，作答紀錄、`sequence`、搶答成功組別不變，重啟後下一筆送出的 `sequence` 接續編號（SC-010）

### Implementation for User Story 3

- [X] T063 [US3] 在 `AuthService` 新增 `joinAsStudent(groupId, session)`：狀態為 `NOT_IMPORTED` 時 `NO_ACTIVE_ACTIVITY`，`groupId` 不在 1～groupCount 時 `INVALID_GROUP`，簽發含 `groupId` 與目前 `activityId` 的 token；在 `apps/server/src/transport/http/routes/authRoutes.ts` 新增 `POST /api/auth/student`
- [X] T064 [P] [US3] 在 `apps/server/src/domain/submission/validateAnswers.ts` 實作 `data-model.md`「送出規則」第 3、4 條：`answers` 必須恰好涵蓋該題所有 `Blank.index`、每個 index 一次，否則 `ANSWER_INCOMPLETE`；每個答案「去除前後空白後 1～200 字（以 Unicode 字元計）」，否則 `ANSWER_INVALID` 並在 `details` 標出 `blankIndex`；回傳 trim 後的答案。測試 `apps/server/tests/unit/validateAnswers.test.ts`
- [X] T065 [US3] 在 `apps/server/src/domain/submission/submissionService.ts` 實作 `submit(identity, request)`，於 `QuizSessionService` 的 mutex 內依序檢查「送出規則」1～5（`SESSION_NOT_OPEN`、`QUESTION_NOT_FOUND`、`ANSWER_INCOMPLETE`／`ANSWER_INVALID`、`ALREADY_SUBMITTED`），`groupId` 一律取自 token；通過後 `sequence = nextSequence++`、`receivedAt = now()`、保存成功才回覆並觸發 `submission` 變更（含 groupId）；記錄 `submission.accepted`（題號、組別、sequence）與 `submission.rejected`（錯誤代碼）；以註解說明順位只依伺服器處理順序、不採用客戶端時間
- [X] T066 [US3] 新增 `apps/server/src/transport/http/routes/submissionRoutes.ts`：`POST /api/submissions`（`requireStudent`，body 為 `SubmitRequest` strict schema，回 `{ submissionId, receivedAt }`，**不含順位**）；確認 `RealtimeGateway` 對 `submission` 變更只推播給 `teachers` 與送出的那一組，讓 T059～T062 通過
- [X] T067 [P] [US3] 在 `apps/web/src/pages/teacher/SubmissionBoard.tsx` 實作作答狀況：每題一張卡片，列出送出紀錄（組別、各子題答案、順位），順位第一標示「搶答成功」，尚無送出顯示「尚無組別作答」；`CLOSED` 後切換為結果檢視：每題顯示搶答成功組別與答案（題組依子題分列），沒有作答顯示「無人搶答」；接入 `TeacherDashboard.tsx`。測試 `apps/web/tests/SubmissionBoard.test.tsx`
- [X] T068 [US3] 在 `scripts/simulate-students.ts` 實作模擬學生腳本（依 `quickstart.md` §4）：參數 `--base-url`（預設 `http://localhost:3000`）、`--group <n> --question <n> --answers <文字...>`、`--race --groups 1,2 --question <n> --answers <文字...>`（各組先加入取得 token，再以 `Promise.all` 同時送出）；請求與回應使用 `@crs/shared` schema；印出每組結果或錯誤代碼與訊息；不顯示 token
- [X] T069 [US3] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 老師可即時檢視作答與結果；並發、可見性、權限都有專門測試證明

---

## Phase 6: User Story 4 — 老師匯出答案至原 Guided Notes（Priority: P2）

**Goal**: 活動結束後，把每題搶答成功的答案寫回原 Google Sheets 的填空格，只改目標格，可重複匯出

**Independent Test**: 以兩份範例 fixtures 跑完整活動後匯出，`FakeGuidedNotesGateway` 記錄的寫入只包含搶答成功題目的作答格；題組保留標記；重複匯出結果相同；文件被改到無法定位時不寫入任何內容

### Tests for User Story 4

- [X] T070 [P] [US4] 測試 `apps/server/tests/unit/exportPlan.test.ts`：單題寫入純答案；題組有標記寫「（1）答案」、無標記寫純答案；已有內容直接覆寫；第二次匯出時「（1）CPU」仍辨識出標記、寫入內容不變；無人搶答的題目不產生寫入；新解析結果找不到某題號或子題數不同 → `EXPORT_LOCATE_FAILED` 並列出題號；沒有任何搶答成功 → 寫入清單為空
- [X] T071 [P] [US4] 整合測試 `apps/server/tests/integration/export.test.ts`（SC-007）：兩份範例 fixtures 各跑「匯入 → 開啟 → 兩組送出 → 結束 → 匯出」，比對 fake 文件匯出前後：只有目標作答格改變、其他所有儲存格完全相同；回應的 `writtenQuestionCount`、`writtenCellCount` 正確；再次匯出文件內容相同；匯出前在 fake 文件刪掉某題的列 → `422 EXPORT_LOCATE_FAILED` 且沒有任何寫入；非 `CLOSED` 匯出 `409 INVALID_TRANSITION`；`SHEETS_UNAVAILABLE` 時回 `502`；學生 token `403`；依 `restart.test.ts` 模式，在「已結束、已匯出」後重啟伺服器，`lastExport` 與結果不變且可再次匯出（SC-010）

### Implementation for User Story 4

- [X] T072 [US4] 在 `apps/server/src/domain/export/exportPlan.ts` 實作純函式 `planExport(session, results, freshParse)`：依 `contracts/guided-notes-format.md` §7 以題號對應新解析結果、檢查子題數，計算每個作答格寫入文字（單題＝答案；題組子題該格目前有標記＝標記原文＋答案、沒有標記＝答案），無法定位的題目收集後拋 `EXPORT_LOCATE_FAILED`（`details` 列出題號）；讓 T070 通過
- [X] T073 [US4] 在 `apps/server/src/domain/export/resultExporter.ts` 定義 `ResultExporter` 介面（`export(session, results): Promise<ExportReport>`），在 `guidedNotesExporter.ts` 實作：`gateway.read` → `parseGuidedNotes`（重新選擇工作表並定位）→ `planExport` → 全部可定位才呼叫一次 `gateway.writeCells`；回傳 `writtenQuestionCount`、`writtenCellCount`
- [X] T074 [US4] 在 `apps/server/src/infrastructure/sheets/googleSheetsGateway.ts` 實作 `writeCells(ref, writes)`：以一次 `spreadsheets.values.batchUpdate` 寫入，`valueInputOption: "RAW"`（答案以純文字寫入，不會被當成公式），範圍使用 A1 表示法並以單引號包住工作表名稱（名稱內的單引號需跳脫）；錯誤轉成 `SHEETS_UNAVAILABLE`
- [X] T075 [US4] 在 `QuizSessionService` 實作 `export()`：狀態必須為 `CLOSED`（否則 `INVALID_TRANSITION`）→ `deriveResults` → `ResultExporter.export` → 成功後在 mutex 內保存 `lastExport = { exportedAt, writtenQuestionCount }` 並觸發 `export` 變更；記錄 `export.succeeded`（題數、格數）／`export.failed`（錯誤代碼）；在 `sessionRoutes.ts` 新增 `POST /api/session/export`（`requireTeacher`，回 `ExportResponse`），讓 T071 通過
- [X] T076 [P] [US4] 在 `apps/web/src/pages/teacher/ExportPanel.tsx` 實作匯出：只在 `CLOSED` 啟用；成功顯示「已寫入 N 題、M 格」與時間，寫入 0 題時顯示「沒有可匯出的答案」；`EXPORT_LOCATE_FAILED` 以 `ErrorBanner` 列出題號；顯示上次匯出時間（`lastExport`）；接入 `TeacherDashboard.tsx`。測試 `apps/web/tests/ExportPanel.test.tsx`
- [X] T077 [US4] 品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果

**Checkpoint**: 四個 user story 都可獨立運作，完整流程「匯入 → 開啟 → 檢視 → 結束 → 匯出」可展示

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 文件、圖表一致性驗證、人工驗證與最終品質關卡

- [X] T078 [P] 建立根目錄 `README.md`（繁體中文）：系統簡介、**單一啟動指令 `npm start`** 與網址 `http://localhost:3000/teacher`、環境需求（Node 26）、設定步驟連到 `specs/001-teacher-quiz-session/quickstart.md`、Guided Notes 準備規則連到 `contracts/guided-notes-format.md`、測試指令、專案結構、子功能清單（001 已完成、002 學生端待實作）
- [X] T079 [P] 機敏資料檢查：確認 `git ls-files` 不含 `.env`、金鑰或 `data/`；以 `git grep -nE "BEGIN PRIVATE KEY|private_key|TEACHER_PASSWORD=.+|SESSION_SECRET=.+"` 確認沒有真實值（`.env.example` 的空值除外）；確認 log 中不會出現 token 與密碼（以 T031 的整合測試擷取 log 輸出檢查）；回報結果
- [X] T080 圖表一致性驗證（原則 VI）：依 `plan.md`「圖表對應」表逐一核對 `diagrams/001-teacher-quiz-session-component.puml`、`-class.puml`、`-sequence.puml` 中的元件、類別、欄位、方法與互動順序是否都存在於原始碼且名稱一致；結果寫入 `specs/001-teacher-quiz-session/diagram-verification.md`（每列：圖表元素、原始碼位置、是否一致、說明）；若實作必須偏離圖表，**先更新 `.puml` 並執行 `plantuml "./diagrams/*.puml"` 重新產生 PNG**，再調整程式碼
- [X] T081 執行 `npm start` 冒煙測試：伺服器啟動、`http://localhost:3000/teacher` 可開啟、`GET /api/session` 回 `PublicView`；並以缺少 `TEACHER_PASSWORD` 的環境啟動，確認伺服器拒絕啟動且訊息只列出變數名稱
- [ ] T082 依 `quickstart.md` §4 人工驗證清單（老師分頁 A、B ＋ 模擬第 1、2 組）以真實 Google Sheets 副本（單題範例、題組範例各一次）逐步執行 20 個步驟，結果記錄於 `specs/001-teacher-quiz-session/checklists/manual-verification.md`（每步：結果、截圖檔名或備註、執行者、日期）；學生端以 `npm run simulate` 模擬執行，並在紀錄中註明；此任務需組員親自執行
- [X] T083 最終品質關卡：`npm run typecheck`、`npm run lint`、`npm test` 全部通過，回報指令與結果；確認 tasks.md 所有任務已勾選，必要時執行 `/speckit-converge`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：無前置，立即開始
- **Phase 2 Foundational**：依賴 Phase 1；**阻擋所有 user story**
- **Phase 3 US1（匯入）**：依賴 Phase 2
- **Phase 4 US2（開啟／結束）**：依賴 Phase 2；測試需要已匯入的題目，使用 US1 的 `importQuestions`（或測試中直接以 `InMemorySessionRepository` 放入 `READY` 狀態的資料），因此建議在 US1 之後進行
- **Phase 5 US3（檢視）**：依賴 US2（需要 `OPEN`／`CLOSED` 狀態）
- **Phase 6 US4（匯出）**：依賴 US3（需要搶答結果），以及 US1 的解析器（匯出時重新定位）
- **Phase 7 Polish**：依賴所有 user story

### User Story Dependencies

```text
Setup → Foundational → US1 匯入 → US2 開啟／結束 → US3 檢視 → US4 匯出 → Polish
```

各 story 的邏輯雖然相依，但每個 story 完成時都能獨立展示並有自己的測試：US1 可單獨示範匯入；US2 示範狀態同步；
US3 以模擬腳本示範作答與可見性；US4 示範寫回 Google Sheets。

### Within Each User Story

- 測試任務先寫（預期失敗），再實作讓測試通過
- 共用契約 → 領域純函式 → 服務 → HTTP／即時傳輸 → 前端畫面
- 每個 Phase 最後一個任務是品質關卡，未通過不得進入下一個 Phase（原則 VII）

### Parallel Opportunities

- Phase 1：T003～T006 可平行
- Phase 2：T009～T013（shared 各檔案）可平行；T015～T020、T022、T023、T025 可平行；T032、T033、T035 可平行
- US1：T038、T039 可平行；T040～T042、T044 可平行；T048、T049 可平行
- US2：T052、T053 可平行；T056 可與後端任務平行
- US3：T059～T062 可平行；T064、T067 可平行
- US4：T070、T071 可平行；T076 可與後端任務平行
- Polish：T078、T079 可平行

---

## Parallel Example: User Story 1

```bash
# 先平行建立測試基礎：
Task: "T038 依兩份課程範例與錯誤變體建立 fixtures"
Task: "T039 撰寫 guidedNotesParser 測試"

# 再平行實作解析的小模組：
Task: "T040 questionNumber.ts"
Task: "T041 grid.ts"
Task: "T042 markers.ts"
Task: "T044 spreadsheetUrl.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T059 concurrency.test.ts"
Task: "T060 visibility.test.ts"
Task: "T061 permissions.test.ts"
Task: "T062 submissions.test.ts"
```

---

## Implementation Strategy

### MVP First（User Story 1）

1. 完成 Phase 1 Setup 與 Phase 2 Foundational
2. 完成 Phase 3 US1：老師登入並匯入兩份範例，看到正確題號清單
3. **停下來驗證**：品質關卡通過，並以真實 Google Sheets 副本人工匯入一次
4. 可先展示「匯入」

### Incremental Delivery

1. Setup + Foundational → 老師登入與即時狀態
2. ＋US1 → 匯入（MVP）
3. ＋US2 → 開啟／結束與多分頁同步
4. ＋US3 → 作答狀況與結果（以模擬腳本扮演兩組學生）
5. ＋US4 → 匯出回 Google Sheets，完整活動流程可錄製 Demo
6. Polish → README、圖表一致性驗證、人工驗證、最終品質關卡

### 本組（2 人）分工建議

- 完成 Foundational 後，一人負責後端（domain、transport），一人負責前端畫面與 fixtures／測試資料
- 每個 Phase 的品質關卡兩人一起確認，並人工審閱 AI 產生的程式碼

---

## Notes

- [P] 任務 = 不同檔案、沒有未完成的相依
- [Story] 標籤對應 spec.md 的 user story，方便追蹤
- 每完成一個任務或一組相關任務就 commit
- 實作若需偏離 plan、contracts 或圖表：需求改變 → 先改 spec 與圖表；只是程式寫錯 → 直接修程式（constitution 開發流程）
- 避免：模糊任務、多個任務同時修改同一檔案、破壞 story 獨立性的跨 story 相依
