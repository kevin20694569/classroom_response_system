---

description: "子功能 007：介面視覺與互動體驗改版 — 實作任務清單"
---

# Tasks: 介面視覺與互動體驗改版

**Input**: `specs/007-ui-ux-refresh/` 中的 spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（皆已完成）；
`diagrams/007-ui-ux-refresh-*.puml/.png` 為設計藍圖

**Tests**: constitution 原則 VII 要求每個功能都有自動化測試（正常＋邊界／錯誤案例），因此本清單包含測試任務。測試先寫、
確認失敗，再實作讓它通過。每個 Phase 結束時都有「品質關卡」：型別檢查、lint、format、測試必須全部通過，並回報執行的
指令與結果，才能進入下一個 Phase。

**Organization**: 依 user story 分組：US1（全站一致的視覺風格，P1）、US2（組別專屬識別，P1）、US3（階段一眼可辨與切換
提示，P2）、US4（送出與結果回饋，P2）、US5（等待、空白與連線狀態，P3）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、不依賴未完成的任務）
- **[Story]**: 所屬 user story（US1～US5，對應 spec.md）
- 每個任務都寫明檔案路徑；路徑依 plan.md 的結構（本子功能只動 `apps/web`）

## 共同約定（所有任務都適用）

- TypeScript `strict`、**不得使用 `any`**；共用型別一律從 `@crs/shared` 匯入。
- **不得修改** `apps/server/**`、`packages/shared/**`、`scripts/**`（FR-027、research R11）。
- **既有文字與可存取名稱不得改變**（FR-027）：按鈕文字、提示訊息、`aria-label`、`role`、`data-testid` 一律保留原字。
  新增文字只有：首頁說明「用 Guided Notes 進行分組搶答的課堂互動」「匯入題目、控制搶答」「輸入暱稱、選組作答」；
  切換提示「搶答開始！」「搶答結束」；「已重新連線」；「結果揭曉」「本題無人搶答」「關閉」（contracts/ui-visual.md、
  contracts/ui-effects.md）。
- **既有測試的處理**：以文字、role、label 查詢的斷言不得修改；檢查版面或換行 class 的斷言（`mx-auto`、`max-w-5xl`、
  `max-w-xs`、`fixed`、`flex-wrap`、`gap-1`、`break-words`、`whitespace-pre-wrap` 等）必須保留這些 class；只有
  `GroupOverviewPanel.test.tsx` 檢查 `text-slate-400` 的斷言可以改成新的「不在組內」樣式（語意不變，research R9）。
- 頁面**不得直接匯入 `lucide-react`、不得寫死色碼**：圖示一律用 `apps/web/src/ui/icons.tsx` 的 `Icon`，顏色一律用
  `apps/web/src/ui/theme.ts`（FR-006，plan Structure Decision）。所有圖示 `aria-hidden="true"`（FR-007）。
- 會動的元素一律加 `ui-anim` class，讓 `index.css` 的減少動態規則統一停用（FR-023）；需要 JS 決定是否渲染的效果
  （慶祝紙片）用 `useReducedMotion()`。
- 時間一律使用 `apps/web/src/ui/timing.ts` 的常數，不得在元件內寫死毫秒數。
- 風格為「活潑遊戲感」，老師端與學生端同一種風格：多種鮮豔顏色搭配、明顯圓角、主要按鈕明顯較大、動畫看得出來（FR-002）。
- **不得播放任何音效**，也不得新增音訊檔或 `Audio` 相關程式（FR-022）。
- web 測試資料用 `apps/web/tests/viewBuilders.ts` 的 `teacherView`、`studentView`、`publicView`；頁面整合測試沿用
  `vi.mock('../src/api/socket', ...)` 搭配 `apps/web/tests/fakeSocket.ts` 的 `FakeSocket` 觸發 `connect`、`disconnect`、
  `session:state`；減少動態效果用 `apps/web/tests/fakeMatchMedia.ts` 的 `installMatchMedia`；時間用 `vi.useFakeTimers()`。
- 實作若需偏離 plan、contracts 或 `diagrams/007-*`：先更新圖表並執行 `plantuml "./diagrams/007-*.puml"`，再改程式（原則 VI）。

---

## Phase 1: Setup

**Purpose**: 確認基準、安裝套件

- [X] T001 在 `007-ui-ux-refresh` branch 執行 `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build -w @crs/web`，確認 001～006 的基準全部通過，並記錄目前 `index-*.js`、`StudentPage-*.js` 的 gzip 大小（research 基準：120.77 kB、162.42 kB）
- [X] T002 在 `apps/web/package.json` 新增相依套件 `lucide-react`（1.x）與 `@fontsource-variable/nunito`（5.x），執行 `npm install -w @crs/web` 更新 `package-lock.json`；確認兩者授權為 ISC／OFL-1.1（research R3、R4）
- [X] T003 確認 research R2、R7 列出的 lucide 圖示在安裝的版本中都存在（Rocket、Star、Flame、Zap、Leaf、Fish、Bird、Cat、Dog、Rabbit、Sun、Moon、Cloud、Anchor、Crown、Gem、Heart、Guitar、Flower2、Snowflake；FileUp、Hourglass、Timer、Flag、CircleCheck、Trophy、Medal、WifiOff、Wifi、CircleExclamationPoint），可從 `node_modules/lucide-react` 的型別定義查；缺少的以同類圖示替換，並同步更新 `specs/007-ui-ux-refresh/research.md` 的 R2／R7 表格

**Checkpoint**: 基準綠燈、套件就緒

---

## Phase 2: Foundational（主題、圖示、按鈕、減少動態）

**Purpose**: 所有 user story 共用的視覺基礎；完成後畫面外觀尚未改變，但元件與 token 都可使用

