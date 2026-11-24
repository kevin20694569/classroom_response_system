import { createHmac, timingSafeEqual } from 'node:crypto';
import { GroupIdSchema } from '@crs/shared';
import { z } from 'zod';

/** 身分有效期限：12 小時（FR-003a）。 */
export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * 分頁身分（存在簽章 token 中，不寫入資料檔）。
 * 前端只存在 sessionStorage，因此每個分頁的身分各自獨立（FR-003a）。
 */
export const TabIdentitySchema = z.discriminatedUnion('role', [
  z.strictObject({
    role: z.literal('teacher'),
    issuedAt: z.string(),
    expiresAt: z.string(),
  }),
  z.strictObject({
    role: z.literal('student'),
    groupId: GroupIdSchema,
    /** 綁定加入時的活動；老師重新匯入後舊的學生身分自動失效 */
    activityId: z.string(),
    /**
     * 組員身分（004 research R3）：加入時產生，同一分頁重新整理或重連都是同一位組員。
     * 004 之前簽發的學生 token 沒有 memberId 與 nickname，驗證失敗，學生需重新選組。
     */
    memberId: z.uuid(),
    /** 加入時的暱稱（已正規化）；送出者暱稱只採用這個值，不相信請求內容（FR-023） */
    nickname: z.string(),
    issuedAt: z.string(),
    expiresAt: z.string(),
  }),
]);
export type TabIdentity = z.infer<typeof TabIdentitySchema>;
export type TeacherIdentity = Extract<TabIdentity, { role: 'teacher' }>;
export type StudentIdentity = Extract<TabIdentity, { role: 'student' }>;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET)) */
export function signToken(identity: TabIdentity, secret: string): string {
  const payload = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** 驗證簽章、格式與期限；任何問題都回傳 null（不透露原因）。 */
export function verifyToken(token: string, secret: string, now: Date): TabIdentity | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  // 以固定時間比較簽章，避免時間差洩漏資訊
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const parsed = TabIdentitySchema.safeParse(json);
  if (!parsed.success) return null;
  const expiresAt = Date.parse(parsed.data.expiresAt);
  if (Number.isNaN(expiresAt) || expiresAt <= now.getTime()) return null;
  return parsed.data;
}
