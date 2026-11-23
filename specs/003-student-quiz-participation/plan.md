# Implementation Plan: 學生端搶答作答與結果檢視

**Branch**: `003-student-quiz-participation` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-student-quiz-participation/spec.md`

## Summary

在 001 已完成的學生 API（加入組別、送出答案、依角色過濾資料、分組推播）之上，做出學生端畫面 `/student`：
選組加入、即時同步活動階段、一次列出所有題目作答並以組別送出、結束後檢視每題結果與本組成績。

技術做法（詳見 [research.md](./research.md)）：

- 伺服器只有一處改動：`QuestionSummary` 新增 `blankLabels`（子題標記原文），讓學生端顯示「（1）」「（2）」
  （R5）；判定規則、API、事件、保存格式都不變。
- 學生身分沿用 001 的分頁 `sessionStorage` token，另存加入回應中的 `identity`；老師身分的分頁打開學生端時，
  依伺服器送來的檢視類型顯示提示（R2、R3）。
- 草稿存在分頁的 `sessionStorage`，以活動、組別、題號為鍵（R6）；送出前以 shared 的 `unicodeLength` 與
  `ANSWER_MAX_LENGTH` 檢查，與伺服器同一套規則（R8）。
- 結果與本組成績由前端純函式 `groupOutcomes` 從 `StudentView` 組合，伺服器可見性不變（R11）。
- 不新增任何相依套件。

## Technical Context

**Language/Version**: TypeScript 6.0（strict）；Node.js 26 LTS（沿用 001）

**Primary Dependencies**: 沿用 001、002（React 19、Vite 8、Tailwind CSS 4、Fastify 5、Socket.IO 4、Zod 4）；
**不新增相依套件**

**Storage**: 伺服器沿用 `data/session.json`，格式不變；學生端只用分頁的 `sessionStorage`（token、identity、草稿）

**Testing**: Vitest 5（shared／server／web 三個 project）；web 以 jsdom、`@testing-library/react`、
`@testing-library/user-event` 做元件測試，`fetch` 以既有 `mockFetch` 替身、socket 以 `vi.mock('../src/api/socket')`
替身；不連線真實伺服器或 Google

**Target Platform**: 沿用 001（本機 Node.js；桌面現代瀏覽器；同一台電腦多分頁扮演老師與各組學生）

**Project Type**: Web 應用程式（沿用 001 的 npm workspaces monorepo）

**Performance Goals**: 階段改變與同組送出在 1 秒內反映到所有學生分頁（SC-002、FR-006，沿用 001 推播）；
重新整理後 3 秒內恢復（SC-003）；每次輸入同步寫入 `sessionStorage`，不造成可感覺的延遲

**Constraints**: 學生資料不含他組作答狀況與任何敘述（FR-021、FR-022）；草稿不送往伺服器（FR-020）；
只有「待開始」可以離開組別（FR-005）；所有訊息使用繁體中文且不含內部細節（FR-027）

**Scale/Scope**: 沿用 001（單一活動、2～20 組、≤ 100 題、每組可多個分頁）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查重點 | 本計畫的做法 | 結果 |
|------|----------|--------------|------|
| I. 伺服器為唯一真實來源 | 判定與可見性由伺服器決定 | 送出、順位、是否接受都由 001 的伺服器判定；學生端前端檢查只是提早提示，伺服器仍做最終判定；`VisibilityPolicy` 不放他組資料與敘述，`blankLabels` 只含標記；老師身分以伺服器回傳的 `view.viewer` 判斷 | 通過 |
| II. 即時同步與狀態一致 | 階段即時同步、重連還原、狀態機明確 | 畫面完全依 `session:state` 的 `status` 切換，學生端不自行改變階段；重連後由伺服器完整推送；不新增狀態轉換；學生端畫面狀態列在 [data-model.md §4](./data-model.md) | 通過 |
| III. 資料驅動的外部文件處理 | 不寫死位置 | 本子功能不讀寫 Guided Notes；`blankLabels` 取自匯入時已依內容辨識的 `Blank.label` | 通過（不適用） |
| IV. 模組化與可擴充設計 | 分層、不過度設計 | 規則類邏輯（`validateDraft`、`groupOutcomes`、`AnswerDraftStore`）為不依賴畫面的模組，可單獨測試；沒有新增介面或抽象層 | 通過 |
| V. 型別安全與契約 | 契約集中、執行期驗證 | `blankLabels` 定義在 `packages/shared` 並以 schema 檢查長度；學生端回應與推播以共用 schema 驗證（沿用 `apiRequest`、`useSessionState`）；`sessionStorage` 內容讀取時以 schema 驗證；字數規則共用 `unicodeLength`、`ANSWER_MAX_LENGTH` | 通過 |
| VI. PlantUML 設計優先 | 圖表為藍圖、實作後驗證 | specify 階段已建立 `diagrams/003-student-quiz-participation-{component,class,sequence}.puml/.png`；clarify 與本 plan 的調整已先更新圖表並重新產生 PNG；下方「圖表對應」列出原始碼位置，implement 結束時逐項核對 | 通過 |
| VII. 測試與驗證 | 正常＋錯誤案例、可見性專門測試、人工驗證清單 | 每個元件與規則模組都有正常與錯誤／邊界測試；可見性（SC-004）有伺服器端專門測試；[quickstart.md](./quickstart.md) §4 有 23 步人工驗證，含兩組以上學生分頁與重跑 001 步驟 8～19 | 通過 |
| VIII. 安全與機敏資料 | 不洩漏、角色權限 | 不新增環境變數或憑證；學生端沒有老師操作入口（FR-008），伺服器沿用 001 角色檢查；錯誤訊息沿用伺服器的使用者訊息，不顯示內部細節；log 沿用 001 不記錄機敏資訊 | 通過 |
| 技術限制 | Node LTS、單一指令、lock file、lint/format、結構化 log | 不新增套件；`npm start` 不變；學生加入、送出與拒絕原因沿用 001 的結構化 log（FR-028） | 通過 |
| 開發流程 | 獨立 branch、clarify／analyze／converge | 在 `003-student-quiz-participation` branch；clarify 已完成（4 題，第二輪無新問題）；tasks 後執行 analyze | 通過 |

### 圖表對應（原則 VI：以圖表為藍圖）

| 圖表元素 | 圖表 | 原始碼位置 |
|----------|------|------------|
| StudentPage（依身分與階段切換畫面） | 組件圖、類別圖、時序圖 | `apps/web/src/pages/student/StudentPage.tsx`（由 `App.tsx` 的 `/student` 使用） |
| JoinGroupPanel | 組件圖、類別圖 | `apps/web/src/pages/student/JoinGroupPanel.tsx` |
| PhaseBanner（組別、階段、連線、離開組別） | 組件圖、類別圖 | `apps/web/src/pages/student/PhaseBanner.tsx` |
| AnswerSheet（一次列出所有題目、題號跳轉） | 組件圖、類別圖 | `apps/web/src/pages/student/AnswerSheet.tsx` |
| QuestionAnswerForm（單題／題組輸入與送出） | 組件圖、類別圖、時序圖 | `apps/web/src/pages/student/QuestionAnswerForm.tsx` |
| StudentResultBoard | 組件圖、類別圖、時序圖 | `apps/web/src/pages/student/StudentResultBoard.tsx` |
| AnswerDraftStore | 組件圖、類別圖、時序圖 | `apps/web/src/student/answerDraftStore.ts` |
| validateDraft | 類別圖、時序圖 | `apps/web/src/student/validateDraft.ts` |
| groupOutcomes、GroupOutcome、OutcomeKind | 類別圖、時序圖 | `apps/web/src/student/groupOutcomes.ts` |
| useStudentAuth（join、leave、onInvalidated） | 組件圖、類別圖、時序圖 | `apps/web/src/hooks/useStudentAuth.ts`；身分保存在 `apps/web/src/api/identity.ts` |
| useSessionState | 組件圖 | `apps/web/src/hooks/useSessionState.ts`（`onUnauthorized` 多帶失效原因，research R4） |
| Contracts（QuestionSummary.blankLabels、StudentView、OwnSubmission、ResultView、SubmitRequest） | 組件圖、類別圖 | `packages/shared/src/views.ts`、`packages/shared/src/api.ts` |
| 答案規則（ANSWER_MAX_LENGTH、unicodeLength） | 組件圖 | `packages/shared/src/domain.ts`（不改） |
| VisibilityPolicy.toStudentView | 組件圖、類別圖、時序圖 | `apps/server/src/domain/visibility/visibilityPolicy.ts`（`base()` 加 `blankLabels`） |
| HttpApi、RealtimeGateway、QuizSessionService、SubmissionService、LocalSessionRepository、TeacherClient | 組件圖（灰色）、時序圖 | 沿用 001、002，不改 |

## Project Structure

### Documentation (this feature)

```text
specs/003-student-quiz-participation/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1（含人工驗證清單）
├── contracts/           # Phase 1
│   ├── http-api.md          # 相對 001／002 的變更（只有 blankLabels）與錯誤處理
│   ├── realtime-events.md   # 學生端訂閱的事件（不新增事件）
│   └── student-ui.md        # 學生端各畫面的內容與文字
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（由 /speckit-tasks 產生）