- [X] T004 [P] 新增 `apps/web/tests/contrast.ts`：`relativeLuminance(hex)` 與 `contrastRatio(a, b)`，依 WCAG 2 相對亮度公式（sRGB 通道 ≤ 0.03928 時 ÷ 12.92，否則 ((c + 0.055) ÷ 1.055)^2.4；亮度 = 0.2126R + 0.7152G + 0.0722B；對比 = (L1 + 0.05) ÷ (L2 + 0.05)）
- [X] T005 [P] 新增 `apps/web/src/ui/theme.ts`：以 `as const` 定義 `GROUP_COLORS`（依序 `#be123c`、`#c2410c`、`#b45309`、`#4d7c0f`、`#047857`、`#0f766e`、`#0e7490`、`#1d4ed8`、`#6d28d9`、`#a21caf`）、`PHASE_COLORS`（`NOT_IMPORTED: '#475569'`、`READY: '#b45309'`、`OPEN: '#15803d'`、`CLOSED: '#4338ca'`）、`MEDAL_COLORS`（金 `#a16207`、銀 `#64748b`、銅 `#9a3412`）、白色 `ON_COLOR = '#ffffff'`；每個常數加註解說明用途（research R2、R7）
- [X] T006 [P] 新增 `apps/web/src/ui/timing.ts`：`PHASE_TOAST_MS = 1800`、`CELEBRATION_MS = 2800`、`NEW_SUBMISSION_HIGHLIGHT_MS = 900`、`RECONNECTED_NOTICE_MS = 2000`，註解對應 FR-013（≤ 2 秒）、FR-019（≤ 3 秒）、FR-030（≤ 1 秒）、FR-021（短暫）
- [X] T007 [P] 新增 `apps/web/src/ui/icons.tsx`：`GROUP_ICON_NAMES`（20 個，依 research R2 順序）、`MeaningIconName`（`notImported`、`waiting`、`open`、`closed`、`submitted`、`winner`、`medal`、`disconnected`、`reconnected`、`error`、`home.teacher`、`home.student`，對應 research R7 與首頁入口圖示）與 `Icon({ name, className?, style? })` 元件；只在此檔匯入 `lucide-react` 的具名圖示；渲染結果一律 `aria-hidden="true"`、`focusable="false"`
- [X] T008 [P] 新增 `apps/web/tests/theme.test.ts`：`GROUP_COLORS` 共 10 色且兩兩不同、每色對 `#ffffff` 的 `contrastRatio` ≥ 4.5；`PHASE_COLORS` 四色兩兩不同、對白底 ≥ 4.5；`MEDAL_COLORS` 三色對白底 ≥ 4.5；另讀取 `apps/web/src/index.css`，解析 `@theme` 中的 `--color-*: #hex` 宣告，檢查 `--color-ink`、`--color-ink-muted` 對 `--color-page` 與 `--color-card` ≥ 4.5，`#ffffff` 對 `--color-primary`、`--color-danger` ≥ 4.5，`--color-secondary-ink` 對 `--color-card` ≥ 4.5（FR-024、SC-006）；`GROUP_ICON_NAMES` 共 20 個且兩兩不同，且不包含 R7 保留的意義圖示（FR-006）
- [X] T009 [P] 新增 `apps/web/tests/useReducedMotion.test.tsx`：沒有 `window.matchMedia` 時回傳 `false`；以 `installMatchMedia(true)` 時回傳 `true`，`setMatches(false)` 後即時變為 `false`；查詢字串為 `(prefers-reduced-motion: reduce)`
- [X] T010 新增 `apps/web/src/ui/useReducedMotion.ts`：讀取 `(prefers-reduced-motion: reduce)`，訂閱 `change` 即時更新；`typeof window.matchMedia !== 'function'` 時回傳 `false`（讓 T009 通過，FR-023）
- [X] T011 [P] 新增 `apps/web/tests/Button.test.tsx`：`variant` 為 `primary`、`secondary`、`danger` 時套用不同的樣式 class；`pending` 時 `aria-busy="true"`、`disabled`、點擊不觸發 `onClick`、顯示旋轉圖示；保留傳入的 `type`、`aria-label` 與子元素文字（文字不變）
- [X] T012 新增 `apps/web/src/ui/Button.tsx`：`variant: 'primary' | 'secondary' | 'danger'`、`size?: 'md' | 'lg'`、`pending?: boolean`，其餘屬性透傳給 `<button>`；四種狀態（移上、按下、停用、處理中）都有可見差異，`focus-visible` 有明顯焦點外框（contracts/ui-visual.md §2，FR-004、FR-024；讓 T011 通過）
- [X] T013 修改 `apps/web/src/index.css`：在 `@import 'tailwindcss'` 之後以 `@theme` 定義靜態語意色（一律寫成 6 位 hex，供 T008 解析）：`--color-page`（頁面底色）、`--color-card`（卡片底色）、`--color-ink`（內文）、`--color-ink-muted`（次要文字）、`--color-primary`（主要按鈕底）、`--color-secondary-ink`（次要按鈕字與外框）、`--color-danger`（危險按鈕底），頁面與元件的文字、按鈕顏色只能用這些 token 或 `theme.ts` 的色票；另定義字型堆疊 `"Nunito Variable", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif`、卡片圓角與陰影 token、keyframes `pop-in`、`slide-in`（含背景短暫亮起）、`pulse-dot`、`confetti-fall`、`float`、`spin-slow`；`body` 背景為帶色調的淺色＋淡圖樣（純 CSS 漸層，不引用外部圖片）；新增 `@media (prefers-reduced-motion: reduce) { .ui-anim { animation: none !important; } }`（FR-001、FR-002、FR-003、FR-023）；修改 `apps/web/src/main.tsx` 匯入 `@fontsource-variable/nunito`（套件預設即 wght 可變字型）（research R4）
- [X] T014 [P] 新增 `apps/web/tests/offlineAssets.test.ts`：讀取 `apps/web/index.html` 與 `apps/web/src/index.css` 的文字內容，斷言不包含 `http://`、`https://`（FR-026）
- [X] T015 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過（既有測試不得改變預期值），回報指令與結果；`git diff --stat` 確認沒有動到 `apps/server`、`packages/shared`
  - 實作備註：typecheck、lint、format:check 通過；web 新增 4 個測試檔 15 個測試全過。全專案 `npm test` 有 1 個既有的 006 伺服器整合測試（`apps/server/tests/integration/roster.test.ts`「老師都在 1 秒內收到更新」）偶發「等待 session:state 逾時」，單獨重跑 7 次失敗 2 次；本 Phase 沒有修改 `apps/server`、`packages/shared`，判定為既有的時間敏感測試，不屬於本子功能範圍。

**Checkpoint**: 主題、圖示、按鈕、減少動態 hook 就緒

---

## Phase 3: User Story 1 - 全站一致且有層次的視覺風格 (Priority: P1) 🎯 MVP

**Goal**: 首頁、老師端、學生端都套用同一套活潑遊戲感的配色、卡片與按鈕（FR-001～FR-006）

