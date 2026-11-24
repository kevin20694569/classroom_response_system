# Implementation Plan: 學生端細修：暱稱、組別人數與題目敘述

**Branch**: `004-student-side-refinements` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-student-side-refinements/spec.md`

## Summary

在 003 的學生端流程上補上四件事：進入學生端先設定暱稱（預填隨機短英文名字）、選組畫面顯示各組人數、
作答與結果畫面顯示本組成員、搶答開始後顯示題目敘述；另外每筆送出記錄送出者暱稱，依角色與階段開放給老師、
同組與（結束後）全班，並寫入匯出的 Guided Notes。

技術做法（詳見 [research.md](./research.md)）：

- 暱稱規則放在 shared（R2）；隨機名字使用持續維護的 `@faker-js/faker`（只匯入英文語系，R1），只在 web 端使用。
- 學生加入時帶暱稱，token 內加入 `memberId` 與暱稱（R3）；伺服器新增只在記憶體的 `GroupRoster`，依 socket
  連線維護組員並保留 30 秒斷線緩衝（R4）；新增「離開組別」API，讓人數立即更新（R5）。
- 名冊改變時沿用 `session:state` 推播 `headcounts` 與本組 `members`，不新增事件（R6）。
- `StudentView` 的題目在 `OPEN`／`CLOSED` 才帶 `content`（敘述），版面與老師端共用 `QuestionContent`（R7、R8）。
- `Submission` 新增 `submitterNickname`（舊資料讀成 `null`），經由既有的可見性規則傳給各角色（R9）；
  匯出的附註行與結果欄加上送出者（R10）。

## Technical Context

**Language/Version**: TypeScript 6.0（strict）；Node.js 26 LTS（沿用 001）

**Primary Dependencies**: 沿用 001～003（React 19、Vite 8、Tailwind CSS 4、Fastify 5、Socket.IO 4、Zod 4）；
**新增** `@faker-js/faker`（只加在 `apps/web`、只匯入英文語系，research R1）

**Storage**: 伺服器沿用 `data/session.json`，`Submission` 多一個欄位（舊檔讀取相容）；組員名冊只在記憶體；
學生端以分頁 `sessionStorage` 保存暱稱（`crs.nickname`）、token、身分與草稿

**Testing**: Vitest 5（shared／server／web 三個 project）；名冊以注入的假計時器測試 30 秒緩衝；伺服器整合
測試以真實 Socket.IO 用戶端連線驗證人數、名冊與可見性；web 沿用 `fakeSocket` 與 `mockFetch`；匯出以兩份版面
不同的 Guided Notes 測試文件驗證。不連線真實 Google

**Target Platform**: 沿用 001（本機 Node.js；桌面現代瀏覽器；同一台電腦多分頁扮演老師與各組學生）

**Project Type**: Web 應用程式（沿用 npm workspaces monorepo）

**Performance Goals**: 人數與名冊在 1 秒內更新（SC-003）；關閉分頁 30 秒內移除（SC-005）；題目敘述在開啟
搶答時與階段一起推播，不額外延遲（SC-007）

**Constraints**: 「待開始」前學生與未登入分頁收不到敘述（FR-018、FR-019）；其他組成員名單不傳給學生
（FR-014）；他組送出者只在結束後出現（FR-025）；送出者取自 token（FR-023）；log 不含暱稱（FR-022）

**Scale/Scope**: 沿用 001（單一活動、2～20 組、≤ 100 題）；每組成員數不設上限，名冊以 30 人為測試基準

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查重點 | 本計畫的做法 | 結果 |
|------|----------|--------------|------|
| I. 伺服器為唯一真實來源 | 判定與可見性由伺服器決定 | 名冊、人數由伺服器依連線維護；送出者暱稱取自簽章 token，不接受請求附帶；敘述、名冊、送出者都由 `VisibilityPolicy` 依角色與階段過濾，前端不做隱藏；離開組別由伺服器檢查階段 | 通過 |
| II. 即時同步與狀態一致 | 即時推播、重連還原、狀態機 | 名冊改變沿用 `session:state` 推播；重連時伺服器依 token 重建名冊並送出完整檢視；名冊是連線狀態，不改變 001 的活動狀態機；學生端畫面新增「暱稱頁」狀態列在 [data-model.md §5](./data-model.md) | 通過 |
| III. 資料驅動的外部文件處理 | 不寫死位置、只改目標 | 「搶答送出者」欄與既有結果欄相同方式依表頭定位或新增；附註行位置不變；匯出前完整定位，失敗不寫入（沿用 002） | 通過 |
| IV. 模組化與可擴充設計 | 分層、不過度設計 | `GroupRoster` 為不依賴 Socket.IO 的領域模組（計時器注入），由傳輸層呼叫；`QuestionContent` 為共用畫面元件；沒有新增抽象介面 | 通過 |
| V. 型別安全與契約 | 契約集中、執行期驗證 | 暱稱規則、加入／離開請求、`headcounts`、`members`、`content`、`submitterNickname` 全部定義在 `packages/shared`；請求以 strict schema 驗證；`sessionStorage` 的暱稱讀取時以 schema 驗證 | 通過 |
| VI. PlantUML 設計優先 | 圖表為藍圖、實作後驗證 | specify／clarify 已建立 `diagrams/004-student-side-refinements-*`；本 plan 依設計調整（`content` 欄位、離開組別 API、已離開集合）先更新圖表並重新產生 PNG；下方「圖表對應」列出原始碼位置 | 通過 |
| VII. 測試與驗證 | 正常＋錯誤案例、可見性專門測試、兩份文件 | 每個新模組有正常與錯誤／邊界測試；可見性（SC-006、SC-008）有伺服器整合測試；匯出以兩份版面不同的測試文件驗證兩種模式；[quickstart.md](./quickstart.md) §4 有人工驗證清單 | 通過 |
| VIII. 安全與機敏資料 | 不洩漏、角色權限 | 不新增環境變數或憑證；離開 API 只限學生 token；log 不記錄暱稱與 token；錯誤訊息為繁體中文且不含內部細節 | 通過 |
| 技術限制 | Node LTS、單一指令、lock file、lint/format、結構化 log | 新增一個持續維護的 web 相依套件（`@faker-js/faker`，不採用已停止維護的 `unique-names-generator`）並更新 lock file；`npm start` 不變；新增的事件寫入結構化 log | 通過 |
| 開發流程 | 獨立 branch、clarify／analyze／converge | 在 `004-student-side-refinements` branch；clarify 已完成（三輪共 7 題，第四輪無新問題）；tasks 後執行 analyze | 通過 |

### 圖表對應（原則 VI：以圖表為藍圖）

| 圖表元素 | 圖表 | 原始碼位置 |
|----------|------|------------|
| StudentPage（暱稱 → 選組 → 作答／結果） | 組件圖、類別圖、時序圖 | `apps/web/src/pages/student/StudentPage.tsx` |
| NicknamePanel | 組件圖、類別圖、時序圖 | `apps/web/src/pages/student/NicknamePanel.tsx` |
| randomNickname | 組件圖、類別圖、時序圖 | `apps/web/src/student/randomNickname.ts` |
| NicknameStore | 組件圖、類別圖、時序圖 | `apps/web/src/student/nicknameStore.ts` |
| JoinGroupPanel（各組人數、修改暱稱） | 組件圖、類別圖 | `apps/web/src/pages/student/JoinGroupPanel.tsx` |
| GroupMemberList | 組件圖、類別圖 | `apps/web/src/pages/student/GroupMemberList.tsx` |
| PhaseBanner（暱稱、組別、階段） | 組件圖 | `apps/web/src/pages/student/PhaseBanner.tsx` |
| AnswerSheet／QuestionAnswerForm（敘述＋子題輸入、送出者） | 組件圖、類別圖 | `apps/web/src/pages/student/{AnswerSheet,QuestionAnswerForm}.tsx` |
| StudentResultBoard（敘述、送出者） | 組件圖 | `apps/web/src/pages/student/StudentResultBoard.tsx` |
| QuestionContent | 組件圖、類別圖 | `apps/web/src/components/QuestionContent.tsx`（`QuestionPreview.tsx` 改用） |
| useStudentAuth（join 帶暱稱、leave 呼叫 API） | 組件圖、類別圖 | `apps/web/src/hooks/useStudentAuth.ts` |
| TeacherClient／SubmissionBoard（送出者） | 組件圖、類別圖 | `apps/web/src/pages/teacher/SubmissionBoard.tsx` |
| Contracts（StudentJoinRequest、IdentitySummary、GroupHeadcount、GroupMember、StudentQuestionView、submitterNickname） | 組件圖、類別圖 | `packages/shared/src/{api,views,domain}.ts` |
| NicknameRules | 組件圖、類別圖 | `packages/shared/src/nickname.ts` |
| HttpApi（加入、離開） | 組件圖、時序圖 | `apps/server/src/transport/http/routes/authRoutes.ts` |
| RealtimeGateway（連線／斷線通知名冊、名冊推播） | 組件圖、時序圖 | `apps/server/src/transport/realtime/realtimeGateway.ts` |
| GroupRoster、RosterEntry | 組件圖、類別圖、時序圖 | `apps/server/src/domain/roster/groupRoster.ts` |
| VisibilityPolicy（人數、本組成員、content、送出者） | 組件圖、類別圖、時序圖 | `apps/server/src/domain/visibility/visibilityPolicy.ts` |
| SubmissionService（送出者） | 組件圖、類別圖、時序圖 | `apps/server/src/domain/submission/submissionService.ts` |
| exportPlan（附註行、送出者欄） | 組件圖、類別圖 | `apps/server/src/domain/export/exportPlan.ts`、`domain/guidedNotes/parser.ts` |
| AuthService／tokens（memberId、暱稱） | 時序圖 | `apps/server/src/auth/{authService,tokens}.ts` |
| QuizSessionService、LocalSessionRepository | 組件圖（灰色） | 沿用，不改（`reset` 變更時由 gateway 清空名冊） |

## Project Structure

### Documentation (this feature)

```text
specs/004-student-side-refinements/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1（含人工驗證清單）
├── contracts/           # Phase 1
│   ├── http-api.md          # 加入請求變更、離開 API、送出者欄位
│   ├── realtime-events.md   # 名冊推播時機（不新增事件）
│   ├── student-ui.md        # 暱稱頁、人數、成員名單、題目敘述、送出者的畫面與文字
│   └── guided-notes-export.md  # 附註行與送出者欄
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（由 /speckit-tasks 產生）

