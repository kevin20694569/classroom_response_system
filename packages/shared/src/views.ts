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

export const QuestionSummarySchema = z.object({
  number: z.number().int().positive(),
  kind: QuestionKindSchema,
  blankCount: z.number().int().positive(),
});
export type QuestionSummary = z.infer<typeof QuestionSummarySchema>;

/** 每題結果的顯示資料：搶答成功組別與答案；無人搶答時皆為 null。 */
export const ResultViewSchema = z.object({
  questionNumber: z.number().int().positive(),
  winnerGroupId: GroupIdSchema.nullable(),
  answers: z.array(BlankAnswerSchema).nullable(),
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
export const TeacherQuestionViewSchema = QuestionSummarySchema.extend({
  prompt: z.string().nullable(),
  blanks: z.array(TeacherBlankViewSchema),
});
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
});
export type PublicView = z.infer<typeof PublicViewSchema>;

/** 學生自己組別的已送出資料：不含 sequence、順位、是否搶答成功（避免透露他組作答狀況）。 */
export const OwnSubmissionSchema = z.object({
  questionNumber: z.number().int().positive(),
  answers: z.array(BlankAnswerSchema),
});
export type OwnSubmission = z.infer<typeof OwnSubmissionSchema>;

export const StudentViewSchema = z.object({
  viewer: z.literal('student'),
  ...BaseViewShape,
  groupId: GroupIdSchema,
  ownSubmissions: z.array(OwnSubmissionSchema),
  /** 只有活動「已結束」後才有值 */
  results: z.array(ResultViewSchema).nullable(),
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
