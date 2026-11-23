import type { Blank, ErrorDetail, GuidedNotesIssueCode, Question } from '@crs/shared';
import type {
  SheetGrid,
  SpreadsheetSnapshot,
} from '../../infrastructure/sheets/guidedNotesGateway.js';
import { DomainError } from '../errors.js';
import {
  anchorOf,
  columnName,
  columnSpanOf,
  effectiveValue,
  rawValue,
  type CellPosition,
} from './grid.js';
import { readBlankMarker } from './markers.js';
import { findPromptColumn, readQuestionPrompts } from './prompts.js';
import { parseQuestionNumber } from './questionNumber.js';

/**
 * Guided Notes 辨識（contracts/guided-notes-format.md §2～§6，constitution 原則 III）。
 * 一切依文件內容動態定位：先找表頭、再逐列讀題號與作答格，不使用任何固定的儲存格座標、列號或欄號。
 */

const HEADER_NUMBER = '題號';
const HEADER_ANSWER = '作答';

const HEADER_RESULT_GROUP = '搶答組別';
const HEADER_RESULT_TIME = '提交時間';

/** 「答案＋組別時間欄」匯出模式使用的結果欄（002 contracts §B.3）；沒有對應表頭時為 null。 */
export interface ResultColumns {
  groupColumn: number | null;
  timeColumn: number | null;
}

export interface ParsedGuidedNotes {
  sheetTitle: string;
  questions: Question[];
  /** 表頭列（0 起算） */
  headerRowIndex: number;
  /** 工作表使用範圍的欄數：最後一個非空白儲存格或合併範圍的欄號 + 1（新增結果欄的起點） */
  usedColumnCount: number;
  resultColumns: ResultColumns;
}

/** 使用範圍的欄數：新增的結果欄放在這之後，保證不覆蓋任何既有內容（002 research R9）。 */
function usedColumnCountOf(grid: SheetGrid): number {
  let count = 0;
  for (const row of grid.cells) {
    for (let col = row.length - 1; col >= 0; col -= 1) {
      if ((row[col] ?? '').trim() !== '') {
        count = Math.max(count, col + 1);
        break;
      }
    }
  }
  for (const merge of grid.merges) count = Math.max(count, merge.endColumn);
  return count;
}

/** 表頭列中先前匯出時新增的「搶答組別」「提交時間」欄；這兩欄不參與題目辨識（002 FR-023）。 */
function resultColumnsOf(grid: SheetGrid, headerRowIndex: number): ResultColumns {
  const cells = grid.cells[headerRowIndex] ?? [];
  const find = (text: string) => {
    const index = cells.findIndex((c) => c.trim() === text);
    return index >= 0 ? index : null;
  };
  return { groupColumn: find(HEADER_RESULT_GROUP), timeColumn: find(HEADER_RESULT_TIME) };
}

interface HeaderRow {
  rowIndex: number;
  numberColumn: number;
  /** 作答區起始欄（「作答」表頭所在欄） */
  answerColumn: number;
  /** 作答區結束欄（不含）：「作答」表頭的合併範圍（002 contracts §A0） */
  answerEndColumn: number;
}

class IssueCollector {
  readonly issues: ErrorDetail[] = [];

  add(code: GuidedNotesIssueCode, message: string, at: Omit<ErrorDetail, 'code' | 'message'> = {}) {
    this.issues.push({ code, message, ...at });
  }
}

/**
 * 表頭列：同一列中同時有內容「恰為」題號與作答的儲存格（忽略前後空白）。
 * 「題目」欄可有可無，用詞不同（例如「答案」）不算表頭。
 * 只看原始值（合併範圍只有左上角有值），避免跨列合併的表頭被算成多列。
 */
function findHeaderRows(grid: SheetGrid): HeaderRow[] {
  const rows: HeaderRow[] = [];
  grid.cells.forEach((cells, rowIndex) => {
    const numberColumn = cells.findIndex((c) => c.trim() === HEADER_NUMBER);
    const answerColumn = cells.findIndex((c) => c.trim() === HEADER_ANSWER);
    if (numberColumn >= 0 && answerColumn >= 0) {
      const answerEndColumn = columnSpanOf(grid, rowIndex, answerColumn).end;
      rows.push({ rowIndex, numberColumn, answerColumn, answerEndColumn });
    }
  });
  return rows;
}

/**
 * 工作表選擇（FR-006a）：恰有一列表頭的工作表是候選；
 * 全部工作表中恰有 1 張候選才使用它。不依工作表名稱、順序或網址中的分頁編號判斷。
 */
