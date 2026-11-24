# Research: 學生端細修：暱稱、組別人數與題目敘述

**Feature**: `004-student-side-refinements` | **Date**: 2026-11-24 | **Plan**: [plan.md](./plan.md)

本文件記錄 plan 階段的技術決策。spec 沒有留下 NEEDS CLARIFICATION；下列決策處理 spec 延到 plan 的兩項
（隨機名字來源、名冊在伺服器重啟後的重建）與其他實作選擇。

## R1：隨機短英文名字的來源

- **Decision**：web 端加入相依套件 `@faker-js/faker`（MIT、持續維護），只匯入英文語系
  （`import { faker } from '@faker-js/faker/locale/en'`），以 `faker.person.firstName()` 產生英文名字；
  `randomNickname(exclude?)` 重複產生，直到名字「只含英文字母、3～10 字」且不等於 `exclude`；不合格的名字直接
  丟棄重新產生，只有「合格但等於 `exclude`」才計入嘗試次數，達到上限時回傳該合格名字（一定有合格名字可回傳）；「換一個」時排除目前輸入欄的名字，避免看起來沒有變。
- **Rationale**：使用者要求優先找現成套件，而 constitution「技術限制」規定 MUST NOT 使用已停止維護的套件。
  faker 持續發版（2026 年仍有新版本），英文名字清單足以滿足 SC-002（連按 20 次至少 15 個不同名字）；
  只匯入英文語系，打包時不會帶入其他語系的資料；不需要網路。只在瀏覽器端使用，伺服器不依賴它。
- **Alternatives considered**：
  - `unique-names-generator`：套件小、有現成的英文名字字典，但最後一次發版是 2022 年 5 月，屬於已停止維護的
    套件，違反 constitution，不採用。
  - `human-id`：產生「形容詞＋名詞＋動詞」組合，不是「短英文名字」。
  - 在 repo 內自行維護名字清單：沒有相依套件，但使用者明確想用套件；清單維護也是額外工作。
- **備註**：英文語系的名字資料讓主程式從約 393 kB 增加到約 812 kB（超過 Vite 的 500 kB 警告）。因此學生端頁面
  改為延遲載入（`App.tsx` 以 `lazy` 載入 `StudentPage`），名字資料只在打開學生端時下載，主程式維持約 383 kB；
  若未來要移除套件，只需替換 `randomNickname` 的實作。

## R2：暱稱的規則與保存位置

- **Decision**：
  - 規則放在 `packages/shared`：`NicknameSchema` 去除前後空白後 1～20 字（以 `unicodeLength` 計算，與答案
    字數同一套算法）、不得包含換行等控制字元；`NICKNAME_MAX_LENGTH = 20`。前端暱稱頁與伺服器加入 API 共用。
  - 前端以分頁的 `sessionStorage`（鍵 `crs.nickname`）保存「已確認的暱稱」；尚未確認的輸入不保存
    （spec 邊界情況：未確認時重新整理會重新預填隨機名字）。
  - 離開組別、身分失效時只清除 `crs.token`、`crs.identity` 與草稿，不清除 `crs.nickname`（FR-006）。
- **Rationale**：與 003 的分頁身分相同的保存方式，天然符合「同一分頁重新整理保留、其他分頁不共享」。規則
  集中在 shared，前後端不會不一致（原則 V）。
- **Alternatives considered**：存在 `localStorage` 會讓同一瀏覽器的所有分頁共用暱稱，違反 FR-006。

## R3：組員身分（memberId）與 token

- **Decision**：
  - `POST /api/auth/student` 的請求改為 `{ groupId, nickname }`（strict），伺服器驗證暱稱後在 token 內放入
    新的 `memberId`（伺服器產生的 UUID）與正規化後的 `nickname`。
  - 回應的 `identity`（`IdentitySummary` 學生分支）同步加入 `memberId`、`nickname`，前端用來標示「自己」。
  - 舊版（004 之前）簽發的學生 token 不含這兩個欄位，驗證失敗，分頁會依 003 的流程回到選組畫面並說明身分
    已失效；學生暱稱仍在，只需重新選組。
- **Rationale**：memberId 隨 token 保存在分頁，重新整理或重連都是同一位組員（FR-012）；暱稱放在簽章 token 內，
  伺服器重新啟動後不需額外保存就能重建名冊（FR-013），送出時也能從 token 取得送出者暱稱，不必相信請求內容
  （FR-023、原則 I）。
