import type { QuizSession, SessionStatus } from '@crs/shared';
import { DomainError } from '../errors.js';

/** 會改變活動狀態的老師操作。 */
export type SessionAction = 'import' | 'open' | 'close';

/** 系統初始狀態：尚未匯入、沒有題目與組別，順位序號從 1 開始。 */
export function initialSession(): QuizSession {
  return {
    activityId: null,
    status: 'NOT_IMPORTED',
    source: null,
    groups: [],
    questions: [],
    submissions: [],
    nextSequence: 1,
    openedAt: null,
    closedAt: null,
    lastExport: null,
    gradingFinishedAt: null,
  };
}

const ACTION_LABEL: Readonly<Record<SessionAction, string>> = {
  import: '匯入',
  open: '開啟搶答',
  close: '結束搶答',
};

/**
 * 搶答活動狀態機（FR-012，data-model.md 狀態轉換表）。只允許下列轉換，其餘一律拒絕：
 * - 尚未匯入 →（匯入）→ 待開始
 * - 待開始 →（重新匯入）→ 待開始
 * - 待開始 →（開啟）→ 搶答進行中（至少 1 題）
 * - 搶答進行中 →（結束）→ 已結束
 * - 已結束 →（老師確認後匯入新文件）→ 待開始
 * 「已結束 → 搶答進行中」不允許：結束後學生已看得到結果，重新開啟會失去公平性。
 */
export function assertTransition(
  status: SessionStatus,
  action: SessionAction,
  options: { confirmDiscard?: boolean | undefined; questionCount?: number } = {},
): void {
  switch (action) {
    case 'import':
      if (status === 'NOT_IMPORTED' || status === 'READY') return;
      if (status === 'CLOSED') {
        if (options.confirmDiscard === true) return;
        throw new DomainError(
          'CONFIRM_DISCARD_REQUIRED',
          '重新匯入會開始新的一場，目前的結果將被清除。請先確認已匯出，再確認要重新匯入。',
        );
      }
      throw new DomainError('INVALID_TRANSITION', '搶答進行中不能匯入題目，請先結束搶答。');
    case 'open':
      if (status === 'READY') {
        if ((options.questionCount ?? 0) < 1) {
          throw new DomainError('INVALID_TRANSITION', '沒有題目，無法開啟搶答。');
        }
        return;
      }
      if (status === 'OPEN') {
        throw new DomainError('ALREADY_IN_STATE', '搶答已經在進行中。');
      }
      if (status === 'CLOSED') {
        throw new DomainError(
          'INVALID_TRANSITION',
          '搶答已結束，不能重新開啟。要再進行搶答，請重新匯入題目開始新的一場。',
        );
      }
      throw new DomainError('INVALID_TRANSITION', '請先匯入題目，再開啟搶答。');
    case 'close':
      if (status === 'OPEN') return;
      if (status === 'CLOSED') {
        throw new DomainError('ALREADY_IN_STATE', '搶答已經結束。');
      }
      throw new DomainError(
        'INVALID_TRANSITION',
        `目前狀態不能${ACTION_LABEL.close}，只有搶答進行中才能結束。`,
      );
  }
}
