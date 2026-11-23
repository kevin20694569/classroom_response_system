# 圖表一致性驗證（constitution 原則 VI）

**Feature**: `001-teacher-quiz-session` | **Date**: 2026-11-23 | **Task**: T080

依 [plan.md](./plan.md)「圖表對應」逐一核對三張圖的元件、類別、欄位、方法與互動順序是否都存在於原始碼且名稱一致。

## 驗證中更新的圖表

實作過程中有下列設計細節比原圖更具體，依原則 VI 先更新 `.puml` 並以 `plantuml "./diagrams/*.puml"` 重新產生 PNG，
使圖表與程式碼一致：

| 圖表 | 更新內容 | 原因 |
|------|----------|------|
| 類別圖 | `importQuestions`／`open`／`close` 從 `QuizSession` 移到 `QuizSessionService`；`QuizSession` 標為純資料，狀態轉換規則改由 `QuizSessionStateMachine`（`initialSession`、`assertTransition`）表示 | 狀態由服務統一持有並經 mutex 修改（原則 I、R9），資料物件保持不可變 |
| 類別圖 | 新增 `SubmissionService`、`AsyncMutex`、`RoleGuard`、`ExportPlanner`（`planExport`）、`SpreadsheetRef` | 實作中的獨立模組，原圖未列出 |
| 類別圖 | `GuidedNotesParser` 改為 `parseGuidedNotes(snapshot)`（`selectSheet` 為內部步驟），並列出 `parseQuestionNumber`、`readBlankMarker` | 工作表選擇與解析一次完成，錯誤可以一起回報 |
| 類別圖 | `ImportError` 改為共用的 `ErrorDetail`；`ParsedGuidedNotes` 加上 `sheetTitle` | 匯入錯誤沿用 API 錯誤細節格式（contracts/http-api.md） |
| 類別圖 | `SessionRepository.save(session)`（作答紀錄已包含在 `QuizSession.submissions`）；`TabIdentity` 移除 `token`、加上 `issuedAt`；`AuthService` 參數與回傳型別依實作；`VisibilityPolicy` 改為三個檢視函式；`QuestionResult` 移除未實作的 `isUnanswered()` | 對齊實際簽章 |
| 時序圖 | 訊息改為實際方法名稱（`importQuestions(…)`、`parseGuidedNotes`、`submit(groupId…)`、`exportResults()`）；匯出段落加入 `GuidedNotesExporter`，由它讀取、定位與寫入，寫入成功後保存 `lastExport` 並推播 | 對齊實際呼叫順序 |

組件圖不需要更新。

## 元件與類別對照

| 圖表元素 | 圖表 | 原始碼位置 | 一致 | 說明 |
|----------|------|------------|------|------|
| TeacherClient | 組件、時序 | `apps/web/src/pages/teacher/`（TeacherPage、TeacherDashboard、ImportPanel、SessionControls、SubmissionBoard、ExportPanel） | ✔ | |
| StudentClient（002） | 組件、時序 | `scripts/simulate-students.ts` | ✔ | 001 以模擬腳本使用相同的學生 API |
| Contracts | 組件 | `packages/shared/src/{errors,domain,views,api,events}.ts` | ✔ | Zod schema 為唯一來源 |
| HttpApi | 組件、時序 | `apps/server/src/transport/http/`（auth.ts、errorHandler.ts、routes/） | ✔ | |
| RealtimeGateway | 組件、時序 | `apps/server/src/transport/realtime/realtimeGateway.ts` | ✔ | rooms：public／teachers／group:N |
| AuthService、TabIdentity | 組件、類別、時序 | `apps/server/src/auth/authService.ts`、`tokens.ts` | ✔ | HMAC 簽章 token，12 小時有效 |
| RoleGuard | 組件、類別、時序 | `apps/server/src/auth/roleGuard.ts` | ✔ | |
| VisibilityPolicy | 組件、類別 | `apps/server/src/domain/visibility/visibilityPolicy.ts` | ✔ | |
| QuizSessionService | 組件、類別、時序 | `apps/server/src/domain/session/quizSessionService.ts` | ✔ | |
| QuizSession、SessionStatus、狀態機 | 類別 | `packages/shared/src/domain.ts`、`apps/server/src/domain/session/quizSession.ts` | ✔ | |
| AsyncMutex | 類別 | `apps/server/src/domain/mutex.ts` | ✔ | |
| SubmissionService | 組件、類別、時序 | `apps/server/src/domain/submission/submissionService.ts`、`validateAnswers.ts` | ✔ | |
| Question、Blank、CellLocation、Submission、BlankAnswer、QuestionResult、Group、GuidedNotesRef | 類別 | `packages/shared/src/domain.ts` | ✔ | |
| RankingStrategy、FirstSubmissionStrategy | 組件、類別 | `apps/server/src/domain/ranking/` | ✔ | `results.ts` 推導每題結果 |
| GuidedNotesParser | 組件、類別、時序 | `apps/server/src/domain/guidedNotes/`（parser.ts、grid.ts、questionNumber.ts、markers.ts） | ✔ | |
| SpreadsheetSnapshot、SheetGrid、SpreadsheetRef、CellWrite | 類別 | `apps/server/src/infrastructure/sheets/guidedNotesGateway.ts` | ✔ | |
| ResultExporter、GuidedNotesExporter、ExportPlanner | 組件、類別、時序 | `apps/server/src/domain/export/` | ✔ | |
| GuidedNotesGateway、GoogleSheetsGateway | 組件、類別、時序 | `apps/server/src/infrastructure/sheets/` | ✔ | 讀取：spreadsheets.get；寫入：values.batchUpdate（RAW） |
| FakeGuidedNotesGateway | 組件、類別 | `apps/server/tests/fakes/fakeGuidedNotesGateway.ts` | ✔ | |
| SessionRepository、LocalSessionRepository | 組件、類別、時序 | `apps/server/src/infrastructure/persistence/` | ✔ | 記憶體版在 tests/fakes |
| ConfigLoader | 組件 | `apps/server/src/config/config.ts`（`loadConfig`） | ✔ | 以函式實作 |
| StructuredLogger | 組件 | `apps/server/src/infrastructure/logger.ts`（`createLogger`） | ✔ | 以函式實作 |
| 本機資料儲存 | 組件 | `data/session.json`（`DATA_DIR`） | ✔ | 已列入 .gitignore |

## 時序圖互動核對

| 段落 | 核對結果 | 對應測試 |
|------|----------|----------|
| 老師登入 | ✔ 密碼正確簽發分頁 token；錯誤回 INVALID_PASSWORD | `tests/integration/auth.test.ts` |
| 匯入 Guided Notes | ✔ 檢查權限 → 讀取 → 解析 → 整批替換並保存 → 推播；失敗時資料不變 | `tests/integration/import.test.ts` |
| 開啟／結束搶答 | ✔ 狀態機檢查 → 保存 → 推播所有 room | `tests/integration/sessionLifecycle.test.ts` |
| 搶答進行中 | ✔ 收件經 mutex 指派 sequence → 保存 → 只推播老師與送出組別 | `tests/integration/submissions.test.ts`、`visibility.test.ts`、`concurrency.test.ts` |
| 匯出 | ✔ 重新讀取、重新定位、全部可定位才一次寫入；保存 lastExport 並推播 | `tests/integration/export.test.ts` |
| 伺服器重新啟動 | ✔ 載入保存檔恢復；分頁 token 重新連線恢復身分 | `tests/integration/restart.test.ts` 等 |

結論：三張圖表與程式碼一致。
