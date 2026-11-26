# Data Model：搶答結果匯出 CSV

**Feature**: `005-results-csv-export` | **Plan**: [plan.md](./plan.md)

本子功能**不新增或修改任何保存的資料**（`data/session.json` 格式不變），只從既有的活動資料推導出 CSV。
類別關係見 `diagrams/005-results-csv-export-class.puml`。

## 1. 讀取的既有資料（不修改）

| 實體 | 使用的欄位 | 來源 |
|------|------------|------|
| `QuizSession` | `status`（必須是 `CLOSED`）、`openedAt`（檔名）、`questions`、`submissions` | 001 |
| `Question` | `number`、`order`、`kind`、`blanks[].label` | 001／002 |
| `Submission` | `id`、`questionNumber`、`groupId`、`answers[]`（`blankIndex`、`text`）、`sequence`、`receivedAt`、`submitterNickname` | 003／004 |
| `QuestionResult` | `questionNumber`、`winner`（`id` 用來判斷是否搶答成功） | 001 |

## 2. 新增的型別（只在伺服器記憶體中，不保存）

### ResultRow（結果紀錄列）

CSV 的一列資料（尚未編碼），全部欄位都已轉成要輸出的文字；`null` 輸出成空字串。

| 欄位 | 型別 | CSV 表頭 | 規則 |
|------|------|----------|------|
| `questionNumber` | `number` | 題號 | 題號數字 |
| `blankLabel` | `string \| null` | 子題 | 題組：`blanks[i].label`，沒有標記時為 `（i）`（i 從 1 起算）；單題與無人作答：`null` |
| `groupLabel` | `string \| null` | 組別 | `groupName(groupId)` →「第 N 組」；無人作答：`null` |
| `submitterNickname` | `string \| null` | 送出者暱稱 | `Submission.submitterNickname`；舊資料與無人作答：`null` |
| `answer` | `string` | 答案 | 該子題（或單題）的 `text` 原文；無人作答：`無人作答` |
| `rankLabel` | `string \| null` | 搶答順位 | 「第 N 名」，N = 依 `RankingStrategy` 排序後的位置（從 1 起算）；無人作答：`null` |
| `submittedAt` | `string \| null` | 送出時間 | `formatSubmittedAt(receivedAt)` →「YYYY/MM/DD HH:mm:ss.SSS」；無人作答：`null` |
| `isWinner` | `'是' \| '否' \| null` | 是否搶答成功 | `submission.id === result.winner?.id` 為「是」，否則「否」；無人作答：`null` |

**產生規則（FR-006～FR-008）**：

1. 題目依 `number` 由小到大。
2. 每題的送出依 `RankingStrategy.rank()` 的結果排序（第 1 名在前）。
3. 單題：每筆送出一列。題組：每筆送出依 `blankIndex` 由小到大拆成 `blankCount` 列，同一筆送出的列相鄰，
   除了 `blankLabel` 與 `answer` 以外的欄位都相同；送出中缺少某子題的答案時，該子題的 `answer` 為空字串。
4. 沒有任何送出的題目：恰好一列，只有 `questionNumber` 與 `answer = 無人作答`。

**列數**：`Σ（每題送出數 × 該題子題數，至少 1 列）`。以上限 20 組 × 100 題 × 每題 5 個子題估算，最多 10,000 列，
在記憶體中一次產生即可。

### CsvExport（匯出結果）

`CsvResultExporter.export()` 的回傳值，也是 `QuizSessionService.exportCsv()` 的回傳值。

| 欄位 | 型別 | 說明 |
|------|------|------|
| `fileName` | `string` | 「搶答結果_YYYYMMDD-HHmm.csv」（`openedAt`，伺服器所在時區） |
| `asciiFileName` | `string` | 「results_YYYYMMDD-HHmm.csv」，給 `Content-Disposition` 的 `filename` 備用 |
| `content` | `string` | 完整的 CSV 文字：BOM＋表頭＋各列，CRLF 換行（[contracts/csv-format.md](./contracts/csv-format.md)） |
| `rowCount` | `number` | 資料列數（不含表頭），寫入 log |

**不變性**：同一場活動在 `CLOSED` 狀態下重複匯出，`fileName` 與 `content` 完全相同（SC-006）。所有欄位只由保存的
資料推導，不包含匯出當下的時間。

## 3. 介面變更

```text
ResultExporter<TReport = ExportReport>
  export(session, results, mode): Promise<TReport>

GuidedNotesExporter implements ResultExporter            （= ResultExporter<ExportReport>，不改）
CsvResultExporter   implements ResultExporter<CsvExport> （新增；建構時注入 RankingStrategy；忽略 mode）
```

`QuizSessionServiceDeps` 新增選填的 `csvExporter?: ResultExporter<CsvExport>`，預設為
`new CsvResultExporter(deps.ranking)`（測試可以替換）。

## 4. 狀態轉換

不新增狀態，也不改變 001 的活動狀態機。CSV 匯出只在 `CLOSED` 可以執行，而且是**唯讀**的：

| 目前狀態 | `exportCsv()` 結果 | 狀態改變 |
|----------|--------------------|----------|
| `NOT_IMPORTED` / `READY` / `OPEN` | `INVALID_TRANSITION`（409）「搶答結束後才能匯出 CSV。」 | 無 |
| `CLOSED` | 回傳 `CsvExport` | 無（不保存、不推播、`lastExport` 不變） |

## 5. 老師端畫面狀態（CsvExportPanel）

| 條件 | 按鈕 | 提示／訊息 |
|------|------|------------|
| `view.status !== 'CLOSED'` | 停用 | 「搶答結束後才能匯出 CSV。」 |
| `CLOSED`，閒置 | 可用 | 無 |
| 下載中 | 停用，文字「匯出中…」 | 無 |
| 成功 | 可用 | 「已下載 搶答結果_….csv。」 |
| 失敗 | 可用 | `ErrorBanner` 顯示伺服器訊息或「匯出失敗，請稍後再試。」 |
