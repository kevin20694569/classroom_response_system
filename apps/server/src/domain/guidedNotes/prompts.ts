import type { Blank, QuestionKind } from '@crs/shared';
import type { SheetGrid } from '../../infrastructure/sheets/guidedNotesGateway.js';
import { anchorOf, effectiveValue } from './grid.js';

/**
 * 題目敘述讀取（002 contracts/guided-notes-format.md §A，FR-001）。
 * 敘述只供老師預覽，讀不到時一律為 null，不會讓匯入失敗；題數、題型與填空格定位完全不受影響。
 */

const HEADER_PROMPT = '題目';

/**
 * 題目欄：表頭列中內容恰為「題目」的儲存格所在欄（忽略前後空白）。
 * 課程範例的「題目」表頭跨多欄合併，值只在左上角，因此找到的就是左上角所在欄。
 * 沒有「題目」表頭時回傳 null（「題目」欄可有可無，001 FR-007）。
 */
export function findPromptColumn(grid: SheetGrid, headerRowIndex: number): number | null {
  const cells = grid.cells[headerRowIndex] ?? [];
  const index = cells.findIndex((c) => c.trim() === HEADER_PROMPT);
  return index >= 0 ? index : null;
}

/** 某一列的敘述：題目欄的有效值（合併範圍取左上角），去除前後空白；空字串視為沒有敘述。 */
export function promptAt(grid: SheetGrid, row: number, column: number): string | null {
  const text = effectiveValue(grid, row, column).trim();
  return text === '' ? null : text;
}

export interface QuestionPrompts {
  /** 單題的題目敘述，或題組的題組說明 */
  prompt: string | null;
  /** 依子題順序的子題敘述；單題為 [null] */
  blankPrompts: (string | null)[];
}

/** 依出現順序去除重複後以換行合併；沒有任何文字時為 null。 */
function joinDistinct(texts: readonly string[]): string | null {
  const distinct = [...new Set(texts)];
  return distinct.length === 0 ? null : distinct.join('\n');
}

/**
 * 讀取一個題目區塊的敘述：
 * - 單題：區塊內各列的敘述去除重複後以換行合併（敘述跨列合併時只取一次）。
 * - 題組：每列依作答格（合併取左上角）對應到子題；只屬於一個子題的敘述是該子題的敘述，
 *   同一個敘述儲存格跨越兩個以上子題（例如跨所有子題列合併的短文）則是題組說明。
 */
export function readQuestionPrompts(
  grid: SheetGrid,
  promptColumn: number | null,
  blockRows: readonly number[],
  blanks: readonly Blank[],
  kind: QuestionKind,
): QuestionPrompts {
  if (promptColumn === null) {
    return { prompt: null, blankPrompts: blanks.map(() => null) };
  }

  if (kind === 'single') {
    const texts = blockRows.map((row) => promptAt(grid, row, promptColumn));
    return {
      prompt: joinDistinct(texts.filter((t): t is string => t !== null)),
      blankPrompts: [null],
    };
  }

  // 每個敘述儲存格（以合併左上角為準）涵蓋了哪些子題
  const answerColumn = blanks[0]?.location.columnIndex ?? 0;
  const blankIndexOfRow = (row: number): number =>
    blanks.findIndex((b) => b.location.rowIndex === anchorOf(grid, row, answerColumn).rowIndex);
  const cells = new Map<string, { text: string; blankIndexes: Set<number> }>();
  for (const row of blockRows) {
    const text = promptAt(grid, row, promptColumn);
    if (text === null) continue;
    const anchor = anchorOf(grid, row, promptColumn);
    const key = `${anchor.rowIndex}:${anchor.columnIndex}`;
    const entry = cells.get(key) ?? { text, blankIndexes: new Set<number>() };
    const blankIndex = blankIndexOfRow(row);
    if (blankIndex >= 0) entry.blankIndexes.add(blankIndex);
    cells.set(key, entry);
  }

  const description: string[] = [];
  const perBlank: string[][] = blanks.map(() => []);
  for (const { text, blankIndexes } of cells.values()) {
    const [only] = [...blankIndexes];
    if (blankIndexes.size === 1 && only !== undefined) perBlank[only]?.push(text);
    else description.push(text);
  }
  return { prompt: joinDistinct(description), blankPrompts: perBlank.map(joinDistinct) };
}
