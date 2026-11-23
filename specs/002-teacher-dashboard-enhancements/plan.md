# Implementation Plan: 老師端介面優化（題目預覽、搶答計時、提交時間提示、匯出模式）

**Branch**: `002-teacher-dashboard-enhancements` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-teacher-dashboard-enhancements/spec.md`

## Summary

在 001 的老師端上加入四項優化：題目預覽（含子題與預覽中狀態）、以百分秒持續跳動的搶答計時、作答狀況與
搶答結果的提交時間提示，以及三種匯出模式（只有答案／答案＋組別時間欄／答案＋格內附註行）。

技術做法（詳見 [research.md](./research.md)）：

- 匯入時依「題目」表頭讀取題目敘述、子題敘述與題組說明；敘述只放進老師端資料（R1、R3）。
- 預覽是老師分頁的本地畫面狀態；計時與提示由前端依伺服器時間計算，伺服器只多提供 `serverNow`（R4～R6）。
- 匯出新增 `mode` 參數；寫入改用單一 `spreadsheets.batchUpdate`（`updateCells` + `textFormatRuns`，必要時
  `appendDimension`），同時支援淡化樣式的附註行並維持全有或全無（R7～R10）。
- 不新增任何相依套件；舊的活動存檔可直接載入（R2）。

## Technical Context

**Language/Version**: TypeScript 6.0（strict）；Node.js 26 LTS（沿用 001）

**Primary Dependencies**: 沿用 001（React 19、Vite 8、Tailwind CSS 4、Fastify 5、Socket.IO 4、
`@googleapis/sheets`、Zod 4）；**不新增相依套件**

**Storage**: 沿用 001 的 `data/session.json`；`schemaVersion` 維持 1，新欄位以預設值相容舊檔（R2）

**Testing**: Vitest 5（shared／server／web 三個 project）；server 與 web project 固定 `TZ=Asia/Taipei`（R11）；
前端計時以假時鐘與假 `requestAnimationFrame` 測試；Google Sheets 仍以 `FakeGuidedNotesGateway` 取代，
批次請求內容以純函式單元測試

**Target Platform**: 沿用 001（本機 Node.js；現代瀏覽器；同一台電腦多分頁）

**Project Type**: Web 應用程式（沿用 001 的 npm workspaces monorepo）

**Performance Goals**: 計時畫面每秒更新 ≥ 30 次（`requestAnimationFrame` 約 60 次）；計時誤差 ≤ 0.5 秒（FR-012）；
計時更新只重繪計時元件本身

**Constraints**: 預覽狀態不送往伺服器；題目敘述不送往學生與公開資料；匯出以單一批次請求寫入；不修改儲存格
原有格式（框線、底色、對齊）；所有寫入值以文字寫入

**Scale/Scope**: 沿用 001（單一活動、2～20 組、≤ 100 題）；題目敘述長度不設上限（完整顯示）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查重點 | 本計畫的做法 | 結果 |
|------|----------|--------------|------|
| I. 伺服器為唯一真實來源 | 可見性與時間由伺服器決定 | 題目敘述只由 `VisibilityPolicy` 放進 TeacherView；計時與提交時間都以伺服器時間（`openedAt`、`closedAt`、`receivedAt`、`serverNow`）計算；順位仍依 `sequence`，計時與時間只供顯示 | 通過 |
| II. 即時同步與狀態一致 | 重新整理與重連後回到正確狀態 | 計時由伺服器時間推導，重新整理、另開分頁或伺服器重啟後接續；預覽刻意不同步（FR-007、FR-008，屬分頁畫面狀態而非系統狀態）；不新增狀態轉換 | 通過 |
| III. 資料驅動的外部文件處理 | 依表頭定位、先驗證再寫入、只改目標位置 | 題目欄、結果欄都依表頭文字定位；結果欄只新增在使用範圍之外；完整算好寫入計畫才寫入；單一批次全有或全無；不改儲存格格式；規則寫在 [contracts/guided-notes-format.md](./contracts/guided-notes-format.md) | 通過 |
| IV. 模組化與可擴充設計 | 領域層獨立；不過度設計 | 解析、匯出計畫、時間格式皆為領域層純函式；Google 請求轉換放在 infrastructure 的純函式；沒有新增介面或抽象層（`ResultExporter` 只多一個 `mode` 參數） | 通過 |
| V. 型別安全與契約 | 契約集中、執行期驗證 | `ExportMode`、`ExportRequest`、`TeacherQuestionView`、`TeacherResultView` 皆定義在 `packages/shared`；匯出請求以 Zod 驗證 mode | 通過 |
| VI. PlantUML 設計優先 | 圖表為藍圖、實作後驗證 | 已建立 `diagrams/002-teacher-dashboard-enhancements-{component,class,sequence}.puml/.png`，下方「圖表對應」列出原始碼位置；implement 結束時逐項核對（偏離說明見 Complexity Tracking） | 通過（附說明） |
| VII. 測試與驗證 | 正常＋錯誤案例、可見性測試、兩份版面文件、人工驗證清單 | 每項功能都有正常與邊界測試；SC-009 可見性有專門測試；匯出三種模式以兩份範例驗證；[quickstart.md](./quickstart.md) §4 提供人工驗證清單 | 通過 |
| VIII. 安全與機敏資料 | 不洩漏、權限控管 | 匯出仍限老師；mode 錯誤回 `VALIDATION_FAILED`，訊息不含內部細節；不新增環境變數或憑證；log 不記錄憑證 | 通過 |
| 技術限制 | Node LTS、單一指令、lock file、lint/format、結構化 log | 不新增套件；`npm start` 不變；匯出 log 增加 `mode` 欄位 | 通過 |
| 開發流程 | 獨立 branch、clarify／analyze／converge | 在 `002-teacher-dashboard-enhancements` branch；clarify 已完成（4 題）；tasks 後執行 analyze | 通過 |

### 圖表對應（原則 VI：以圖表為藍圖）

| 圖表元素 | 圖表 | 原始碼位置 |
|----------|------|------------|
| QuestionList、QuestionPreview、togglePreview | 組件圖、類別圖、時序圖 | `apps/web/src/components/QuestionList.tsx`、`apps/web/src/components/QuestionPreview.tsx` |
| SessionTimer | 組件圖、類別圖、時序圖 | `apps/web/src/pages/teacher/SessionTimer.tsx`（由 `SessionControls.tsx` 使用） |
| TimeHint | 組件圖、類別圖、時序圖 | `apps/web/src/components/TimeHint.tsx`（含 `computeTooltipPosition`）（由 `SubmissionBoard.tsx` 使用） |
| timeFormat（formatElapsed、formatClock） | 組件圖、類別圖 | `apps/web/src/utils/timeFormat.ts` |
| ExportPanel（模式選擇） | 組件圖、類別圖、時序圖 | `apps/web/src/pages/teacher/ExportPanel.tsx` |
| Contracts（ExportMode、ExportRequest、ExportResponse、LastExport、TeacherQuestionView、TeacherResultView、TeacherView、Question、Blank） | 組件圖、類別圖 | `packages/shared/src/{domain,api,views}.ts` |
| HttpApi（匯出 mode） | 組件圖、時序圖 | `apps/server/src/transport/http/routes/sessionRoutes.ts` |
| VisibilityPolicy | 組件圖、類別圖 | `apps/server/src/domain/visibility/visibilityPolicy.ts` |
| QuizSessionService.exportResults(mode) | 組件圖、類別圖、時序圖 | `apps/server/src/domain/session/quizSessionService.ts` |
| GuidedNotesParser（`answerSlots`，FR-025 作答區與填答格）、GuidedNotesPrompts、ParsedGuidedNotes、ResultColumns | 組件圖、類別圖、時序圖 | `apps/server/src/domain/guidedNotes/parser.ts`、`prompts.ts`、`grid.ts`（`columnSpanOf`） |
| ResultExporter、GuidedNotesExporter | 類別圖、時序圖 | `apps/server/src/domain/export/{resultExporter,guidedNotesExporter}.ts` |
| ExportPlanner、ExportPlan | 組件圖、類別圖、時序圖 | `apps/server/src/domain/export/exportPlan.ts` |
| SubmittedAtFormat | 組件圖、類別圖 | `apps/server/src/domain/export/submittedAt.ts` |
| CellWrite、GuidedNotesGateway | 組件圖、類別圖 | `apps/server/src/infrastructure/sheets/guidedNotesGateway.ts` |
| GoogleSheetsGateway、SheetsBatchRequests | 組件圖、類別圖、時序圖 | `apps/server/src/infrastructure/sheets/{googleSheetsGateway,batchRequests}.ts` |
| FakeGuidedNotesGateway | 組件圖 | `apps/server/tests/fakes/fakeGuidedNotesGateway.ts` |
| LocalSessionRepository（舊存檔相容） | 組件圖 | `apps/server/src/infrastructure/persistence/`（schema 預設值，無程式改動） |

## Project Structure

### Documentation (this feature)

```text
specs/002-teacher-dashboard-enhancements/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1（含人工驗證清單）
├── contracts/           # Phase 1（相對於 001 的變更）
│   ├── http-api.md
│   ├── realtime-events.md
│   └── guided-notes-format.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（由 /speckit-tasks 產生）