**Independent Test**: 依序打開首頁、老師登入頁、老師主畫面、學生暱稱頁、選組頁、作答頁、結果頁，確認配色與按鈕樣式一致、
背景不是純白、首頁兩個入口都有圖示與說明（spec US1 Independent Test、quickstart §5「共用風格與首頁」）

### Tests for User Story 1

- [X] T016 [P] [US1] 新增 `apps/web/tests/HomePage.test.tsx`：顯示標題「課堂搶答系統」與說明「用 Guided Notes 進行分組搶答的課堂互動」；兩個連結的可存取名稱分別以「老師端」「學生端」開頭，`href` 為 `/teacher`、`/student`；分別含說明「匯入題目、控制搶答」「輸入暱稱、選組作答」；入口內的圖示 `aria-hidden="true"`（FR-005）

### Implementation for User Story 1

- [X] T017 [US1] 新增 `apps/web/src/pages/HomePage.tsx`（自 `apps/web/src/App.tsx` 抽出並改版：標題、說明、兩張入口卡片，各含 `Icon`（`home.teacher`／`home.student`）與用途說明），修改 `App.tsx` 改用它；路由行為不變（讓 T016 通過，contracts/ui-visual.md §1）
- [X] T018 [P] [US1] 老師端換樣式：`apps/web/src/pages/teacher/TeacherLoginPage.tsx`、`TeacherPage.tsx`、`ImportPanel.tsx`、`ExportPanel.tsx`、`CsvExportPanel.tsx` 的卡片改用主題卡片樣式，按鈕改用 `Button`（匯入、匯出為 `primary`；確認重新匯入的危險確認為 `danger`；取消為 `secondary`），文字與 `aria-label` 不變
- [X] T019 [P] [US1] 修改 `apps/web/src/pages/teacher/SessionControls.tsx`：「開始搶答」為 `primary`（`size="lg"`）、「結束搶答」為 `danger`（`size="lg"`），處理中時 `pending`；文字與既有停用條件不變
- [X] T020 [US1] 修改 `apps/web/src/pages/teacher/TeacherDashboard.tsx` 的標題列與各區塊卡片樣式：「登出」改為 `Button variant="secondary"`（contracts/ui-visual.md §2，登出不屬於危險操作）；**保留** `mx-auto`、`max-w-5xl`、`p-6`、寬版 `aside` 與框架內卡片的所有版面 class（006 測試）
- [X] T021 [P] [US1] 修改 `apps/web/src/components/QuestionList.tsx`、`QuestionPreview.tsx`、`QuestionContent.tsx`、`ErrorBanner.tsx`、`TimeHint.tsx`：套用主題字級、圓角與語意色（錯誤用 `error` 意義圖示＋紅色系）；保留 `whitespace-pre-wrap`、`break-words` 等換行 class
- [X] T022 [P] [US1] 修改 `apps/web/src/pages/student/NicknamePanel.tsx`：卡片樣式；「確認」為 `primary`、「換一個」「取消」為 `secondary`；輸入欄有 `focus-visible` 外框；文字、字數提示與錯誤訊息不變
- [X] T023 [P] [US1] 修改 `apps/web/src/pages/student/AnswerSheet.tsx` 與 `QuestionAnswerForm.tsx` 的卡片與按鈕樣式：「送出」改用 `Button variant="primary"`，`submitting` 時傳入 `pending`（文字仍為「送出中…」）；保留 `whitespace-pre-wrap` 等 class；「修改暱稱」（`JoinGroupPanel.tsx`）改為 `Button variant="secondary"`
- [X] T024 [US1] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過（既有文字與 role 查詢未修改），回報指令與結果；在瀏覽器（使用者開發伺服器以外的埠，見 quickstart §2）看一次首頁與老師、學生各畫面
  - 實作備註：typecheck、lint、format:check 通過，web 37 個測試檔全過。另以種好的本機活動資料（測試建構器產生、暫存資料夾、3901 埠、本次產生的測試密碼）啟動正式建置，在瀏覽器確認首頁、老師登入頁、老師主畫面的新樣式。為共用 class 與區塊標題另外新增 `apps/web/src/ui/styles.ts`、`apps/web/src/ui/SectionHeading.tsx`，`icons.tsx` 加入區塊用的意義圖示（questions、export、csv、submissions、login、logout、nickname、shuffle、sparkles），於 T080 圖表比對時一併記錄。

**Checkpoint**: 全站風格一致，可先展示（MVP）

---

## Phase 4: User Story 2 - 每個組別都有專屬識別 (Priority: P1)

**Goal**: 每組固定的顏色＋圖示，出現在學生端選組、頂端列、組員名單、結果，以及老師端送出列表與分組情況面板（FR-007～FR-009a）

**Independent Test**: 設定 20 組，選組畫面 20 組的顏色＋圖示都不同；加入第 3 組送出一題，學生端頂端列與老師端送出列表、
分組情況面板中第 3 組的識別一致（spec US2 Independent Test）

### Tests for User Story 2

- [X] T025 [P] [US2] 新增 `apps/web/tests/groupIdentity.test.ts`：`groupIdentity(n)` 對 1～20 回傳 `{ groupId, color, icon, name }`，「1～20 任兩組的 `(color, icon)` 不相同」；同一 n 重複呼叫結果相同；`color === GROUP_COLORS[(n − 1) % 10]`、`icon === GROUP_ICON_NAMES[n − 1]`、`name === groupName(n)`（data-model §1，FR-007、FR-008、SC-003）
- [X] T026 [P] [US2] 新增 `apps/web/tests/GroupBadge.test.tsx`：顯示「第 N 組」文字、背景為該組顏色（inline style 或 CSS 變數）、圖示 `aria-hidden`；可存取文字只有「第 N 組」，不含圖示名稱（FR-007）
- [X] T027 [P] [US2] 修改 `apps/web/tests/JoinGroupPanel.test.tsx`：新增案例「每組按鈕的背景為各自的組別色、內含組別圖示（`aria-hidden`），按鈕的可存取名稱仍為『第 N 組』、仍顯示『已加入：N 人』」；既有斷言不變
- [X] T028 [P] [US2] 修改 `apps/web/tests/PhaseBanner.test.tsx` 與 `apps/web/tests/GroupMemberList.test.tsx`：頂端列根元素的底色為本組顏色並含本組圖示；組員名單標題列有本組 `GroupBadge`（FR-009）、卡片有本組顏色的左側邊條（FR-009a）；既有斷言不變
- [X] T029 [P] [US2] 修改 `apps/web/tests/SubmissionBoard.test.tsx` 與 `apps/web/tests/GroupOverviewPanel.test.tsx`：送出列表每筆、分組情況每組都有該組的 `GroupBadge`（以顏色與「第 N 組」文字判斷）；`GroupOverviewPanel` 原本檢查 `text-slate-400` 的斷言改為檢查新的「不在組內」樣式 class（語意不變，research R9）

