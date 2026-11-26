# 老師檢視資料契約（006）

定義在 `packages/shared/src/views.ts`（`Submission` 在 `domain.ts`），以 Zod schema 為唯一來源；前端收到的
`session:state` 與 `GET /api/session` 都以 `SessionViewSchema` 驗證。資料結構細節見 [data-model.md](../data-model.md)。

## 新增的 schema

```ts
MemberAnswerTagSchema = z.object({
  questionNumber: z.number().int().positive(),
  isWinner: z.boolean(),
});

OverviewMemberSchema = z.object({
  memberId: z.uuid(),
  nickname: z.string(),
  inGroup: z.boolean(),
  disconnected: z.boolean(),
  answered: z.array(MemberAnswerTagSchema),
}); // refine：inGroup = false 時 disconnected 必為 false 且 answered 非空

GroupOverviewSchema = z.object({
  groupId: GroupIdSchema,
  memberCount: z.number().int().nonnegative(),
  members: z.array(OverviewMemberSchema),
}); // refine：memberCount = inGroup 成員數；inGroup 成員排在前面；memberId 不重複
```

## 修改的 schema

| Schema | 變更 |
|--------|------|
| `SubmissionSchema` | 新增 `submitterMemberId: z.uuid().nullable().default(null)` |
| `TeacherViewSchema` | 新增 `groupOverview: z.array(GroupOverviewSchema)` |

## 不變（SC-005 以測試證明）

| Schema | 說明 |
|--------|------|
| `StudentViewSchema` | 不新增欄位；`members` 仍只有本組、`OwnSubmission` 不含 `submitterMemberId` |
| `PublicViewSchema` | 不新增欄位；只有 `headcounts` |
| `SubmitRequestSchema` | 不新增欄位；送出者身分只取自 token |

## 範例（搶答進行中、共 2 組）

```json
"groupOverview": [
  {
    "groupId": 1,
    "memberCount": 2,
    "members": [
      { "memberId": "…a1", "nickname": "Milo", "inGroup": true, "disconnected": false,
        "answered": [{ "questionNumber": 1, "isWinner": true }, { "questionNumber": 3, "isWinner": false }] },
      { "memberId": "…a2", "nickname": "Ava", "inGroup": true, "disconnected": true, "answered": [] },
      { "memberId": "…a3", "nickname": "Leo", "inGroup": false, "disconnected": false,
        "answered": [{ "questionNumber": 2, "isWinner": false }] }
    ]
  },
  { "groupId": 2, "memberCount": 0, "members": [] }
]
```

（第 1 組 2 人：Milo 在組內、Ava 在組內但連線中斷；Leo 已不在組內但送出過第 2 題，不計入人數。）
