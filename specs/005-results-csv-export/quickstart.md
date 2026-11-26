# Quickstart：搶答結果匯出 CSV

**Feature**: `005-results-csv-export` | **Plan**: [plan.md](./plan.md)

## 1. 事前準備

與 001 相同：Node.js 26 LTS、Google 服務帳號金鑰、`.env`、課程兩份 Guided Notes 的副本並分享給服務帳號，
詳見 [001 quickstart.md §1](../001-teacher-quiz-session/quickstart.md)。本子功能**不需要**新的環境變數、Google 權限或相依套件。
人工驗證需要 Windows 版 Microsoft Excel（clarify Q3）。

## 2. 安裝與啟動

```bash
nvm use
```

```bash
npm ci
```

```bash
npm start
```

老師端：<http://localhost:3000/teacher>；學生端：<http://localhost:3000/student>。

## 3. 自動化驗證（每個 Phase 結束時都必須全部通過）

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run format:check
```

```bash
npm test
```

與本子功能相關的測試（可單獨執行）：

```bash
npx vitest run apps/server/tests/unit/csvEncoder.test.ts apps/server/tests/unit/resultRows.test.ts apps/server/tests/unit/csvFileName.test.ts apps/server/tests/unit/csvResultExporter.test.ts apps/server/tests/integration/csvExport.test.ts apps/web/tests/CsvExportPanel.test.tsx apps/web/tests/contentDisposition.test.ts
```

預期：全部通過；既有的 `export.test.ts`、`exportPlan.test.ts`、`ExportPanel.test.tsx`（Guided Notes 匯出）不需修改且仍然通過（FR-016）。

## 4. 用 curl 驗證 API（選擇性）

先在老師端登入，從瀏覽器開發者工具的 `sessionStorage` 複製老師 token：

```bash
curl -i -H "Authorization: Bearer <老師 token>" http://localhost:3000/api/session/export.csv -o results.csv
```

- 搶答結束前：`409`，body 為 `{"error":{"code":"INVALID_TRANSITION","message":"搶答結束後才能匯出 CSV。"}}`。
- 結束後：`200`，header 與 [contracts/http-api.md](./contracts/http-api.md) 相同；`results.csv` 的前三個位元組是 `EF BB BF`。
- 不帶 token：`401`；帶學生 token：`403`。

## 5. 人工驗證清單（老師端＋兩組學生端）

每一項標記通過／不通過；全部通過才算完成。

### A. 單題範例（老師＋第 1、2 組各一個分頁，設定 3 組）

1. [ ] 老師匯入「單題範例」。「匯出 CSV」按鈕停用，旁邊顯示「搶答結束後才能匯出 CSV。」
2. [ ] 開啟搶答。按鈕仍然停用、提示仍在。
3. [ ] 第 2 組（暱稱 Milo）送出第 1 題答案「蘋果, 香蕉」；第 1 組（暱稱 `A,B`）接著送出第 1 題，答案「橘子」。
   （學生端輸入欄是單行，無法輸入換行；答案含換行的情況由自動化測試以 API 直接送出驗證。）
4. [ ] 第 1 組送出第 2 題答案「=1+1」；第 2 組送出第 3 題答案 `他說"好"`。其餘題目都不作答。
5. [ ] 老師結束搶答。1 秒內「匯出 CSV」變成可以按，提示消失；不需重新整理。
6. [ ] 按下「匯出 CSV」。瀏覽器下載「搶答結果_YYYYMMDD-HHmm.csv」，時間與開啟搶答的時間相同；畫面顯示「已下載 …」。
7. [ ] 在檔案總管對檔案點兩下，用 Windows 版 Excel 直接開啟：表頭與所有中文正常，沒有亂碼。
8. [ ] 表頭依序為「題號、子題、組別、送出者暱稱、答案、搶答順位、送出時間、是否搶答成功」；單題的「子題」欄都是空的。
9. [ ] 第 1 題有兩列：第 2 組 Milo「蘋果, 香蕉」第 1 名、是；第 1 組 `A,B`（完整在送出者暱稱欄）「橘子」、第 2 名、否。後面的欄位都沒有錯位。
10. [ ] 第 2 題答案顯示為文字「=1+1」（開頭可能多一個 `'`），沒有被算成 2；第 3 題顯示 `他說"好"`。
11. [ ] 答案或暱稱為「007」「1/2」「3:30」「TRUE」這類值時，Excel 顯示原樣（007 沒變 7、1/2 沒變日期或分數、TRUE 沒變布林），儲存格內容不多出單引號。
12. [ ] 「送出時間」欄在 Excel 直接顯示完整的日期與時間（如「2026-11-26 13:11:00」），不是「分:秒.小數」；欄寬不足時顯示 `####` 屬正常，拉寬即可。
13. [ ] 每一題沒有人作答的題目都恰好一列，答案為「無人作答」，其他欄位空白；所有列依題號、再依順位排序。
14. [ ] 與老師端送出列表逐筆比對：組別、送出者、答案、「第 N 名」與搶答成功標示完全一致（SC-002）。
15. [ ] 再按一次「匯出 CSV」，下載的檔名相同；用比較工具（例如 `fc /b`）比對兩份檔案，內容完全相同。
16. [ ] 以學生分頁的開發者工具確認：學生端沒有「匯出 CSV」按鈕，學生收到的資料沒有任何 CSV 內容。

### B. 題組範例（老師＋第 1、2 組各兩個分頁，設定 4 組）

1. [ ] 老師匯入「題組範例」並開啟搶答。
2. [ ] 第 3 組送出第 1 題（題組），接著第 1 組也送出第 1 題；某一題完全不作答；第 4 組送出另一題。
3. [ ] 結束搶答並匯出 CSV，用 Excel 開啟。
4. [ ] 第 1 題第 3 組的送出拆成每個子題一列，「子題」欄依序為「子題1」「子題2」（不是「（1）」，也不是 -1、-2 或日期），各列的組別、送出者、
       順位、時間、是否搶答成功都相同；第 3 組的所有子題列都排在第 1 組之前。
5. [ ] 無人作答的題組只有一列「無人作答」，「子題」欄空白。

### C. 錯誤處理與既有功能

1. [ ] 在結束搶答後重新整理老師分頁，「匯出 CSV」仍可使用。
2. [ ] 結束搶答後停止伺服器（Ctrl+C）再 `npm start`，重新登入老師端後匯出，內容與重新啟動前相同。
3. [ ] 停止伺服器後在老師端按「匯出 CSV」：顯示「無法連線到伺服器，請確認系統已啟動。」，沒有下載任何檔案。
4. [ ] 以三種模式各執行一次「匯出至原 Guided Notes」，結果與 004 相同（附註行、送出者欄位、只寫入搶答成功答案）；
       匯出 CSV 不會改變「上次匯出」的資訊，也不會修改 Guided Notes 文件。
5. [ ] 檢查伺服器 log：每次 CSV 匯出都有一筆 `csv_export.succeeded`（或 `csv_export.failed`）紀錄，只含列數或錯誤代碼，
       不含答案或暱稱。
