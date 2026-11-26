import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CSV_EXPORT_NOT_CLOSED_MESSAGE, CSV_EXPORT_PATH, CSV_HEADERS } from '@crs/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { csvAsciiFileName } from '../../src/domain/export/csv/csvFileName.js';
import { LocalSessionRepository } from '../../src/infrastructure/persistence/localSessionRepository.js';
import {
  call,
  joinStudent,
  loginTeacher,
  restartApp,
  startTestApp,
  submitAnswers,
  teacherWithImport,
  type TestApp,
} from '../helpers/testApp.js';

let app: TestApp | undefined;
let dataDir: string | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
  if (dataDir !== undefined) await rm(dataDir, { recursive: true, force: true });
  dataDir = undefined;
});

/** 把 CSV 本文去掉 BOM 後依 CRLF 切成列（本檔的 US1 案例不含引號與換行）。 */
function linesOf(body: string): string[] {
  return body.slice(1).split('\r\n').slice(0, -1);
}

describe('GET /api/session/export.csv（成功路徑，US1）', () => {
  it('單題範例：下載含 BOM、表頭與每筆送出的 CSV，重複匯出完全相同（SC-006）', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 3);
    await call(app, 'POST', '/api/session/open', teacher);
    const g2 = await joinStudent(app, 2, '小華');
    const g1 = await joinStudent(app, 1, '小明');
    await submitAnswers(app, g2, 1, ['CPU']);
    await submitAnswers(app, g1, 1, ['GPU']);
    await call(app, 'POST', '/api/session/close', teacher);

    const res = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['cache-control']).toBe('no-store');
    const disposition = String(res.headers['content-disposition']);
    expect(disposition).toMatch(/^attachment; filename="results_\d{8}-\d{4}\.csv"; /);
    const stamp = /results_(\d{8}-\d{4})\.csv/.exec(disposition)?.[1] ?? '';
    expect(disposition).toContain(
      `filename*=UTF-8''${encodeURIComponent(`搶答結果_${stamp}.csv`)}`,
    );

    const lines = linesOf(res.body);
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
    const [, first, second] = lines.map((line) => line.split(','));
    expect(first?.slice(0, 5)).toEqual(['1', '', '第 2 組', '小華', 'CPU']);
    expect(first?.[5]).toBe('第 1 名');
    expect(first?.[7]).toBe('是');
    expect(second?.slice(0, 5)).toEqual(['1', '', '第 1 組', '小明', 'GPU']);
    expect(second?.[5]).toBe('第 2 名');
    expect(second?.[7]).toBe('否');

    for (let i = 0; i < 4; i += 1) {
      const again = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
      expect(again.body).toBe(res.body);
      expect(again.headers['content-disposition']).toBe(disposition);
    }
  });
});

describe('題組、無人作答與老師端一致（US2，SC-002）', () => {
  it('題組範例：CSV 每一列與老師端送出列表一致，無人作答的題目有一列', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'group-example', 3);
    await call(app, 'POST', '/api/session/open', teacher);
    const g1 = await joinStudent(app, 1, '甲');
    const g3 = await joinStudent(app, 3, '丙');
    await submitAnswers(app, g3, 1, ['CPU', '作業系統']);
    await submitAnswers(app, g1, 1, ['GPU', '核心']);
    await submitAnswers(app, g1, 3, ['0']);
    await call(app, 'POST', '/api/session/close', teacher);

    const view = (await call(app, 'GET', '/api/session', teacher)).json<{
      view: {
        questions: { number: number; blanks: { index: number }[] }[];
        submissions: {
          questionNumber: number;
          groupId: number;
          sequence: number;
          submitterNickname: string | null;
          answers: { blankIndex: number; text: string }[];
        }[];
      };
    }>().view;

    const expected: string[][] = [];
    for (const question of [...view.questions].sort((a, b) => a.number - b.number)) {
      const subs = view.submissions
        .filter((s) => s.questionNumber === question.number)
        .sort((a, b) => a.sequence - b.sequence);
      if (subs.length === 0) expected.push([String(question.number), '', '', '', '無人作答']);
      subs.forEach((sub, position) => {
        for (const blank of question.blanks) {
          expected.push([
            String(question.number),
            question.blanks.length > 1 ? `子題${String(blank.index)}` : '',
            `第 ${String(sub.groupId)} 組`,
            sub.submitterNickname ?? '',
            sub.answers.find((a) => a.blankIndex === blank.index)?.text ?? '',
            `第 ${String(position + 1)} 名`,
            '',
            position === 0 ? '是' : '否',
          ]);
        }
      });
    }

    const res = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    const actual = linesOf(res.body)
      .slice(1)
      // 純數字等 Excel 會轉換的值以 ="…" 輸出（CSV 中為 "=""0"""），比對前還原成原文
      .map((line) => line.split(',').map((cell) => cell.replace(/^"=""(.*)"""$/, '$1')));
    expect(actual).toHaveLength(expected.length);
    actual.forEach((cells, i) => {
      const want = expected[i] ?? [];
      // 無人作答列只有 5 個有內容的欄位（其餘為空）；送出時間欄不比對內容，只確認有無
      expect(cells.slice(0, 5)).toEqual(want.slice(0, 5));
      if (want.length === 8) {
        expect(cells[5]).toBe(want[5]);
        expect(cells[7]).toBe(want[7]);
        expect(cells[6]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      } else {
        expect(cells.slice(5)).toEqual(['', '', '']);
      }
    });
    expect(actual.some((cells) => cells[4] === '無人作答')).toBe(true);
  });
});

