/**
 * 作答草稿（003 FR-020、research R6）：未送出的輸入只存在該分頁的 sessionStorage，
 * 不送往伺服器，同組其他分頁也看不到；以活動、組別、題號區分。
 */
const DRAFT_PREFIX = 'crs.draft.';

/** 清除該分頁所有草稿（離開組別、身分失效時使用）。 */
export function clearAll(): void {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX) === true) keys.push(key);
  }
  for (const key of keys) sessionStorage.removeItem(key);
}
