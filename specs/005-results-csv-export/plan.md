# Implementation Plan: 搶答結果匯出 CSV

**Branch**: `005-results-csv-export` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-results-csv-export/spec.md`

## Summary

老師在搶答結束後按下「匯出 CSV」，下載「搶答結果_YYYYMMDD-HHmm.csv」，內容是所有組別的所有送出紀錄
（題組每個子題一列）與無人作答的題目，用 Excel 直接開啟不亂碼、欄位不錯位；搶答結束前不能匯出。Guided Notes 匯出不變。

技術做法（詳見 [research.md](./research.md)）：

- 依使用者指示實作既有的 `ResultExporter` 擴充點：介面加上泛型 `ResultExporter<TReport = ExportReport>`，
  新增 `CsvResultExporter implements ResultExporter<CsvExport>`；`GuidedNotesExporter` 不用改（R1）。
- `CsvResultExporter` 注入 `RankingStrategy` 取得每題完整順位，搶答成功取自 `deriveResults` 的 `winner`，
  與老師端送出列表、Guided Notes 匯出一致（R2）。
- `QuizSessionService.exportCsv()` 在 `mutate()` 鎖內讀取並回傳原 session，不保存、不推播、不改 `lastExport`；
  非 `CLOSED` 回 `INVALID_TRANSITION`「搶答結束後才能匯出 CSV。」（R3）。
- 自行實作 CSV 編碼：UTF-8 BOM、CRLF、RFC 4180 引號、`= + - @ Tab CR` 開頭加 `'`；不新增相依套件（R4）。
- 新增 `GET /api/session/export.csv`（只限老師），以 `Content-Disposition` 的 `filename*` 傳中文檔名；
  前端以 fetch＋Bearer 取得 Blob 後下載（R5）。檔名用開啟搶答時間、送出時間用 CSV 專用的 `formatCsvSubmittedAt`（R6）。

## Technical Context

**Language/Version**: TypeScript 6.0（strict）；Node.js 26 LTS（沿用 001）

**Primary Dependencies**: 沿用 001～004（React 19、Vite 8、Tailwind CSS 4、Fastify 5、Socket.IO 4、Zod 4、pino）；
**不新增**任何相依套件（research R4）

**Storage**: 沿用 `data/session.json`，格式不變；CSV 不保存在伺服器，只回傳給老師的瀏覽器下載

**Testing**: Vitest 5（shared／server／web 三個 project，server 與 web 已固定 `TZ=Asia/Taipei`）；server 單元測試
（編碼、列產生、檔名、匯出器、服務）＋ Fastify `inject` 整合測試（狀態限制、權限、header、內容、重新啟動）；web 以
`mockFetch` 測試 `CsvExportPanel`、`apiDownload` 與 `Content-Disposition` 解析。不連線真實 Google

**Target Platform**: 沿用 001（本機 Node.js；桌面現代瀏覽器）；CSV 目標軟體為 Windows 版 Excel（人工驗證）與
macOS 版 Excel（以自動化測試檢查 BOM，clarify Q3）

**Project Type**: Web 應用程式（沿用 npm workspaces monorepo）

**Performance Goals**: 按下到取得檔案 3 秒內（SC-001）；最大規模（20 組 × 100 題 × 5 子題 ≈ 10,000 列）在記憶體中
一次產生，預期遠低於 1 秒

**Constraints**: 只在 `CLOSED` 可以匯出、只限老師（FR-002、FR-003）；匯出唯讀、重複匯出逐位元組相同（FR-004、SC-006）；
log 不含答案與暱稱（FR-015）；Guided Notes 匯出行為與契約不變（FR-016）

