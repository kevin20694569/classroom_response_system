# Implementation Plan: 使用者角色與老師端搶答活動管理

**Branch**: `001-teacher-quiz-session` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-teacher-quiz-session/spec.md`

## Summary

建立本機執行的課堂搶答系統第一個子功能：老師與學生的角色模型，以及老師端「匯入 Guided Notes →
開啟搶答 → 即時檢視 → 結束 → 匯出回原 Google Sheets」的完整流程。

技術做法（依使用者指定與 [research.md](./research.md)）：

- 前端以 **TypeScript + React + Vite + Tailwind CSS** 建置老師端畫面；測試一律使用 **Vitest**。
- 後端以 **Node.js 26 LTS + TypeScript** 撰寫，HTTP 指令由 Fastify 處理，即時推播使用 Socket.IO。
- 前後端契約集中在 `packages/shared`，以 Zod 同時產生型別與執行期驗證（原則 V）。
- Guided Notes 透過 Google Sheets API 直接讀寫線上文件；辨識規則依表頭與題號動態定位，
  完全不寫死儲存格（原則 III，規則見 [contracts/guided-notes-format.md](./contracts/guided-notes-format.md)）。
- 活動狀態以本機 JSON 檔保存，每次變更先寫入成功才回覆，伺服器重啟後恢復（FR-028）。
- 學生端畫面屬於子功能 002；本子功能提供學生加入與送出答案的伺服器端契約，並附一支
  模擬學生的腳本，供老師端的人工驗證與 Demo 使用。

## Technical Context

**Language/Version**: TypeScript 6.0（strict）；Node.js 26 LTS（`.nvmrc` 固定 `26`）

**Primary Dependencies**:

- 前端：React 19、Vite 8、Tailwind CSS 4（`@tailwindcss/vite`）、socket.io-client 4
- 後端：Fastify 5、Socket.IO 4、`@googleapis/sheets` + `google-auth-library`、pino（結構化 log）
- 共用：Zod 4（schema 即契約，型別由 schema 推導）
- 工具：npm workspaces、ESLint 10 + typescript-eslint 8、Prettier 3、tsx（開發執行）、concurrently

**Storage**: 本機 JSON 檔（`data/session.json`，不納入版控），以「寫入暫存檔 → rename」原子替換

**Testing**: Vitest 5（單元、整合、前端元件）；前端搭配 @testing-library/react + jsdom；
後端整合測試使用 Fastify `inject` 與 socket.io-client 連線臨時伺服器；外部服務一律以
`FakeGuidedNotesGateway` 取代

**Target Platform**: 本機（macOS / Windows / Linux）上的 Node.js 26；現代瀏覽器（Chrome、Edge、
Safari、Firefox 最新版），同一台電腦多分頁同時操作

**Project Type**: Web 應用程式（前端 SPA + 後端 API／即時伺服器 + 共用契約套件，npm workspaces monorepo）

**Performance Goals**: 狀態變更推播到所有分頁 ≤ 1 秒（SC-003）；分頁重新整理後 ≤ 3 秒回到正確畫面
（SC-004）；100 次並發送出測試皆只產生一個搶答成功組別（SC-005）

**Constraints**: 只在本機執行、單一指令啟動；憑證與老師密碼只放在不納入版控的 `.env` 與金鑰檔；
自動化測試不連線真實 Google Sheets；分頁身分互不干擾（不使用 cookie 保存身分）

**Scale/Scope**: 單一活動；2～20 組；單份 Guided Notes 預期 ≤ 100 題；同時連線分頁數 ≤ 50

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查重點 | 本計畫的做法 | 結果 |
|------|----------|--------------|------|
| I. 伺服器為唯一真實來源 | 狀態、順位、可見性由伺服器決定 | 順位以伺服器序號 `sequence` 決定；所有送出經單一佇列（async mutex）序列化處理；`VisibilityPolicy` 依角色產生資料，學生收不到他組作答 | 通過 |
| II. 即時同步與狀態一致 | 狀態機、即時推播、重連恢復 | `QuizSession` 狀態機只允許 FR-012 列出的轉換；每次變更以 Socket.IO 推播；連線（含重連）時先推送完整狀態 | 通過 |
| III. 資料驅動的外部文件處理 | 不寫死座標、先驗證再寫入、只改目標格 | 解析規則見 `contracts/guided-notes-format.md`；匯入全部驗證通過才替換；匯出先重新定位全部目標格，再以單一批次寫入 | 通過 |
| IV. 模組化與可擴充設計 | 領域層與傳輸層、外部服務分離；只在已知擴充點建抽象 | `domain/` 不 import Fastify、Socket.IO、Google SDK；抽象層只有 `RankingStrategy`、`ResultExporter`（課程已知延伸）、`GuidedNotesGateway`、`SessionRepository`（測試與重啟恢復所需），理由見 Complexity Tracking | 通過 |
| V. 型別安全與契約 | TS strict、共用契約、執行期驗證、不用 any | `packages/shared` 以 Zod 定義 API、事件與領域模型；HTTP body、Socket 訊息、環境變數、試算表資料皆經 Zod 驗證；ESLint 開啟 `no-explicit-any` | 通過 |
| VI. PlantUML 設計優先 | 圖表為主要藍圖，實作後驗證一致 | 下方「圖表對應」把每個元件與類別對應到原始碼位置；implement 階段結束時逐項核對 | 通過 |
| VII. 測試與驗證 | 正常＋錯誤案例、並發與可見性專門測試、兩份版面測試文件、人工驗證清單 | 測試資料依兩份課程範例製作；並發順位、可見性、權限各有專門測試；`quickstart.md` 提供老師端＋兩組學生的人工驗證步驟 | 通過 |
| VIII. 安全與機敏資料 | 機敏資料不進版控、啟動時驗證設定、錯誤不洩漏內部細節、角色權限 | `.env`、金鑰檔、`data/` 列入 `.gitignore`，提供 `.env.example`；`ConfigLoader` 啟動時以 Zod 驗證，缺少就中止；統一錯誤處理只回傳使用者看得懂的訊息；`RoleGuard` 檢查每個老師操作 | 通過 |
| 技術限制 | Node LTS、單一指令啟動、多分頁身分獨立、lock file、lint/format、結構化 log | Node 26 LTS；`npm start` 一個指令啟動；身分存在 `sessionStorage`；`package-lock.json`；ESLint + Prettier；pino | 通過 |
| 開發流程 | 獨立 branch、clarify／analyze／converge 關卡、人工審閱 | 本子功能在 `001-teacher-quiz-session` branch；已完成兩輪 clarify；tasks 後將執行 analyze | 通過 |

**Phase 1 設計後重新檢查**：data-model、contracts 與 quickstart 完成後再次逐條核對，結果仍全部通過，
沒有新增未說明的抽象層或違反原則的設計（詳見本文末「設計後檢查」）。

### 圖表對應（原則 VI：以圖表為藍圖）

| 圖表元素 | 圖表 | 原始碼位置 |
|----------|------|------------|
| TeacherClient | 組件圖 | `apps/web/src/pages/teacher/` |
| StudentClient（002） | 組件圖 | 本子功能不實作；以 `scripts/simulate-students.ts` 使用相同契約模擬 |
| Contracts | 組件圖 | `packages/shared/src/` |
| HttpApi | 組件圖、時序圖 | `apps/server/src/transport/http/` |
| RealtimeGateway | 組件圖、時序圖 | `apps/server/src/transport/realtime/` |
| AuthService、TabIdentity | 組件圖、類別圖 | `apps/server/src/auth/` |
| RoleGuard | 組件圖 | `apps/server/src/auth/roleGuard.ts` |
| VisibilityPolicy | 組件圖、類別圖 | `apps/server/src/domain/visibility/` |
| QuizSessionService、QuizSession、SessionStatus | 組件圖、類別圖、時序圖 | `apps/server/src/domain/session/` |
| SubmissionService、Submission、BlankAnswer | 組件圖、類別圖、時序圖 | `apps/server/src/domain/submission/` |
| RankingStrategy、FirstSubmissionStrategy | 組件圖、類別圖 | `apps/server/src/domain/ranking/` |
| GuidedNotesParser、Question、Blank、CellLocation、SheetGrid、SpreadsheetSnapshot | 組件圖、類別圖、時序圖 | `apps/server/src/domain/guidedNotes/` |
| ResultExporter、GuidedNotesExporter | 組件圖、類別圖 | `apps/server/src/domain/export/` |
| GuidedNotesGateway、GoogleSheetsGateway、FakeGuidedNotesGateway | 組件圖、類別圖 | `apps/server/src/infrastructure/sheets/`（Fake 放 `apps/server/tests/fakes/`） |
| SessionRepository、LocalSessionRepository | 組件圖、類別圖 | `apps/server/src/infrastructure/persistence/` |
| ConfigLoader | 組件圖 | `apps/server/src/config/` |
| StructuredLogger | 組件圖 | `apps/server/src/infrastructure/logger.ts` |

## Project Structure

### Documentation (this feature)

```text
specs/001-teacher-quiz-session/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1（含人工驗證清單）
├── contracts/           # Phase 1
│   ├── http-api.md
│   ├── realtime-events.md
│   └── guided-notes-format.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（由 /speckit-tasks 產生）

