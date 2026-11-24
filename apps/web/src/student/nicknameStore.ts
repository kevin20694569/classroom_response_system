import { NicknameSchema } from '@crs/shared';

/**
 * 暱稱保存（004 FR-006、research R2）：只存在本分頁的 sessionStorage，
 * 同一分頁重新整理保留、其他分頁不共享。只保存「已確認」的暱稱；
 * 離開組別與身分失效只清除身分（crs.token、crs.identity），不清除暱稱。
 */
const NICKNAME_KEY = 'crs.nickname';

/** 讀取已確認的暱稱；不存在或不符合暱稱規則時回傳 null（原則 V：讀取時驗證）。 */
export function load(): string | null {
  const raw = sessionStorage.getItem(NICKNAME_KEY);
  if (raw === null) return null;
  const parsed = NicknameSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** 保存已確認的暱稱（去除前後空白後的值）。 */
export function save(nickname: string): void {
  sessionStorage.setItem(NICKNAME_KEY, NicknameSchema.parse(nickname));
}