diagrams/
├── 003-student-quiz-participation-component.puml / .png
├── 003-student-quiz-participation-class.puml / .png
└── 003-student-quiz-participation-sequence.puml / .png
```

### Source Code (repository root)

只列出本子功能新增（＋）或修改（～）的檔案：

```text
packages/shared/src/
└── views.ts                      ～ QuestionSummary.blankLabels（長度等於 blankCount）
packages/shared/tests/            ＋／～ blankLabels schema 測試

apps/server/src/
├── domain/visibility/visibilityPolicy.ts  ～ base() 與 toTeacherQuestion 產生 blankLabels
└── transport/http/routes/authRoutes.ts    ～ 學生加入成功的結構化 log（不含 token，FR-028）
apps/server/tests/
├── unit/visibilityPolicy.test.ts          ～ blankLabels、學生資料不含敘述
└── integration/visibility.test.ts         ～ 各階段學生推播與回應只含允許的欄位（SC-004）

apps/web/src/
├── App.tsx                       ～ /student 路徑；首頁學生端連結
├── api/identity.ts               ～ 學生 identity（crs.identity）的讀寫與清除
├── hooks/
│   ├── useSessionState.ts        ～ onUnauthorized 帶失效原因（NEW_ACTIVITY／EXPIRED）
│   └── useStudentAuth.ts         ＋ join、leave、onInvalidated
├── student/
│   ├── answerDraftStore.ts       ＋ sessionStorage 草稿
│   ├── validateDraft.ts          ＋ 送出前檢查
│   └── groupOutcomes.ts          ＋ 本組成績
└── pages/student/
    ├── StudentPage.tsx           ＋ 依身分與階段切換畫面
    ├── JoinGroupPanel.tsx        ＋ 等待匯入／選組
    ├── PhaseBanner.tsx           ＋ 組別、階段、連線、離開組別
    ├── AnswerSheet.tsx           ＋ 題號清單與所有題目
    ├── QuestionAnswerForm.tsx    ＋ 單題／題組作答與送出
    └── StudentResultBoard.tsx    ＋ 結果與本組成績
