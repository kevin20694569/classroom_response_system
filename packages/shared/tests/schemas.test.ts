import { describe, expect, it } from 'vitest';
import {
  BlankAnswerSchema,
  CSV_EXPORT_PATH,
  CSV_HEADERS,
  CSV_NO_ANSWER_TEXT,
  GroupIdSchema,
  GroupOverviewSchema,
  NICKNAME_MAX_LENGTH,
  NicknameSchema,
  OverviewMemberSchema,
  OwnSubmissionSchema,
  PersistedStateSchema,
  PublicViewSchema,
  StudentJoinRequestSchema,
  StudentQuestionViewSchema,
  SubmissionSchema,
  QuestionSchema,
  QuestionSummarySchema,
  StudentViewSchema,
  SubmitRequestSchema,
  TeacherViewSchema,
  unicodeLength,
  type OverviewMember,
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
      results: [
        {
          questionNumber: 1,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
      ],
      openedAt: '2026-11-23T02:00:00.000Z',
      closedAt: '2026-11-23T02:05:00.000Z',
      lastExport: null,
      serverNow: '2026-11-23T02:06:00.000Z',
      groupOverview: [],
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
    const base = {
      status: 'READY' as const,
      groups: [{ id: 1, name: '第 1 組' }],
      headcounts: [{ groupId: 1, memberCount: 0 }],
    };
    const question = { ...group, blankLabels: ['（1）', '（2）'] };
    expect(
      PublicViewSchema.safeParse({ viewer: 'public', ...base, questions: [question] }).success,
    ).toBe(true);
    expect(
      StudentViewSchema.safeParse({
        viewer: 'student',
        ...base,
        questions: [{ ...question, content: null }],
        members: [],
        groupId: 1,
        ownSubmissions: [],
        results: null,
        openedAt: null,
        closedAt: null,
        serverNow: '2026-11-25T02:00:00.000Z',
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

describe('004：暱稱（FR-004、data-model §1）', () => {
  it('去除前後空白後保存', () => {
    expect(NicknameSchema.parse('  Milo  ')).toBe('Milo');
  });

  it('1 字與 20 字通過，21 字失敗', () => {
    expect(NicknameSchema.safeParse('A').success).toBe(true);
    expect(NicknameSchema.safeParse('字'.repeat(NICKNAME_MAX_LENGTH)).success).toBe(true);
    expect(NicknameSchema.safeParse('字'.repeat(NICKNAME_MAX_LENGTH + 1)).success).toBe(false);
  });

  it('空字串與只有空白失敗', () => {
    expect(NicknameSchema.safeParse('').success).toBe(false);
    expect(NicknameSchema.safeParse('   ').success).toBe(false);
  });

  it('含換行或 tab 失敗', () => {
    expect(NicknameSchema.safeParse('Mi\nlo').success).toBe(false);
    expect(NicknameSchema.safeParse('Mi\tlo').success).toBe(false);
  });

  it('表情符號以實際字元計算：20 個表情符號通過', () => {
    expect(NicknameSchema.safeParse('😀'.repeat(20)).success).toBe(true);
    expect(NicknameSchema.safeParse('😀'.repeat(21)).success).toBe(false);
  });

  it('失敗訊息為暱稱規則', () => {
    const result = NicknameSchema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('暱稱需為 1～20 字，且不能只有空白。');
  });
});

describe('004：加入請求（research R3）', () => {
  it('組別與暱稱都有時通過，暱稱被正規化', () => {
    expect(StudentJoinRequestSchema.parse({ groupId: 2, nickname: ' 小明 ' })).toEqual({
      groupId: 2,
      nickname: '小明',
    });
  });

  it('缺少暱稱或有多餘欄位時失敗', () => {
    expect(StudentJoinRequestSchema.safeParse({ groupId: 2 }).success).toBe(false);
    expect(
      StudentJoinRequestSchema.safeParse({ groupId: 2, nickname: 'Milo', memberId: 'x' }).success,
    ).toBe(false);
  });
});

describe('004：學生端題目敘述（research R7）', () => {
  const base = { number: 1, kind: 'group' as const, blankCount: 2, blankLabels: [null, null] };

  it('content 可為 null', () => {
    expect(StudentQuestionViewSchema.safeParse({ ...base, content: null }).success).toBe(true);
  });

  it('blankPrompts 長度等於 blankCount 時通過，元素可為 null', () => {
    expect(
      StudentQuestionViewSchema.safeParse({
        ...base,
        content: { prompt: null, blankPrompts: ['子題一', null] },
      }).success,
    ).toBe(true);
  });

  it('blankPrompts 長度不符時失敗', () => {
    expect(
      StudentQuestionViewSchema.safeParse({
        ...base,
        content: { prompt: '題組說明', blankPrompts: ['子題一'] },
      }).success,
    ).toBe(false);
  });
});

describe('004：送出者暱稱（FR-023、research R9）', () => {
  const submission = {
    id: '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11',
    questionNumber: 1,
    groupId: 1,
    answers: [{ blankIndex: 1, text: '答案' }],
    sequence: 1,
    receivedAt: '2026-11-24T02:00:00.000Z',
  };

  it('004 之前的送出紀錄沒有 submitterNickname 時解析為 null', () => {
    expect(SubmissionSchema.parse(submission).submitterNickname).toBeNull();
  });

  it('保留送出者暱稱', () => {
    expect(
      SubmissionSchema.parse({ ...submission, submitterNickname: 'Milo' }).submitterNickname,
    ).toBe('Milo');
  });

  it('舊格式的保存檔（送出紀錄沒有送出者）仍可載入', () => {
    const parsed = PersistedStateSchema.parse({
      schemaVersion: 1,
      session: {
        activityId: submission.id,
        status: 'CLOSED',
        source: { spreadsheetId: 'doc', sheetTitle: '學習單' },
        groups: [
          { id: 1, name: '第 1 組' },
          { id: 2, name: '第 2 組' },
        ],
        questions: [
          { number: 1, order: 1, kind: 'single', blanks: [{ index: 1, label: null, location }] },
        ],
        submissions: [submission],
        nextSequence: 2,
        openedAt: '2026-11-24T01:59:00.000Z',
        closedAt: '2026-11-24T02:05:00.000Z',
        lastExport: null,
      },
    });
    expect(parsed.session.submissions[0]?.submitterNickname).toBeNull();
  });

  it('006：沒有 submitterMemberId 的舊送出紀錄解析為 null（FR-008）', () => {
    expect(SubmissionSchema.parse(submission).submitterMemberId).toBeNull();
  });

  it('006：保留送出者身分，非 uuid 字串被拒絕', () => {
    const memberId = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';
    expect(
      SubmissionSchema.parse({ ...submission, submitterMemberId: memberId }).submitterMemberId,
    ).toBe(memberId);
    expect(
      SubmissionSchema.safeParse({ ...submission, submitterMemberId: 'not-a-uuid' }).success,
    ).toBe(false);
  });
});

describe('005：CSV 匯出共用常數（contracts/http-api.md）', () => {
  it('表頭恰為 8 欄且順序固定（FR-005）', () => {
    expect([...CSV_HEADERS]).toEqual([
      '題號',
      '子題',
      '組別',
      '送出者暱稱',
      '答案',
      '搶答順位',
      '送出時間',
      '是否搶答成功',
    ]);
  });

  it('路徑與無人作答文字', () => {
    expect(CSV_EXPORT_PATH).toBe('/api/session/export.csv');
    expect(CSV_NO_ANSWER_TEXT).toBe('無人作答');
  });
});

describe('006：分組情況（contracts/teacher-view.md、data-model §2）', () => {
  const id = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`;
  const member = (overrides: Partial<OverviewMember> = {}): OverviewMember => ({
    memberId: id(1),
    nickname: 'Milo',
    inGroup: true,
    disconnected: false,
    answered: [],
    ...overrides,
  });

  it('在組內的組員可以是「連線中斷」、可以沒有送出', () => {
    expect(OverviewMemberSchema.safeParse(member({ disconnected: true })).success).toBe(true);
  });

  it('不在組內的成員必須送出過題目、不可是「連線中斷」', () => {
    const tag = [{ questionNumber: 1, isWinner: false }];
    expect(OverviewMemberSchema.safeParse(member({ inGroup: false, answered: tag })).success).toBe(
      true,
    );
    expect(OverviewMemberSchema.safeParse(member({ inGroup: false })).success).toBe(false);
    expect(
      OverviewMemberSchema.safeParse(member({ inGroup: false, disconnected: true, answered: tag }))
        .success,
    ).toBe(false);
  });

  it('answered 題號必須不重複且由小到大', () => {
    const tags = (...ns: number[]) => ns.map((n) => ({ questionNumber: n, isWinner: false }));
    expect(OverviewMemberSchema.safeParse(member({ answered: tags(1, 3) })).success).toBe(true);
    expect(OverviewMemberSchema.safeParse(member({ answered: tags(3, 1) })).success).toBe(false);
    expect(OverviewMemberSchema.safeParse(member({ answered: tags(2, 2) })).success).toBe(false);
  });

  it('memberCount 必須等於在組內的成員數', () => {
    const absent = member({
      memberId: id(2),
      inGroup: false,
      answered: [{ questionNumber: 1, isWinner: true }],
    });
    const group = { groupId: 1, memberCount: 1, members: [member(), absent] };
    expect(GroupOverviewSchema.safeParse(group).success).toBe(true);
    expect(GroupOverviewSchema.safeParse({ ...group, memberCount: 2 }).success).toBe(false);
  });

  it('在組內的成員必須排在不在組內的成員之前', () => {
    const absent = member({
      memberId: id(2),
      inGroup: false,
      answered: [{ questionNumber: 1, isWinner: false }],
    });
    expect(
      GroupOverviewSchema.safeParse({ groupId: 1, memberCount: 1, members: [member(), absent] })
        .success,
    ).toBe(true);
    expect(
      GroupOverviewSchema.safeParse({ groupId: 1, memberCount: 1, members: [absent, member()] })
        .success,
    ).toBe(false);
  });

  it('同一組的成員不可重複', () => {
    expect(
      GroupOverviewSchema.safeParse({
        groupId: 1,
        memberCount: 2,
        members: [member(), member({ memberId: id(2) })],
      }).success,
    ).toBe(true);
    expect(
      GroupOverviewSchema.safeParse({ groupId: 1, memberCount: 2, members: [member(), member()] })
        .success,
    ).toBe(false);
  });

  it('學生與公開檢視沒有 groupOverview，學生的送出紀錄不含 submitterMemberId（FR-016）', () => {
    expect(Object.keys(StudentViewSchema.shape)).not.toContain('groupOverview');
    expect(Object.keys(PublicViewSchema.shape)).not.toContain('groupOverview');
    expect(Object.keys(OwnSubmissionSchema.shape)).not.toContain('submitterMemberId');
    expect(Object.keys(TeacherViewSchema.shape)).toContain('groupOverview');
  });
});
