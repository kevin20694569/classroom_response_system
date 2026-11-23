import { createHash, timingSafeEqual } from 'node:crypto';
import type { AuthResponse, QuizSession } from '@crs/shared';
import { DomainError } from '../domain/errors.js';
import { signToken, TOKEN_TTL_MS, verifyToken, type TabIdentity } from './tokens.js';

function sha256(text: string): Buffer {
  return createHash('sha256').update(text, 'utf8').digest();
}

/**
 * 身分服務：老師以密碼登入、學生以選擇組別加入（後者於 US3 加入）。
 * 身分以簽章 token 表示，伺服器重啟後只要 SESSION_SECRET 不變就仍有效（FR-003a）。
 */
export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly teacherPassword: string,
    private readonly now: () => Date,
  ) {}

  /** 老師密碼比對：兩邊先 SHA-256 成等長再以固定時間比較，錯誤訊息不透露任何密碼資訊。 */
  loginAsTeacher(password: string): AuthResponse {
    const ok = timingSafeEqual(sha256(password), sha256(this.teacherPassword));
    if (!ok) {
      throw new DomainError('INVALID_PASSWORD', '密碼錯誤，請再試一次。');
    }
    const issuedAt = this.now();
    const identity: TabIdentity = {
      role: 'teacher',
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + TOKEN_TTL_MS).toISOString(),
    };
    return {
      token: signToken(identity, this.secret),
      identity: { role: 'teacher', expiresAt: identity.expiresAt },
    };
  }

  /**
   * 學生選擇組別加入：尚未匯入時 NO_ACTIVE_ACTIVITY；組別不在 1～groupCount 時 INVALID_GROUP。
   * token 綁定目前的 activityId，老師重新匯入後即失效。
   */
  joinAsStudent(groupId: number, session: Readonly<QuizSession>): AuthResponse {
    if (session.status === 'NOT_IMPORTED' || session.activityId === null) {
      throw new DomainError('NO_ACTIVE_ACTIVITY', '老師尚未匯入題目，請稍後再加入。');
    }
    if (!session.groups.some((g) => g.id === groupId)) {
      throw new DomainError('INVALID_GROUP', `沒有第 ${groupId} 組，請重新選擇組別。`);
    }
    const issuedAt = this.now();
    const identity: TabIdentity = {
      role: 'student',
      groupId,
      activityId: session.activityId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + TOKEN_TTL_MS).toISOString(),
    };
    return {
      token: signToken(identity, this.secret),
      identity: {
        role: 'student',
        groupId,
        activityId: session.activityId,
        expiresAt: identity.expiresAt,
      },
    };
  }

  /**
   * 解析 token：無效、過期，或學生 token 屬於舊活動（activityId 不同）時回傳 null。
   */
  resolve(token: string, currentActivityId: string | null): TabIdentity | null {
    const identity = verifyToken(token, this.secret, this.now());
    if (identity === null) return null;
    if (identity.role === 'student' && identity.activityId !== currentActivityId) return null;
    return identity;
  }
}
