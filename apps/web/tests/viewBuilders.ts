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
          { number: 1, kind: 'group', blankCount: 2 },
          { number: 2, kind: 'group', blankCount: 2 },
          { number: 3, kind: 'single', blankCount: 1 },
          { number: 4, kind: 'single', blankCount: 1 },
        ]
      : [],
    activityId: imported ? '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11' : null,
    source: imported ? { spreadsheetId: 'group-doc', sheetTitle: '學習單' } : null,
    submissions: [],
    results: imported
      ? [1, 2, 3, 4].map((n) => ({ questionNumber: n, winnerGroupId: null, answers: null }))
      : [],
    openedAt: null,
    closedAt: null,
    lastExport: null,
    ...overrides,
  };
}
