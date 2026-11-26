# 006 老師端學生分組情況面板：對外變更摘要（給 OpenSpec 小組）

**分支**：`006-teacher-group-overview`　**詳細規格**：[spec.md](./spec.md)

## 一句話

老師端新增「分組情況」面板：列出每組的組員暱稱、每位組員替本組送出了哪幾題（搶答成功醒目標示）、斷線緩衝中標示
「連線中斷」、已不在組內的送出者以灰色保留。學生端看到的資料、作答與兩種匯出都不變。

## 1. 資料契約（`packages/shared`）

詳見 [contracts/teacher-view.md](./contracts/teacher-view.md)。

- `Submission` 新增 `submitterMemberId: string (uuid) | null`：送出者的學生身分，取自 token；006 之前的保存檔讀取時為
  `null`（不需遷移）。送出請求不能指定此欄位（`SubmitRequestSchema` 為 strict，夾帶時回 400）。
- `TeacherView` 新增 `groupOverview: GroupOverview[]`（依組別編號；尚未匯入時為 `[]`）：
  - `GroupOverview`：`groupId`、`memberCount`（只算在組內，等於學生端人數）、`members`。
  - `OverviewMember`：`memberId`、`nickname`、`inGroup`、`disconnected`、`answered`。
  - `MemberAnswerTag`：`questionNumber`、`isWinner`（與既有的搶答結果判定相同）。
- **不變**：`StudentView`、`PublicView`、`OwnSubmission`、`ResultView`、所有 HTTP 路徑與請求格式。

## 2. 即時推播

詳見 [contracts/realtime-events.md](./contracts/realtime-events.md)。不新增事件名稱。

- 名冊改變（加入、30 秒到期移除、離開組別、清空）時，除了原本的公開與各組推播，**也推播 TeacherView 給老師**。
- 新的名冊事件 `disconnected`（組員所有分頁斷線、開始 30 秒緩衝）與 `reconnected`（緩衝期內重連）**只推播給老師**；
  人數規則不變（緩衝中仍計入）。
- 新增 log：`student.roster.disconnected`、`student.roster.reconnected`（只含 groupId、memberId）。

## 3. 老師端畫面

詳見 [contracts/teacher-ui.md](./contracts/teacher-ui.md)。

- 視窗寬度 ≥ 1600 px：主畫面置中；面板固定在主畫面右緣到視窗右緣之間的框架並在框架內置中，不隨主畫面捲動，內容多時框架內捲動；沒有收起按鈕。
- < 1600 px：右上角浮動「分組情況」按鈕，按下從右側展開抽屜；「關閉」、點背景、Esc 都能關閉。
- 只顯示，不提供調整分組的操作。

## 4. 需要對齊的決策

| 決策 | 本組做法 |
|------|----------|
| 題號標註依據 | 依送出者身分（memberId），不依暱稱 |
| 已不在組內的送出者 | 仍列在原組最後，灰色「不在組內」，不計入人數 |
| 搶答成功標示 | 「★」＋醒目樣式＋「搶答成功」文字，不只靠顏色 |
| 斷線緩衝期 | 標示「連線中斷」，仍計入人數 |
| 版面門檻 | 1600 px（主畫面 1024 px 置中時右側才放得下面板） |