diagrams/
├── 001-teacher-quiz-session-component.puml / .png
├── 001-teacher-quiz-session-class.puml / .png
└── 001-teacher-quiz-session-sequence.puml / .png
```

### Source Code (repository root)

```text
package.json                 # npm workspaces、根層 scripts（start / dev / test / lint / typecheck）
package-lock.json
tsconfig.base.json           # strict 共用設定
eslint.config.js
.prettierrc
.env.example                 # 不含真實值的範例設定
.gitignore                   # .env、*.key.json、data/、dist/、node_modules/

packages/shared/
├── src/
│   ├── domain.ts            # SessionStatus、Question、Blank、Submission 等 schema 與型別
│   ├── api.ts               # HTTP 請求／回應 schema
│   ├── events.ts            # Socket.IO 事件名稱與 payload schema
│   ├── errors.ts            # 錯誤代碼列舉
│   └── index.ts
└── tests/

apps/server/
├── src/
│   ├── main.ts              # 進入點：載入設定 → 恢復狀態 → 啟動伺服器
│   ├── app.ts               # 組裝依賴（不含業務邏輯）
│   ├── config/              # ConfigLoader（Zod 驗證環境變數）
│   ├── auth/                # AuthService、tokens（HMAC 簽章）、roleGuard
│   ├── domain/              # 不依賴網路與外部服務
│   │   ├── session/         # QuizSession 狀態機、QuizSessionService
│   │   ├── submission/      # SubmissionService、答案驗證
│   │   ├── ranking/         # RankingStrategy、FirstSubmissionStrategy
│   │   ├── guidedNotes/     # GuidedNotesParser、questionNumber、markers
│   │   ├── export/          # ResultExporter、GuidedNotesExporter
│   │   ├── visibility/      # VisibilityPolicy（產生 TeacherView / StudentView）
│   │   └── errors.ts        # DomainError（含錯誤代碼與使用者訊息）
│   ├── infrastructure/
│   │   ├── sheets/          # GuidedNotesGateway、GoogleSheetsGateway、spreadsheetUrl
│   │   ├── persistence/     # SessionRepository、LocalSessionRepository
│   │   └── logger.ts
│   └── transport/
│       ├── http/            # Fastify routes、錯誤處理、靜態檔案
│       └── realtime/        # Socket.IO 連線驗證、rooms、推播
└── tests/
    ├── unit/
    ├── integration/
    ├── fakes/               # FakeGuidedNotesGateway、InMemorySessionRepository
    └── fixtures/guided-notes/   # 依兩份課程範例與錯誤變體製作的 SheetGrid JSON

