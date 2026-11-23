import type { SessionStatus } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  assertTransition,
  initialSession,
  type SessionAction,
} from '../../src/domain/session/quizSession.js';

type Expect = 'ok' | 'INVALID_TRANSITION' | 'ALREADY_IN_STATE' | 'CONFIRM_DISCARD_REQUIRED';

/** 4 狀態 × 3 操作逐格檢查（data-model.md 狀態轉換表）。 */
const table: [SessionStatus, SessionAction, Expect][] = [
  ['NOT_IMPORTED', 'import', 'ok'],
  ['NOT_IMPORTED', 'open', 'INVALID_TRANSITION'],
  ['NOT_IMPORTED', 'close', 'INVALID_TRANSITION'],
  ['READY', 'import', 'ok'],
  ['READY', 'open', 'ok'],
  ['READY', 'close', 'INVALID_TRANSITION'],
  ['OPEN', 'import', 'INVALID_TRANSITION'],
  ['OPEN', 'open', 'ALREADY_IN_STATE'],
  ['OPEN', 'close', 'ok'],
  ['CLOSED', 'import', 'CONFIRM_DISCARD_REQUIRED'],
  ['CLOSED', 'open', 'INVALID_TRANSITION'],
  ['CLOSED', 'close', 'ALREADY_IN_STATE'],
];

function outcome(status: SessionStatus, action: SessionAction): Expect {
  try {
    assertTransition(status, action, { questionCount: 3 });
    return 'ok';
  } catch (error) {
    if (error instanceof DomainError) return error.code as Expect;
    throw error;
  }
}

describe('assertTransition', () => {
  it.each(table)('%s + %s → %s', (status, action, expected) => {
    expect(outcome(status, action)).toBe(expected);
  });

  it('已結束後帶確認可以匯入新文件', () => {
    expect(() => {
      assertTransition('CLOSED', 'import', { confirmDiscard: true });
    }).not.toThrow();
  });

  it('沒有題目時不能開啟', () => {
    expect(() => {
      assertTransition('READY', 'open', { questionCount: 0 });
    }).toThrow(DomainError);
  });

  it('已結束後開啟的訊息說明要重新匯入', () => {
    expect(() => {
      assertTransition('CLOSED', 'open', { questionCount: 1 });
    }).toThrow(/重新匯入/);
  });
});

describe('initialSession', () => {
  it('從尚未匯入、序號 1 開始', () => {
    const s = initialSession();
    expect(s.status).toBe('NOT_IMPORTED');
    expect(s.nextSequence).toBe(1);
    expect(s.activityId).toBeNull();
  });
});