/** 簡單的 RFC 4180 解析器（測試用）：處理引號、成對的雙引號與引號內的換行。 */
function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\r' && text.charAt(i + 1) === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      i += 1;
    } else field += ch;
  }
  return records;
}

describe('特殊字元不使欄位錯位（US3，SC-004）', () => {
  it('逗號、換行、雙引號與公式字元：每列 8 欄、值等於原文', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 6);
    await call(app, 'POST', '/api/session/open', teacher);
    const answers = ['蘋果, 香蕉', '第一行\n第二行', '他說"好"', '=1+1', '-5'];
    for (const [i, text] of answers.entries()) {
      const nickname = i === 0 ? 'A,B' : `組員${String(i)}`;
      const token = await joinStudent(app, i + 1, nickname);
      expect((await submitAnswers(app, token, 1, [text])).statusCode).toBe(200);
    }
    await call(app, 'POST', '/api/session/close', teacher);

    const res = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    const records = parseCsv(res.body.slice(1));
    expect(records[0]).toEqual([...CSV_HEADERS]);
    const dataRows = records.slice(1);
    expect(dataRows.filter((r) => r[0] === '1')).toHaveLength(5);
    for (const row of dataRows) expect(row).toHaveLength(8);
    const q1 = dataRows.filter((r) => r[0] === '1');
    expect(q1.map((r) => r[4])).toEqual([
      '蘋果, 香蕉',
      '第一行\n第二行',
      '他說"好"',
      "'=1+1",
      '="-5"',
    ]);
    expect(q1[0]?.[3]).toBe('A,B');
  });
});

describe('Excel 會轉換的答案與暱稱', () => {
  it('007、1/2、TRUE 等以 ="…" 輸出，其他欄位不受影響', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 4);
    await call(app, 'POST', '/api/session/open', teacher);
    const cases: [string, string][] = [
      ['007', '1/2'],
      ['1/2', '3:30'],
      ['TRUE', '甲'],
      ['CPU', '乙'],
    ];
    for (const [i, [text, nickname]] of cases.entries()) {
      const token = await joinStudent(app, i + 1, nickname);
      expect((await submitAnswers(app, token, 1, [text])).statusCode).toBe(200);
    }
    await call(app, 'POST', '/api/session/close', teacher);

    const res = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    const q1 = parseCsv(res.body.slice(1))
      .slice(1)
      .filter((r) => r[0] === '1');
    expect(q1.map((r) => r[4])).toEqual(['="007"', '="1/2"', '="TRUE"', 'CPU']);
    expect(q1.map((r) => r[3])).toEqual(['="1/2"', '="3:30"', '甲', '乙']);
    // 題號、組別、順位等欄位維持原樣
    expect(q1[0]?.[0]).toBe('1');
    expect(q1[0]?.[2]).toBe('第 1 組');
    expect(q1[0]?.[5]).toBe('第 1 名');
  });
});

