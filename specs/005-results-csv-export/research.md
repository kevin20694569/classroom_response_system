# Research：搶答結果匯出 CSV

**Feature**: `005-results-csv-export` | **Plan**: [plan.md](./plan.md)

Technical Context 沒有 NEEDS CLARIFICATION（沿用 001～004 技術棧）。以下記錄實作方式的決策。

## R1. 實作既有的 ResultExporter 擴充點

- **Decision**: 把 `ResultExporter` 加上泛型回傳型別 `ResultExporter<TReport = ExportReport>`；新增
  `CsvResultExporter implements ResultExporter<CsvExport>`。`GuidedNotesExporter` 與 `QuizSessionServiceDeps.exporter`
  因預設型別參數完全不用改。CSV 不需要匯出模式，`mode` 參數依介面既有註解「其他匯出目的地可依需要忽略」忽略。
- **Rationale**: 使用者指定實作此擴充點；constitution 原則 IV 已點名「匯出格式可擴充（如 CSV）」。介面原本固定回傳
  `ExportReport`（寫入格數），CSV 要回傳檔名與內容；泛型是讓兩種匯出共用同一介面、又不影響既有實作的最小改動。
- **Alternatives considered**:
  - 獨立的 `buildCsv()` 函式、不走介面：較簡單，但違反使用者指示，擴充點也一直沒有第二個實作。
  - 改成回傳聯集型別 `ExportReport | CsvExport`：呼叫端每次都要判斷型別，型別安全較差。
  - 新增 `CsvExportMode` 加進 `ExportModeSchema`：會出現在 Guided Notes 的模式選單並改變 002 契約，違反 FR-016。

## R2. 每題完整排序的來源

- **Decision**: `CsvResultExporter` 建構時注入 `RankingStrategy`，對每題的送出呼叫 `rank()` 取得完整順位；
  「是否搶答成功」以傳入的 `results`（`deriveResults` 產生）的 `winner.id` 判斷。
- **Rationale**: `QuestionResult` 只有第一名，CSV 需要所有名次。用同一個策略排序，順位與老師端送出列表
  （`toTeacherView` 也用 `ranking`）一致（FR-009）；搶答成功直接取自 `results`，與 Guided Notes 匯出的依據相同。
- **Alternatives considered**: 在 `QuestionResult` 加 `ranked` 陣列——那是 shared 的檢視型別，會改到學生與老師
  的檢視契約，範圍過大。

## R3. 服務層入口與並發

- **Decision**: `QuizSessionService.exportCsv(): Promise<CsvExport>`，在 `mutate()` 內執行並回傳**原本的** session 物件，
  因此不保存、不推播、不改 `lastExport`（FR-004）；非 `CLOSED` 丟出
  `DomainError('INVALID_TRANSITION', CSV_EXPORT_NOT_CLOSED_MESSAGE)`。成功與失敗都寫結構化 log（只記列數與錯誤代碼）。
- **Rationale**: 在鎖內讀取，保證不會與正在執行的「結束搶答」或「重新匯入」交錯，讀到的是一致的快照
  （constitution 原則 I：並發要有確定的結果）。`mutate()` 原本就在 `next === current` 時直接回傳，不必新增機制。
- **Alternatives considered**: 直接 `getSession()` 讀取——JS 單執行緒下大多沒問題，但 `importQuestions` 會在鎖內
  `await` 讀取線上文件，走鎖的語意比較清楚。新增錯誤代碼 `CSV_NOT_READY`——沿用 `INVALID_TRANSITION`（409）已足夠，
  前端只顯示伺服器訊息，不依代碼分支。

## R4. CSV 編碼（Excel 直接開啟不亂碼、欄位不錯位）

- **Decision**:
  - 檔案以 UTF-8 輸出，開頭加 BOM（`U+FEFF`）。Windows 與 macOS 版 Excel 都靠 BOM 把 CSV 辨識為 UTF-8；沒有 BOM 時，
    繁體中文 Windows 會用 Big5（CP950）解讀而出現亂碼。
  - 欄位分隔用逗號，換列用 CRLF（RFC 4180）。
  - 值含 `,`、`"`、CR、LF，或開頭／結尾是空白時，用雙引號包住，值中的 `"` 寫成 `""`。值內的換行原樣保留（Excel 在
    引號內的 LF 會顯示為同一格內的換行）。
  - Excel 文字儲存格（FR-017，人工驗證後新增）：答案與暱稱中 Excel 會自動轉換的值——只含數字與「 + - . , / : % $ e E」且至少
    有一個數字（如 `007`、`1/2`、`3:30`、`1e5`、`1,000`、`-5`、`+3`），以及 `TRUE`／`FALSE`（不分大小寫）——輸出為 `="值"`
    （CSV 中寫成 `"=""值"""`）。Excel 會把 007 變成 7、1/2 變成日期、3:30 變成時間、TRUE 變成布林值，而單引號前綴在 CSV
    直接開啟時不會被當成「文字前綴」，會原樣顯示在儲存格內；`="值"` 則顯示值本身。此規則優先於公式防護，因此「-5」「+3」
    不加單引號；只套用在答案與暱稱欄。
  - 公式防護（clarify Q1）：不符合上一條的值，其第一個字元是 `=`、`+`、`-`、`@`、Tab（`\t`）或 CR（`\r`）時，在開頭加 `'`，再套用引號規則。
  - 表頭與每列固定 8 欄；空值輸出空字串。