### Implementation for User Story 2

- [X] T030 [US2] 新增 `apps/web/src/ui/groupIdentity.ts`：`groupIdentity(groupId: GroupId): GroupIdentity`，`color = GROUP_COLORS[(groupId − 1) % 10]`、`icon = GROUP_ICON_NAMES[groupId − 1]`、`name = groupName(groupId)`；註解說明「1～20 任兩組的 (color, icon) 不相同，因圖示兩兩不同」（讓 T025 通過）
- [X] T031 [US2] 新增 `apps/web/src/ui/GroupBadge.tsx`：組別色圓角膠囊＋白色 `Icon`＋「第 N 組」；`size?: 'sm' | 'md'`（讓 T026 通過，contracts/ui-visual.md §3）
- [X] T032 [US2] 修改 `apps/web/src/pages/student/JoinGroupPanel.tsx`：每顆組別按鈕整顆為組別色底、白字，含組別圖示、「第 N 組」與「已加入：N 人」；`aria-label={group.name}` 不變（讓 T027 通過）
- [X] T033 [US2] 修改 `apps/web/src/pages/student/PhaseBanner.tsx`：頂端列整條為本組顏色底、白字，左側本組圖示＋「第 N 組・暱稱」；「離開組別」改為 `Button variant="danger"`（文字、出現條件不變）；頁面背景不隨組別改變（讓 T028 頂端列部分通過，FR-009a）
- [X] T034 [US2] 修改 `apps/web/src/pages/student/GroupMemberList.tsx`：接收 `groupId`，標題列加本組 `GroupBadge`（FR-009），卡片左側為本組顏色邊條（FR-009a）；修改 `apps/web/src/pages/student/StudentPage.tsx` 傳入 `groupId`（讓 T028 組員部分通過）
- [X] T035 [US2] 修改 `apps/web/src/pages/student/StudentResultBoard.tsx`：每題搶答成功組別以 `GroupBadge` 顯示，本組的列有本組顏色邊條；結果文字（`本組搶答成功` 等）不變
- [X] T036 [US2] 修改 `apps/web/src/pages/teacher/SubmissionBoard.tsx`：每筆送出的組別改用 `GroupBadge`（文字「第 N 名・第 X 組・暱稱：」的順序與內容不變）；修改 `apps/web/src/pages/teacher/GroupOverviewPanel.tsx` 與 `MemberAnswerTags.tsx`：每組標題用 `GroupBadge`，「不在組內」改用主題的灰色樣式；保留 `break-words`、`flex-wrap`、`gap-1` 與 006 的版面 class（讓 T029 通過）
- [X] T037 [US2] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；在瀏覽器以 20 組確認選組畫面識別不重複
  - 實作備註：typecheck、lint、format:check 通過，web 39 個測試檔 265 個測試全過。既有 `StudentPage.test.tsx` 以 `getByText('第 2 組')` 要求畫面上只有一處組名，因此組員名單標題與學生端結果的組別識別改用圓形標記（`GroupBadge showName={false}`：顏色＋圖示，aria-hidden），組名由頂端列或同一行文字提供，已同步更新 contracts/ui-visual.md §3。`GroupOverviewPanel` 的「不在組內」由 slate-400 改為 slate-500（原本對白底只有約 2.6:1，未達 FR-024），測試斷言同步更新。瀏覽器以 20 組種子資料確認選組畫面 20 組識別不重複、頂端列為本組顏色與圖示、組員卡片有本組邊條。

**Checkpoint**: 組別識別完成，US1＋US2 可展示

---

## Phase 5: User Story 3 - 活動階段一眼可辨，切換時有提示 (Priority: P2)

**Goal**: 四個階段各有強調色與圖示；當場看到「待開始→搶答進行中」「搶答進行中→已結束」時顯示 ≤ 2 秒、不擋操作的切換提示
（FR-010～FR-014）

**Independent Test**: 老師開始搶答，兩個學生分頁都出現「搶答開始！」並在 2 秒內消失、階段標籤換色；老師結束搶答出現
「搶答結束」；重新整理學生分頁不重播（spec US3 Independent Test）

### Tests for User Story 3

- [X] T038 [P] [US3] 修改 `apps/web/tests/theme.test.ts`：`phaseStyle(status)` 對四個階段回傳的 `color` 兩兩不同、`icon` 兩兩不同，`label` 等於 `SESSION_STATUS_LABEL[status]`（data-model §2，FR-010、SC-002）
- [X] T039 [P] [US3] 新增 `apps/web/tests/StatusBadge.test.tsx`：`data-testid="status-badge"` 不變、文字為既有階段文字、含該階段的圖示（`aria-hidden`）、文字顏色為該階段強調色、白底（FR-011）
- [X] T040 [P] [US3] 新增 `apps/web/tests/usePhaseTransition.test.tsx`（以 `renderHook`）：(1) 第一份非 null 的 status 只建立 baseline，回傳 `null`；(2) READY→OPEN 回傳 `{ from: 'READY', to: 'OPEN', text: '搶答開始！' }`；(3) OPEN→CLOSED 回傳 `text: '搶答結束'`；(4) CLOSED→READY（重新匯入）回傳 `text: null`；(5) `connected` 變為 `false` 後，下一份不同的 status（如 OPEN→CLOSED）只建立 baseline、不回傳變化；(6) status 變為 `null` 後同 (5)；(7) 連續兩次變化的 `key` 遞增（data-model §3，FR-014）
- [X] T041 [P] [US3] 新增 `apps/web/tests/PhaseTransitionToast.test.tsx`（假時鐘）：收到 `text` 後顯示該文字，`role="status"`、`aria-live="polite"`、外層含 `pointer-events-none`；經過 `PHASE_TOAST_MS` 後移除（≤ 2000 ms）；提示顯示期間點擊下層按鈕仍會觸發；新的 `key` 取代舊提示且計時重新開始；`text` 為 `null` 時不顯示（FR-012、FR-013）
- [X] T042 [P] [US3] 修改 `apps/web/tests/StudentPage.test.tsx`：以 `FakeSocket` 依序推 READY、OPEN 的 `session:state` → 出現「搶答開始！」並在 `PHASE_TOAST_MS` 後消失；首次推 OPEN（模擬重新整理）不出現提示；推 OPEN 後觸發 `disconnect`、`connect`，再推 CLOSED → 直接顯示結果畫面、不出現「搶答結束」（FR-014）
- [X] T043 [P] [US3] 修改 `apps/web/tests/TeacherDashboard.test.tsx`：老師分頁看到 READY→OPEN 時出現「搶答開始！」；首次載入為 OPEN 時不出現；既有版面斷言不變

