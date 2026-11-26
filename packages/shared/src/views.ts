import { z } from 'zod';
import {
  BlankAnswerSchema,
  GroupIdSchema,
  GroupSchema,
  GuidedNotesRefSchema,
  LastExportSchema,
  QuestionKindSchema,
  SessionStatusSchema,
  SubmissionSchema,
} from './domain.js';

/**
 * 依角色產生的檢視資料（data-model.md「依角色產生的檢視資料」，FR-020）。
 * `viewer` 欄位標示資料是給哪一種身分，前端據此決定畫面。
 */

const QuestionSummaryShape = {
  number: z.number().int().positive(),
  kind: QuestionKindSchema,
  blankCount: z.number().int().positive(),
  /**
   * 子題標記原文（如「（1）」），依子題序號排列；沒有標記為 null（003 FR-012、research R5）。
   * 只含標記、不含任何題目或子題敘述（003 FR-022）；長度必須等於 blankCount。
   */
  blankLabels: z.array(z.string().nullable()),
};

/** blankLabels 必須與子題數一致，否則學生端無法對應輸入欄。 */
const labelsMatchBlankCount = (q: { blankCount: number; blankLabels: unknown[] }): boolean =>
  q.blankLabels.length === q.blankCount;
const LABELS_MISMATCH = { message: 'blankLabels 的數量必須等於 blankCount' };

export const QuestionSummarySchema = z
  .object(QuestionSummaryShape)
  .refine(labelsMatchBlankCount, LABELS_MISMATCH);
export type QuestionSummary = z.infer<typeof QuestionSummarySchema>;

/**
 * 學生端的題目敘述（004 FR-016、research R7）：prompt 為題目敘述或題組說明，
 * blankPrompts 依子題序號排列（長度等於 blankCount）；文件沒有敘述時為 null。
 */
export const QuestionTextsSchema = z.object({
  prompt: z.string().nullable(),
  blankPrompts: z.array(z.string().nullable()),
});
export type QuestionTexts = z.infer<typeof QuestionTextsSchema>;

/**
 * 學生端的題目：在 QuestionSummary 上加 content。
 * content 只在「搶答進行中」「已結束」時有值，其他階段為 null（004 FR-018、FR-019）。
 */
export const StudentQuestionViewSchema = z
  .object({ ...QuestionSummaryShape, content: QuestionTextsSchema.nullable() })
  .refine(labelsMatchBlankCount, LABELS_MISMATCH)
  .refine((q) => q.content === null || q.content.blankPrompts.length === q.blankCount, {
    message: 'blankPrompts 的數量必須等於 blankCount',
  });
export type StudentQuestionView = z.infer<typeof StudentQuestionViewSchema>;

/** 各組目前的組員數（004 FR-009）：所有學生端與未登入分頁都看得到。 */
export const GroupHeadcountSchema = z.object({
  groupId: GroupIdSchema,
  memberCount: z.number().int().nonnegative(),
});
export type GroupHeadcount = z.infer<typeof GroupHeadcountSchema>;