diagrams/
├── 002-teacher-dashboard-enhancements-component.puml / .png
├── 002-teacher-dashboard-enhancements-class.puml / .png
└── 002-teacher-dashboard-enhancements-sequence.puml / .png
```

### Source Code (repository root)

只列出本子功能新增（＋）或修改（～）的檔案：

```text
packages/shared/src/
├── domain.ts                    ～ Question.prompt、Blank.prompt、ExportMode、LastExport.mode、模式名稱與說明
├── views.ts                     ～ TeacherQuestionView、TeacherResultView、TeacherView.serverNow
└── api.ts                       ～ ExportRequestSchema、ExportResponse.mode

apps/server/src/
├── domain/guidedNotes/
│   ├── parser.ts                ～ 回傳 headerRowIndex、usedColumnCount、resultColumns；組合敘述
│   └── prompts.ts               ＋ 題目欄定位與敘述讀取（contracts §A）
├── domain/export/
│   ├── exportPlan.ts            ～ planExport(…, mode)：三種模式
│   ├── submittedAt.ts           ＋ formatSubmittedAt（YYYY/MM/DD HH:mm:ss.SSS）
│   ├── resultExporter.ts        ～ export(session, results, mode)
│   └── guidedNotesExporter.ts   ～ 傳遞 mode
├── domain/session/quizSessionService.ts   ～ exportResults(mode)、lastExport.mode
├── domain/visibility/visibilityPolicy.ts  ～ TeacherView 帶敘述、receivedAt、serverNow
├── infrastructure/sheets/
│   ├── guidedNotesGateway.ts    ～ CellWrite { text, mutedFrom }
│   ├── batchRequests.ts         ＋ buildBatchUpdateRequests（appendDimension＋updateCells）
│   └── googleSheetsGateway.ts   ～ 改用單一 spreadsheets.batchUpdate
└── transport/http/routes/sessionRoutes.ts ～ 以 ExportRequestSchema 驗證