### Implementation for User Story 3

- [X] T044 [US3] 新增 `apps/web/src/ui/phaseStyle.ts`：`phaseStyle(status): PhaseStyle`，`color` 取自 `PHASE_COLORS`，`icon` 依 research R7（尚未匯入 `notImported`、待開始 `waiting`、搶答進行中 `open`、已結束 `closed`），`label` 取自 `SESSION_STATUS_LABEL`（讓 T038 通過）
- [X] T045 [US3] 修改 `apps/web/src/components/StatusBadge.tsx`：白底膠囊、階段色文字與外框、左側階段圖示；`data-testid` 與文字不變（讓 T039 通過，contracts/ui-visual.md §4）；修改 `apps/web/src/pages/student/PhaseBanner.tsx` 讓階段標籤在組別色頂端列上維持白底（FR-011）
- [X] T046 [US3] 新增 `apps/web/src/ui/usePhaseTransition.ts`：`usePhaseTransition(view: { status: SessionStatus } | null, connected: boolean): PhaseTransition | null`（實作時由 status 參數改為 view 物件，以伺服器每次推來的資料為單位判斷，見 research R6），以 `useRef` 保存 baseline 與 `needsBaseline`，規則照 data-model §3；只有 READY→OPEN、OPEN→CLOSED 有提示文字；不讀寫任何 storage（讓 T040 通過）
- [X] T047 [US3] 新增 `apps/web/src/ui/PhaseTransitionToast.tsx`：接收 `transition`，顯示 `transition.text`，`PHASE_TOAST_MS` 後自行隱藏；畫面上方中央、`fixed`、外層 `pointer-events-none`；彈出動畫加 `ui-anim`（減少動態時直接出現）（讓 T041 通過，contracts/ui-effects.md §1）
- [X] T048 [US3] 修改 `apps/web/src/pages/student/StudentPage.tsx`：以目前顯示中的 view 呼叫 `usePhaseTransition`（顯示「連線中…」或 stale 時傳 `null`），在作答與結果畫面上方掛 `PhaseTransitionToast`；結果畫面不等提示、立即切換（讓 T042 通過，FR-012）
- [X] T049 [US3] 修改 `apps/web/src/pages/teacher/TeacherDashboard.tsx`：以 `view?.status ?? null` 與 `connected` 呼叫 `usePhaseTransition`，掛 `PhaseTransitionToast`；寬窄兩種版面都要掛（讓 T043 通過）
- [X] T050 [US3] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；在瀏覽器以老師＋兩個學生分頁確認老師按下後 1 秒內兩個學生分頁都出現提示（SC-004）、2 秒內消失、提示期間可輸入、重新整理不重播
  - 實作備註：typecheck、lint、format:check 通過，web 42 個測試檔 287 個測試全過。瀏覽器（3901 埠、種子資料）以學生分頁加入第 1 組，從老師 API 開啟搶答後立即截圖：「搶答開始！」出現在畫面上方、計時已開始；2 秒後消失；重新整理後不再出現。`usePhaseTransition` 在 status 變為 null 或斷線時同時清除上一筆變化，避免切換畫面後重新掛載的提示重播。

**Checkpoint**: 階段標示與切換提示完成

---

## Phase 6: User Story 4 - 送出與結果有明顯回饋 (Priority: P2)

**Goal**: 送出中與送出成功標記、計時脈動、金銀銅名次、老師端新送出滑入、學生端慶祝紙片、老師端結果揭曉（FR-015～FR-019、
FR-028～FR-030）

**Independent Test**: 學生送出一題看到處理中與成功標記；老師端第 1～3 名有金銀銅；結束後搶到題目的組別看到紙片、老師端
出現結果揭曉（spec US4 Independent Test）

**Depends on**: US3 的 `usePhaseTransition`（T046）與 `PhaseTransitionToast`（T047）

### Tests for User Story 4