- **Alternatives considered**：
  - 以 socket id 當組員：重新整理就換成另一位，無法滿足 FR-012。
  - 把名冊寫進 `data/session.json`：名冊是連線狀態，寫入檔案會在伺服器重啟後留下已經關閉的分頁。

## R4：組員名冊（GroupRoster）與 30 秒緩衝

- **Decision**：新增伺服器領域模組 `GroupRoster`（只在記憶體）：
  - 以 memberId 為鍵記錄 `groupId`、`nickname`、加入順序 `joinedSeq`、目前連線數與移除計時器。
  - `RealtimeGateway` 在學生 socket 連線時呼叫 `connected()`（第一次出現即加入名冊，若有移除計時器就取消），
    斷線時呼叫 `disconnected()`；連線數歸零後啟動 30 秒計時器，到期才移除（FR-012）。
  - `leave(memberId)` 立即移除並記錄在本次活動的「已離開」集合；之後同一 token 連線或送出一律視為身分失效。
  - 新的活動（`reset` 變更）時 `clear()`：清空名冊、已離開集合與所有計時器（FR-015）。
  - 名冊改變時發出 `onChange`，由 `RealtimeGateway` 推播（R6）。
  - 計時器與時間以建構參數注入，單元測試用假的計時器驗證 30 秒行為。
- **Rationale**：「在組內」依連線判斷是 clarify 的結論；名冊與作答資料分開，不影響 001 的狀態機與保存格式。
  加入順序用遞增序號而不是時間，排序結果確定可重現（原則 I）。
- **伺服器重新啟動**：名冊從空的開始；學生分頁自動重連（003 FR-010）後，伺服器從 token 取得 memberId、
  組別與暱稱重新加入名冊（FR-013）。加入順序改為重連的先後，這是可接受的差異。「已離開」集合也會清空，但離開
  組別的分頁已經刪除 token，不會再以舊身分連線。
- **身分逾時**：token 有效期 12 小時（沿用 001），遠長於一堂課。名冊不主動檢查連線中的 token 是否到期；到期的
  token 在下一次連線或送出時才被拒絕（003 流程回到選組畫面），斷線後依 30 秒緩衝移出名冊（FR-012）。
- **Alternatives considered**：以 Socket.IO room 的成員數直接計算人數：無法提供 30 秒緩衝，也拿不到暱稱。

## R5：離開組別要通知伺服器

- **Decision**：新增 `POST /api/auth/student/leave`（只限學生 token，空的請求內容）：
  - 只在「待開始」接受；其他階段回 `409 LEAVE_NOT_ALLOWED`（與 003 FR-005 一致，伺服器也檢查）。
  - 成功時 `GroupRoster.leave(memberId)`，回 `204`；前端收到後才清除 token 與身分，回到選組畫面。
  - 連線失敗時前端顯示錯誤並保持在組內，不清除身分，避免名冊與畫面不一致。
- **Rationale**：003 的「離開組別」只在前端刪除 token，伺服器要等 socket 斷線 30 秒才會移除，不符合
  「原組別人數立即減 1」（spec 邊界情況）。
- **Alternatives considered**：用 Socket.IO 自訂事件通知離開：001 刻意讓 Socket.IO 只負責伺服器推播
  （`ClientToServerEvents` 為空），新增上行事件會破壞這個設計。

## R6：人數與名冊的推播

- **Decision**：
  - `PublicView` 新增 `headcounts`；`StudentView` 新增 `headcounts` 與 `members`（只有本組，依 `joinedSeq`）。
    老師檢視不加（clarify：老師端不顯示人數與名冊）。
  - 名冊改變時，`RealtimeGateway` 對 public room 與每個 group room 推送 `session:state`，`version` 沿用目前的
    活動版本（名冊不是活動狀態，不遞增版本）。前端 `useSessionState` 只忽略「比目前更舊」的版本，同版本會套用，
    因此名冊更新一定會顯示。
  - 活動狀態推播（`state`、`submission`）產生檢視時也帶入最新名冊，兩種推播內容一致。
