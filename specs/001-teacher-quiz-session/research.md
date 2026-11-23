# Research: 使用者角色與老師端搶答活動管理

**Feature**: `001-teacher-quiz-session` | **Date**: 2026-11-23

本文件記錄 plan 階段的技術決策。使用者指定前端使用 TypeScript、React、Vite、Tailwind CSS，
測試使用 Vitest；constitution 規定以 Node.js LTS + TypeScript 為核心。其餘選擇依下列研究決定。
版本號為 2026-11-23 查詢 npm registry 的最新穩定版，實際版本以 `package-lock.json` 鎖定為準。

## R1. 執行環境與語言版本

- **Decision**: Node.js 26 LTS（`.nvmrc` = `26`，目前 26.13.1）；TypeScript 固定 `~6.0`（6.0.3），`strict: true`。
- **Rationale**: Node 26 是目前最新的 LTS，Vite 8 與 Vitest 5 都支援。TypeScript 7 已發布，但
  typescript-eslint 8 的 peer dependency 只支援到 `<6.1.0`；若使用 TS 7，lint 無法正常運作，違反
  「lint 必須全部通過」的品質關卡。
- **Alternatives considered**: TypeScript 7（lint 不支援，暫不採用，待 typescript-eslint 支援後再評估）；
  Node 24 LTS（可用，但 26 支援期更長）。
- **注意**: 本機目前預設 Node 為 v18，開發前須執行 `nvm install && nvm use` 切換到 26。

## R2. 專案結構

- **Decision**: npm workspaces monorepo：`apps/web`、`apps/server`、`packages/shared`。
- **Rationale**: 原則 V 要求前後端契約只有一份來源；workspaces 讓兩端直接引用 `@crs/shared`，
  不需發佈套件。npm 是 Node 內建工具，不增加額外安裝步驟。
- **Alternatives considered**: pnpm／Turborepo（功能更多，但多一層工具，對本專案規模不必要）；
  單一套件（前端建置會混入伺服器相依，邊界不清楚）。

## R3. 前端框架（使用者指定）

- **Decision**: React 19 + Vite 8 + Tailwind CSS 4（`@tailwindcss/vite` 外掛）；狀態管理使用 React
  hooks；不使用路由套件，`App.tsx` 依 `location.pathname` 切換 `/teacher` 與 `/student`（002 預留）。
- **Rationale**: 使用者指定。001 只有老師端一個頁面流程，路由套件屬於 YAGNI；002 若需要再引入。
- **Alternatives considered**: React Router（目前只有兩個路徑，暫不需要）；Redux／Zustand（狀態來源是
  伺服器推播的單一 `session:state`，用 hook 保存即可）。

## R4. 後端 HTTP 框架

- **Decision**: Fastify 5。
- **Rationale**: 原生支援 TypeScript 與結構化 log（內建 pino）；`app.inject()` 可在不開埠的情況下做
  整合測試；錯誤處理器可統一隱藏內部細節（原則 VIII）。
- **Alternatives considered**: Express 5（生態大，但型別與測試輔助較弱）；NestJS（裝飾器與 DI 對本專案過重）；
  Hono（輕量，但與 Socket.IO 整合的範例較少）。

## R5. 即時通訊

- **Decision**: Socket.IO 4（伺服器 `socket.io`、前端 `socket.io-client`），掛在 Fastify 的同一個 HTTP 伺服器上。
  Socket.IO 只負責伺服器推播；所有會改變狀態的指令都走 HTTP。
- **Rationale**: 內建自動重連與 rooms。學生加入 `group:{id}` room、老師加入 `teachers` room，伺服器
  依 room 推送不同內容，在伺服器端落實可見性（原則 I）。重連時伺服器主動推送完整狀態（原則 II）。
- **Alternatives considered**: 原生 `ws`（需自行實作重連與 rooms）；Server-Sent Events（單向即可，但
  重連後狀態恢復與身分驗證需自行處理，且 002 學生端可能需要雙向）；HTTP 輪詢（難以達成 1 秒內同步）。

## R6. 契約與執行期驗證

- **Decision**: Zod 4。所有 schema 定義在 `packages/shared`，型別以 `z.infer` 推導。
- **Rationale**: 原則 V 要求型別與驗證規則來自同一份定義。Zod 同時用於 HTTP body、Socket 訊息、
  環境變數與 Google Sheets 回傳資料的驗證。
- **Alternatives considered**: TypeBox（與 Fastify 整合佳，但前端也要用，Zod 在 React 生態較普及）；
  Valibot（體積小，但團隊熟悉度較低）。