**Scale/Scope**: 沿用 001（單一活動、2～20 組、≤ 100 題）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查重點 | 本計畫的做法 | 結果 |
|------|----------|--------------|------|
| I. 伺服器為唯一真實來源 | 判定與可見性由伺服器決定、並發有確定結果 | CSV 由伺服器依保存的送出紀錄與 `RankingStrategy` 產生；狀態限制與老師權限在伺服器檢查，前端停用按鈕只是提示；在 `mutate()` 鎖內讀取，不會與結束搶答或重新匯入交錯；學生與未登入請求收不到任何紀錄 | 通過 |
| II. 即時同步與狀態一致 | 即時推播、重連還原、狀態機 | 不新增狀態或轉換；按鈕狀態由既有的 `session:state` 推播的 `status` 決定，重新整理後依目前狀態還原；匯出不推播 | 通過 |
| III. 資料驅動的外部文件處理 | 不寫死位置、只改目標 | CSV 不讀寫 Guided Notes；Guided Notes 匯出完全不變，以既有的兩份文件測試證明 | 通過（不適用的部分沿用既有保證） |
| IV. 模組化與可擴充設計 | 分層、只在已知擴充點抽象 | 實作 constitution 點名的「匯出格式可擴充（如 CSV）」擴充點：`ResultExporter` 加泛型（預設型別讓既有實作不變），不新增其他抽象；編碼、列產生、檔名為不依賴 HTTP 的純函式模組，傳輸層只負責 header | 通過 |
| V. 型別安全與契約 | 契約集中、執行期驗證 | 路徑、訊息、表頭、「無人作答」定義在 `packages/shared/src/csvExport.ts`，前後端共用；路由沒有請求 body；前端錯誤回應以既有的 `ApiErrorBodySchema` 驗證；不使用 `any` | 通過 |
| VI. PlantUML 設計優先 | 圖表為藍圖、偏離先改圖 | specify 已建立 `diagrams/005-results-csv-export-*`；本 plan 決定實作 `ResultExporter` 與前端下載模組後，**先更新**三張圖並重新產生 PNG；下方「圖表對應」列出原始碼位置 | 通過 |
| VII. 測試與驗證 | 正常＋錯誤案例、權限專門測試、人工清單 | 每個新模組都有正常與邊界／錯誤測試；權限與狀態限制有整合測試（SC-005）；單題、題組兩種活動資料都測；[quickstart.md](./quickstart.md) §5 有老師＋兩組學生的人工驗證清單 | 通過 |
| VIII. 安全與機敏資料 | 不洩漏、角色權限 | 不新增環境變數；token 只放在 header（不放查詢字串）；錯誤訊息為繁體中文、不含內部細節；CSV 公式注入防護（FR-013）；log 不記錄答案與暱稱 | 通過 |
| 技術限制 | Node LTS、單一指令、lock file、lint/format、結構化 log | 不新增套件、lock file 不變；`npm start` 不變；新增 `csv_export.succeeded`／`csv_export.failed` 結構化 log | 通過 |
| 開發流程 | 獨立 branch、clarify／analyze／converge | 在 `005-results-csv-export` branch；clarify 已完成（specify 1 題＋clarify 4 題）；tasks 後執行 analyze；本功能新增對外行為，需告知 OpenSpec 小組 | 通過 |

**Phase 1 設計後重新檢查**：data-model、contracts、quickstart 沒有引入新的違反項目；Complexity Tracking 不需填寫。

### 圖表對應（原則 VI：以圖表為藍圖）

| 圖表元素 | 圖表 | 原始碼位置 |
|----------|------|------------|
| Contracts／csvExport 常數 | 組件圖、類別圖 | `packages/shared/src/csvExport.ts`（`index.ts` 匯出） |
| ResultExporter<TReport>（加泛型） | 組件圖、類別圖 | `apps/server/src/domain/export/resultExporter.ts` |
| GuidedNotesExporter（不變） | 組件圖、類別圖 | `apps/server/src/domain/export/guidedNotesExporter.ts` |
| CsvResultExporter、CsvExport | 組件圖、類別圖、時序圖 | `apps/server/src/domain/export/csv/csvResultExporter.ts` |
| resultRows、ResultRow | 組件圖、類別圖、時序圖 | `apps/server/src/domain/export/csv/resultRows.ts` |
| csvEncoder | 組件圖、類別圖、時序圖 | `apps/server/src/domain/export/csv/csvEncoder.ts` |
| csvFileName | 組件圖、類別圖、時序圖 | `apps/server/src/domain/export/csv/csvFileName.ts` |
| formatCsvSubmittedAt（新增；002 的 formatSubmittedAt 不變） | 類別圖 | `apps/server/src/domain/export/csv/csvSubmittedAt.ts` |
| QuizSessionService.exportCsv、csvExporter 依賴 | 組件圖、類別圖、時序圖 | `apps/server/src/domain/session/quizSessionService.ts` |
| RankingStrategy／deriveResults（沿用） | 組件圖、時序圖 | `apps/server/src/domain/ranking/{rankingStrategy,results}.ts` |
| HttpApi／sessionRoutes `GET /api/session/export.csv` | 組件圖、類別圖、時序圖 | `apps/server/src/transport/http/routes/sessionRoutes.ts` |
| roleGuard（沿用） | 組件圖、時序圖 | `apps/server/src/auth/roleGuard.ts` |
| CsvExportPanel | 組件圖、類別圖、時序圖 | `apps/web/src/pages/teacher/CsvExportPanel.tsx` |
| TeacherDashboard（掛載） | 組件圖、類別圖 | `apps/web/src/pages/teacher/TeacherDashboard.tsx` |
| apiDownload | 組件圖、類別圖 | `apps/web/src/api/http.ts` |
| fileNameFromContentDisposition | 組件圖、類別圖 | `apps/web/src/api/contentDisposition.ts` |
| saveBlob | 組件圖、類別圖 | `apps/web/src/utils/download.ts` |
| ExportPanel、SubmissionBoard、useSessionState、RealtimeGateway、LocalSessionRepository | 組件圖（灰色） | 沿用，不改 |