diagrams/
├── 004-student-side-refinements-component.puml / .png
├── 004-student-side-refinements-class.puml / .png
└── 004-student-side-refinements-sequence.puml / .png
```

### Source Code (repository root)

只列出本子功能新增（＋）或修改（～）的檔案：

```text
packages/shared/src/
├── nickname.ts                  ＋ NICKNAME_MAX_LENGTH、NicknameSchema（去除前後空白、1～20 字、無控制字元）
├── api.ts                       ～ StudentJoinRequest 加 nickname；IdentitySummary 學生加 memberId、nickname
├── domain.ts                    ～ Submission.submitterNickname（預設 null）
├── views.ts                     ～ GroupHeadcount、GroupMember、StudentQuestionView（content）、
│                                   PublicView／StudentView 加 headcounts、members；OwnSubmission、ResultView 加送出者
├── errors.ts                    ～ LEAVE_NOT_ALLOWED
└── index.ts                     ～ 匯出 nickname
packages/shared/tests/schemas.test.ts  ～

apps/server/src/
├── auth/tokens.ts               ～ 學生 token 加 memberId、nickname
├── auth/authService.ts          ～ joinAsStudent(groupId, nickname)；resolve 排除已離開的 memberId
├── domain/roster/groupRoster.ts ＋ 組員名冊、30 秒緩衝、已離開集合
├── domain/submission/submissionService.ts ～ 以學生身分送出，記錄送出者
├── domain/visibility/visibilityPolicy.ts  ～ headcounts、members、content、送出者
├── domain/export/exportPlan.ts  ～ 附註行與「搶答送出者」欄
├── domain/guidedNotes/parser.ts ～ 辨識「搶答送出者」表頭
├── transport/views.ts           ～ viewFor 帶入名冊與學生身分
├── transport/http/routes/authRoutes.ts       ～ 加入帶暱稱；POST /api/auth/student/leave
├── transport/http/routes/submissionRoutes.ts ～ 傳入學生身分
├── transport/realtime/realtimeGateway.ts     ～ 連線／斷線通知名冊、名冊推播、reset 清空
└── app.ts                       ～ 建立 GroupRoster 並注入
apps/server/tests/
├── unit/groupRoster.test.ts     ＋
├── unit/{authService,tokens,visibilityPolicy,exportPlan,guidedNotesParser}.test.ts ～
└── integration/{auth,roster,visibility,submissions,export,restart}.test.ts  ＋／～

