import { IdentitySummarySchema, type IdentitySummary } from '@crs/shared';

/**
 * 分頁身分保存（FR-003a）：只存在 sessionStorage。
 * sessionStorage 每個分頁各自獨立、重新整理後保留、關閉分頁即清除；
 * 不得使用 cookie 或 localStorage（兩者會被同一瀏覽器的所有分頁共用）。
 */
const TOKEN_KEY = 'crs.token';
/** 學生加入時伺服器回傳的身分摘要（003 research R2）：草稿以 activityId 區分，連線前就能顯示組別。 */
const IDENTITY_KEY = 'crs.identity';

/** 學生身分：IdentitySummary 中 role 為 student 的分支（003 data-model §3）。 */
export type StudentIdentity = Extract<IdentitySummary, { role: 'student' }>;

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** 讀取學生身分；內容不存在、壞掉或不是學生身分時回傳 null（原則 V：讀取時驗證）。 */
export function getStudentIdentity(): StudentIdentity | null {
  const raw = sessionStorage.getItem(IDENTITY_KEY);
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = IdentitySummarySchema.safeParse(json);
  if (!parsed.success || parsed.data.role !== 'student') return null;
  return parsed.data;
}

export function setStudentIdentity(identity: StudentIdentity): void {
  sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

/** 清除分頁身分（token 與學生身分摘要），用於離開組別與身分失效。 */
export function clearIdentity(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(IDENTITY_KEY);
}