apps/server/tests/
├── unit/                        ＋ prompts、exportPlan 三模式、batchRequests、submittedAt
├── integration/                 ～ export（mode）、visibility（SC-009）、restart（舊存檔）
├── fakes/fakeGuidedNotesGateway.ts        ～ 套用 text／記錄 mutedFrom、模擬補欄
└── fixtures/guided-notes/       ＋ exported-columns.json、exported-note-line.json、no-prompt-header.json

apps/web/src/
├── components/
│   ├── QuestionList.tsx         ～ 題號按鈕、aria-pressed、預覽中標示、togglePreview
│   ├── QuestionPreview.tsx      ＋ 預覽內容
│   └── TimeHint.tsx             ＋ 時間圖示與浮出小視窗（Portal）
├── utils/timeFormat.ts          ＋ formatElapsed、formatClock
├── pages/teacher/
│   ├── TeacherDashboard.tsx     ～ QuestionList 以 activityId 為 key
│   ├── SessionControls.tsx      ～ 放入 SessionTimer
│   ├── SessionTimer.tsx         ＋ requestAnimationFrame 計時
│   ├── SubmissionBoard.tsx      ～ 每筆答案後加 TimeHint
│   └── ExportPanel.tsx          ～ 匯出模式選擇、顯示模式
apps/web/tests/                  ＋／～ 對應的元件測試

