import { groupName, type SessionStatus, type TeacherView } from '@crs/shared';

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
            prompt: '二進位由數字 1 和哪一個數字構成？',
            blanks: [{ index: 1, label: null, prompt: null }],
          },
          {
            number: 4,
            kind: 'single',
            blankCount: 1,
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
