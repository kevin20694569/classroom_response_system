import {
  CSV_HEADERS,
  CSV_NO_ANSWER_TEXT,
  groupName,
  type Question,
  type QuestionResult,
  type QuizSession,
  type Submission,
} from '@crs/shared';
import type { RankingStrategy } from '../../ranking/rankingStrategy.js';
import { type CsvCell, toExcelText } from './csvEncoder.js';
import { formatCsvSubmittedAt } from './csvSubmittedAt.js';

/** 結果 CSV 的一列（data-model.md §2）。 */
export interface ResultRow {
  questionNumber: number;
  /** 題組的子題標記；單題與無人作答為 null */
  blankLabel: string | null;
  groupLabel: string | null;
  submitterNickname: string | null;
  answer: string;
  rankLabel: string | null;
  submittedAt: string | null;
  isWinner: '是' | '否' | null;
}

/** 依 CSV_HEADERS 的欄位順序輸出一列。 */
export function toCsvRecord(row: ResultRow): CsvCell[] {
  const byHeader: Record<(typeof CSV_HEADERS)[number], CsvCell> = {
    題號: String(row.questionNumber),
    子題: row.blankLabel,
    組別: row.groupLabel,
    送出者暱稱: toExcelText(row.submitterNickname),
    答案: toExcelText(row.answer),
    搶答順位: row.rankLabel,
    送出時間: row.submittedAt,
    是否搶答成功: row.isWinner,
  };
  return CSV_HEADERS.map((header) => byHeader[header]);
}

/**
 * 子題標記：「子題1」「子題2」…，依子題序號。刻意不使用文件上的「（1）」或「(1)」：
 * Excel 會把括號包住的數字（半形、全形皆然）當成會計負數顯示成 -1；也不使用「1-1」，Excel 會把它轉成日期。
 */
function blankLabelOf(question: Question, position: number): string {
  return `子題${String(question.blanks[position]?.index ?? position + 1)}`;
}

/** 一筆送出轉成列：單題一列；題組依子題順序每個子題一列（同一筆送出的列相鄰，FR-007）。 */
function rowsOfSubmission(
  question: Question,
  submission: Submission,
  rankLabel: string,
  isWinner: boolean,
): ResultRow[] {
  const common = {
    questionNumber: question.number,
    groupLabel: groupName(submission.groupId),
    submitterNickname: submission.submitterNickname,
    rankLabel,
    submittedAt: formatCsvSubmittedAt(submission.receivedAt),
    isWinner: isWinner ? ('是' as const) : ('否' as const),
  };
  if (question.kind === 'single') {
    return [{ ...common, blankLabel: null, answer: submission.answers[0]?.text ?? '' }];
  }
  return question.blanks.map((blank, position) => ({
    ...common,
    blankLabel: blankLabelOf(question, position),
    answer: submission.answers.find((a) => a.blankIndex === blank.index)?.text ?? '',
  }));
}

/**
 * 把活動的送出紀錄轉成結果列（FR-006～FR-008）：
 * 題號由小到大，同題依順位策略排序，題組的同一筆送出依子題順序；
 * 沒有任何組別作答的題目恰好一列「無人作答」。
 * 搶答成功以 results 的 winner 為準，與老師端畫面一致（FR-009）。
 */
export function buildResultRows(
  session: Readonly<QuizSession>,
  ranking: RankingStrategy,
  results: readonly QuestionResult[],
): ResultRow[] {
  const questions = [...session.questions].sort((a, b) => a.number - b.number);
  const rows: ResultRow[] = [];
  for (const question of questions) {
    const winnerId = results.find((r) => r.questionNumber === question.number)?.winner?.id;
    const ranked = ranking.rank(
      session.submissions.filter((s) => s.questionNumber === question.number),
    );
    if (ranked.length === 0) {
      rows.push({
        questionNumber: question.number,
        blankLabel: null,
        groupLabel: null,
        submitterNickname: null,
        answer: CSV_NO_ANSWER_TEXT,
        rankLabel: null,
        submittedAt: null,
        isWinner: null,
      });
      continue;
    }
    ranked.forEach((submission, position) => {
      rows.push(
        ...rowsOfSubmission(
          question,
          submission,
          `第 ${String(position + 1)} 名`,
          submission.id === winnerId,
        ),
      );
    });
  }
  return rows;
}
