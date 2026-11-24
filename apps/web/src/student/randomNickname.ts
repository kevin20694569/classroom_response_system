import { faker } from '@faker-js/faker/locale/en';

/** 隨機名字的規則（004 FR-002）：只含英文字母、3～10 字，一定符合暱稱規則。 */
const SHORT_ENGLISH_NAME = /^[A-Za-z]{3,10}$/;

/** 「合格但等於 exclude」的嘗試上限；名字清單很多，實際上幾乎不會用到。 */
const MAX_SAME_AS_EXCLUDE = 20;

/**
 * 產生隨機的短英文名字（004 research R1）：以 faker 的英文名字產生，只匯入英文語系。
 * 不合格的名字直接丟棄重新產生；只有「合格但等於 exclude」才計入嘗試次數，
 * 達到上限時回傳該合格名字，因此一定有合格的名字可回傳。
 * 「換一個」時傳入目前輸入欄的名字，避免看起來沒有變。
 */
export function randomNickname(exclude?: string): string {
  let sameAsExclude = 0;
  for (;;) {
    const name = faker.person.firstName();
    if (!SHORT_ENGLISH_NAME.test(name)) continue;
    if (name !== exclude) return name;
    sameAsExclude += 1;
    if (sameAsExclude >= MAX_SAME_AS_EXCLUDE) return name;
  }
}