## Project Structure

### Documentation (this feature)

```text
specs/005-results-csv-export/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1（含人工驗證清單）
├── contracts/           # Phase 1
│   ├── http-api.md          # GET /api/session/export.csv、錯誤、共用常數
│   ├── csv-format.md        # 編碼、引號、公式防護、欄位、排序、範例、檔名
│   └── teacher-ui.md        # 老師端「匯出 CSV」區塊的文字與行為
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（由 /speckit-tasks 產生）

diagrams/
├── 005-results-csv-export-component.puml / .png
├── 005-results-csv-export-class.puml / .png
└── 005-results-csv-export-sequence.puml / .png
```

### Source Code (repository root)

只列出本子功能新增（＋）或修改（～）的檔案：

```text
packages/shared/src/
├── csvExport.ts                 ＋ CSV_EXPORT_PATH、CSV_EXPORT_NOT_CLOSED_MESSAGE、CSV_HEADERS、CSV_NO_ANSWER_TEXT
└── index.ts                     ～ 匯出 csvExport
packages/shared/tests/schemas.test.ts  ～ 常數（表頭 8 欄、順序）

apps/server/src/
├── domain/export/resultExporter.ts        ～ ResultExporter<TReport = ExportReport>
├── domain/export/csv/csvEncoder.ts        ＋ encodeCsv、encodeField（BOM、CRLF、引號、公式防護）
├── domain/export/csv/resultRows.ts        ＋ ResultRow、buildResultRows
├── domain/export/csv/csvFileName.ts       ＋ csvFileName、csvAsciiFileName
├── domain/export/csv/csvResultExporter.ts ＋ CsvExport、CsvResultExporter
├── domain/session/quizSessionService.ts   ～ deps.csvExporter、exportCsv()、csv_export log
└── transport/http/routes/sessionRoutes.ts ～ GET /api/session/export.csv
apps/server/tests/
├── unit/csvEncoder.test.ts                ＋
├── unit/resultRows.test.ts                ＋
├── unit/csvFileName.test.ts               ＋
├── unit/csvResultExporter.test.ts         ＋
├── unit/quizSessionService.test.ts        ～ exportCsv 狀態限制、不保存、不推播
└── integration/csvExport.test.ts          ＋ 409／401／403、200 header 與內容、重複匯出、重新啟動、Guided Notes 不受影響

apps/web/src/
├── api/http.ts                  ～ apiDownload
├── api/contentDisposition.ts    ＋ fileNameFromContentDisposition
├── utils/download.ts            ＋ saveBlob
├── pages/teacher/CsvExportPanel.tsx   ＋
└── pages/teacher/TeacherDashboard.tsx ～ 在 ExportPanel 下方掛載 CsvExportPanel
apps/web/tests/
├── CsvExportPanel.test.tsx      ＋
└── contentDisposition.test.ts   ＋
```

**Structure Decision**: 沿用既有的 monorepo（`packages/shared`、`apps/server`、`apps/web`）。CSV 相關的伺服器模組集中在
`domain/export/csv/`，與 Guided Notes 的 `exportPlan`／`guidedNotesExporter` 分開，但同樣放在 `domain/export` 之下並實作
同一個 `ResultExporter` 介面。

## Complexity Tracking

Constitution Check 沒有違反項目，不需填寫。
