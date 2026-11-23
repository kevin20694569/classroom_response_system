# Research：老師端介面優化

**Feature**: `002-teacher-dashboard-enhancements` | **Date**: 2026-11-23 | **Plan**: [plan.md](./plan.md)

技術棧沿用 001（[001 research.md](../001-teacher-quiz-session/research.md)），本子功能**不新增任何相依套件**。
以下只記錄本子功能新增的決策（編號 R1～R13）。

## R1. 題目敘述的讀取規則

- **Decision**：沿用 001 找到的表頭列；在同一列找內容恰為「題目」（忽略前後空白）的儲存格，其欄位（合併時取
  左上角所在欄）即題目欄。每一列的敘述取該列題目欄的「有效值」（合併範圍取左上角的值，沿用 001 的
  `effectiveValue`），去除前後空白，空字串視為沒有敘述。
  - 單題：題目區塊內各列的敘述依出現順序去除重複後以換行合併，存為 `Question.prompt`；`Blank.prompt` 為 null。
  - 題組：每個子題取其作答格所在列的敘述存為 `Blank.prompt`；區塊內其他列（不是任何子題作答格所在列）的敘述
    依序合併為 `Question.prompt`（題組說明）。
  - 找不到「題目」表頭時，所有敘述為 null，匯入照常成功（FR-001）。
- **Rationale**：兩份課程範例的題目欄都是「題目」表頭並跨 4 欄合併，敘述跨 2 列合併；以合併左上角讀值可同時處理
  兩種版面。只依表頭定位，維持 constitution 原則 III 不寫死座標。
- **Alternatives considered**：以「題號欄與作答欄之間的所有欄」組合敘述——會把非題目欄（例如備註）誤讀進來，
  且課程規格沒有這種要求，不採用。

## R2. 舊存檔相容

- **Decision**：`Question.prompt` 與 `Blank.prompt` 在 Zod schema 以 `.nullable().default(null)` 定義；
  `LastExport.mode` 以 `.default('answers-only')` 定義。`PersistedState.schemaVersion` 維持 `1`。
- **Rationale**：001 的 `data/session.json` 沒有這些欄位；以預設值補齊即可載入，不需要轉換程式，老師升級後
  活動不會中斷。預覽會顯示「文件未提供題目敘述」，重新匯入即可取得敘述。
- **Alternatives considered**：版本升為 2 並撰寫轉換程式——新增欄位全部可安全預設，轉換程式只是多餘的程式碼。

## R3. 題目敘述只給老師端（Clarification Q3）

- **Decision**：Public／Student 檢視沿用 001 的 `QuestionSummary`（不含敘述）；`TeacherView.questions` 改為
  `TeacherQuestionView`（多 `prompt` 與 `blanks[].{index,label,prompt}`）。由 `VisibilityPolicy` 產生，
  以自動化測試檢查學生與公開資料中不含任何敘述字串（SC-009）。
- **Rationale**：可見性由伺服器決定（原則 I）；分開的 schema 讓「學生資料不可能帶有敘述」在型別層面就成立。
- **Alternatives considered**：共用 schema 但學生端填 null——容易在之後的修改中漏掉，違反「伺服器不傳」的精神。

## R4. 題目預覽的狀態管理

- **Decision**：預覽狀態是 `QuestionList` 元件內的 `previewNumber: number | null`（React `useState`），
  不送往伺服器、不存 `sessionStorage`。切換邏輯抽成純函式 `togglePreview(current, clicked)`；
  `TeacherDashboard` 以 `key={activityId}` 掛載 `QuestionList`，活動識別改變（重新匯入）時元件重建、預覽自動
  清除；若 `previewNumber` 對應的題號已不存在也視為 null。按鈕使用 `aria-pressed`，預覽中另加「預覽中」文字
  標籤與外框（不只靠顏色，FR-005）。預覽區以 `aria-live="polite"` 的區塊顯示在按鈕清單下方（Clarification Q2）。
- **Rationale**：預覽是單一分頁的畫面狀態（FR-007、FR-008），本地狀態最簡單；`key` 重建避免手寫同步邏輯。
- **Alternatives considered**：放進 URL query（重新整理會保留預覽，與 FR-008 相反）；放進伺服器狀態（違反 FR-007）。

## R5. 搶答計時的時間來源與更新頻率

- **Decision**：
  - `TeacherView` 新增 `serverNow`（伺服器產生這份資料時的 ISO 時間）。前端收到時計算
    `offset = Date.parse(serverNow) − Date.now()`，之後經過時間 = `Date.now() + offset − Date.parse(openedAt)`，
    小於 0 時顯示 0（FR-012）。
  - 搶答進行中以 `requestAnimationFrame` 迴圈更新（瀏覽器約每秒 60 次，滿足 ≥ 30 次，FR-010）；每一格都由
    時鐘重新計算，不累加，因此分頁從背景切回時立即顯示正確值。
  - 「已結束」顯示 `closedAt − openedAt`；「尚未匯入」「待開始」顯示 `00:00.00`；兩者都不啟動迴圈。
  - 格式化為純函式 `formatElapsed(ms)`：無條件捨去到百分秒，未滿 1 小時為 `mm:ss.cc`，滿 1 小時為
    `h:mm:ss.cc`（Clarification Q2）。
  - 只更新計時元件本身（獨立元件、自己的 state），不會讓整個老師端畫面每格重新繪製。
