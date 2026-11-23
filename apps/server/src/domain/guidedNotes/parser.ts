import type { Blank, ErrorDetail, GuidedNotesIssueCode, Question } from '@crs/shared';
import type {
  SheetGrid,
  SpreadsheetSnapshot,
} from '../../infrastructure/sheets/guidedNotesGateway.js';
import { DomainError } from '../errors.js';
import { anchorOf, columnName, effectiveValue, rawValue, type CellPosition } from './grid.js';
import { readBlankMarker } from './markers.js';
import { findPromptColumn, readQuestionPrompts } from './prompts.js';
import { parseQuestionNumber } from './questionNumber.js';

/**
 * Guided Notes 辨識（contracts/guided-notes-format.md §2～§6，constitution 原則 III）。
 * 一切依文件內容動態定位：先找表頭、再逐列讀題號與作答格，不使用任何固定的儲存格座標、列號或欄號。
 */

const HEADER_NUMBER = '題號';
const HEADER_ANSWER = '作答';

export interface ParsedGuidedNotes {
  sheetTitle: string;
  questions: Question[];
}

interface HeaderRow {
  rowIndex: number;
  numberColumn: number;
  answerColumn: number;
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
    if (numberColumn >= 0 && answerColumn >= 0) rows.push({ rowIndex, numberColumn, answerColumn });
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

/** 作答格：區塊內每列在作答欄的儲存格，依合併左上角去重後依列排序。 */
function answerCells(grid: SheetGrid, header: HeaderRow, block: QuestionBlock): CellPosition[] {
  const seen = new Set<string>();
  const cells: CellPosition[] = [];
  for (const row of block.rows) {
    const anchor = anchorOf(grid, row, header.answerColumn);
    const key = `${anchor.rowIndex}:${anchor.columnIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push(anchor);
  }
  return cells.sort((a, b) => a.rowIndex - b.rowIndex);
}

/**
 * 題組的子題標記規則：全部沒有標記，或全部有且從（1）連號；
 * 部分有標記或不連號都視為格式錯誤。單題沒有子題標記（label 一律為 null）。
 */
function buildBlanks(
  grid: SheetGrid,
  block: QuestionBlock,
  cells: CellPosition[],
  collector: IssueCollector,
): Blank[] {
  const location = (cell: CellPosition) => ({ sheetTitle: grid.sheetTitle, ...cell });
  if (cells.length === 1 && cells[0] !== undefined) {
    return [{ index: 1, label: null, location: location(cells[0]), prompt: null }];
  }
  const markers = cells.map((c) => readBlankMarker(rawValue(grid, c.rowIndex, c.columnIndex)));
  const marked = markers.filter((m) => m !== null).length;
  const firstRow = (block.rows[0] ?? 0) + 1;
  if (marked > 0 && marked < cells.length) {
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
  return cells.map((cell, i) => ({
    index: i + 1,
    label: markers[i]?.label ?? null,
    location: location(cell),
    prompt: null,
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
    const cells = answerCells(grid, header, block);
    const blanks = buildBlanks(grid, block, cells, collector);
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
  return { sheetTitle: grid.sheetTitle, questions };
}

function invalid(collector: IssueCollector): DomainError {
  return new DomainError(
    'GUIDED_NOTES_INVALID',
    'Guided Notes 格式不符，請依下列位置修正後再匯入。',
    collector.issues,
  );
}