- [X] T051 [P] [US4] 修改 `apps/web/tests/QuestionAnswerForm.test.tsx`：按下「送出」後、伺服器回應前，按鈕同步顯示「送出中…」且 `aria-busy="true"`、不可再次送出（FR-015、FR-028）；送出成功後顯示送出成功圖示（`aria-hidden`）與既有文字「已送出」／「已送出（暱稱）」
- [X] T052 [P] [US4] 修改 `apps/web/tests/SessionTimer.test.tsx`：OPEN 時有脈動圓點（帶 `ui-anim`）且數字為 `PHASE_COLORS.OPEN`；CLOSED 時沒有脈動點、數字為 `PHASE_COLORS.CLOSED`；`aria-label="搶答計時"` 與計算結果不變（FR-016）
- [X] T053 [P] [US4] 修改 `apps/web/tests/SubmissionBoard.test.tsx`：某題有 4 筆送出時，第 1、2、3 名分別有金、銀、銅 `RankMedal`（以顏色與「第 N 名」判斷），第 4 名沒有；「搶答成功」標籤仍在、含獎盃圖示（FR-017）
- [X] T054 [P] [US4] 新增 `apps/web/tests/useNewSubmissionHighlight.test.tsx`（以 `renderHook`）：第一份 id 清單全部不標記；之後新增的 id 標記為新送出，同一次新增多筆全部標記；`connected` 變為 `false` 後的下一份清單全部視為已看過（data-model §5，FR-030）
- [X] T055 [P] [US4] 修改 `apps/web/tests/TeacherDashboard.test.tsx`：OPEN 中推送新增一筆送出的 `session:state` → 該列帶滑入動畫 class；重新掛載（模擬重新整理）後同一筆不帶動畫 class
- [X] T056 [P] [US4] 新增 `apps/web/tests/Celebration.test.tsx`（StudentPage 整合，假時鐘）：(1) 當場 OPEN→CLOSED 且 `results` 中本組搶到 ≥ 1 題 → `PHASE_TOAST_MS` 前沒有紙片、之後出現紙片容器（`aria-hidden="true"`、`pointer-events-none`），再過 `CELEBRATION_MS` 後移除；播放期間結果畫面的元素可被點擊；(2) 本組沒搶到 → 不出現；(3) 首次載入即為 CLOSED → 不出現；(4) 斷線重連後才收到 CLOSED → 不出現；(5) `installMatchMedia(true)`（減少動態）→ 不出現（FR-019、FR-023）
- [X] T057 [P] [US4] 修改 `apps/web/tests/StudentResultBoard.test.tsx`：每題搶答成功答案前有獎盃圖示（`aria-hidden`）；結果只使用 `results` 與 `ownSubmissions`，既有斷言不變（FR-018）
- [X] T058 [P] [US4] 新增 `apps/web/tests/ResultReveal.test.tsx`（TeacherDashboard 整合，假時鐘）：(1) 當場 OPEN→CLOSED → `PHASE_TOAST_MS` 後出現 `role="dialog"`、`aria-modal="true"`、標題「結果揭曉」，依題號列出「第 N 題」、組別 `GroupBadge`、送出者暱稱與答案（題組每個子題一行「（n）答案」）；無人送出的題目顯示「本題無人搶答」；開啟時焦點在「關閉」；(2) 按「關閉」或 Esc 後對話框消失；(3) 首次載入即為 CLOSED → 不出現；(4) 對話框開著時推送 `activityId` 不同或 status 為 READY 的 view → 自動關閉；(5) 老師端沒有紙片（FR-029）

### Implementation for User Story 4

- [X] T059 [US4] 修改 `apps/web/src/pages/student/QuestionAnswerForm.tsx`：送出成功標記加 `submitted` 意義圖示與 `pop-in` 動畫（`ui-anim`）；處理中沿用 T023 的 `pending`（讓 T051 通過，contracts/ui-effects.md §2）
- [X] T060 [P] [US4] 修改 `apps/web/src/components/SessionTimer.tsx`：OPEN 時數字為 `PHASE_COLORS.OPEN` 並加脈動圓點（`pulse-dot`、`ui-anim`、`aria-hidden`），CLOSED 時定格為 `PHASE_COLORS.CLOSED`；計時計算不變（讓 T052 通過）
- [X] T061 [P] [US4] 新增 `apps/web/src/ui/RankMedal.tsx`：`rank` 為 1、2、3 時顯示 `medal` 圖示與 `MEDAL_COLORS` 金、銀、銅，其他名次回傳 `null`（contracts/ui-effects.md §4）
- [X] T062 [P] [US4] 新增 `apps/web/src/components/AnswerLines.tsx`：自 `SubmissionBoard.tsx` 抽出 `AnswerLines`（題組每個子題一行「（n）答案」、單題一行，保留 `whitespace-pre-wrap break-words [overflow-wrap:anywhere]`），行為不變
- [X] T063 [P] [US4] 新增 `apps/web/src/ui/useNewSubmissionHighlight.ts`：`useNewSubmissionHighlight(submissions: readonly { id: string }[], connected: boolean): ReadonlySet<string>`，baseline 規則同 data-model §5（讓 T054 通過）
- [X] T064 [US4] 修改 `apps/web/src/pages/teacher/SubmissionBoard.tsx`：改用 `AnswerLines`；每列首加 `RankMedal`；「搶答成功」標籤加 `winner` 圖示；以 `useNewSubmissionHighlight` 標記新送出的 `<li>` 加 `ui-anim` 與 `slide-in` 動畫（`NEW_SUBMISSION_HIGHLIGHT_MS` 內結束）；新增選填屬性 `connected?: boolean`（預設 `true`，既有測試不需傳入），由 `TeacherDashboard.tsx` 傳入（讓 T053、T055 通過，FR-030）
- [X] T065 [P] [US4] 修改 `apps/web/src/pages/student/StudentResultBoard.tsx`：每題搶答成功答案前加 `winner` 圖示（讓 T057 通過）
- [X] T066 [US4] 新增 `apps/web/src/ui/Celebration.tsx`：`active` 為 true 時渲染約 40 片紙片（顏色輪流取自 `GROUP_COLORS`，各自不同的水平位置與延遲），外層 `fixed inset-0 pointer-events-none`、`aria-hidden="true"`，每片 `ui-anim` 套 `confetti-fall`；`useReducedMotion()` 為 true 時回傳 `null`（contracts/ui-effects.md §6）
- [X] T067 [US4] 修改 `apps/web/src/pages/student/StudentPage.tsx`：當 `usePhaseTransition` 回傳 `to === 'CLOSED'` 且 `wonCount(groupOutcomes(results, ownSubmissions, groupId)) > 0` 時，`PHASE_TOAST_MS` 後啟動 `Celebration`、`CELEBRATION_MS` 後停止；新的 transition 或卸載時清除計時器（讓 T056 通過，FR-019）
- [X] T068 [US4] 新增 `apps/web/src/pages/teacher/ResultReveal.tsx`：`role="dialog"`、`aria-modal="true"`、`aria-labelledby` 指向標題「結果揭曉」；依題號列出 `view.questions` 每題的 `GroupBadge`、`submitterNickname`、`AnswerLines`（取自 `view.results`），`winnerGroupId` 為 `null` 時顯示「本題無人搶答」；內容區可捲動；「關閉」為 `Button variant="secondary"`，開啟時取得焦點，Esc 關閉；彈出動畫加 `ui-anim`（contracts/ui-effects.md §7）
- [X] T069 [US4] 修改 `apps/web/src/pages/teacher/TeacherDashboard.tsx`：`to === 'CLOSED'` 時 `PHASE_TOAST_MS` 後開啟 `ResultReveal`；`status !== 'CLOSED'` 或 `activityId` 改變時自動關閉；新的 transition 或卸載時清除計時器（讓 T058 通過，FR-029）
- [X] T070 [US4] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；在瀏覽器確認金銀銅、新送出滑入、紙片不擋捲動、結果揭曉內容與關閉
  - 實作備註：typecheck、lint、format:check 通過，web 45 個測試檔 308 個測試全過。實作中發現原設計的漏洞：重新連線時 `connect` 事件只把 connected 改回 true，畫面上仍是斷線前的 view；若只看 status，重連後階段沒變時 baseline 建立不起來，下一次真正的變化會被吞掉。已先更新類別圖、時序圖、data-model、research R6，再把 `usePhaseTransition` 改為以 view 物件為單位、`useNewSubmissionHighlight` 改為以送出陣列為單位，並新增「重連後階段沒變，下一次變化仍會出現」的測試。瀏覽器（3901 埠）實測：學生送出後出現打勾標記與脈動計時；模擬第 2、3 組送出後老師端出現金、銀、銅；即時新送出的列帶 `animate-slide-in`；結束後老師端先出現「搶答結束」，約 2 秒後出現結果揭曉（組別、送出者、答案、本題無人搶答）；學生端結果有獎盃與本組邊條。慶祝紙片在背景分頁播放，未拍到畫面，由 `Celebration.test.tsx` 涵蓋，並列入人工驗證。