## R7. Google Sheets 存取

- **Decision**: `@googleapis/sheets`（Sheets v4 專用客戶端）+ `google-auth-library`，以**服務帳號**驗證。
  老師把 Guided Notes 分享給服務帳號的 email（編輯者權限）。
  - 讀取：`spreadsheets.get`，`includeGridData: true`，以 `fields` 只取
    `sheets(properties(sheetId,title),merges,data(startRow,startColumn,rowData(values(formattedValue))))`。
  - 寫入：`spreadsheets.values.batchUpdate`，`valueInputOption: "RAW"`，一次請求寫入所有目標儲存格。
  - 網址解析：從 `https://docs.google.com/spreadsheets/d/{spreadsheetId}/...` 取出 ID；其他格式回報錯誤。
- **Rationale**:
  - 符合「直接讀寫線上原文件」（FR-006）。服務帳號不需要每次 OAuth 同意流程，適合本機 Demo。
  - 讀取合併儲存格資訊（`merges`）是辨識題組與跨列題號的必要條件。
  - `RAW` 讓學生答案以純文字寫入，不會被當成公式執行（例如以 `=` 開頭的答案），避免公式注入。
  - 單一 batch 請求減少「只寫了一半」的機會；寫入前先完成全部定位檢查（FR-023）。若網路在請求中斷，
    系統回報失敗，因匯出可重複執行（FR-024），老師重試即可得到一致結果。
- **Alternatives considered**: 完整 `googleapis` 套件（包含所有 Google API，體積過大）；OAuth 使用者授權
  （需處理同意畫面與 refresh token 保存，增加機敏資料）；公開連結下載 CSV（違反「不下載離線處理」的決策，
  且讀不到合併儲存格）。
- **機敏資料**: 服務帳號金鑰 JSON 放在 repo 以外或已列入 `.gitignore` 的路徑，由
  `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` 環境變數指定。

## R8. 本機資料保存

- **Decision**: 單一 JSON 檔 `data/session.json`（路徑由 `DATA_DIR` 設定），以「寫入暫存檔 → `fs.rename`」
  原子替換；內容以 Zod schema 驗證後才載入。
- **Rationale**: 系統一次只有一個活動、資料量小（≤ 100 題 × ≤ 20 組）。整份快照寫入最簡單，
  `rename` 在同一個檔案系統是原子操作，不會留下寫一半的檔案。重啟時載入快照即恢復（FR-028）。
- **Alternatives considered**: `node:sqlite`／better-sqlite3（需要 schema 與遷移，對單一快照過重；
  better-sqlite3 還需原生編譯）；lowdb（多一個套件，功能與自行實作相近）。

## R9. 並發與順位判定

- **Decision**: 所有會改變活動狀態的操作（匯入、開啟、結束、送出）都經過同一個 in-process async mutex
  依序執行：取得鎖 → 驗證 → 指派遞增的 `sequence` → 保存成功 → 釋放鎖 → 回覆並推播。
- **Rationale**: Node 是單執行緒，但保存是非同步 I/O，若不加鎖，兩個送出可能交錯。序列化後，順位只取決於
  伺服器取得鎖的順序，結果確定且可重現（FR-016、SC-005）。「結束」與「送出」同樣經過鎖，結束後的送出必然
  看到 `CLOSED` 而被拒絕（Edge Case）。
- **Alternatives considered**: 依伺服器時間戳排序（同一毫秒可能並列）；資料庫交易（不使用資料庫）。
  mutex 以約 20 行自行實作，不引入額外套件。

## R10. 分頁身分與 token

- **Decision**:
  - 老師以密碼登入、學生以選擇組別加入，伺服器簽發 **HMAC-SHA256 簽章 token**（密鑰來自 `SESSION_SECRET`），
    內容含 `role`、`groupId`（學生）、`activityId`（學生）、`issuedAt`、`expiresAt`（12 小時）。
  - 前端把 token 存在 **`sessionStorage`**（每個分頁獨立、重新整理後保留、關閉分頁即清除），HTTP 以
    `Authorization: Bearer` 傳送，Socket.IO 以 `auth.token` 傳送。**不使用 cookie**（cookie 會被同一瀏覽器
    所有分頁共用，違反 FR-003a）。
  - 老師密碼比對使用 `crypto.timingSafeEqual`（先各自做 SHA-256 以等長比對），避免時間差洩漏資訊。