function selectSheet(
  snapshot: SpreadsheetSnapshot,
  collector: IssueCollector,
): { grid: SheetGrid; header: HeaderRow } | null {
  const candidates: { grid: SheetGrid; header: HeaderRow }[] = [];
  for (const grid of snapshot.sheets) {
    const headers = findHeaderRows(grid);
    if (headers.length > 1) {
      collector.add(
        'MULTIPLE_HEADER_ROWS',
        `工作表「${grid.sheetTitle}」有多列「題號／作答」表頭（第 ${headers
          .map((h) => h.rowIndex + 1)
          .join('、')} 列），請只保留一列。`,
        { sheetTitle: grid.sheetTitle },
      );
    } else if (headers.length === 1 && headers[0] !== undefined) {
      candidates.push({ grid, header: headers[0] });
    }
  }
  if (collector.issues.length > 0) return null;
  if (candidates.length === 0) {
    collector.add(
      'HEADER_NOT_FOUND',
      '找不到同時含有「題號」與「作答」的表頭列，請確認文件使用課程的 Guided Notes 範本。',
    );
    return null;
  }
  if (candidates.length > 1) {
    collector.add(
      'MULTIPLE_GUIDED_NOTES_SHEETS',
      `有多張工作表含有「題號／作答」表頭：${candidates
        .map((c) => `「${c.grid.sheetTitle}」`)
        .join('、')}。請只保留一張 Guided Notes 工作表。`,
    );
    return null;
  }
  return candidates[0] ?? null;
}

interface QuestionBlock {
  number: number;
  rows: number[];
}

/**
 * 組成題目區塊：由上而下，連續且題號相同的列屬於同一題。
 * 題號相同的來源可以是合併儲存格跨列，或相鄰的列各自寫上相同題號；空白列結束目前區塊。
 */
function collectBlocks(
  grid: SheetGrid,
  header: HeaderRow,
  collector: IssueCollector,
): QuestionBlock[] {
  const blocks: QuestionBlock[] = [];
  const firstRowOf = new Map<number, number>();
  const reportedInvalid = new Set<string>();
  let current: QuestionBlock | null = null;

  for (let row = header.rowIndex + 1; row < grid.cells.length; row += 1) {
    const raw = effectiveValue(grid, row, header.numberColumn);
    const parsed = parseQuestionNumber(raw);
    if (parsed === 'empty') {
      current = null;
      continue;
    }
    if (parsed === 'invalid') {
      // 跨列合併的題號儲存格只回報一次（位置以左上角為準）
      const anchor = anchorOf(grid, row, header.numberColumn);
      const key = `${anchor.rowIndex}:${anchor.columnIndex}`;
      if (!reportedInvalid.has(key)) {
        reportedInvalid.add(key);
        collector.add(
          'INVALID_QUESTION_NUMBER',
          `題號「${raw.trim()}」無法辨識，請使用「1」「1.」「Q1」「第1題」等寫法。`,
          {
            sheetTitle: grid.sheetTitle,
            row: anchor.rowIndex + 1,
            column: columnName(anchor.columnIndex),
          },
        );
      }
      current = null;
      continue;
    }
    if (current !== null && current.number === parsed) {
      current.rows.push(row);
      continue;
    }
    const seenAt = firstRowOf.get(parsed);
    if (seenAt !== undefined) {
      collector.add(
        'DUPLICATE_QUESTION_NUMBER',
        `題號 ${parsed} 重複出現（第 ${seenAt + 1} 列與第 ${row + 1} 列）。`,
        { sheetTitle: grid.sheetTitle, row: row + 1, questionNumber: parsed },
      );
      current = null;
      continue;
    }
    firstRowOf.set(parsed, row);
    current = { number: parsed, rows: [row] };
    blocks.push(current);
  }
  return blocks;
}

/** 一列作答區解析出的填空格：填答格位置與子題標記的來源。 */
interface AnswerSlot {
  /** 答案要寫入的填答格（合併左上角） */
  fill: CellPosition;
  /** 讀取子題標記的文字（標記格或填答格的內容） */
  markerText: string;
  /** 標記是否與填答格同一格 */
  labelInAnswerCell: boolean;
}

/** 某列作答區內的儲存格（合併時以左上角為準、同一格只算一次），由左至右。 */
function cellsInAnswerArea(grid: SheetGrid, header: HeaderRow, row: number): CellPosition[] {
  const cells: CellPosition[] = [];
  for (let col = header.answerColumn; col < header.answerEndColumn; col += 1) {
    const anchor = anchorOf(grid, row, col);
    const seen = cells.some(
      (c) => c.rowIndex === anchor.rowIndex && c.columnIndex === anchor.columnIndex,
    );
    if (!seen) cells.push(anchor);
  }
  return cells;
}

/**
 * 一列的填答格（002 contracts §A0，FR-025）：作答區只有一格（例如單題 G:H 合併）時該格就是填答格，
 * 標記讀自同一格；分成多格（例如題組 G 欄「（1）」、H 欄空白）時，內容為「（n）」的格是標記格，
 * 它右側的第一格才是填答格；都沒有標記時取最左側的格。
 */
