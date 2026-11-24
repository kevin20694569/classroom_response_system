import type { OwnSubmission, QuestionSummary } from '@crs/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StudentIdentity } from '../src/api/identity';
import { QuestionAnswerForm } from '../src/pages/student/QuestionAnswerForm';
import * as AnswerDraftStore from '../src/student/answerDraftStore';
import { bodyOf, mockFetch } from './helpers';

const identity: StudentIdentity = {
  role: 'student',
  groupId: 2,
  activityId: '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11',
  memberId: '3f0b2c1e-1111-4222-8333-444455556666',
  nickname: 'Milo',
  expiresAt: '2999-01-01T00:00:00.000Z',
};
const single: QuestionSummary = { number: 3, kind: 'single', blankCount: 1, blankLabels: [null] };
const group: QuestionSummary = {
  number: 1,
  kind: 'group',
  blankCount: 2,
  blankLabels: ['（1）', '（2）'],
};
const unlabeled: QuestionSummary = {
  number: 2,
  kind: 'group',
  blankCount: 2,
  blankLabels: [null, null],
};
const OK = {
  submissionId: '0b8d2c33-5f0e-4d0a-9a8e-2f2b1f1d0c11',
  receivedAt: '2026-11-24T01:00:00.000Z',
};

function renderForm(
  overrides: Partial<{
    question: QuestionSummary;
    submitted: OwnSubmission | null;
    enabled: boolean;
    canSubmit: boolean;
    onInvalidated: () => void;
  }> = {},
) {
  const props = {
    question: single,
    submitted: null,
    enabled: true,
    canSubmit: true,
    identity,
    onInvalidated: vi.fn(),
    ...overrides,
  };
  return { ...render(<QuestionAnswerForm {...props} />), props };
}

const submitButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /送出/ });

describe('QuestionAnswerForm — 輸入欄（003 FR-012、FR-014、FR-020）', () => {
  it('單題一個輸入欄、沒有子題標記', () => {
    renderForm();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByLabelText('第 3 題答案')).toBeTruthy();
  });

  it('題組依子題顯示標記；沒有標記時顯示（n）', () => {
    renderForm({ question: group });
    expect(screen.getByLabelText('第 1 題（1）')).toBeTruthy();
    expect(screen.getByLabelText('第 1 題（2）')).toBeTruthy();
    renderForm({ question: unlabeled });
    expect(screen.getByLabelText('第 2 題（2）')).toBeTruthy();
  });

  it('輸入時顯示字數並寫入草稿，重新掛載時讀回', async () => {
    const { unmount } = renderForm({ question: group });
    await userEvent.type(screen.getByLabelText('第 1 題（1）'), ' CPU ');
    expect(screen.getByText('3／200')).toBeTruthy();
    expect(AnswerDraftStore.load(identity.activityId, 2, 1, 2)).toEqual([' CPU ', '']);
    unmount();
    renderForm({ question: group });
    expect(screen.getByLabelText<HTMLInputElement>('第 1 題（1）').value).toBe(' CPU ');
  });

  it('enabled 為 false 時輸入與送出停用', () => {
    renderForm({ enabled: false });
    expect(screen.getByLabelText<HTMLInputElement>('第 3 題答案').disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
  });

  it('斷線（canSubmit 為 false）時送出停用但仍可輸入', async () => {
    renderForm({ canSubmit: false });
    await userEvent.type(screen.getByLabelText('第 3 題答案'), '答案');
    expect(submitButton().disabled).toBe(true);
  });
});