- **Rationale**：本機執行時瀏覽器與伺服器同一個時鐘，offset 接近 0；保留 offset 讓規格「以伺服器時間為準」成立，
  也能防止伺服器重啟後時間基準不同。
- **Alternatives considered**：`setInterval(10ms)`（背景分頁會被節流、不準）；伺服器每 10ms 推播時間（浪費且違反
  只在狀態改變時推播的設計）。

## R6. 提交時間提示（TimeHint）

- **Decision**：自製無相依的 `TimeHint` 元件：一個 `<button aria-label="查看提交時間">`（時鐘圖示，SVG），
  `pointerenter`／`focus` 時顯示、`pointerleave`／`blur`／`Escape` 時關閉；小視窗為 `role="tooltip"`，以
  `aria-describedby` 連到按鈕，透過 React Portal 渲染到 `document.body`、`position: fixed`，依按鈕位置放在上方，
  超出視窗時改放下方並把水平位置夾在可視範圍內（FR-016）。內容：`提交時間 HH:mm:ss.SSS` 與
  `開始後 formatElapsed(receivedAt − openedAt)`。
  - 搶答進行中：每筆送出紀錄都有提示（資料來自 `TeacherView.submissions[].receivedAt`）。
  - 已結束：結果資料 `TeacherResultView` 新增 `receivedAt`（搶答成功作答的收件時間），無人搶答為 null、不顯示圖示。
- **Rationale**：需求單純（一行兩個時間），引入浮動定位套件不符 YAGNI；Portal + fixed 可確保不推擠版面。
- **Alternatives considered**：原生 `title` 屬性（無法鍵盤觸發、樣式不可控、顯示延遲）；Floating UI 套件（多一個相依）。

## R7. 匯出模式的契約

- **Decision**：共用契約新增 `ExportModeSchema = z.enum(['answers-only', 'answers-with-columns',
  'answers-with-note-line'])`；匯出請求由 001 的 `EmptyRequestSchema` 改為
  `ExportRequestSchema = z.strictObject({ mode: ExportModeSchema.default('answers-only') })`，送出空物件時等同
  「只有答案」（相容 001 的呼叫方式）；其他值回 `400 VALIDATION_FAILED`。`ExportResponse`、`LastExport`
  都加上 `mode`。畫面上的模式名稱與說明集中定義在 shared 的 `EXPORT_MODE_LABEL`、`EXPORT_MODE_DESCRIPTION`。
- **Rationale**：伺服器端驗證模式（FR-017）；預設值讓既有測試與模擬腳本不需改動。

## R8. Google Sheets 寫入方式

- **Decision**：匯出寫入由 001 的 `spreadsheets.values.batchUpdate` 改為**單一** `spreadsheets.batchUpdate`：
  1. 先讀取 `sheets.properties(sheetId,title,gridProperties.columnCount)`；
  2. 若任何寫入的欄位超出工作表目前欄數，加入一個 `appendDimension`（COLUMNS）請求補足；
  3. 每個目標儲存格一個 `updateCells` 請求：`rows[0].values[0] = { userEnteredValue: { stringValue }, textFormatRuns }`，
     `fields: 'userEnteredValue,textFormatRuns'`，`start` 為工作表 ID＋列欄位置。
     - `text` 為空字串時不給 `userEnteredValue`（清空該格）。
     - `mutedFrom` 為 null 時 `textFormatRuns` 為空（清除先前附註行的格式）；否則為兩段：
       `{ startIndex: 0, format: {} }`（沿用儲存格原有格式）與
       `{ startIndex: mutedFrom, format: { fontSize: 8, foregroundColorStyle: { rgbColor: 灰色 #80868B } } }`。
  請求內容由純函式 `buildBatchUpdateRequests(sheetProperties, writes)` 產生並單元測試，不需連線 Google。
- **Rationale**：
  - 格內附註行需要「同一格不同文字樣式」，只有 `updateCells` 的 `textFormatRuns` 能做到。
  - `spreadsheets.batchUpdate` 中任何一個請求無效，整批都不會套用，比 001 更確實地達成全有或全無（FR-022）。
  - `stringValue` 一律當文字，不會被解析成公式或數字，效果等同 001 的 RAW（答案以「=」開頭也安全；提交時間的
    毫秒不會被轉成日期而捨去，FR-019）。
  - 「只有答案」模式也走同一條路徑，寫入的文字與 001 完全相同；另外會清除先前附註行模式留下的文字格式，
    使切換模式後答案格的外觀正確。
  - 不改動 `userEnteredFormat`（儲存格框線、底色、對齊等），符合「只改目標位置」。
  - 權限範圍（`spreadsheets` scope、服務帳號為編輯者）與 001 相同，不需要新的 Google 設定。
