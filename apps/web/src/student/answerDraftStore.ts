import { z } from 'zod';

/**
 * 作答草稿（003 FR-020、research R6）：未送出的輸入只存在該分頁的 sessionStorage，
 * 不送往伺服器，同組其他分頁也看不到；以活動、組別、題號區分，避免舊活動的草稿出現在新活動。
 */
const DRAFT_PREFIX = 'crs.draft.';
const DraftSchema = z.array(z.string());

const keyOf = (activityId: string, groupId: number, questionNumber: number): string =>
  `${DRAFT_PREFIX}${activityId}.${groupId}.${questionNumber}`;

function parse(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 讀取某題草稿；沒有資料或內容壞掉時為空白。回傳長度一定等於子題數。 */
export function load(
  activityId: string,
  groupId: number,
  questionNumber: number,
  blankCount: number,
): string[] {
  const texts = parse(sessionStorage.getItem(keyOf(activityId, groupId, questionNumber))) ?? [];
  return Array.from({ length: blankCount }, (_, i) => texts[i] ?? '');
}

export function save(
  activityId: string,
  groupId: number,
  questionNumber: number,
  texts: readonly string[],
): void {
  sessionStorage.setItem(keyOf(activityId, groupId, questionNumber), JSON.stringify(texts));
}

/** 清除某題草稿（該題送出成功，或本組已由其他分頁送出）。 */
export function clear(activityId: string, groupId: number, questionNumber: number): void {
  sessionStorage.removeItem(keyOf(activityId, groupId, questionNumber));
}

function draftKeys(prefix = DRAFT_PREFIX): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix) === true) keys.push(key);
  }
  return keys;
}

/** 清除該分頁所有草稿（離開組別、身分失效時使用）。 */
export function clearAll(): void {
  for (const key of draftKeys()) sessionStorage.removeItem(key);
}

/**
 * 該活動與組別是否還有未送出、且不是空白的草稿。
 * 活動結束時作答畫面會換成結果畫面，結果畫面據此提示「尚未送出的答案不會被採計」（FR-018）。
 */
export function hasUnsent(activityId: string, groupId: number): boolean {
  return draftKeys(`${DRAFT_PREFIX}${activityId}.${groupId}.`).some((key) =>
    (parse(sessionStorage.getItem(key)) ?? []).some((text) => text.trim() !== ''),
  );
}
