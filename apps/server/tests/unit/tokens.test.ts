import { describe, expect, it } from 'vitest';
import { signToken, TOKEN_TTL_MS, verifyToken, type TabIdentity } from '../../src/auth/tokens.js';

const secret = 'x'.repeat(40);
const now = new Date('2026-11-23T08:00:00.000Z');
const teacher: TabIdentity = {
  role: 'teacher',
  issuedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
};

describe('signToken / verifyToken', () => {
  it('簽發後可以驗證', () => {
    expect(verifyToken(signToken(teacher, secret), secret, now)).toEqual(teacher);
  });

  it('竄改 payload 時失敗', () => {
    const [payload, sig] = signToken(teacher, secret).split('.') as [string, string];
    const forged = Buffer.from(
      JSON.stringify({ ...teacher, expiresAt: '2099-01-01T00:00:00.000Z' }),
    ).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`, secret, now)).toBeNull();
    expect(verifyToken(`${payload}.${sig}x`, secret, now)).toBeNull();
  });

  it('使用錯誤密鑰時失敗', () => {
    expect(verifyToken(signToken(teacher, secret), 'y'.repeat(40), now)).toBeNull();
  });

  it('過期時失敗（12 小時）', () => {
    const later = new Date(now.getTime() + TOKEN_TTL_MS + 1);
    expect(verifyToken(signToken(teacher, secret), secret, later)).toBeNull();
  });

  it('格式錯誤時失敗', () => {
    expect(verifyToken('not-a-token', secret, now)).toBeNull();
    expect(verifyToken('a.b.c', secret, now)).toBeNull();
    expect(verifyToken('', secret, now)).toBeNull();
  });
});