vitest.config.ts                 ～ server 與 web project 設定 TZ=Asia/Taipei
README.md                        ～ 子功能表：002 為老師端優化、學生端改為下一個編號
```

**Structure Decision**: 沿用 001 的三套件結構與分層，不新增套件或目錄層級；新增的檔案都放在既有分層中
對應的位置。

## Complexity Tracking

| 項目 | 為何需要 | 為何不用更簡單的做法 |
|------|----------|----------------------|
| 圖表在 plan 階段才建立（原則 VI 要求 specify 階段） | specify 階段遺漏；已在 plan 開始、任何設計決策之前補上，仍作為本 plan 的藍圖 | 重新執行 specify 會覆蓋已釐清的 spec；補建圖表即可滿足「以圖表為藍圖」的目的 |
| 匯出寫入從 values API 改為 `spreadsheets.batchUpdate` | 附註行需要同一格不同文字樣式（`textFormatRuns`），且需要必要時補欄數；單一批次也更確實地全有或全無 | 保留 values API 再另外呼叫格式 API 需要兩次請求，中途失敗會只寫一半，違反 FR-022 |
| `TeacherView.serverNow` | 計時與「開始後」時間需以伺服器時間為準（FR-012），不能只信任瀏覽器時鐘 | 伺服器定時推播時間會產生大量無意義事件；只用瀏覽器時鐘則違反原則 I 的精神 |
| 自製 `TimeHint` 而非套件 | 需求只有一行兩個時間、需鍵盤可用且不推擠版面 | 引入浮動定位套件不符 YAGNI；原生 `title` 無法鍵盤觸發與控制樣式 |

## 設計後檢查（Phase 1 完成後）

- **原則 I**：[data-model.md](./data-model.md) §2 讓 Public／Student 檢視維持 `QuestionSummary`，敘述在型別上
  就不可能出現在學生資料；計時與提交時間全部來自伺服器時間。
- **原則 II**：[contracts/realtime-events.md](./contracts/realtime-events.md) 不新增事件；預覽與計時不推播，
  重新整理後由 `session:state` 完整恢復。
- **原則 III**：[contracts/guided-notes-format.md](./contracts/guided-notes-format.md) §A、§B 定義題目欄與結果欄
  的定位、寫入範圍與全有或全無規則；001 §1～§6 不變。
- **原則 V**：所有新契約集中在 `packages/shared`；[contracts/http-api.md](./contracts/http-api.md) 規定 mode 的
  執行期驗證。
- **原則 VI**：三張 002 圖表的元素都已對應到原始碼位置（上方「圖表對應」）。
- **原則 VII**：[quickstart.md](./quickstart.md) §3 列出自動化測試重點，§4 列出 26 步人工驗證（含重跑 001 的
  20 步）。
- **原則 VIII**：沒有新增機敏設定；錯誤回應沿用 001 的統一錯誤處理。

結論：沒有未說明的違反事項，可進入 `/speckit-tasks`。