describe('權限與狀態（US4，SC-005）', () => {
  it('NOT_IMPORTED、READY、OPEN 以老師 token 請求 → 409 且訊息正確、狀態不變', async () => {
    app = await startTestApp();
    const teacher = await loginTeacher(app);
    const expectRejected = async () => {
      const res = await call(app as TestApp, 'GET', CSV_EXPORT_PATH, teacher);
      expect(res.statusCode).toBe(409);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.json<{ error: { code: string; message: string } }>().error).toMatchObject({
        code: 'INVALID_TRANSITION',
        message: CSV_EXPORT_NOT_CLOSED_MESSAGE,
      });
    };
    await expectRejected();
    await teacherWithImport(app, 'single-example', 2);
    await expectRejected();
    await call(app, 'POST', '/api/session/open', teacher);
    await expectRejected();
    const view = (await call(app, 'GET', '/api/session', teacher)).json<{
      view: { status: string };
    }>().view;
    expect(view.status).toBe('OPEN');
  });

  it('不帶 token → 401；學生 token → 403，body 不含答案與暱稱', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const student = await joinStudent(app, 1, '機密暱稱');
    await submitAnswers(app, student, 1, ['機密答案']);

    const anonymous = await call(app, 'GET', CSV_EXPORT_PATH, null);
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json<{ error: { code: string } }>().error.code).toBe('UNAUTHORIZED');

    const duringOpen = await call(app, 'GET', CSV_EXPORT_PATH, student);
    expect(duringOpen.statusCode).toBe(403);
    await call(app, 'POST', '/api/session/close', teacher);
    const afterClose = await call(app, 'GET', CSV_EXPORT_PATH, student);
    expect(afterClose.statusCode).toBe(403);
    expect(afterClose.json<{ error: { code: string } }>().error.code).toBe('FORBIDDEN');
    for (const res of [anonymous, duringOpen, afterClose]) {
      expect(res.body).not.toContain('機密');
    }
  });
});

describe('重新啟動與既有功能不受影響（US4，FR-004、FR-016）', () => {
  it('重新啟動後內容相同；匯出 CSV 不改 lastExport，Guided Notes 匯出仍可用', async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'crs-csv-'));
    app = await startTestApp({ repository: new LocalSessionRepository(dataDir) });
    const teacher = await teacherWithImport(app, 'single-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const student = await joinStudent(app, 1, '小明');
    await submitAnswers(app, student, 1, ['CPU']);
    await call(app, 'POST', '/api/session/close', teacher);

    const before = (await call(app, 'GET', CSV_EXPORT_PATH, teacher)).body;
    const lastExportBefore = (await call(app, 'GET', '/api/session', teacher)).json<{
      view: { lastExport: unknown };
    }>().view.lastExport;
    expect(lastExportBefore).toBeNull();
    const gatewayWrites = app.gateway.get('single-example');

    app = await restartApp(app, dataDir);
    const after = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    expect(after.statusCode).toBe(200);
    expect(after.body).toBe(before);

    expect(app.gateway.get('single-example')).toEqual(gatewayWrites);
    const gn = await call(app, 'POST', '/api/session/export', teacher);
    expect(gn.statusCode).toBe(200);
    const view = (await call(app, 'GET', '/api/session', teacher)).json<{
      view: { lastExport: { writtenQuestionCount: number } | null };
    }>().view;
    expect(view.lastExport?.writtenQuestionCount).toBe(1);
  });
});

interface TeacherView {
  openedAt: string | null;
  questions: {
    number: number;
    kind: string;
    blankCount: number;
    blankLabels: (string | null)[];
  }[];
  submissions: {
    questionNumber: number;
    groupId: number;
    sequence: number;
    submitterNickname: string | null;
    answers: { blankIndex: number; text: string }[];
  }[];
}

async function teacherView(testApp: TestApp, teacher: string): Promise<TeacherView> {
  return (await call(testApp, 'GET', '/api/session', teacher)).json<{ view: TeacherView }>().view;
}