/** 本組成員（004 FR-010）：只傳給同組學生，依加入先後排列。 */
export const GroupMemberSchema = z.object({
  memberId: z.uuid(),
  nickname: z.string(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

/**
 * 每題結果的顯示資料：搶答成功組別、答案與送出者；無人搶答時皆為 null。
 * 送出者為 null 也可能是 004 之前保存的送出紀錄（004 FR-025）。
 */
export const ResultViewSchema = z.object({
  questionNumber: z.number().int().positive(),
  winnerGroupId: GroupIdSchema.nullable(),
  answers: z.array(BlankAnswerSchema).nullable(),
  submitterNickname: z.string().nullable(),
});
export type ResultView = z.infer<typeof ResultViewSchema>;

/** 老師端預覽用的子題資料：不含儲存格位置（002 data-model §2）。 */
export const TeacherBlankViewSchema = z.object({
  index: z.number().int().positive(),
  label: z.string().nullable(),
  prompt: z.string().nullable(),
});
export type TeacherBlankView = z.infer<typeof TeacherBlankViewSchema>;

/** 老師端的題目資料：比 QuestionSummary 多了題目敘述與子題（只出現在 TeacherView，002 FR-007）。 */
export const TeacherQuestionViewSchema = z
  .object({
    ...QuestionSummaryShape,
    prompt: z.string().nullable(),
    blanks: z.array(TeacherBlankViewSchema),
  })
  .refine(labelsMatchBlankCount, LABELS_MISMATCH);
export type TeacherQuestionView = z.infer<typeof TeacherQuestionViewSchema>;

/** 老師端的每題結果：多了搶答成功作答的伺服器收件時間（002 FR-014）。 */
export const TeacherResultViewSchema = ResultViewSchema.extend({
  receivedAt: z.string().nullable(),
});
export type TeacherResultView = z.infer<typeof TeacherResultViewSchema>;

const BaseViewShape = {
  status: SessionStatusSchema,
  groups: z.array(GroupSchema),
  questions: z.array(QuestionSummarySchema),
};

export const PublicViewSchema = z.object({
  viewer: z.literal('public'),
  ...BaseViewShape,
  headcounts: z.array(GroupHeadcountSchema),
});
export type PublicView = z.infer<typeof PublicViewSchema>;

/** 學生自己組別的已送出資料：不含 sequence、順位、是否搶答成功（避免透露他組作答狀況）。 */
export const OwnSubmissionSchema = z.object({
  questionNumber: z.number().int().positive(),
  answers: z.array(BlankAnswerSchema),
  /** 本組這一題的送出者暱稱（004 FR-024）；舊紀錄為 null */
  submitterNickname: z.string().nullable(),
});
export type OwnSubmission = z.infer<typeof OwnSubmissionSchema>;

export const StudentViewSchema = z.object({
  viewer: z.literal('student'),
  ...BaseViewShape,
  questions: z.array(StudentQuestionViewSchema),
  headcounts: z.array(GroupHeadcountSchema),
  /** 只有本組成員（004 FR-014） */
  members: z.array(GroupMemberSchema),
  groupId: GroupIdSchema,
  ownSubmissions: z.array(OwnSubmissionSchema),
  /** 只有活動「已結束」後才有值 */
  results: z.array(ResultViewSchema).nullable(),
  /** 搶答計時用（004 FR-029、FR-030）：與老師端相同的開啟、結束時間與伺服器時間 */
  openedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  serverNow: z.string(),
});
export type StudentView = z.infer<typeof StudentViewSchema>;

/** 數列是否嚴格遞增（不重複且由小到大）。 */
function isAscending(values: readonly number[]): boolean {
  return values.every((v, i) => i === 0 || (values[i - 1] ?? Number.NEGATIVE_INFINITY) < v);
}

/** 在組內的成員是否都排在不在組內的成員之前（出現第一位不在組內者後，不能再有在組內者）。 */
function inGroupFirst(members: readonly { inGroup: boolean }[]): boolean {
  let seenOutside = false;
  for (const m of members) {
    if (!m.inGroup) seenOutside = true;
    else if (seenOutside) return false;
  }
  return true;
}

/**
 * 分組情況的題號標註（006 FR-007、FR-010）：組員替本組送出且被採計的題目。
 * isWinner：該送出是此題的搶答成功（依既有的 deriveResults 判定，不另訂規則）。
 */
export const MemberAnswerTagSchema = z.object({
  questionNumber: z.number().int().positive(),
  isWinner: z.boolean(),
});
export type MemberAnswerTag = z.infer<typeof MemberAnswerTagSchema>;

/**
 * 分組情況中的一位成員（006 data-model §2）：
 * - inGroup：目前在名冊中（在組內）；false 為已不在組內、但送出過題目的送出者（FR-009）。
 * - disconnected：在組內但所有分頁都斷線、仍在 30 秒緩衝期（「連線中斷」，FR-021）。
 * - answered：依題號由小到大。
 */
export const OverviewMemberSchema = z
  .object({
    memberId: z.uuid(),
    nickname: z.string(),
    inGroup: z.boolean(),
    disconnected: z.boolean(),
    answered: z.array(MemberAnswerTagSchema),
  })
  .refine((m) => m.inGroup || (!m.disconnected && m.answered.length > 0), {
    message: '不在組內的成員不會是「連線中斷」，且一定送出過題目',
  })
  .refine((m) => isAscending(m.answered.map((t) => t.questionNumber)), {
    message: 'answered 的題號必須不重複且由小到大',
  });
export type OverviewMember = z.infer<typeof OverviewMemberSchema>;

/**
 * 一組的分組情況（006 FR-002、FR-003、FR-009）：memberCount 只算在組內的組員（與學生端人數一致），
 * members 先列在組內的組員（依加入先後），再列不在組內的送出者。只出現在老師檢視（FR-016）。
 */
export const GroupOverviewSchema = z
  .object({
    groupId: GroupIdSchema,
    memberCount: z.number().int().nonnegative(),
    members: z.array(OverviewMemberSchema),
  })
  .refine((g) => g.memberCount === g.members.filter((m) => m.inGroup).length, {
    message: 'memberCount 必須等於在組內的成員數',
  })
  .refine((g) => inGroupFirst(g.members), {
    message: '在組內的成員必須排在不在組內的成員之前',
  })
  .refine((g) => new Set(g.members.map((m) => m.memberId)).size === g.members.length, {
    message: '同一組的成員不可重複',
  });
export type GroupOverview = z.infer<typeof GroupOverviewSchema>;

export const TeacherViewSchema = z.object({
  viewer: z.literal('teacher'),
  ...BaseViewShape,
  questions: z.array(TeacherQuestionViewSchema),
  activityId: z.uuid().nullable(),
  source: GuidedNotesRefSchema.nullable(),
  submissions: z.array(SubmissionSchema),
  /** 「搶答進行中」時為目前的第一名，「已結束」後為最終結果 */
  results: z.array(TeacherResultViewSchema),
  openedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  lastExport: LastExportSchema.nullable(),
  /** 伺服器產生這份資料時的時間，前端據此校正計時（002 FR-012、research R5） */
  serverNow: z.string(),
  /** 分組情況（006）：依組別編號排列；尚未匯入時為空陣列。只有老師檢視有（FR-016） */
  groupOverview: z.array(GroupOverviewSchema),
});
export type TeacherView = z.infer<typeof TeacherViewSchema>;

export const SessionViewSchema = z.discriminatedUnion('viewer', [
  PublicViewSchema,
  StudentViewSchema,
  TeacherViewSchema,
]);
export type SessionView = z.infer<typeof SessionViewSchema>;
