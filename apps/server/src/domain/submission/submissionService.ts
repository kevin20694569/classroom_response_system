import type { GroupId, Submission, SubmitRequest, SubmitResponse } from '@crs/shared';
import { DomainError } from '../errors.js';
import type { QuizSessionService } from '../session/quizSessionService.js';
import { validateAnswers } from './validateAnswers.js';

/**
 * 收件與順位判定（US3，FR-015～FR-017a）。
 *
 * 業務規則：順位只依伺服器處理的先後決定——每筆送出在同一把鎖內依序檢查，
 * 通過後才取得遞增的 sequence，不採用任何客戶端時間（FR-016、原則 I）。
 * 「結束搶答」也經過同一把鎖，因此結束之後處理的送出必定看到「已結束」而被拒絕。
 * 被拒絕的送出不產生作答紀錄、不消耗 sequence。
 */
/** 送出者身分：一律取自已驗證的學生 token（004 FR-023）。 */
export interface Submitter {
  groupId: GroupId;
  memberId: string;
  nickname: string;
}

export class SubmissionService {
  constructor(private readonly sessions: QuizSessionService) {}

  /**
   * 組別、送出者暱稱與送出者身分（memberId）一律取自送出者的 token，請求內容無法指定（原則 I、006 FR-008）。
   * 送出者暱稱只用於顯示，不影響順位與搶答判定（004 FR-020）。
   */
  async submit(submitter: Submitter, request: SubmitRequest): Promise<SubmitResponse> {
    const { groupId } = submitter;
    const { logger, now, uuid } = this.sessions.deps;
    try {
      const submission = await this.sessions.mutate((current) => {
        // 1. 只在搶答進行中接受作答
        if (current.status !== 'OPEN') {
          throw new DomainError('SESSION_NOT_OPEN', '目前不在搶答進行中，無法送出答案。');
        }
        // 2. 題號必須存在
        const question = current.questions.find((q) => q.number === request.questionNumber);
        if (question === undefined) {
          throw new DomainError('QUESTION_NOT_FOUND', `沒有第 ${request.questionNumber} 題。`);
        }
        // 3、4. 子題齊全且每個答案 1～200 字
        const answers = validateAnswers(question, request.answers);
        // 5. 同一組對同一題只採計第一次送出
        if (
          current.submissions.some(
            (s) => s.groupId === groupId && s.questionNumber === question.number,
          )
        ) {
          throw new DomainError(
            'ALREADY_SUBMITTED',
            `你的組別已經送出過第 ${question.number} 題。`,
          );
        }
        const created: Submission = {
          id: uuid(),
          questionNumber: question.number,
          groupId,
          answers,
          sequence: current.nextSequence,
          receivedAt: now().toISOString(),
          submitterNickname: submitter.nickname,
          // 006 FR-008：老師端分組情況依身分（不依暱稱）把題號標到實際送出的組員
          submitterMemberId: submitter.memberId,
        };
        return {
          next: {
            ...current,
            submissions: [...current.submissions, created],
            nextSequence: current.nextSequence + 1,
          },
          result: created,
          changes: [{ kind: 'submission', groupId }],
        };
      });
      logger.info(
        {
          event: 'submission.accepted',
          questionNumber: submission.questionNumber,
          groupId,
          // 以 memberId 辨識送出者；log 不記錄暱稱（004 FR-022）
          memberId: submitter.memberId,
          sequence: submission.sequence,
        },
        '已接受送出',
      );
      return { submissionId: submission.id, receivedAt: submission.receivedAt };
    } catch (error) {
      logger.info(
        {
          event: 'submission.rejected',
          questionNumber: request.questionNumber,
          groupId,
          code: error instanceof DomainError ? error.code : 'INTERNAL_ERROR',
        },
        '拒絕送出',
      );
      throw error;
    }
  }
}