- **Rationale**: 簽章 token 不需寫入資料檔，伺服器重啟後只要 `SESSION_SECRET` 不變就仍有效（FR-003a），
  也符合 FR-028「資料檔不含密碼或憑證」。學生 token 綁定 `activityId`，老師開始新的一場活動後舊的學生
  身分自動失效。
- **Alternatives considered**: 伺服器保存 session 表（要寫入資料檔，且需要處理清理）；JWT 套件（功能相同，
  自行用 `node:crypto` 實作 HMAC 即可，少一個相依）。
- **已知限制**: 瀏覽器的「複製分頁」會一併複製 `sessionStorage`，複製出的分頁會沿用原身分；此行為寫入
  quickstart 的注意事項，Demo 時請以「開新分頁」取代「複製分頁」。

## R11. 測試策略

- **Decision**: Vitest 5，以 projects 設定分成 `shared`、`server`、`web`（jsdom）。
  - **單元**：題號正規化、表頭與工作表選擇、題組判斷、標記驗證、狀態機轉換表、答案驗證、順位策略、
    可見性過濾、匯出寫入內容計算。
  - **測試資料**：`apps/server/tests/fixtures/guided-notes/` 以 `SpreadsheetSnapshot` JSON 重現兩份課程範例
    （單題 6 題、題組 4 題），另有錯誤與變體（缺表頭、多張表頭工作表、題號重複、標記不連號、部分標記、
    無標記題組、`Q1`／全形題號、空白列、額外工作表）。題目一律為簡答題（原則 VII）。
  - **整合**：Fastify `inject` 測 API 與權限；socket.io-client 連線臨時伺服器測推播、重連恢復與可見性；
    `FakeGuidedNotesGateway` 記錄每次寫入，驗證「只改目標格」。
  - **專門測試**：並發（20 組同時送出同一題，重複 100 次，只有一個搶答成功且與鎖順序一致）、可見性
    （活動結束前學生收到的所有事件不含他組作答）、權限（學生 token 呼叫老師 API 全部回 403）、重啟恢復。
  - **前端**：@testing-library/react 測老師端主要畫面在各狀態的顯示與錯誤訊息。
- **Rationale**: 對應原則 VII 的每一項要求，且全部不依賴網路與真實憑證。
- **Alternatives considered**: Playwright E2E（成本較高；本子功能以人工驗證清單涵蓋端到端流程）。

## R12. 結構化 log

- **Decision**: pino（Fastify 內建）。設定 `redact` 遮蔽 `password`、`token`、`authorization`、金鑰路徑；
  事件以固定 `event` 欄位記錄：`session.transition`、`submission.accepted`、`submission.rejected`、
  `import.succeeded`、`import.failed`、`export.succeeded`、`export.failed`。
- **Rationale**: 符合技術限制「結構化 log 記錄關鍵事件、不含機敏資訊」（FR-027）。

## R13. 啟動方式

- **Decision**:
  - `npm start`：建置 shared 與 web，啟動後端；後端在同一個埠（`PORT`，預設 3000）提供前端靜態檔、
    `/api` 與 Socket.IO。這是文件寫明的**單一啟動指令**。
  - `npm run dev`：以 concurrently 同時啟動 `tsx watch` 後端與 Vite dev server（Vite proxy `/api`、`/socket.io`）。
- **Rationale**: 技術限制要求單一指令在本機啟動；Demo 時只需開 `http://localhost:3000`。

## R14. 錯誤模型

- **Decision**: 領域層拋出 `DomainError(code, userMessage, details?)`；`code` 列舉在 `packages/shared/src/errors.ts`。
  Fastify 錯誤處理器把 `DomainError` 對應到 HTTP 狀態碼並回傳 `{ error: { code, message, details } }`；
  其他未預期錯誤一律回傳 `INTERNAL_ERROR` 與通用訊息，堆疊只寫入 log。
- **Rationale**: 錯誤訊息看得懂且不洩漏內部細節（FR-026）；`details` 用於匯入錯誤的位置清單。

## R15. 學生端模擬（為老師端驗收）

- **Decision**: `scripts/simulate-students.ts`（`npm run simulate -- ...`）以學生 API 加入指定組別並送出答案，
  使用與 002 學生端相同的公開契約。
- **Rationale**: 學生畫面屬於 002，但原則 VII 要求人工驗證涵蓋至少兩組學生；腳本可在 Demo 中模擬兩組
  幾乎同時送出，不需要額外的測試專用 API。
- **Alternatives considered**: 加入只在開發模式存在的「假送出」API（會產生只存在於測試的對外行為，與 002 契約不一致）。