apps/web/tests/                   ＋ 上述模組與元件的測試；viewBuilders.ts ～ 學生檢視與 blankLabels

README.md                         ～ 子功能表加入 003、學生端網址
```

**Structure Decision**: 沿用 001 的三套件結構。學生端畫面放在 `apps/web/src/pages/student/`（對應老師端的
`pages/teacher/`）；不依賴畫面的學生端規則放在 `apps/web/src/student/`，方便單獨測試。

## Complexity Tracking

| 項目 | 為何需要 | 為何不用更簡單的做法 |
|------|----------|----------------------|
| `QuestionSummary.blankLabels`（修改共用契約） | 題組作答欄要顯示與學生手上 Guided Notes 相同的子題標記（FR-012） | 前端一律顯示「（n）」無法對應文件中不同寫法的標記；另外為學生定義題目型別會讓三種檢視不一致 |
| 另存 `crs.identity` | 草稿需要以 `activityId` 區分活動；連線前就要顯示組別 | 在 `StudentView` 加 `activityId` 需改推播契約；前端解析 token 依賴 token 內部格式 |

## 設計後檢查（Phase 1 完成後）

- **原則 I**：[data-model.md](./data-model.md) §1 列出各階段學生資料的內容；`blankLabels` 只含標記原文；
  前端驗證不取代伺服器判定（[research.md](./research.md) R8）。
- **原則 II**：[contracts/realtime-events.md](./contracts/realtime-events.md) 不新增事件，畫面狀態由推播決定
  （data-model §4）。
- **原則 V**：唯一的契約變更在 `packages/shared`；[contracts/http-api.md](./contracts/http-api.md) §2 定義範例與
  規則；`sessionStorage` 內容讀取時驗證。
- **原則 VI**：clarify 後的「一次列出所有題目」與本 plan 的「離開組別只在待開始」「草稿清除」已先反映在類別圖
  與組件圖並重新產生 PNG；所有圖表元素都對應到原始碼位置（上方「圖表對應」）。
- **原則 VII**：[quickstart.md](./quickstart.md) §3 列出自動化測試重點，§4 有 23 步人工驗證（三個學生分頁、
  兩份範例、重跑 001 步驟 8～19）。
- **原則 VIII**：沒有新增機敏設定；學生端沒有老師操作入口；錯誤訊息沿用伺服器的使用者訊息。

結論：沒有未說明的違反事項，可進入 `/speckit-tasks`。
