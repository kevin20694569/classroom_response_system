# HTTP API 契約（003 相對於 001、002 的變更）

**Feature**: `003-student-quiz-participation` | 基準：[001 contracts/http-api.md](../../001-teacher-quiz-session/contracts/http-api.md)、
[002 contracts/http-api.md](../../002-teacher-dashboard-enhancements/contracts/http-api.md)

本子功能**不新增、不刪除任何 API**，也不改變請求格式、錯誤代碼或判定規則。學生端使用的 API 與唯一的
回應變更如下。

## 1. 學生端使用的 API

| API | 用途 | 需求 |
|-----|------|------|
| `POST /api/auth/student { groupId }` | 加入組別，取得綁定分頁的 token 與 `identity` | FR-001、FR-003 |
| `POST /api/submissions { questionNumber, answers }` | 以本組名義送出答案；組別取自 token | FR-014～FR-019 |

`GET /api/session` 學生端不呼叫：連線（含重連）時伺服器會立即推送完整的 `session:state`（001 既有行為）。

## 2. 回應變更：`QuestionSummary.blankLabels`

所有回傳檢視資料的回應（`GET /api/session` 的 Public／Student／Teacher 檢視，以及老師端操作回傳的
`TeacherView`）中，每一題多一個欄位：

```json
{ "number": 1, "kind": "group", "blankCount": 2, "blankLabels": ["（1）", "（2）"] }
```

```json
{ "number": 3, "kind": "single", "blankCount": 1, "blankLabels": [null] }
```

規則見 [data-model.md §1](../data-model.md)：長度等於 `blankCount`，只含標記原文，不含任何敘述。

## 3. 學生端對錯誤代碼的處理

錯誤代碼與 HTTP 狀態沿用 001；學生端的畫面處理見 [research.md R4、R8](../research.md)：

| API | 錯誤代碼 | 學生端處理 |
|-----|----------|------------|
| 加入 | `NO_ACTIVE_ACTIVITY` | 顯示伺服器訊息，回到等待匯入畫面 |
| 加入 | `INVALID_GROUP` | 顯示伺服器訊息，保留在選組畫面（組別清單由推播更新） |
| 送出 | `SESSION_NOT_OPEN` | 「搶答已結束，這次送出沒有被採計」，停用作答 |
| 送出 | `ALREADY_SUBMITTED` | 「本組已送出此題」，顯示本組答案，清除草稿 |
| 送出 | `ANSWER_INCOMPLETE`、`ANSWER_INVALID` | 依 `details[].blankIndex` 標示子題與原因，保留輸入 |
| 送出 | `QUESTION_NOT_FOUND`、`VALIDATION_FAILED`、`INTERNAL_ERROR` | 顯示伺服器訊息，保留輸入 |
| 送出 | `FORBIDDEN` | 不應發生（老師身分的分頁不顯示作答功能，FR-008）；顯示伺服器訊息 |
| 任何 | `UNAUTHORIZED` | 身分失效（reason `EXPIRED`），回到選組畫面 |
| 任何 | 連線失敗（前端 `NETWORK_ERROR`） | 「無法連線到伺服器，連線恢復後請再送出一次」，保留輸入 |
