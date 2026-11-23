import type {
  GroupId,
  PublicView,
  QuestionResult,
  QuizSession,
  ResultView,
  StudentView,
  TeacherQuestionView,
  TeacherResultView,
  TeacherView,
} from '@crs/shared';
import type { RankingStrategy } from '../ranking/rankingStrategy.js';
import { deriveResults } from '../ranking/results.js';

/**
 * 可見性政策（FR-020、constitution 原則 I）：伺服器依角色產生不同的資料，
 * 學生不該看到的資料根本不會被送出，而不是只靠前端隱藏。
 * 題目敘述（002 FR-007）只放進老師檢視，學生與公開檢視沿用只有題號的 QuestionSummary。
 */

function base(session: QuizSession): Pick<PublicView, 'status' | 'groups' | 'questions'> {
  return {
    status: session.status,
    groups: session.groups,
    questions: session.questions.map((q) => ({
      number: q.number,
      kind: q.kind,
      blankCount: q.blanks.length,
      // 只取子題標記原文，敘述（prompt）不會進入學生與公開資料（003 FR-022、research R5）
      blankLabels: q.blanks.map((b) => b.label),
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

/** 老師端題目：含題目敘述與子題（預覽用，002 FR-006），不含儲存格位置。 */
function toTeacherQuestion(question: QuizSession['questions'][number]): TeacherQuestionView {
  return {
    number: question.number,
    kind: question.kind,
    blankCount: question.blanks.length,
    blankLabels: question.blanks.map((b) => b.label),
    prompt: question.prompt,
    blanks: question.blanks.map((b) => ({ index: b.index, label: b.label, prompt: b.prompt })),
  };
}

/** 老師端結果：多了搶答成功作答的收件時間，供提交時間提示使用（002 FR-014）。 */
function toTeacherResult(result: QuestionResult): TeacherResultView {
  return { ...toResultView(result), receivedAt: result.winner?.receivedAt ?? null };
}

/**
 * 老師檢視：所有組別的作答紀錄與順位；搶答進行中時 results 為目前第一名。
 * serverNow 為產生這份資料的伺服器時間，前端據此校正計時（002 FR-012）。
 */
export function toTeacherView(
  session: QuizSession,
  strategy: RankingStrategy,
  now: Date,
): TeacherView {
  return {
    viewer: 'teacher',
    ...base(session),
    questions: session.questions.map(toTeacherQuestion),
    activityId: session.activityId,
    source: session.source,
    submissions: session.submissions,
    results: deriveResults(session, strategy).map(toTeacherResult),
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    lastExport: session.lastExport,
    serverNow: now.toISOString(),
  };
}
