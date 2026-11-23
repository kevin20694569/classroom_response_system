import { describe, expect, it } from 'vitest';
import {
  BlankAnswerSchema,
  GroupIdSchema,
  QuestionSchema,
  SubmitRequestSchema,
  unicodeLength,
} from '../src/index.js';

const location = { sheetTitle: '學習單', rowIndex: 4, columnIndex: 6 };

describe('BlankAnswerSchema（FR-017a：去除前後空白後 1～200 字）', () => {
  it('空白或只有空格時失敗', () => {
    expect(BlankAnswerSchema.safeParse({ blankIndex: 1, text: '' }).success).toBe(false);
    expect(BlankAnswerSchema.safeParse({ blankIndex: 1, text: '   ' }).success).toBe(false);
  });

  it('1 字與 200 字通過，201 字失敗', () => {
    expect(BlankAnswerSchema.safeParse({ blankIndex: 1, text: '零' }).success).toBe(true);
    expect(BlankAnswerSchema.safeParse({ blankIndex: 1, text: '字'.repeat(200) }).success).toBe(
      true,
    );
    expect(BlankAnswerSchema.safeParse({ blankIndex: 1, text: '字'.repeat(201) }).success).toBe(
      false,
    );
  });

  it('去除前後空白後保存', () => {
    const parsed = BlankAnswerSchema.parse({ blankIndex: 1, text: '  CPU  ' });
    expect(parsed.text).toBe('CPU');
  });

  it('以 Unicode 字元計算長度', () => {
    expect(unicodeLength('😀😀')).toBe(2);
    expect(BlankAnswerSchema.safeParse({ blankIndex: 1, text: '😀'.repeat(200) }).success).toBe(
      true,
    );
  });
});

describe('GroupIdSchema（1～20）', () => {
  it.each([
    [0, false],
    [1, true],
    [20, true],
    [21, false],
  ])('%i → %s', (value, ok) => {
    expect(GroupIdSchema.safeParse(value).success).toBe(ok);
  });
});

describe('QuestionSchema', () => {
  it('單題有 2 個填空格時失敗', () => {
    const result = QuestionSchema.safeParse({
      number: 1,
      order: 1,
      kind: 'single',
      blanks: [
        { index: 1, label: null, location },
        { index: 2, label: null, location },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('題組至少 2 個填空格且從 1 連號', () => {
    const ok = QuestionSchema.safeParse({
      number: 1,
      order: 1,
      kind: 'group',
      blanks: [
        { index: 1, label: '（1）', location },
        { index: 2, label: '（2）', location },
      ],
    });
    expect(ok.success).toBe(true);
    const bad = QuestionSchema.safeParse({
      number: 1,
      order: 1,
      kind: 'group',
      blanks: [
        { index: 1, label: null, location },
        { index: 3, label: null, location },
      ],
    });
    expect(bad.success).toBe(false);
  });
});

describe('SubmitRequestSchema（原則 I：不接受客戶端指定組別或時間）', () => {
  it('帶多餘的 groupId 欄位時被拒絕', () => {
    const result = SubmitRequestSchema.safeParse({
      questionNumber: 1,
      groupId: 2,
      answers: [{ blankIndex: 1, text: 'CPU' }],
    });
    expect(result.success).toBe(false);
  });

  it('帶客戶端時間時被拒絕', () => {
    const result = SubmitRequestSchema.safeParse({
      questionNumber: 1,
      answers: [{ blankIndex: 1, text: 'CPU' }],
      clientTime: '2026-11-23T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('正常請求通過', () => {
    expect(
      SubmitRequestSchema.safeParse({
        questionNumber: 1,
        answers: [{ blankIndex: 1, text: 'CPU' }],
      }).success,
    ).toBe(true);
  });
});
