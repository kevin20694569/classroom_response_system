# HTTP API 變更（004）

相對 001～003 的 HTTP API，只列出新增或修改的部分；其餘不變。

## 1. 學生加入組別（修改）

`POST /api/auth/student`

請求（strict，多餘欄位拒絕）：

```json
{ "groupId": 2, "nickname": "Milo" }
```

| 情況 | 狀態碼 | code | 訊息 |
|------|--------|------|------|
| 成功 | 200 | — | — |
| 暱稱不符合規則（空白、超過 20 字、控制字元） | 400 | `VALIDATION_FAILED` | 暱稱需為 1～20 字，且不能只有空白。 |
| 尚未匯入、組別不存在 | 沿用 001 | `NO_ACTIVE_ACTIVITY`、`INVALID_GROUP` | 沿用 |

成功回應：

```json
{
  "token": "…",
  "identity": {
    "role": "student",
    "groupId": 2,
    "activityId": "7c1d7a8e-…",
    "memberId": "3f0b2c1e-…",
    "nickname": "Milo",
    "expiresAt": "2026-11-25T08:00:00.000Z"
  }
}
```

- 暱稱以伺服器正規化後（去除前後空白）的值寫入 token 與回應。
- log：`student.joined`（`groupId`、`activityId`、`memberId`），不含暱稱。

## 2. 學生離開組別（新增）

`POST /api/auth/student/leave`（需要學生 token；請求內容為 `{}`）

| 情況 | 狀態碼 | code | 訊息 |
|------|--------|------|------|
| 成功（活動為「待開始」） | 204 | — | — |
| 活動不是「待開始」 | 409 | `LEAVE_NOT_ALLOWED` | 搶答已開始，無法離開組別。 |
| 沒有 token、token 無效或已離開 | 401 | `UNAUTHORIZED` | 沿用 |
| 老師 token | 403 | `FORBIDDEN` | 沿用 |

- 成功時伺服器把該 memberId 從名冊移除並記為「已離開」，立即推播新的人數與名冊。
- log：`student.left`（`groupId`、`memberId`）。
- 前端在 204 後才清除 token 與身分；失敗時保持在組內並顯示訊息。

## 3. 送出答案（行為補充，請求與回應格式不變）

`POST /api/submissions`

- 送出者暱稱取自 token 的 `nickname`，請求不得也不能附帶名字（`SubmitRequest` 仍為 strict）。
- 已離開的 memberId 送出回 `401 UNAUTHORIZED`。
- 其他判定（只在 OPEN、題號存在、子題齊全、每組每題一次、順位）沿用 001。

## 4. 檢視資料欄位（GET /api/session 與 `session:state` 共用）

欄位定義見 [data-model.md §4](../data-model.md)。範例（學生、OPEN、第 2 組）：

```json
{
  "viewer": "student",
  "status": "OPEN",
  "groups": [{ "id": 1, "name": "第 1 組" }, { "id": 2, "name": "第 2 組" }],
  "headcounts": [{ "groupId": 1, "memberCount": 2 }, { "groupId": 2, "memberCount": 1 }],
  "members": [{ "memberId": "3f0b2c1e-…", "nickname": "Milo" }],
  "questions": [
    {
      "number": 1, "kind": "group", "blankCount": 2, "blankLabels": ["（1）", "（2）"],
      "content": { "prompt": "閱讀下列敘述回答問題", "blankPrompts": ["第一小題敘述", null] }
    }
  ],
  "groupId": 2,
  "ownSubmissions": [
    { "questionNumber": 3, "answers": [{ "blankIndex": 1, "text": "答案" }], "submitterNickname": "Milo" }
  ],
  "results": null
}
```

同一時刻「待開始」的學生檢視中，每題 `content` 為 `null`；`PublicView` 的題目沒有 `content` 欄位。

## 5. 老師批改（converge 新增）

`POST /api/session/grade`（只限老師）

```json
{ "submissionId": "0b8d2c33-…", "correct": true }
```

`POST /api/session/grade/finish`（只限老師；請求內容為 `{}`）

| 情況 | 狀態碼 | code | 訊息 |
|------|--------|------|------|
| 成功 | 200 | — | 回應 `{ view: TeacherView }` |
| 活動不是「已結束」 | 409 | `GRADE_NOT_ALLOWED` | 搶答結束後才能批改。 |
| 找不到這筆送出 | 404 | `SUBMISSION_NOT_FOUND` | 找不到這筆送出，請重新整理後再試。 |
| 學生 token | 403 | `FORBIDDEN` | 沿用 |
| 沒有 token | 401 | `UNAUTHORIZED` | 沿用 |

- 勾選狀態與原本相同時不改變資料；批改完成重複按下不改變第一次的時間。
- log：`submission.graded`（題號、組別、`correct`）、`grading.finished`；不含暱稱。
