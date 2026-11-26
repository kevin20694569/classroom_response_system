# Implementation Plan: 老師端學生分組情況面板

**Branch**: `006-teacher-group-overview` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-teacher-group-overview/spec.md`

## Summary

老師端主畫面新增「分組情況」面板：列出每一組的標示、人數與組員暱稱，組員旁標註他替本組送出的題號（搶答成功另外醒目
標示），斷線緩衝中標「連線中斷」，已不在組內的送出者以灰色保留。視窗寬度 ≥ 1280 px 時面板固定在右側、不隨主畫面捲動、
內容多時面板內捲動；較窄時收合成右上角浮動按鈕，按下從右側展開抽屜。學生端與匯出行為不變。

技術做法（詳見 [research.md](./research.md)）：

- `Submission` 新增 `submitterMemberId`（取自 token，舊資料預設 `null`），讓標註依身分而非暱稱對應（R1）。
- 伺服器端純函式 `buildGroupOverview(session, roster, results)` 合併名冊、送出紀錄與 `deriveResults` 的搶答成功，
  只放進 `TeacherView.groupOverview`；學生與公開檢視不變（R2、R4、R5）。
- `GroupRoster` 新增 `isInGrace` 與 `disconnected`／`reconnected` 事件；`RealtimeGateway` 在所有名冊變更時推播
  老師檢視，連線狀態變更只推給老師（R3）。
- 前端 `useWideLayout`（`matchMedia` 1600 px）切換兩種版面：寬為置中主畫面＋右側固定框架（面板在框架內置中），
  窄為浮動按鈕＋抽屜（R6、R7；converge 後由 1280 px sticky 側欄調整而來）。

## Technical Context

**Language/Version**: TypeScript 6.0（strict）；Node.js 26 LTS（沿用 001）

**Primary Dependencies**: 沿用 001～005（React 19、Vite 8、Tailwind CSS 4、Fastify 5、Socket.IO 4、Zod 4、pino）；
**不新增**任何相依套件（research R9）

**Storage**: 沿用 `data/session.json`；`Submission` 多一個可為 `null` 的欄位，舊檔案直接載入（R1）。名冊與連線狀態
仍只在記憶體

**Testing**: Vitest 5（shared／server／web 三個 project）；server 單元＋真實 Socket.IO 用戶端的整合測試；web 以
Testing Library＋`vi.stubGlobal('matchMedia')` 測試版面切換。固定框架位置與實際捲動以人工驗證（jsdom 不計算版面）

**Target Platform**: 沿用 001（本機 Node.js；桌面現代瀏覽器）

**Project Type**: Web 應用程式（沿用 npm workspaces monorepo）

**Performance Goals**: 名冊或送出變動後老師端 1 秒內更新（SC-002）；最大規模 20 組 × 每組數人 × 100 題，
`buildGroupOverview` 為線性時間，遠低於 1 毫秒等級

**Constraints**: 組員名單、連線狀態、送出者身分只傳給老師（FR-016）；作答、順位、判定、兩種匯出不變（FR-018）；
log 不記錄暱稱（FR-020）

**Scale/Scope**: 沿用 001（單一活動、2～20 組、≤ 100 題）；面板以 20 組 × 每組 5 人驗證捲動（SC-003）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查重點 | 本計畫的做法 | 結果 |
|------|----------|--------------|------|
| I. 伺服器為唯一真實來源 | 判定與可見性由伺服器決定 | 分組情況、連線狀態、搶答成功都由伺服器依名冊與保存的送出紀錄計算；送出者身分取自 token、不能由請求指定；`groupOverview` 只在 `toTeacherView` 產生，學生 room 不會收到連線狀態推播 | 通過 |
| II. 即時同步與狀態一致 | 即時推播、重連還原、狀態機 | 名冊所有變更（含新增的 `disconnected`／`reconnected`）都推播老師檢視；老師分頁重連後收到完整檢視；不新增活動狀態，名冊的組員狀態轉換寫在 data-model §3 | 通過 |
| III. 資料驅動的外部文件處理 | 不寫死位置 | 不讀寫 Guided Notes；匯出不變，以既有測試證明 | 通過（不適用） |
| IV. 模組化與可擴充設計 | 分層、不過度設計 | `groupOverview` 為不依賴傳輸層的純函式；名冊只加一個查詢與兩種事件；不新增抽象層 | 通過 |
| V. 型別安全與契約 | 契約集中、執行期驗證 | 新 schema 定義在 `packages/shared/src/views.ts`，前端以既有的 `SessionViewSchema` 驗證；不變式以 `superRefine` 表達；不使用 `any` | 通過 |
| VI. PlantUML 設計優先 | 圖表為藍圖 | specify／clarify 已建立 `diagrams/006-teacher-group-overview-*`；本 plan 定案後**先更新**三張圖（`toTeacherView` 簽章、名冊事件、RealtimeGateway 推播、抽屜關閉方式）並重新產生 PNG；下方「圖表對應」列出原始碼位置 | 通過 |
| VII. 測試與驗證 | 正常＋錯誤案例、可見性專門測試、人工清單 | 每個新模組有正常與邊界測試；FR-016 可見性有單元＋整合測試（SC-005）；[quickstart.md](./quickstart.md) §4 有老師＋兩組學生的人工驗證 | 通過 |
| VIII. 安全與機敏資料 | 不洩漏、角色權限 | 不新增環境變數；新資料只給老師角色；log 以 memberId 記錄、不含暱稱 | 通過 |
| 技術限制 | Node LTS、單一指令、lock file、lint/format、結構化 log | 不新增套件、lock file 不變；`npm start` 不變；名冊既有的 `student.roster.*` log 沿用，新增 `student.roster.disconnected`／`reconnected`（只含 groupId、memberId） | 通過 |
| 開發流程 | 獨立 branch、clarify／analyze／converge | 在 `006-teacher-group-overview` branch；specify 3 題＋clarify 3 題已完成；tasks 後執行 analyze；老師端新增面板與 `TeacherView` 新欄位需告知 OpenSpec 小組 | 通過 |

**Phase 1 設計後重新檢查**：data-model、contracts、quickstart 沒有引入新的違反項目；Complexity Tracking 不需填寫。

### 圖表對應（原則 VI：以圖表為藍圖）

| 圖表元素 | 圖表 | 原始碼位置 |
|----------|------|------------|
| Contracts：GroupOverview／OverviewMember／MemberAnswerTag、TeacherView.groupOverview | 組件圖、類別圖 | `packages/shared/src/views.ts` |
| Submission.submitterMemberId | 組件圖、類別圖 | `packages/shared/src/domain.ts` |
| groupOverview（buildGroupOverview） | 組件圖、類別圖、時序圖 | `apps/server/src/domain/overview/groupOverview.ts` |
| GroupRoster（isInGrace、disconnected／reconnected） | 組件圖、類別圖、時序圖 | `apps/server/src/domain/roster/groupRoster.ts` |
| VisibilityPolicy.toTeacherView（加 roster） | 組件圖、類別圖、時序圖 | `apps/server/src/domain/visibility/visibilityPolicy.ts` |
| viewFor（傳 roster 給老師檢視） | 組件圖 | `apps/server/src/transport/views.ts` |
| RealtimeGateway（名冊變更推播老師） | 組件圖、類別圖、時序圖 | `apps/server/src/transport/realtime/realtimeGateway.ts` |
| SubmissionService（保存 memberId） | 組件圖、類別圖、時序圖 | `apps/server/src/domain/submission/submissionService.ts` |
| RankingStrategy／deriveResults（沿用） | 組件圖、時序圖 | `apps/server/src/domain/ranking/{rankingStrategy,results}.ts` |
| TeacherDashboard（兩種版面） | 組件圖、類別圖、時序圖 | `apps/web/src/pages/teacher/TeacherDashboard.tsx` |
| useWideLayout | 組件圖、類別圖 | `apps/web/src/hooks/useWideLayout.ts` |
| GroupOverviewPanel | 組件圖、類別圖、時序圖 | `apps/web/src/pages/teacher/GroupOverviewPanel.tsx` |
| GroupOverviewToggle（浮動按鈕＋抽屜） | 組件圖、類別圖、時序圖 | `apps/web/src/pages/teacher/GroupOverviewToggle.tsx` |
| MemberAnswerTags、「連線中斷」標示 | 組件圖、類別圖 | `apps/web/src/pages/teacher/MemberAnswerTags.tsx`（標示在 `GroupOverviewPanel.tsx` 內） |
| SubmissionBoard、ExportPanel、CsvExportPanel、SessionControls、useSessionState、LocalSessionRepository、StudentClient | 組件圖（灰色） | 沿用，不改 |

## Project Structure

### Documentation (this feature)

```text
specs/006-teacher-group-overview/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1（含人工驗證步驟）
├── contracts/           # Phase 1
│   ├── teacher-view.md      # TeacherView.groupOverview、Submission.submitterMemberId、不變的檢視
│   ├── realtime-events.md   # 推播時機（名冊變更推給老師、連線狀態只推老師）
│   └── teacher-ui.md        # 面板文字、寬窄版面、抽屜行為
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（由 /speckit-tasks 產生）

