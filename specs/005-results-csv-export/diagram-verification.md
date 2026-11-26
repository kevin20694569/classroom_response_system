# 圖表與程式碼一致性驗證（原則 VI）

**Feature**: `005-results-csv-export`
**驗證日期**: 2026-11-26
**比對對象**: `diagrams/005-results-csv-export-{component,class,sequence}.puml` ↔ plan.md「圖表對應」的原始碼

## 結果

實作完成後逐一比對，發現 3 處與圖表有細部差異；依原則 VI 已先更新圖表並重新產生 PNG
（`java -jar plantuml.jar "./diagrams/005-*.puml"`），之後兩者一致。

| 圖表元素 | 原始碼 | 結果 |
|----------|--------|------|
| csvExport 常數（路徑、訊息、表頭、無人作答文字） | `packages/shared/src/csvExport.ts` | 一致 |
| `ResultExporter<TReport = ExportReport>` | `domain/export/resultExporter.ts` | 一致 |
| `GuidedNotesExporter`（沿用） | `domain/export/guidedNotesExporter.ts` | 一致，未修改 |
| `CsvResultExporter`、`CsvExport` | `domain/export/csv/csvResultExporter.ts` | 一致（忽略 mode、注入 RankingStrategy） |
| `resultRows`：`buildResultRows`、`toCsvRecord`、`ResultRow` | `domain/export/csv/resultRows.ts` | 已更新：私有函式為 `blankLabelOf`、新增 `rowsOfSubmission`；`resultRows` 直接使用 `RankingStrategy` |
| `csvEncoder`：`encodeCsv`、`encodeField`、`neutralizeFormula` | `domain/export/csv/csvEncoder.ts` | 已更新：新增私有的 `quoteIfNeeded` |
| `csvFileName`、`csvAsciiFileName` | `domain/export/csv/csvFileName.ts` | 一致 |
| `QuizSessionService.exportCsv`、`csvExporter` 依賴 | `domain/session/quizSessionService.ts` | 一致（mutate 內回傳原 session、log 只記列數） |
| `GET /api/session/export.csv` | `transport/http/routes/sessionRoutes.ts` | 一致 |
| `apiDownload`、`fileNameFromContentDisposition`、`saveBlob` | `web/src/api/http.ts`、`contentDisposition.ts`、`utils/download.ts` | 一致 |
| `CsvExportPanel`、`TeacherDashboard` 掛載 | `web/src/pages/teacher/` | 一致 |
| 時序圖：排序呼叫 | `resultRows.ts` | 已更新：`rank()` 由 `resultRows` 呼叫（原圖畫成匯出器呼叫） |
| 組件圖：排序依賴 | `resultRows.ts` | 已更新：`ResultRows --> Ranking`（原圖畫成 `CsvExporter --> Ranking`） |
