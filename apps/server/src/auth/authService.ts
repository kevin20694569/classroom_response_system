import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuthResponse, QuizSession } from '@crs/shared';
import { DomainError } from '../domain/errors.js';
import {
  signToken,
  TOKEN_TTL_MS,
  verifyToken,
  type StudentIdentity,
  type TabIdentity,
} from './tokens.js';

function sha256(text: string): Buffer {
  return createHash('sha256').update(text, 'utf8').digest();
}

/**
 * 身分服務：老師以密碼登入、學生以選擇組別加入（後者於 US3 加入）。
 * 身分以簽章 token 表示，伺服器重啟後只要 SESSION_SECRET 不變就仍有效（FR-003a）。
 */
export interface AuthServiceOptions {
  /** 產生學生 memberId（測試可注入固定值） */
  uuid?: () => string;
  /**
   * 該組員是否已在本次活動離開組別（004 research R4）。
   * 已離開的 memberId 即使 token 未過期也視為身分失效，連線與送出都會被拒絕。
   */
  isMemberLeft?: (memberId: string) => boolean;
}

export class AuthService {
  private readonly uuid: () => string;
  private readonly isMemberLeft: (memberId: string) => boolean;

  constructor(
    private readonly secret: string,
    private readonly teacherPassword: string,
    private readonly now: () => Date,
    options: AuthServiceOptions = {},
  ) {
    this.uuid = options.uuid ?? randomUUID;
    this.isMemberLeft = options.isMemberLeft ?? (() => false);
  }

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
   * 004：token 另含新產生的 memberId 與暱稱（暱稱已由 NicknameSchema 正規化）。
   */
  joinAsStudent(groupId: number, nickname: string, session: Readonly<QuizSession>): AuthResponse {
    if (session.status === 'NOT_IMPORTED' || session.activityId === null) {
      throw new DomainError('NO_ACTIVE_ACTIVITY', '老師尚未匯入題目，請稍後再加入。');
    }
    if (!session.groups.some((g) => g.id === groupId)) {
      throw new DomainError('INVALID_GROUP', `沒有第 ${groupId} 組，請重新選擇組別。`);
    }
    const issuedAt = this.now();
    const identity: StudentIdentity = {
      role: 'student',
      groupId,
      activityId: session.activityId,
      memberId: this.uuid(),
      nickname,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + TOKEN_TTL_MS).toISOString(),
    };
    return {
      token: signToken(identity, this.secret),
      identity: {
        role: 'student',
        groupId,
        activityId: session.activityId,
        memberId: identity.memberId,
        nickname: identity.nickname,
        expiresAt: identity.expiresAt,
      },
    };
  }

  /**
   * 解析 token：無效、過期、學生 token 屬於舊活動（activityId 不同），或該組員已離開組別時回傳 null。
   */
  resolve(token: string, currentActivityId: string | null): TabIdentity | null {
    const identity = verifyToken(token, this.secret, this.now());
    if (identity === null) return null;
    if (identity.role === 'student' && identity.activityId !== currentActivityId) return null;
    if (identity.role === 'student' && this.isMemberLeft(identity.memberId)) return null;
    return identity;
  }
}
