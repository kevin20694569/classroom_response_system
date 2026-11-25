import type {
  GroupId,
  PublicView,
  GradingStatus,
  QuestionResult,
  QuestionTexts,
  QuizSession,
  ResultView,
  StudentView,
  TeacherQuestionView,
  TeacherResultView,
  TeacherView,
} from '@crs/shared';
import type { RankingStrategy } from '../ranking/rankingStrategy.js';
import type { RosterReader } from '../roster/groupRoster.js';
import { deriveResults } from '../ranking/results.js';

/**
 * 可見性政策（FR-020、constitution 原則 I）：伺服器依角色產生不同的資料，
 * 學生不該看到的資料根本不會被送出，而不是只靠前端隱藏。
 * 題目敘述：老師檢視任何階段都有（002 FR-007）；學生檢視只在「搶答進行中」「已結束」才有，
 * 讓所有組別在老師開啟搶答的同一刻才看到題目（004 FR-018、FR-019，取代 003「學生不含敘述」的規定）；
 * 公開檢視（尚未選組）任何階段都沒有敘述。
 */

function base(session: QuizSession): Pick<PublicView, 'status' | 'groups' | 'questions'> {
  return {
    status: session.status,
    groups: session.groups,
    questions: session.questions.map((q) => ({
      number: q.number,
      kind: q.kind,
      blankCount: q.blanks.length,
      // 只取子題標記原文；敘述另由 studentContent 依階段決定是否提供（004 research R7）
      blankLabels: q.blanks.map((b) => b.label),
    })),
  };
}

/**
 * 本組送出的批改狀態（004 FR-033、FR-034）：「已結束」以前一律等待批改（不透露任何判定）；
 * 已勾選為答對；批改完成後仍未勾選為答錯。
 */
function gradingOf(
  submission: QuizSession['submissions'][number],
  status: QuizSession['status'],
  gradingFinished: boolean,
): GradingStatus {
  if (status !== 'CLOSED') return 'PENDING';
  if (submission.correct) return 'CORRECT';
  return gradingFinished ? 'INCORRECT' : 'PENDING';
}

/** 學生端在這個階段能不能看到題目敘述（004 FR-016、FR-018）。 */
const showsContent = (status: QuizSession['status']): boolean =>
  status === 'OPEN' || status === 'CLOSED';

/** 學生端的題目敘述：題目敘述或題組說明，與依子題序號排列的子題敘述。 */
function studentContent(question: QuizSession['questions'][number]): QuestionTexts {
  return { prompt: question.prompt, blankPrompts: question.blanks.map((b) => b.prompt) };
}

function toResultView(result: QuestionResult): ResultView {
  return {
    questionNumber: result.questionNumber,
    winnerGroupId: result.winner?.groupId ?? null,
    answers: result.winner?.answers ?? null,
    submitterNickname: result.winner?.submitterNickname ?? null,
  };
}

/** 公開檢視：各組人數所有人都看得到，但不含任何成員名單（004 FR-009、FR-014）。 */
export function toPublicView(session: QuizSession, roster: RosterReader): PublicView {
  return {
    viewer: 'public',
    ...base(session),
    headcounts: roster.headcounts(session.groups),
  };
}

/**
 * 學生檢視：活動結束前只拿得到自己組別送出的題號與答案，
 * 拿不到 sequence、順位、是否搶答成功與任何他組資料（這些都會透露他組的作答狀況）。
 * 活動結束後才提供每題結果。
 * 004：加上各組人數與「只有本組」的成員名單，其他組的成員名單永遠不會傳給學生（FR-014）。
 */
export function toStudentView(
  session: QuizSession,
  groupId: GroupId,
  strategy: RankingStrategy,
  roster: RosterReader,
  now: Date,
): StudentView {
  const gradingFinished = session.status === 'CLOSED' && session.gradingFinishedAt !== null;
  return {
    viewer: 'student',
    ...base(session),
    questions: base(session).questions.map((summary, i) => {
      const question = session.questions[i];
      return {
        ...summary,
        content:
          question !== undefined && showsContent(session.status) ? studentContent(question) : null,
      };
    }),
    headcounts: roster.headcounts(session.groups),
    members: roster.membersOf(groupId),
    groupId,
    ownSubmissions: session.submissions
      .filter((s) => s.groupId === groupId)
      .map((s) => ({
        questionNumber: s.questionNumber,
        answers: s.answers,
        submitterNickname: s.submitterNickname,
        grading: gradingOf(s, session.status, gradingFinished),
      })),
    // 他組的搶答成功答案與送出者只在老師「批改完成」後公布（004 FR-025），避免批改途中結果反覆改變
    results: gradingFinished ? deriveResults(session, strategy).map(toResultView) : null,
    gradingFinished,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    serverNow: now.toISOString(),
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
    gradingFinishedAt: session.gradingFinishedAt,
    serverNow: now.toISOString(),
  };
}