- **Alternatives considered**：values API 寫文字＋另一個 batchUpdate 寫格式（兩次呼叫，中途失敗會只寫一半）；
  `textFormatRuns` 的 `startIndex` 以 UTF-16 code unit 計算，與 JavaScript 字串索引一致，因此 `mutedFrom` 直接用
  JavaScript 字串長度計算。

## R9. 「答案＋組別時間欄」的定位

- **Decision**：
  - 解析結果 `ParsedGuidedNotes` 新增 `headerRowIndex`、`usedColumnCount` 與 `resultColumns`。
    `usedColumnCount` = 所有列最後一個非空白儲存格的欄號 + 1，與所有合併範圍 `endColumn` 的最大值。
    `resultColumns` = 表頭列中內容恰為「搶答組別」「提交時間」的欄（沒有則為 null）。
  - 匯出時：缺少的欄依序新增在 `usedColumnCount` 起的空白欄（只缺一欄就只新增那一欄），並寫入表頭文字。
  - 每題的「題目區塊第一列」= 該題所有填空格中最小的列號；搶答成功 → 寫入 `第 N 組` 與提交時間；
    無人搶答 → 該列兩欄寫空字串（清空）。
  - 這兩欄不在 001 的定位規則內，重新匯入時被忽略（FR-023）。
- **Rationale**：新增在使用範圍之外，保證不覆蓋任何既有內容；以表頭名稱沿用既有欄，同一模式重複匯出不會重複
  新增欄位（FR-021）。

## R10. 「答案＋格內附註行」的內容

- **Decision**：附註行文字為 `〔第 N 組｜YYYY/MM/DD HH:mm:ss.SSS〕`。答案格內容 = `答案值 + "\n" + 附註行`，
  `mutedFrom` = 換行字元的位置（換行與附註行都用淡化樣式）。答案值依 001 規則（題組保留「（n）」標記）。
  單題寫在該題填空格；題組只在最後一個子題填空格加附註行，其他子題只有答案。
  重新匯入時，作答格的「（n）」標記判斷只看開頭，附註行在第二行以後，不影響（FR-023）。
- **Rationale**：全形括號與「｜」分隔加上較小灰字，與答案在文字和樣式上都明顯不同（FR-018）；整格覆寫使重複
  匯出結果相同。

## R11. 時間格式與時區

- **Decision**：伺服器端以純函式 `formatSubmittedAt(iso)` 依執行環境本地時區產生 `YYYY/MM/DD HH:mm:ss.SSS`；
  前端 `formatClock(iso)` 產生 `HH:mm:ss.SSS`。自動化測試在 Vitest 設定中固定 `TZ=Asia/Taipei`，讓結果可重現。
- **Rationale**：系統只在本機執行，伺服器與瀏覽器同一台電腦、同一時區（spec Assumptions）。

## R12. 圖表

- **Decision**：依原則 VI 建立 `diagrams/002-teacher-dashboard-enhancements-{component,class,sequence}.puml`
  並以 `plantuml "./diagrams/*.puml"` 產生 PNG，作為本 plan 的藍圖。類別圖只畫本子功能新增或修改的成員，其餘沿用
  001 類別圖。
- **Note**：原則 VI 要求圖表在 specify 階段產生；本子功能在 specify 階段遺漏，於 plan 開始時補上，並在設計前
  完成，仍作為規劃的主要藍圖（記錄於 plan 的 Complexity Tracking）。

## R13. 測試策略

- **Decision**：
  - 單元：`parseGuidedNotes` 題目敘述（兩份範例＋無「題目」表頭＋已匯出文件的變體）、`planExport` 三種模式
    （兩份範例）、`buildBatchUpdateRequests`、`formatSubmittedAt`、`formatElapsed`、`togglePreview`。
  - 整合：匯出 API 的 mode 驗證與三種模式的寫入結果、重複匯出相同、匯出後重新匯入成功、無法定位時全不寫入、
    學生與公開資料不含敘述（SC-009）、舊存檔載入。
  - 前端：QuestionList 預覽切換與 `aria-pressed`、SessionTimer（假時鐘與假 `requestAnimationFrame`）、
    TimeHint 滑鼠與鍵盤顯示／關閉、ExportPanel 模式選擇與送出內容。
  - 新增測試文件：`exported-columns.json`（已有「搶答組別」「提交時間」欄）、`exported-note-line.json`
    （作答格含附註行）、`no-prompt-header.json`（沒有「題目」表頭）。
- **Rationale**：符合原則 VII（正常＋錯誤案例、可見性專門測試、兩份版面不同的文件）。
