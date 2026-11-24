import { z } from 'zod';
import { unicodeLength } from './domain.js';

/** 暱稱去除前後空白後的長度上限（004 FR-004）。 */
export const NICKNAME_MAX_LENGTH = 20;

/** 暱稱不符規則時顯示給學生的訊息（004 contracts/student-ui.md §1、http-api.md §1）。 */
export const NICKNAME_RULE_MESSAGE = `暱稱需為 1～${NICKNAME_MAX_LENGTH} 字，且不能只有空白。`;

/** 換行、tab 等控制字元：暱稱會顯示在名冊與匯出文件中，不接受會打亂版面的字元。 */
const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * 學生暱稱（004 data-model §1）：只用來讓同組同學與老師辨識，不代表真實身分，允許重複。
 * 去除前後空白後 1～20 字（以 Unicode 字元計算，表情符號算一個字）；不得包含控制字元。
 * 輸出為去除前後空白後的字串；前端暱稱頁與伺服器加入 API 共用同一份規則（原則 V）。
 */
export const NicknameSchema = z
  .string()
  .trim()
  .refine(
    (t) =>
      unicodeLength(t) >= 1 &&
      unicodeLength(t) <= NICKNAME_MAX_LENGTH &&
      !CONTROL_CHARACTER.test(t),
    { message: NICKNAME_RULE_MESSAGE },
  );
export type Nickname = z.infer<typeof NicknameSchema>;