apps/web/
├── index.html
├── vite.config.ts           # React + Tailwind 外掛；dev 時 proxy /api 與 /socket.io
├── src/
│   ├── main.tsx
│   ├── App.tsx              # 依路徑切換 /teacher（001）與 /student（002 預留）
│   ├── api/                 # fetch 包裝、socket 連線、sessionStorage 身分
│   ├── hooks/               # useSessionState、useTeacherAuth
│   ├── pages/teacher/       # 登入、匯入、活動控制、作答狀況、結果、匯出
│   └── components/
└── tests/

scripts/
└── simulate-students.ts     # 以學生身分加入並送出答案（Demo／人工驗證用）
```

**Structure Decision**: 採用 npm workspaces 的三套件結構（`apps/web`、`apps/server`、
`packages/shared`）。前後端分開建置，但共用契約只有一份來源（原則 V）。`npm start` 會建置共用套件與
前端，並由後端同一個埠（預設 3000）同時提供網頁、API 與 Socket.IO，達成「單一指令啟動」；
開發時 `npm run dev` 以 concurrently 同時啟動 Vite 與後端。

## Complexity Tracking

> 下列抽象層與額外元件皆有明確理由，不視為違反原則 IV「不要過度設計」。

| 項目 | 為何需要 | 為何不用更簡單的做法 |
|------|----------|----------------------|
| `GuidedNotesGateway` 介面 | 自動化測試不得連線真實 Google Sheets（原則 VII），需可替換為 Fake | 直接呼叫 Google SDK 會讓解析與匯出邏輯無法在沒有網路與憑證時測試 |
| `SessionRepository` 介面 | 重啟恢復（FR-028）需要檔案保存；測試需要記憶體版本以避免檔案 I/O 互相干擾 | 直接在服務裡讀寫檔案會讓單元測試依賴檔案系統、無法平行執行 |
| `RankingStrategy` 介面 | 課程已知延伸功能「更公平的搶答順位機制」 | 寫死在 SubmissionService 會讓延伸時需改動核心收件流程 |
| `ResultExporter` 介面 | 課程已知延伸功能「匯出至 CSV」 | 寫死匯出到 Google Sheets 會讓新增 CSV 匯出時需改動活動服務 |
| HTTP 與 Socket.IO 兩種傳輸 | 指令需要明確的請求／回應與錯誤代碼；狀態變更需要伺服器主動推播 | 只用 HTTP 輪詢無法達成 1 秒內同步（SC-003）；只用 Socket.IO 則錯誤回應與測試較繁瑣 |
| 三個 workspace 套件 | 原則 V 要求前後端契約集中且不得重複定義 | 前後端各自定義型別會違反原則 V；單一套件則前端建置會帶入伺服器相依 |

## 設計後檢查（Phase 1 完成後）

- **原則 I**：`contracts/http-api.md` 的送出 API 不接受任何客戶端時間欄位；`realtime-events.md`
  規定學生只會加入自己組別的 room，伺服器依角色產生不同的狀態資料。
- **原則 II**：`data-model.md` 列出完整狀態轉換表與每個轉換的前置條件；Socket 連線建立時立即推送
  `session:state`。
- **原則 III**：`guided-notes-format.md` 定義表頭、題號、題組、標記與錯誤代碼，所有錯誤都帶工作表與列號。
- **原則 V**：所有契約均以 `packages/shared` 的 Zod schema 為準，文件中的型別名稱與 schema 一一對應。
- **原則 VII**：`quickstart.md` 列出自動化測試指令與老師端＋兩組學生的人工驗證清單。
- **原則 VIII**：`.env.example` 只含變數名稱與說明；token 以 HMAC 簽章、不寫入資料檔；錯誤回應只含
  錯誤代碼與使用者訊息。

結論：沒有違反 constitution 的設計，可進入 `/speckit-tasks`。
