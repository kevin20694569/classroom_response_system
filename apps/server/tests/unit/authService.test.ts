import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../src/auth/authService.js';
import { requireStudent, requireTeacher } from '../../src/auth/roleGuard.js';
import { signToken, TOKEN_TTL_MS } from '../../src/auth/tokens.js';
import { DomainError } from '../../src/domain/errors.js';

const secret = 's'.repeat(40);
const now = new Date('2026-11-23T08:00:00.000Z');
const service = new AuthService(secret, 'correct-password', () => now);

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
});

describe('roleGuard', () => {
  const teacher = { role: 'teacher' as const, issuedAt: '', expiresAt: '' };
  const student = {
    role: 'student' as const,
    groupId: 1,
    activityId: 'a',
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
