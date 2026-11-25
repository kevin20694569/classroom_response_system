import { randomUUID } from 'node:crypto';
import type { QuizSession } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../src/auth/authService.js';
import { requireStudent, requireTeacher } from '../../src/auth/roleGuard.js';
import { signToken, TOKEN_TTL_MS } from '../../src/auth/tokens.js';
import { DomainError } from '../../src/domain/errors.js';

const secret = 's'.repeat(40);
const now = new Date('2026-11-23T08:00:00.000Z');
const service = new AuthService(secret, 'correct-password', () => now);

/** 只需要 joinAsStudent 會讀到的欄位：狀態、活動 ID 與組別。 */
function readySession(activityId: string): Readonly<QuizSession> {
  return {
    activityId,
    status: 'READY',
    source: null,
    groups: [
      { id: 1, name: '第 1 組' },
      { id: 2, name: '第 2 組' },
    ],
    questions: [],
    submissions: [],
    nextSequence: 1,
    openedAt: null,
    closedAt: null,
    lastExport: null,
    gradingFinishedAt: null,
  };
}

describe('AuthService.loginAsTeacher', () => {
  it('密碼正確時簽發老師 token', () => {
    const result = service.loginAsTeacher('correct-password');
    expect(result.identity.role).toBe('teacher');
    expect(service.resolve(result.token, null)?.role).toBe('teacher');
  });

  it('密碼錯誤時拋出 INVALID_PASSWORD，訊息不透露密碼', () => {
    try {
      service.loginAsTeacher('wrong');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('INVALID_PASSWORD');
      expect((error as DomainError).userMessage).not.toContain('correct-password');
    }
  });
});

describe('AuthService.resolve', () => {
  const activityId = randomUUID();
  const studentToken = signToken(
    {
      role: 'student',
      groupId: 1,
      activityId,
      memberId: randomUUID(),
      nickname: 'Milo',
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
    },
    secret,
  );

  it('學生 token 屬於目前活動時有效', () => {
    expect(service.resolve(studentToken, activityId)?.role).toBe('student');
  });

  it('學生 token 屬於舊活動時無效', () => {
    expect(service.resolve(studentToken, randomUUID())).toBeNull();
  });

  it('無效 token 回傳 null', () => {
    expect(service.resolve('garbage', activityId)).toBeNull();
  });

  it('004 之前簽發、沒有 memberId 與暱稱的學生 token 無效', () => {
    const legacy = signToken(
      {
        role: 'student',
        groupId: 1,
        activityId,
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
      } as unknown as Parameters<typeof signToken>[0],
      secret,
    );
    expect(service.resolve(legacy, activityId)).toBeNull();
  });

  it('已離開組別的 memberId 視為身分失效（research R4）', () => {
    const left = new Set<string>();
    const withRoster = new AuthService(secret, 'correct-password', () => now, {
      isMemberLeft: (memberId) => left.has(memberId),
    });
    const joined = withRoster.joinAsStudent(1, 'Milo', readySession(activityId));
    expect(withRoster.resolve(joined.token, activityId)?.role).toBe('student');
    if (joined.identity.role !== 'student') throw new Error('應為學生身分');
    left.add(joined.identity.memberId);
    expect(withRoster.resolve(joined.token, activityId)).toBeNull();
  });
});

describe('AuthService.joinAsStudent（004 research R3）', () => {
  it('token 與回應都含新的 memberId 與暱稱', () => {
    const activityId = randomUUID();
    const fixed = new AuthService(secret, 'correct-password', () => now, {
      uuid: () => '3f0b2c1e-1111-4222-8333-444455556666',
    });
    const result = fixed.joinAsStudent(2, '小明', readySession(activityId));
    expect(result.identity).toMatchObject({
      role: 'student',
      groupId: 2,
      activityId,
      memberId: '3f0b2c1e-1111-4222-8333-444455556666',
      nickname: '小明',
    });
    const resolved = fixed.resolve(result.token, activityId);
    expect(resolved).toMatchObject({
      memberId: '3f0b2c1e-1111-4222-8333-444455556666',
      nickname: '小明',
    });
  });

  it('每次加入產生不同的 memberId', () => {
    const activityId = randomUUID();
    const a = service.joinAsStudent(1, 'Milo', readySession(activityId)).identity;
    const b = service.joinAsStudent(1, 'Milo', readySession(activityId)).identity;
    if (a.role !== 'student' || b.role !== 'student') throw new Error('應為學生身分');
    expect(a.memberId).not.toBe(b.memberId);
  });
});

describe('roleGuard', () => {
  const teacher = { role: 'teacher' as const, issuedAt: '', expiresAt: '' };
  const student = {
    role: 'student' as const,
    groupId: 1,
    activityId: 'a',
    memberId: '3f0b2c1e-1111-4222-8333-444455556666',
    nickname: 'Milo',
    issuedAt: '',
    expiresAt: '',
  };

  it('未登入 → UNAUTHORIZED；角色不符 → FORBIDDEN', () => {
    expect(() => requireTeacher(null)).toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    expect(() => requireTeacher(student)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => requireStudent(teacher)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(requireTeacher(teacher).role).toBe('teacher');
    expect(requireStudent(student).groupId).toBe(1);
  });
});
