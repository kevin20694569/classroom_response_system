# 圖表一致性驗證（constitution 原則 VI）

**Feature**: `002-teacher-dashboard-enhancements` | **Date**: 2026-11-23 | **Task**: T054

依 [plan.md](./plan.md)「圖表對應」逐一核對三張 002 圖表的元件、類別、欄位、方法與互動順序是否都存在於原始碼且
名稱一致。

## 驗證中更新的圖表

| 圖表 | 更新內容 | 原因 |
|------|----------|------|
| 類別圖 | `GoogleSheetsGateway` 加上 `writeCellsWith(client, ref, writes, onError)` | 寫入流程抽成可注入 client 的函式，讓單元測試不需金鑰或網路即可驗證單一 batchUpdate |
| 時序圖 | 匯出段落在 batchUpdate 前加上「讀取工作表屬性（sheetId、目前欄數）」 | 補欄與 updateCells 需要工作表 ID 與目前欄數（research R8） |

更新後已執行 `plantuml "./diagrams/002-*.puml"` 重新產生 PNG。組件圖不需要更新。

## 元件與類別對照

| 圖表元素 | 圖表 | 原始碼位置 | 一致 | 說明 |
|----------|------|------------|------|------|
| QuestionList（`previewNumber`、`togglePreview`） | 組件、類別、時序 | `apps/web/src/components/QuestionList.tsx` | ✔ | `aria-pressed` 與「預覽中」標籤 |
| QuestionPreview | 組件、類別、時序 | `apps/web/src/components/QuestionPreview.tsx` | ✔ | |
| SessionTimer | 組件、類別、時序 | `apps/web/src/pages/teacher/SessionTimer.tsx`（由 `SessionControls.tsx` 使用） | ✔ | `requestAnimationFrame` 迴圈、`serverNow` 校正 |
| TimeHint（`computeTooltipPosition`） | 組件、類別、時序 | `apps/web/src/components/TimeHint.tsx`（由 `SubmissionBoard.tsx` 使用） | ✔ | Portal + fixed 定位 |
| TimeFormat（`formatElapsed`、`formatClock`） | 組件、類別、時序 | `apps/web/src/utils/timeFormat.ts` | ✔ | |
| ExportPanel（`mode`） | 組件、類別、時序 | `apps/web/src/pages/teacher/ExportPanel.tsx` | ✔ | 預設 `answers-only`、不記憶 |
| Question.prompt、Blank.prompt | 類別 | `packages/shared/src/domain.ts` | ✔ | 預設 null（舊存檔相容） |
| ExportMode、LastExport.mode | 類別 | `packages/shared/src/domain.ts` | ✔ | 另有 `EXPORT_MODE_LABEL`、`EXPORT_MODE_DESCRIPTION` |
| ExportRequest、ExportResponse | 組件、類別、時序 | `packages/shared/src/api.ts` | ✔ | |
| TeacherView（`serverNow`）、TeacherQuestionView、TeacherBlankView、TeacherResultView | 組件、類別 | `packages/shared/src/views.ts` | ✔ | 學生與公開檢視不變 |
| HttpApi（匯出 mode） | 組件、時序 | `apps/server/src/transport/http/routes/sessionRoutes.ts` | ✔ | 錯誤時回「匯出模式不正確。」 |
| VisibilityPolicy（`toTeacherView(session, ranking, now)`） | 組件、類別 | `apps/server/src/domain/visibility/visibilityPolicy.ts` | ✔ | |
| QuizSessionService.exportResults(mode) | 組件、類別、時序 | `apps/server/src/domain/session/quizSessionService.ts` | ✔ | log 含 `mode` |
| GuidedNotesParser、ParsedGuidedNotes、ResultColumns | 組件、類別、時序 | `apps/server/src/domain/guidedNotes/parser.ts` | ✔ | `headerRowIndex`、`usedColumnCount`、`resultColumns` |
| GuidedNotesPrompts（`findPromptColumn`、`promptAt`、`readQuestionPrompts`） | 類別 | `apps/server/src/domain/guidedNotes/prompts.ts` | ✔ | |
| ResultExporter、GuidedNotesExporter（`export(…, mode)`） | 組件、類別、時序 | `apps/server/src/domain/export/{resultExporter,guidedNotesExporter}.ts` | ✔ | |
| ExportPlanner（`planExport`、`answerValue`、`attribution`）、ExportPlan | 組件、類別、時序 | `apps/server/src/domain/export/exportPlan.ts` | ✔ | 結果欄由 `resultColumnWrites` 計算 |
| SubmittedAtFormat（`formatSubmittedAt`） | 組件、類別 | `apps/server/src/domain/export/submittedAt.ts` | ✔ | |
| CellWrite（`text`、`mutedFrom`）、GuidedNotesGateway | 組件、類別 | `apps/server/src/infrastructure/sheets/guidedNotesGateway.ts` | ✔ | |
| GoogleSheetsGateway（`writeCells`、`writeCellsWith`） | 組件、類別、時序 | `apps/server/src/infrastructure/sheets/googleSheetsGateway.ts` | ✔ | 驗證中更新圖表 |
| SheetsBatchRequests（`buildBatchUpdateRequests`） | 組件、類別 | `apps/server/src/infrastructure/sheets/batchRequests.ts` | ✔ | |
| FakeGuidedNotesGateway | 組件 | `apps/server/tests/fakes/fakeGuidedNotesGateway.ts` | ✔ | 記錄 `mutedFrom`、全有或全無 |
| LocalSessionRepository（舊存檔相容） | 組件 | `apps/server/src/infrastructure/persistence/localSessionRepository.ts` | ✔ | 由 schema 預設值處理，程式未改 |

## 時序圖互動核對

| 段落 | 核對結果 | 對應測試 |
|------|----------|----------|
| 匯入時讀取題目敘述 | ✔ 解析時一併讀取敘述；只有老師端資料含敘述 | `unit/prompts.test.ts`、`integration/visibility.test.ts` |
| 題目預覽 | ✔ 只在分頁本地切換，不呼叫伺服器 | `web/QuestionList.test.tsx` |
| 搶答計時 | ✔ offset 由 `serverNow` 計算；進行中每格重算；結束後停止 | `web/SessionTimer.test.tsx`、`integration/restart.test.ts` |
| 提交時間提示 | ✔ 移入／聚焦顯示，移出／失焦／Esc 關閉 | `web/TimeHint.test.tsx`、`web/SubmissionBoard.test.tsx` |
| 依模式匯出 | ✔ 驗證 mode → 重新讀取與解析 → 計畫 → 讀取屬性 → 單一 batchUpdate；無法定位時不寫入 | `unit/exportPlan.test.ts`、`unit/batchRequests.test.ts`、`unit/googleSheetsGateway.test.ts`、`integration/export.test.ts` |

結論：三張 002 圖表與程式碼一致。