describe('QuestionAnswerForm — 送出（003 FR-014～FR-019）', () => {
  it('前端檢查不通過時不送出，並在子題下方顯示原因', async () => {
    const { fetchMock } = mockFetch([]);
    renderForm({ question: group });
    await userEvent.type(screen.getByLabelText('第 1 題（1）'), '甲');
    await userEvent.click(submitButton());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('（2）尚未填寫')).toBeTruthy();
  });

  it('送出去除前後空白的文字；成功後顯示已送出與唯讀答案、清除草稿、不顯示順位', async () => {
    const { calls } = mockFetch([{ status: 200, body: OK }]);
    renderForm({ question: group });
    await userEvent.type(screen.getByLabelText('第 1 題（1）'), '  CPU ');
    await userEvent.type(screen.getByLabelText('第 1 題（2）'), '作業系統');
    await userEvent.click(submitButton());
    expect(calls[0]?.url).toBe('/api/submissions');
    expect(bodyOf(calls[0]?.init)).toEqual({
      questionNumber: 1,
      answers: [
        { blankIndex: 1, text: 'CPU' },
        { blankIndex: 2, text: '作業系統' },
      ],
    });
    expect(await screen.findByText('已送出')).toBeTruthy();
    expect(screen.getByText('CPU')).toBeTruthy();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByText(/順位|搶答成功|第一/)).toBeNull();
    expect(AnswerDraftStore.hasUnsent(identity.activityId, 2)).toBe(false);
  });

  it('送出處理中顯示「送出中…」，連點只送出一次', async () => {
    let respond: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderForm();
    await userEvent.type(screen.getByLabelText('第 3 題答案'), '答案');
    const button = submitButton();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '送出中…' })).toBeTruthy();
    respond(new Response(JSON.stringify(OK), { status: 200 }));
    expect(await screen.findByText('已送出')).toBeTruthy();
  });

  it('SESSION_NOT_OPEN：說明這次送出沒有被採計，停用作答並保留草稿', async () => {
    mockFetch([
      {
        status: 409,
        body: { error: { code: 'SESSION_NOT_OPEN', message: '搶答尚未開始或已結束。' } },
      },
    ]);
    renderForm();
    await userEvent.type(screen.getByLabelText('第 3 題答案'), '答案');
    await userEvent.click(submitButton());
    expect(await screen.findByText('搶答已結束，這次送出沒有被採計')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('第 3 題答案').disabled).toBe(true);
    expect(AnswerDraftStore.hasUnsent(identity.activityId, 2)).toBe(true);
  });

  it('ALREADY_SUBMITTED：顯示本組已送出此題並清除草稿', async () => {
    mockFetch([
      {
        status: 409,
        body: { error: { code: 'ALREADY_SUBMITTED', message: '本組已送出過這一題。' } },
      },
    ]);
    renderForm();
    await userEvent.type(screen.getByLabelText('第 3 題答案'), '答案');
    await userEvent.click(submitButton());
    expect(await screen.findByText('本組已送出此題')).toBeTruthy();
    expect(AnswerDraftStore.hasUnsent(identity.activityId, 2)).toBe(false);
  });

  it('本組已送出（同組其他分頁）時以唯讀方式顯示本組答案', () => {
    renderForm({
      question: group,
      submitted: {
        questionNumber: 1,
        answers: [
          { blankIndex: 1, text: '另一分頁的答案一' },
          { blankIndex: 2, text: '另一分頁的答案二' },
        ],
        submitterNickname: null,
      },
    });
    expect(screen.getByText('已送出')).toBeTruthy();
    expect(screen.getByText('另一分頁的答案一')).toBeTruthy();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('ANSWER_INVALID：依 details.blankIndex 標示子題並保留輸入', async () => {
    mockFetch([
      {
        status: 400,
        body: {
          error: {
            code: 'ANSWER_INVALID',
            message: '答案需為 1～200 字，請修正後再送出。',
            details: [
              {
                code: 'ANSWER_TOO_LONG',
                message: '答案不能超過 200 字',
                questionNumber: 1,
                blankIndex: 2,
              },
            ],
          },
        },
      },
    ]);
    renderForm({ question: group });
    await userEvent.type(screen.getByLabelText('第 1 題（1）'), '甲');
    await userEvent.type(screen.getByLabelText('第 1 題（2）'), '乙');
    await userEvent.click(submitButton());
    expect(await screen.findByText('答案不能超過 200 字')).toBeTruthy();
    expect(screen.getByText('答案需為 1～200 字，請修正後再送出。')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('第 1 題（2）').value).toBe('乙');
  });

  it('連線失敗：保留輸入並提示連線恢復後再送出', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText('第 3 題答案'), '答案');
    await userEvent.click(submitButton());
    expect(await screen.findByText('無法連線到伺服器，連線恢復後請再送出一次')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('第 3 題答案').value).toBe('答案');
  });

  it('UNAUTHORIZED：視為身分失效', async () => {
    mockFetch([
      { status: 401, body: { error: { code: 'UNAUTHORIZED', message: '身分已失效。' } } },
    ]);
    const { props } = renderForm();
    await userEvent.type(screen.getByLabelText('第 3 題答案'), '答案');
    await userEvent.click(submitButton());
    await vi.waitFor(() => {
      expect(props.onInvalidated).toHaveBeenCalledWith('EXPIRED');
    });
  });

  it('伺服器回 500 且內容無法解析時只顯示通用訊息（FR-027）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('Error: boom at /Users/someone/file.ts', { status: 500 })),
      ),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText('第 3 題答案'), '答案');
    await userEvent.click(submitButton());
    expect(await screen.findByText('系統發生錯誤，請稍後再試。')).toBeTruthy();
    expect(document.body.textContent).not.toContain('/Users/');
  });
});