function slotOfRow(grid: SheetGrid, header: HeaderRow, row: number): AnswerSlot | undefined {
  const cells = cellsInAnswerArea(grid, header, row);
  const text = (c: CellPosition) => rawValue(grid, c.rowIndex, c.columnIndex);
  const [first] = cells;
  if (first === undefined) return undefined;
  if (cells.length === 1) return { fill: first, markerText: text(first), labelInAnswerCell: true };
  const markerIndex = cells.findIndex((c) => readBlankMarker(text(c)) !== null);
  if (markerIndex < 0) return { fill: first, markerText: '', labelInAnswerCell: true };
  const marker = cells[markerIndex] ?? first;
  const fill = cells[markerIndex + 1];
  // 標記格已在作答區最右側、右邊沒有填答格：視為標記與答案同格
  if (fill === undefined)
    return { fill: marker, markerText: text(marker), labelInAnswerCell: true };
  return { fill, markerText: text(marker), labelInAnswerCell: false };
}

/** 區塊內每列的填空格，依填答格（合併左上角）去重後依列排序。 */
function answerSlots(grid: SheetGrid, header: HeaderRow, block: QuestionBlock): AnswerSlot[] {
  const seen = new Set<string>();
  const slots: AnswerSlot[] = [];
  for (const row of block.rows) {
    const slot = slotOfRow(grid, header, row);
    if (slot === undefined) continue;
    const key = `${String(slot.fill.rowIndex)}:${String(slot.fill.columnIndex)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push(slot);
  }
  return slots.sort((a, b) => a.fill.rowIndex - b.fill.rowIndex);
}

/**
 * 題組的子題標記規則：全部沒有標記，或全部有且從（1）連號；
 * 部分有標記或不連號都視為格式錯誤。單題沒有子題標記（label 一律為 null）。
 */
function buildBlanks(
  grid: SheetGrid,
  block: QuestionBlock,
  slots: AnswerSlot[],
  collector: IssueCollector,
): Blank[] {
  const location = (cell: CellPosition) => ({ sheetTitle: grid.sheetTitle, ...cell });
  const [first] = slots;
  if (slots.length === 1 && first !== undefined) {
    return [
      {
        index: 1,
        label: null,
        location: location(first.fill),
        prompt: null,
        labelInAnswerCell: true,
      },
    ];
  }
  const markers = slots.map((s) => readBlankMarker(s.markerText));
  const marked = markers.filter((m) => m !== null).length;
  const firstRow = (block.rows[0] ?? 0) + 1;
  if (marked > 0 && marked < slots.length) {
    collector.add(
      'PARTIAL_BLANK_MARKERS',
      `第 ${block.number} 題（題組）只有部分子題有「（n）」標記，請全部加上或全部移除。`,
      { sheetTitle: grid.sheetTitle, row: firstRow, questionNumber: block.number },
    );
    return [];
  }
  if (marked > 0 && markers.some((m, i) => m?.number !== i + 1)) {
    collector.add(
      'INVALID_BLANK_MARKERS',
      `第 ${block.number} 題（題組）的子題標記必須從（1）開始連號。`,
      { sheetTitle: grid.sheetTitle, row: firstRow, questionNumber: block.number },
    );
    return [];
  }
  return slots.map((slot, i) => ({
    index: i + 1,
    label: markers[i]?.label ?? null,
    location: location(slot.fill),
    prompt: null,
    labelInAnswerCell: slot.labelInAnswerCell,
  }));
}

/** 解析整份文件；有任何錯誤時收集全部後一次拋出 GUIDED_NOTES_INVALID。 */
export function parseGuidedNotes(snapshot: SpreadsheetSnapshot): ParsedGuidedNotes {
  const collector = new IssueCollector();
  const selected = selectSheet(snapshot, collector);
  if (selected === null) throw invalid(collector);

  const { grid, header } = selected;
  const blocks = collectBlocks(grid, header, collector);
  // 題目欄可有可無：只用來讀取預覽用的敘述，不參與題目與填空格的判斷（002 FR-001）
  const promptColumn = findPromptColumn(grid, header.rowIndex);
  const questions: Question[] = [];
  for (const block of blocks) {
    const slots = answerSlots(grid, header, block);
    const blanks = buildBlanks(grid, block, slots, collector);
    if (blanks.length === 0) continue;
    const kind = blanks.length === 1 ? 'single' : 'group';
    const prompts = readQuestionPrompts(grid, promptColumn, block.rows, blanks, kind);
    questions.push({
      number: block.number,
      order: questions.length + 1,
      kind,
      blanks: blanks.map((b, i) => ({ ...b, prompt: prompts.blankPrompts[i] ?? null })),
      prompt: prompts.prompt,
    });
  }
  if (blocks.length === 0) {
    collector.add('NO_QUESTIONS', '表頭以下沒有任何題目。', { sheetTitle: grid.sheetTitle });
  }
  if (collector.issues.length > 0) throw invalid(collector);
  return {
    sheetTitle: grid.sheetTitle,
    questions,
    headerRowIndex: header.rowIndex,
    usedColumnCount: usedColumnCountOf(grid),
    resultColumns: resultColumnsOf(grid, header.rowIndex),
  };
}

function invalid(collector: IssueCollector): DomainError {
  return new DomainError(
    'GUIDED_NOTES_INVALID',
    'Guided Notes 格式不符，請依下列位置修正後再匯入。',
    collector.issues,
  );
}