**Checkpoint**: 回饋效果完成

---

## Phase 7: User Story 5 - 等待、空白與連線狀態不再只是一行灰字 (Priority: P3)

**Goal**: 等待、空白、載入狀態有圖示與循環動態；連線中斷有醒目橫幅、恢復時短暫顯示「已重新連線」（FR-020、FR-021）

**Independent Test**: 老師尚未匯入時打開學生端、待開始時加入組別、關閉伺服器再重啟，確認各狀態都有圖示與說明、等待中有
動態、連線中斷與恢復都有提示（spec US5 Independent Test）

### Tests for User Story 5

- [ ] T071 [P] [US5] 新增 `apps/web/tests/EmptyState.test.tsx`：顯示傳入的說明文字與圖示（`aria-hidden`）；`animated` 時圖示帶 `ui-anim`；`LoadingState` 顯示「連線中…」
- [ ] T072 [P] [US5] 新增 `apps/web/tests/ConnectionBanner.test.tsx`（假時鐘）：第一次連線前與第一次連線後都不顯示任何內容；`connected` 由 true 變 false 時，有傳 `disconnectedText` 則以 `role="status"` 顯示該文字，沒傳則不顯示；再變回 true 時顯示「已重新連線」，`RECONNECTED_NOTICE_MS` 後消失；橫幅外層 `pointer-events-none`（FR-021）
- [ ] T073 [P] [US5] 修改 `apps/web/tests/PhaseBanner.test.tsx`：`connected={false}` 時「連線中斷，正在重新連線」仍在（既有斷言不變），且帶 `role="status"` 與 WifiOff 圖示（`aria-hidden`）的醒目樣式（FR-021）
- [ ] T074 [P] [US5] 修改 `apps/web/tests/JoinGroupPanel.test.tsx`、`apps/web/tests/AnswerSheet.test.tsx`、`apps/web/tests/SubmissionBoard.test.tsx`：尚未匯入、待開始、尚無送出、無人搶答的既有文字仍在，且旁邊有圖示（`aria-hidden`）；既有斷言不變（FR-020）；另修改 `apps/web/tests/StudentPage.test.tsx`：在選組畫面（public view）先 `connect` 再 `disconnect` → 出現 `role="status"` 的「連線中斷，正在重新連線」；加入組別後斷線 → 該文字只出現一次（在頂端列）（FR-021）

### Implementation for User Story 5

- [ ] T075 [US5] 新增 `apps/web/src/ui/EmptyState.tsx`：`EmptyState({ icon, message, animated? })`（插圖風格的大圖示＋說明，`animated` 時 `float` 動畫加 `ui-anim`）與 `LoadingState()`（彈跳指示＋「連線中…」）（讓 T071 通過，contracts/ui-visual.md §5）
- [ ] T076 [US5] 新增 `apps/web/src/ui/ConnectionBanner.tsx`：`ConnectionBanner({ connected, disconnectedText? })`，頂端固定、醒目、外層不攔截點擊；曾經連線後斷線且有 `disconnectedText` 時才顯示中斷文字，恢復後顯示「已重新連線」`RECONNECTED_NOTICE_MS`（讓 T072 通過）
- [ ] T077 [US5] 套用等待與空白狀態：`apps/web/src/pages/student/JoinGroupPanel.tsx`（尚未匯入：`EmptyState` + 「老師尚未匯入題目，請稍候」+ `animated`）、`apps/web/src/pages/student/AnswerSheet.tsx`（待開始：`EmptyState` + 「等待老師開啟搶答」+ `animated`）、`apps/web/src/pages/teacher/SubmissionBoard.tsx`（「開啟搶答後，這裡會即時顯示各組送出的答案。」「尚無組別作答」「無人搶答」加圖示）、`apps/web/src/pages/student/StudentResultBoard.tsx`（無人搶答加圖示）；文字不變（讓 T074 通過）
- [ ] T078 [US5] 套用載入與連線狀態：`apps/web/src/App.tsx` 與 `apps/web/src/pages/student/StudentPage.tsx` 的整頁「連線中…」改用 `LoadingState`（`StudentPage.test.tsx` 的「連線中…」查詢仍須通過）；`apps/web/src/pages/student/PhaseBanner.tsx` **保留**「連線中斷，正在重新連線」與 `role="status"`，改為紅底膠囊＋`disconnected` 圖示（讓 T073 通過）；`StudentPage.tsx` 另掛 `ConnectionBanner`：尚未加入組別（暱稱頁、選組頁）時傳 `disconnectedText="連線中斷，正在重新連線"`，加入組別後不傳（只負責「已重新連線」，中斷文字由頂端列顯示），同一時間畫面上只有一處中斷文字（FR-021）；`apps/web/src/pages/teacher/TeacherDashboard.tsx` 第一次連上前維持標題旁的「連線中…」（改用小尺寸 `LoadingState` 樣式），曾經連上後斷線改由 `ConnectionBanner`（`disconnectedText="連線中…"`）顯示，恢復時顯示「已重新連線」（contracts/ui-visual.md §5）
- [ ] T079 [US5] 品質關卡：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` 全部通過，回報指令與結果；在瀏覽器關閉再啟動伺服器，確認中斷橫幅與「已重新連線」

**Checkpoint**: 所有 user story 完成

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T080 [P] 新增 `specs/007-ui-ux-refresh/diagram-verification.md`：逐一比對 `diagrams/007-ui-ux-refresh-{component,class,sequence}.puml` 的元素與 plan.md「圖表對應」的原始碼位置（函式名稱、簽章、時間常數、觸發條件）；不一致時先改圖並重新產生 PNG，再記錄結果（原則 VI）
- [ ] T081 [P] 新增 `specs/007-ui-ux-refresh/checklists/manual-verification.md`：依 quickstart.md §5 列出老師＋兩組學生的人工驗證步驟，`- [ ]` 格式、每步「操作 → 預期結果」，不含截圖、日期、執行者欄位
- [ ] T082 [P] 更新 `README.md` 的功能說明：加入一兩句介面改版說明（組別顏色與圖示、切換提示、結果揭曉、支援減少動態效果）；不改其他段落
- [ ] T083 依 quickstart.md §4 執行 `npm run build -w @crs/web` 與外部網址檢查：沒有 500 kB 警告、`index-*.js` gzip ≤ 140 kB、`StudentPage-*.js` gzip ≤ 180 kB、Nunito latin woff2 ≤ 60 kB、`dist/index.html` 與 CSS 不含 `http://`／`https://`；在本任務下方記錄實際數字（research R10）
- [ ] T084 以瀏覽器在 375、768、1280、1920 px 檢查首頁、暱稱、選組、作答、結果、老師主畫面、結果揭曉：沒有水平捲動與重疊；20 字暱稱與長答案正常換行；以 Chrome Lighthouse 無障礙檢查（或開發者工具的對比檢查）確認上述畫面沒有對比不足的文字（SC-006）；開啟系統「減少動態效果」後沒有動畫（FR-023、FR-025、SC-007）；結果記錄在 `checklists/manual-verification.md` 的備註
- [ ] T085 依 quickstart.md §3 執行完整自動化驗證（`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build`），全部通過並回報；`git diff main --stat` 確認 `apps/server`、`packages/shared`、`scripts` 沒有變更，`package.json` 只有 `apps/web/package.json` 新增兩個套件

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → **Phase 2 Foundational**（阻擋所有 user story）→ **Phase 3 US1** → **Phase 4 US2** → **Phase 5 US3**
  → **Phase 6 US4** → **Phase 7 US5** → **Phase 8 Polish**