- **Rationale**: 這是 Excel 相容性最廣、也是 OWASP CSV Injection 建議的做法；規則簡單，可以完整單元測試，
  不需要新增相依套件。
- **Alternatives considered**:
  - 使用 `csv-stringify`、`papaparse`：功能遠超所需，而且公式防護仍要自己處理；相依套件越少越好。
  - UTF-16LE＋Tab 分隔：Excel 也能正確開啟，但不是逗號分隔，其他工具相容性較差。
  - 純數字等 Excel 會轉換的值也加單引號：放棄，因為單引號在 CSV 直接開啟時會原樣顯示（例如「'007」），既改變原文，
    也無法阻止 Excel 的轉換之外的顯示問題；文字儲存格 `="值"` 能讓 Excel 顯示原樣。
  - 公式防護改用前置 Tab 或空白：Excel 顯示時一樣會多一個字元，而 `'` 是最常見的做法（使用者已在 clarify 選定）。

## R5. 下載方式與檔名傳遞

- **Decision**: 新增 `GET /api/session/export.csv`。回應：
  `Content-Type: text/csv; charset=utf-8`、`Cache-Control: no-store`、
  `Content-Disposition: attachment; filename="results_YYYYMMDD-HHmm.csv"; filename*=UTF-8''<百分比編碼的中文檔名>`。
  前端以 `fetch`（帶 `Authorization: Bearer`）取得 Blob，從 `filename*` 解出「搶答結果_YYYYMMDD-HHmm.csv」，
  再用 object URL＋`<a download>` 觸發下載。非 2xx 時沿用 `ApiErrorBodySchema` 解析 JSON 錯誤，不產生檔案（FR-014）。
- **Rationale**: 老師身分存在分頁的 `sessionStorage`，並以 Bearer header 傳送（001），單純的 `<a href>` 帶不了 header，
  所以必須用 fetch。HTTP header 只能放 ASCII，中文檔名依 RFC 6266／5987 放在 `filename*`，並附 ASCII 的 `filename`
  給不支援的用戶端。先完整收到回應再存檔，連線中斷時不會留下半個檔案。
- **Alternatives considered**: 用 JSON 回傳 `{ fileName, content }` 由前端組檔——可行，但 CSV 本身就是下載資源，
  用正確的 HTTP 語意也方便直接用 curl 驗證；token 放進查詢字串——會出現在伺服器 log 與瀏覽器歷史，違反原則 VIII。

## R6. 檔名與時間

- **Decision**: `csvFileName(openedAt)` 產生 `搶答結果_YYYYMMDD-HHmm.csv`（伺服器所在時區，與 002 的時間格式一樣用本機時區）；
  ASCII 備用檔名為 `results_YYYYMMDD-HHmm.csv`。送出時間使用 CSV 專用的 `formatCsvSubmittedAt()`：「YYYY-MM-DD HH:mm:ss」（人工驗證發現含毫秒的「YYYY/MM/DD HH:mm:ss.SSS」在 Excel 會被當成「分:秒.小數」；002 的 `formatSubmittedAt()` 維持不變）。
- **Rationale**: clarify Q4 選定開啟搶答時間；`CLOSED` 狀態一定有 `openedAt`。CSV 與 Guided Notes 的時間格式刻意不同，
  Excel 相容性優先。
- **Alternatives considered**: 由前端組檔名——時間會依老師瀏覽器的時區，與 CSV 內容中伺服器時區的時間可能不一致。

## R7. 測試策略

- **Decision**:
  - 單元測試：`csvEncoder`（BOM、CRLF、引號、公式防護、空值）、`resultRows`（排序、題組拆列、無人作答、送出者 null、
    子題欄一律「子題N」、題號不連續）、`csvFileName`、`CsvResultExporter`（重複匯出內容逐位元組相同、mode 不影響結果）、
    `QuizSessionService.exportCsv`（各狀態的限制；不保存、不推播、`lastExport` 不變）。
  - 整合測試（Fastify `inject`）：未匯入／待開始／進行中回 409 與指定訊息；未登入 401、學生 403 且 body 沒有任何答案；
    `CLOSED` 回 200、header 正確、內容與預期 CSV 相同；伺服器重新啟動後仍可匯出且內容相同；匯出 CSV 後 Guided Notes 匯出
    與 `lastExport` 不受影響。
  - Web：`CsvExportPanel`（非 `CLOSED` 停用＋提示、變成 `CLOSED` 時啟用、成功時以正確檔名下載、錯誤時顯示訊息且不下載）、
    `apiDownload` 與 `Content-Disposition` 解析。
  - 時區：沿用 `vitest.config.ts` 中 server 與 web 專案已固定的 `TZ: 'Asia/Taipei'`（002 research R11），
    測試結果與執行的電腦無關。
- **Rationale**: 符合 constitution 原則 VII（每個功能都有正常與錯誤案例；權限有專門測試）；不連線真實 Google。
  CSV 不讀寫 Guided Notes，因此「兩份版面不同的文件」要求改以兩種題型（單題範例、題組範例）的活動資料驗證 CSV，
  並以既有的 Guided Notes 匯出測試證明 FR-016。
