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
});
export type TeacherView = z.infer<typeof TeacherViewSchema>;

export const SessionViewSchema = z.discriminatedUnion('viewer', [
  PublicViewSchema,
  StudentViewSchema,
  TeacherViewSchema,
]);
export type SessionView = z.infer<typeof SessionViewSchema>;