apps/web/src/
├── App.tsx                      ～ 路徑與首頁連結不變（暱稱頁在 /student 內）；學生端改為延遲載入（research R1）
├── api/identity.ts              ～ 學生身分含 memberId、nickname
├── components/QuestionContent.tsx ＋ 共用題目版面
├── components/QuestionPreview.tsx ～ 改用 QuestionContent
├── hooks/useStudentAuth.ts      ～ join 帶暱稱；leave 呼叫 API
├── student/
│   ├── nicknameStore.ts         ＋
│   └── randomNickname.ts        ＋
├── pages/student/
│   ├── StudentPage.tsx          ～ 先顯示暱稱頁
│   ├── NicknamePanel.tsx        ＋
│   ├── JoinGroupPanel.tsx       ～ 人數、暱稱、修改暱稱
│   ├── GroupMemberList.tsx      ＋
│   ├── PhaseBanner.tsx          ～ 顯示暱稱
│   ├── AnswerSheet.tsx          ～ 傳遞 content
│   ├── QuestionAnswerForm.tsx   ～ QuestionContent＋子題輸入；已送出（暱稱）
│   └── StudentResultBoard.tsx   ～ 敘述與送出者
└── pages/teacher/SubmissionBoard.tsx ～ 送出者
apps/web/package.json            ～ @faker-js/faker
apps/web/tests/                  ＋／～ 上述模組與元件的測試；viewBuilders 加新欄位

