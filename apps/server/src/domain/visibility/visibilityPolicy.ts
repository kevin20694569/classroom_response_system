import type {
  GroupId,
  PublicView,
  QuestionResult,
  QuizSession,
  ResultView,
  StudentView,
  TeacherView,
} from '@crs/shared';
import type { RankingStrategy } from '../ranking/rankingStrategy.js';
import { deriveResults } from '../ranking/results.js';

/**
 * 可見性政策（FR-020、constitution 原則 I）：伺服器依角色產生不同的資料，
 * 學生不該看到的資料根本不會被送出，而不是只靠前端隱藏。
 * 匯入時只保存題號與作答格，不保存題目敘述（FR-008），因此任何檢視都不含題目敘述。
 */

function base(session: QuizSession): Pick<PublicView, 'status' | 'groups' | 'questions'> {
  return {
    status: session.status,
    groups: session.groups,
    questions: session.questions.map((q) => ({
      number: q.number,
      kind: q.kind,
      blankCount: q.blanks.length,
    })),
  };
}

function toResultView(result: QuestionResult): ResultView {
  return {
    questionNumber: result.questionNumber,
    winnerGroupId: result.winner?.groupId ?? null,
    answers: result.winner?.answers ?? null,
  };
}

export function toPublicView(session: QuizSession): PublicView {
  return { viewer: 'public', ...base(session) };
}

/**
 * 學生檢視：活動結束前只拿得到自己組別送出的題號與答案，
 * 拿不到 sequence、順位、是否搶答成功與任何他組資料（這些都會透露他組的作答狀況）。
 * 活動結束後才提供每題結果。
 */
export function toStudentView(
  session: QuizSession,
  groupId: GroupId,
  strategy: RankingStrategy,
): StudentView {
  return {
    viewer: 'student',
    ...base(session),
    groupId,
    ownSubmissions: session.submissions
      .filter((s) => s.groupId === groupId)
      .map((s) => ({ questionNumber: s.questionNumber, answers: s.answers })),
    results:
      session.status === 'CLOSED' ? deriveResults(session, strategy).map(toResultView) : null,
  };
}

/** 老師檢視：所有組別的作答紀錄與順位；搶答進行中時 results 為目前第一名。 */
export function toTeacherView(session: QuizSession, strategy: RankingStrategy): TeacherView {
  return {
    viewer: 'teacher',
    ...base(session),
    activityId: session.activityId,
    source: session.source,
    submissions: session.submissions,
    results: deriveResults(session, strategy).map(toResultView),
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    lastExport: session.lastExport,
  };
}
