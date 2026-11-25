import {
  groupName,
  type PublicView,
  type QuestionSummary,
  type SessionStatus,
  type StudentQuestionView,
  type StudentView,
  type TeacherView,
} from '@crs/shared';

/** 前端測試用的老師檢視資料。 */
export function teacherView(overrides: Partial<TeacherView> = {}): TeacherView {
  const status: SessionStatus = overrides.status ?? 'READY';
  const imported = status !== 'NOT_IMPORTED';
  return {
    viewer: 'teacher',
    status,
    groups: imported ? [1, 2].map((id) => ({ id, name: groupName(id) })) : [],
    questions: imported
      ? [
          {
            number: 1,
            kind: 'group',
            blankCount: 2,
            blankLabels: ['（1）', '（2）'],
            prompt: null,
            blanks: [
              { index: 1, label: '（1）', prompt: '電腦的「大腦」英文簡稱是什麼？' },
              { index: 2, label: '（2）', prompt: '管理軟硬體資源的系統軟體稱為什麼？' },
            ],
          },
          {
            number: 2,
            kind: 'group',
            blankCount: 2,
            blankLabels: [null, null],
            prompt: null,
            blanks: [
              { index: 1, label: null, prompt: '步驟明確的邏輯稱為什麼？' },
              { index: 2, label: null, prompt: null },
            ],
          },
          {
            number: 3,
            kind: 'single',
            blankCount: 1,
            blankLabels: [null],
            prompt: '二進位由數字 1 和哪一個數字構成？',
            blanks: [{ index: 1, label: null, prompt: null }],
          },
          {
            number: 4,
            kind: 'single',
            blankCount: 1,
            blankLabels: [null],
            prompt: null,
            blanks: [{ index: 1, label: null, prompt: null }],
          },
        ]
      : [],
    activityId: imported ? '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11' : null,
    source: imported ? { spreadsheetId: 'group-doc', sheetTitle: '學習單' } : null,
    submissions: [],
    results: imported
      ? [1, 2, 3, 4].map((n) => ({
          questionNumber: n,
          winnerGroupId: null,
          answers: null,
          submitterNickname: null,
          receivedAt: null,
        }))
      : [],
    openedAt: null,
    closedAt: null,
    lastExport: null,
    serverNow: '2026-11-23T02:00:00.000Z',
    ...overrides,
  };
}

/** 學生與公開檢視用的題目摘要：與 teacherView() 的 4 題相同，但不含敘述（003 FR-022）。 */
function questionSummaries(): QuestionSummary[] {
  return teacherView().questions.map(({ number, kind, blankCount, blankLabels }) => ({
    number,
    kind,
    blankCount,
    blankLabels,
  }));
}

/** 前端測試用的公開檢視（沒有身分的分頁）。 */
export function publicView(overrides: Partial<PublicView> = {}): PublicView {
  const status: SessionStatus = overrides.status ?? 'READY';
  const imported = status !== 'NOT_IMPORTED';
  return {
    viewer: 'public',
    status,
    groups: imported ? [1, 2, 3].map((id) => ({ id, name: groupName(id) })) : [],
    questions: imported ? questionSummaries() : [],
    headcounts: imported ? [1, 2, 3].map((groupId) => ({ groupId, memberCount: 0 })) : [],
    ...overrides,
  };
}

/** 前端測試用的學生檢視（預設第 2 組、待開始）。 */
export function studentView(overrides: Partial<StudentView> = {}): StudentView {
  return {
    viewer: 'student',
    status: 'READY',
    groups: [1, 2, 3].map((id) => ({ id, name: groupName(id) })),
    questions: questionSummaries().map((q) => ({ ...q, content: null })),
    headcounts: [1, 2, 3].map((groupId) => ({ groupId, memberCount: 0 })),
    members: [],
    groupId: 2,
    ownSubmissions: [],
    results: null,
    openedAt: null,
    closedAt: null,
    serverNow: '2026-11-23T02:00:00.000Z',
    ...overrides,
  };
}

/**
 * 學生端題目加上題目敘述（004 research R7）：把 teacherView() 的敘述轉成 content，
 * 模擬伺服器在「搶答進行中」「已結束」時提供的資料。
 */
export function withContent(): StudentQuestionView[] {
  return teacherView().questions.map(
    ({ number, kind, blankCount, blankLabels, prompt, blanks }) => ({
      number,
      kind,
      blankCount,
      blankLabels,
      content: { prompt, blankPrompts: blanks.map((b) => b.prompt) },
    }),
  );
}