- US1 與 US2 都只依賴 Phase 2，可平行開發；但兩者都會修改 `JoinGroupPanel.tsx`（T023、T032）、`TeacherDashboard.tsx`、
  `SubmissionBoard.tsx`，平行時需協調合併。
- US3 只依賴 Phase 2；`PhaseBanner.tsx` 的階段標籤（T045）建立在 US2 的頂端列（T033）上。
- **US4 依賴 US3**：慶祝效果與結果揭曉使用 `usePhaseTransition`（T046）與 `PhaseTransitionToast`（T047）的時間點；
  也使用 US2 的 `GroupBadge`（T031）。
- US5 只依賴 Phase 2；T078 會修改 US3、US4 也修改的 `StudentPage.tsx`、`TeacherDashboard.tsx`，因此排在最後。

### Within Each User Story

- 測試任務先寫、確認失敗，再做實作任務讓它通過。
- 純函式與 hook（`groupIdentity`、`phaseStyle`、`usePhaseTransition`、`useNewSubmissionHighlight`）→ 元件
  （`GroupBadge`、`PhaseTransitionToast`、`RankMedal`、`Celebration`、`ResultReveal`）→ 掛到頁面。

### Parallel Opportunities

- Phase 2：T004～T009、T011、T014 全部 [P]（不同檔案）；T010 在 T009 後、T012 在 T011 後；T013 獨立但要在 T015 前完成。
- US1：T018、T019、T021、T022、T023 [P]（不同檔案）；T020 與 T017 依序。
- US2 測試：T025～T029 全部 [P]。
- US3 測試：T038～T043 全部 [P]。
- US4 測試：T051～T058 全部 [P]；實作 T060～T063、T065 [P]。
- US5 測試：T071～T074 全部 [P]。
- Polish：T080～T082 [P]。

### Parallel Example: User Story 2

```text
# 同時寫 US2 的五個測試：
Task: "T025 groupIdentity.test.ts：1～20 組 (color, icon) 兩兩不同"
Task: "T026 GroupBadge.test.tsx"
Task: "T027 JoinGroupPanel.test.tsx 組別色按鈕"
Task: "T028 PhaseBanner.test.tsx、GroupMemberList.test.tsx 本組顏色"
Task: "T029 SubmissionBoard.test.tsx、GroupOverviewPanel.test.tsx 組別徽章"
```

### Parallel Example: User Story 3

```text
Task: "T040 usePhaseTransition.test.tsx"
Task: "T041 PhaseTransitionToast.test.tsx"
Task: "T042 StudentPage.test.tsx 當場變化才有提示"
Task: "T043 TeacherDashboard.test.tsx 老師端提示"
```

### Parallel Example: User Story 4

```text
Task: "T060 SessionTimer.tsx 脈動點"
Task: "T061 RankMedal.tsx"
Task: "T062 AnswerLines.tsx 抽出"
Task: "T063 useNewSubmissionHighlight.ts"
Task: "T065 StudentResultBoard.tsx 獎盃"
```

---

## Implementation Strategy

### MVP First（只做 US1）

1. Phase 1 → Phase 2（主題、圖示、按鈕、減少動態；全專案綠燈）
2. Phase 3：首頁改版、老師端與學生端換上共用卡片與按鈕
3. **停下來驗證**：quickstart §5「共用風格與首頁」；畫面已明顯不單調，可先展示

### Incremental Delivery

1. US1 → 全站風格（MVP）
2. US2 → 組別顏色與圖示
3. US3 → 階段標示與切換提示
4. US4 → 送出回饋、名次、慶祝、結果揭曉
5. US5 → 等待、空白、連線狀態
6. Polish → 圖表驗證、人工驗證清單、README、大小與離線檢查、多寬度檢查

每個 Phase 的品質關卡通過後 commit 一次。

### 後續流程（constitution 開發流程）

- 本清單完成後先執行 `/speckit-analyze`，確認 spec、plan、tasks 之間沒有衝突或缺漏，再進入 `/speckit-implement`。
- implement 完成後執行 `/speckit-converge` 補齊遺漏，最後由組員依 `checklists/manual-verification.md` 人工驗證。