scripts/simulate-students.ts     ～ 加入時帶暱稱
README.md                        ～ 子功能表加入 004
```

**Structure Decision**: 沿用三套件結構。名冊是新的伺服器領域模組，放在 `apps/server/src/domain/roster/`；
學生端不依賴畫面的規則（暱稱保存、隨機名字）放在 `apps/web/src/student/`，畫面元件放在 `pages/student/`；
老師端與學生端共用的題目版面放在 `apps/web/src/components/`。

## Complexity Tracking

| 項目 | 為何需要 | 為何不用更簡單的做法 |
|------|----------|----------------------|
| 新增相依套件 `@faker-js/faker` | 使用者要求以套件產生隨機英文名字（R1） | 自行維護名字清單需另外維護資料；`unique-names-generator` 自 2022 年起停止維護，違反 constitution |
| 伺服器記憶體中的 `GroupRoster` | 人數與名冊依連線計算並有 30 秒緩衝（FR-012） | Socket.IO room 人數無法緩衝也沒有暱稱；寫入資料檔會留下已關閉的分頁 |
| 新增 `POST /api/auth/student/leave` | 離開組別時人數要立即更新（spec 邊界情況） | 只靠斷線要等 30 秒；上行 socket 事件會破壞「Socket.IO 只負責推播」的設計 |
| `Submission.submitterNickname`（修改保存格式） | 送出者要在重啟後仍保留並寫入匯出（FR-023、FR-027） | 只放在記憶體會在重啟後遺失 |

## 設計後檢查（Phase 1 完成後）

- **原則 I**：[data-model.md](./data-model.md) §4 列出各角色、各階段收到的欄位；[contracts/http-api.md](./contracts/http-api.md)
  §3 說明送出者取自 token、離開 API 由伺服器檢查階段。
- **原則 II**：[contracts/realtime-events.md](./contracts/realtime-events.md) 不新增事件，名冊推播與重連還原規則明確。
- **原則 III**：[contracts/guided-notes-export.md](./contracts/guided-notes-export.md) 的送出者欄沿用表頭定位。
- **原則 V**：所有契約變更都在 `packages/shared`，請求 strict、`sessionStorage` 讀取時驗證。
- **原則 VI**：本 plan 調整的 `content` 欄位、離開 API、已離開集合已先更新類別圖、組件圖、時序圖並重新產生 PNG。
- **原則 VII**：[quickstart.md](./quickstart.md) §3 列出自動化測試重點，§4 為人工驗證清單。
- **原則 VIII**：不新增機敏設定；log 不含暱稱與 token。

結論：沒有未說明的違反事項，可進入 `/speckit-tasks`。
