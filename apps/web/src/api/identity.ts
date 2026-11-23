/**
 * 分頁身分保存（FR-003a）：只存在 sessionStorage。
 * sessionStorage 每個分頁各自獨立、重新整理後保留、關閉分頁即清除；
 * 不得使用 cookie 或 localStorage（兩者會被同一瀏覽器的所有分頁共用）。
 */
const TOKEN_KEY = 'crs.token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}
