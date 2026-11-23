import { describe, expect, it } from 'vitest';
import {
  BlankAnswerSchema,
  GroupIdSchema,
  PersistedStateSchema,
  PublicViewSchema,
  QuestionSchema,
  QuestionSummarySchema,
  StudentViewSchema,
  SubmitRequestSchema,
  TeacherViewSchema,
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

describe('002：題目敘述與老師檢視（research R2、R3）', () => {
  const session001 = {
    activityId: '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11',
    status: 'READY',
    source: { spreadsheetId: 'doc', sheetTitle: '學習單' },
    groups: [
      { id: 1, name: '第 1 組' },
      { id: 2, name: '第 2 組' },
    ],
    questions: [
      { number: 1, order: 1, kind: 'single', blanks: [{ index: 1, label: null, location }] },
    ],
    submissions: [],
    nextSequence: 1,
    openedAt: null,
    closedAt: null,
    lastExport: null,
  };

  it('001 格式的保存檔（沒有 prompt）可以載入，prompt 預設為 null', () => {
    const parsed = PersistedStateSchema.parse({ schemaVersion: 1, session: session001 });
    const question = parsed.session.questions[0];
    expect(question?.prompt).toBeNull();
    expect(question?.blanks[0]?.prompt).toBeNull();
  });

  it('TeacherView 接受題目敘述、子題、結果提交時間與 serverNow', () => {
    const view = {
      viewer: 'teacher',
      status: 'CLOSED',
      groups: session001.groups,
      questions: [
        {
          number: 1,
          kind: 'group',
          blankCount: 2,
          blankLabels: ['（1）', '（2）'],
          prompt: null,
          blanks: [
            { index: 1, label: '（1）', prompt: '子題一' },
            { index: 2, label: '（2）', prompt: '子題二' },
          ],
        },
      ],
      activityId: session001.activityId,
      source: session001.source,
      submissions: [],
      results: [{ questionNumber: 1, winnerGroupId: null, answers: null, receivedAt: null }],
      openedAt: '2026-11-23T02:00:00.000Z',
      closedAt: '2026-11-23T02:05:00.000Z',
      lastExport: null,
      serverNow: '2026-11-23T02:06:00.000Z',
    };
    expect(TeacherViewSchema.safeParse(view).success).toBe(true);
  });

  it('學生與公開檢視的題目資料不含 prompt 或 blanks 欄位（SC-009）', () => {
    const questionShape = (schema: typeof StudentViewSchema | typeof PublicViewSchema) =>
      Object.keys(schema.shape.questions.element.shape);
    for (const keys of [questionShape(StudentViewSchema), questionShape(PublicViewSchema)]) {
      expect(keys).not.toContain('prompt');
      expect(keys).not.toContain('blanks');
    }
  });
});

describe('QuestionSummary.blankLabels（003 FR-012、data-model §1）', () => {
  const group = { number: 1, kind: 'group' as const, blankCount: 2 };

  it('長度等於 blankCount 時通過，元素可為 null', () => {
    expect(
      QuestionSummarySchema.safeParse({ ...group, blankLabels: ['（1）', '（2）'] }).success,
    ).toBe(true);
    expect(QuestionSummarySchema.safeParse({ ...group, blankLabels: [null, null] }).success).toBe(
      true,
    );
  });

  it('長度不符或缺少欄位時失敗', () => {
    expect(QuestionSummarySchema.safeParse({ ...group, blankLabels: ['（1）'] }).success).toBe(
      false,
    );
    expect(QuestionSummarySchema.safeParse(group).success).toBe(false);
  });

  it('學生、公開、老師檢視的題目都接受 blankLabels', () => {
    const base = { status: 'READY' as const, groups: [{ id: 1, name: '第 1 組' }] };
    const question = { ...group, blankLabels: ['（1）', '（2）'] };
    expect(
      PublicViewSchema.safeParse({ viewer: 'public', ...base, questions: [question] }).success,
    ).toBe(true);
    expect(
      StudentViewSchema.safeParse({
        viewer: 'student',
        ...base,
        questions: [question],
        groupId: 1,
        ownSubmissions: [],
        results: null,
      }).success,
    ).toBe(true);
    expect(
      PublicViewSchema.safeParse({
        viewer: 'public',
        ...base,
        questions: [{ ...group, blankLabels: [null] }],
      }).success,
    ).toBe(false);
  });
});