- **Rationale**：不新增事件，學生端仍只需訂閱 `session:state`（003 契約不變）；1 秒內更新（SC-003）。
- **Alternatives considered**：新增 `roster:update` 事件：前端要合併兩種來源的資料，重連時還要另外補送。

## R7：學生端的題目敘述

- **Decision**：
  - `StudentView.questions` 改為 `StudentQuestionView`：在 `QuestionSummary` 上加 `content`（型別 `QuestionTexts`，可為 null）；
    `content = { prompt, blankPrompts }`，`prompt` 為題目敘述或題組說明，`blankPrompts` 依子題順序。
  - `VisibilityPolicy.toStudentView` 只在 `OPEN`、`CLOSED` 填入 `content`，其他階段為 `null`；`PublicView`
    維持 `QuestionSummary`，任何階段都不含敘述（FR-018、FR-019）。
  - 「文件沒有敘述」與「目前不提供」分開表示：`content === null` 代表不提供；`content.prompt === null` 代表
    文件沒有敘述（顯示「文件未提供題目敘述」）。
- **Rationale**：以單一 `content` 欄位控制可見性，測試只要檢查一個欄位就能證明「待開始」前沒有敘述（SC-006）。
- **Alternatives considered**：把 `TeacherQuestionView` 直接給學生：型別會讓學生端誤以為永遠有敘述，也較難檢查。

## R8：共用的題目版面（QuestionContent）

- **Decision**：把老師端 `QuestionPreview` 的版面抽成 `apps/web/src/components/QuestionContent.tsx`：輸入為題號、
  題型、`prompt` 與 `blanks: { label, prompt }[]`，另有選用的 `renderBlank(index)` 讓學生端在每個子題下方插入
  輸入欄或結果。老師端 `QuestionPreview` 改為使用它，畫面不變（002 測試保持通過）。
- **Rationale**：FR-017 要求版面與老師端預覽相同；共用元件保證兩邊一致，不需要複製樣式。

## R9：送出者暱稱

- **Decision**：
  - `Submission` 新增 `submitterNickname: string | null`。讀取舊的 `data/session.json` 時缺少此欄位視為
    `null`（schema 給預設值），舊資料不需轉換；新送出一律寫入。
  - `SubmissionService.submit` 改為接收學生身分（組別、memberId、暱稱），暱稱取自 token（FR-023）；
    已離開的 memberId 送出時回 `401`（R4）。
  - `OwnSubmission` 新增 `submitterNickname`（本組隨時可見，FR-024）；`ResultView` 新增 `submitterNickname`
    （搶答成功答案的送出者）。學生檢視的 `results` 只在 `CLOSED` 才有值，因此其他組的送出者只在結束後出現
    （FR-025）。老師檢視本來就含全部 `submissions`，加上欄位即可顯示（FR-026）。
- **Rationale**：可見性仍由既有的 `toStudentView` 控制，不新增新的過濾路徑。

## R10：匯出格式

- **Decision**（FR-027）：
  - 「答案＋格內附註行」：`attribution()` 改為 `〔第 N 組｜暱稱｜時間〕`；送出者為 `null` 時維持 `〔第 N 組｜時間〕`。
    樣式（較小灰色字）、寫入位置與題組只寫一次的規則不變。
  - 「答案＋組別時間欄」：新增表頭「搶答送出者」，與「搶答組別」「提交時間」相同的方式定位（解析器在表頭列找
    既有欄）或新增在使用範圍之後；無人搶答與送出者為 `null` 時寫入空字串。
  - 重複匯出寫入內容相同；只寫搶答成功答案的送出者。
- **Rationale**：沿用 002 的動態定位（原則 III），不寫死欄位；兩份版面不同的測試文件都要通過（原則 VII）。

## R11：紀錄（log）

- **Decision**：`student.joined` 加上 `memberId`，新增 `student.left`（含 `groupId`、`memberId`）與
  `student.roster.removed`（斷線逾時移除）；任何 log 都不含暱稱與 token（FR-022）。
- **Rationale**：暱稱由學生自訂，可能是真實姓名，log 不記錄以減少個人資料外流。

## R12：模擬學生腳本

- **Decision**：`scripts/simulate-students.ts` 加入組別時帶入暱稱（例如 `Sim-1`），其他行為不變。
- **Rationale**：`StudentJoinRequest` 改為必填暱稱，腳本必須跟著更新才能繼續用於壓力測試。