diagrams/
├── 006-teacher-group-overview-component.puml / .png
├── 006-teacher-group-overview-class.puml / .png
└── 006-teacher-group-overview-sequence.puml / .png
```

### Source Code (repository root)

只列出本子功能新增（＋）或修改（～）的檔案：

```text
packages/shared/src/
├── domain.ts                    ～ SubmissionSchema.submitterMemberId
└── views.ts                     ～ MemberAnswerTag／OverviewMember／GroupOverview schema、TeacherView.groupOverview
packages/shared/tests/schemas.test.ts  ～ 新 schema 與不變式、舊送出紀錄相容

apps/server/src/
├── domain/overview/groupOverview.ts          ＋ buildGroupOverview
├── domain/roster/groupRoster.ts              ～ isInGrace、disconnected／reconnected 事件、RosterReader
├── domain/visibility/visibilityPolicy.ts     ～ toTeacherView(session, strategy, roster, now)
├── domain/submission/submissionService.ts    ～ 保存 submitterMemberId
├── transport/views.ts                        ～ viewFor 傳 roster 給老師檢視
└── transport/realtime/realtimeGateway.ts     ～ 名冊變更推播老師；連線狀態只推老師；新 log
apps/server/tests/
├── unit/groupOverview.test.ts                ＋
├── unit/groupRoster.test.ts                  ～ isInGrace、新事件
├── unit/visibilityPolicy.test.ts             ～ 老師含 groupOverview；學生／公開不含
├── unit/localSessionRepository.test.ts       ～ 載入沒有 submitterMemberId 的舊檔
├── helpers/builders.ts                       ～ 送出紀錄建構器加 submitterMemberId
├── integration/roster.test.ts                ～ 老師推播、學生不收連線狀態
└── integration/submissions.test.ts           ～ 保存送出者身分

apps/web/src/
├── hooks/useWideLayout.ts                    ＋
├── pages/teacher/GroupOverviewPanel.tsx      ＋
├── pages/teacher/GroupOverviewToggle.tsx     ＋
├── pages/teacher/MemberAnswerTags.tsx        ＋
└── pages/teacher/TeacherDashboard.tsx        ～ 寬：置中主畫面＋右側固定框架；窄：主畫面（右側保留欄）＋浮動按鈕
apps/web/tests/
├── GroupOverviewPanel.test.tsx               ＋
├── TeacherDashboard.test.tsx                 ＋ 寬窄版面、抽屜開關、跨斷點
├── useWideLayout.test.tsx                    ＋
└── viewBuilders.ts                           ～ TeacherView 建構器加 groupOverview
```

**Structure Decision**: 沿用既有的 monorepo（`packages/shared`、`apps/server`、`apps/web`）。分組情況的組裝放在新的
`domain/overview/`，與名冊（`domain/roster/`）、可見性（`domain/visibility/`）分開，讓可見性政策只決定「誰拿得到」，
組裝規則另外測試。

## Complexity Tracking

Constitution Check 沒有違反項目，不需填寫。