/** 依老師端 view 組出預期的 CSV 列；題組的子題欄為「子題N」（N 為子題序號）。 */
function expectedRows(view: TeacherView): string[][] {
  const rows: string[][] = [];
  for (const q of [...view.questions].sort((a, b) => a.number - b.number)) {
    const subs = view.submissions
      .filter((s) => s.questionNumber === q.number)
      .sort((a, b) => a.sequence - b.sequence);
    if (subs.length === 0) rows.push([String(q.number), '', '', '', '無人作答']);
    subs.forEach((sub, position) => {
      for (let index = 1; index <= q.blankCount; index += 1) {
        const label = q.kind === 'group' ? `子題${String(index)}` : '';
        rows.push([
          String(q.number),
          label,
          `第 ${String(sub.groupId)} 組`,
          sub.submitterNickname ?? '',
          sub.answers.find((a) => a.blankIndex === index)?.text ?? '',
          `第 ${String(position + 1)} 名`,
          '',
          position === 0 ? '是' : '否',
        ]);
      }
    });
  }
  return rows;
}

describe('單題與題組範例：每一列與老師端一致（SC-002）', () => {
  it.each(['single-example', 'group-example'])('%s：4 組、含無人作答的題目', async (fixture) => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, fixture, 4);
    await call(app, 'POST', '/api/session/open', teacher);
    const tokens = [
      await joinStudent(app, 1, '甲'),
      await joinStudent(app, 2, '乙'),
      await joinStudent(app, 3, '丙'),
      await joinStudent(app, 4, '丁'),
    ];
    const before = await teacherView(app, teacher);
    const numbers = before.questions.map((q) => q.number).sort((a, b) => a - b);
    const unanswered = numbers[numbers.length - 1];
    let n = 0;
    for (const q of before.questions) {
      if (q.number === unanswered) continue;
      // 每題由不同的組、不同的順序作答；第 4 組永遠不作答
      const order = [(q.number % 3) + 1, ((q.number + 1) % 3) + 1].map((i) => tokens[i - 1] ?? '');
      for (const token of order) {
        n += 1;
        const texts = Array.from({ length: q.blankCount }, (_, i) => `答${String(n)}-${String(i)}`);
        const res = await submitAnswers(app, token, q.number, texts);
        expect(res.statusCode).toBe(200);
      }
    }
    await call(app, 'POST', '/api/session/close', teacher);

    const view = await teacherView(app, teacher);
    const expected = expectedRows(view);
    const res = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    const actual = parseCsv(res.body.slice(1)).slice(1);
    expect(actual).toHaveLength(expected.length);
    actual.forEach((cells, i) => {
      const want = expected[i] ?? [];
      expect(cells).toHaveLength(8);
      expect(cells.slice(0, 5)).toEqual(want.slice(0, 5));
      if (want.length === 8) {
        expect(cells[5]).toBe(want[5]);
        expect(cells[7]).toBe(want[7]);
        expect(cells[6]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      } else {
        expect(cells.slice(5)).toEqual(['', '', '']);
      }
    });
    expect(actual.some((c) => c[0] === String(unanswered) && c[4] === '無人作答')).toBe(true);
  });
});

describe('重新匯入新文件（Edge Cases）', () => {
  it('新的一場結束前回 409；結束後的 CSV 只含新一場且檔名用新的開啟時間', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const old = await joinStudent(app, 1, '舊場');
    await submitAnswers(app, old, 1, ['舊答案']);
    await call(app, 'POST', '/api/session/close', teacher);
    expect((await call(app, 'GET', CSV_EXPORT_PATH, teacher)).statusCode).toBe(200);

    const reimport = await call(app, 'POST', '/api/session/import', teacher, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-example/edit',
      groupCount: 2,
      confirmDiscard: true,
    });
    expect(reimport.statusCode).toBe(200);
    const rejected = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json<{ error: { code: string; message: string } }>().error).toMatchObject({
      code: 'INVALID_TRANSITION',
      message: CSV_EXPORT_NOT_CLOSED_MESSAGE,
    });

    await call(app, 'POST', '/api/session/open', teacher);
    const fresh = await joinStudent(app, 2, '新場');
    await submitAnswers(app, fresh, 1, ['新答案']);
    await call(app, 'POST', '/api/session/close', teacher);

    const res = await call(app, 'GET', CSV_EXPORT_PATH, teacher);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('新答案');
    expect(res.body).not.toContain('舊答案');
    expect(res.body).not.toContain('舊場');
    const openedAt = (await teacherView(app, teacher)).openedAt;
    expect(openedAt).not.toBeNull();
    expect(String(res.headers['content-disposition'])).toContain(
      `filename="${csvAsciiFileName(openedAt ?? '')}"`,
    );
  });
});
