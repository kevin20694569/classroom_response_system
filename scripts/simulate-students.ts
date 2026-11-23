/**
 * 模擬學生腳本（quickstart.md §4）：以正式的學生 API 加入組別並送出答案，
 * 學生畫面已於子功能 003 提供（/student），本腳本保留作為自動化與壓力測試的輔助工具。
 *
 * 用法：
 *   npm run simulate -- --group 1 --question 1 --answers "CPU" "作業系統"
 *   npm run simulate -- --race --groups 1,2 --question 3 --answers "0"
 *   選填：--base-url http://localhost:3000
 */
import { parseArgs } from 'node:util';
import {
  ApiErrorBodySchema,
  AuthResponseSchema,
  SubmitResponseSchema,
  type SubmitRequest,
} from '@crs/shared';
import type { z } from 'zod';

interface Options {
  baseUrl: string;
  groups: number[];
  question: number;
  answers: string[];
  race: boolean;
}

function usage(message: string): never {
  console.error(`${message}

用法：
  npm run simulate -- --group 1 --question 1 --answers "CPU" "作業系統"
  npm run simulate -- --race --groups 1,2 --question 3 --answers "0"`);
  process.exit(1);
}

function parseOptions(): Options {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'base-url': { type: 'string', default: 'http://localhost:3000' },
      group: { type: 'string' },
      groups: { type: 'string' },
      question: { type: 'string' },
      answers: { type: 'string', multiple: true },
      race: { type: 'boolean', default: false },
    },
  });
  const groupsText = values.race ? values.groups : values.group;
  if (groupsText === undefined)
    usage(values.race ? '請以 --groups 指定組別，例如 1,2' : '請以 --group 指定組別');
  const groups = groupsText.split(',').map((g) => Number.parseInt(g.trim(), 10));
  if (groups.some((g) => !Number.isInteger(g) || g < 1)) usage('組別必須是正整數');
  const question = Number.parseInt(values.question ?? '', 10);
  if (!Number.isInteger(question) || question < 1) usage('請以 --question 指定題號');
  // 「--answers A B」中 A 由 --answers 取得、B 以後是位置參數，兩者依序合併成各子題答案
  const answers = [...(values.answers ?? []), ...positionals];
  if (answers.length === 0) usage('請以 --answers 提供答案（題組依子題順序提供多個答案）');
  return { baseUrl: values['base-url'], groups, question, answers, race: values.race };
}

async function post<T>(
  baseUrl: string,
  path: string,
  schema: z.ZodType<T>,
  body: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(new URL(path, baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('無法連線到伺服器，請先執行 npm start。');
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorBodySchema.safeParse(json);
    throw new Error(
      parsed.success
        ? `${parsed.data.error.code}：${parsed.data.error.message}`
        : `HTTP ${response.status}`,
    );
  }
  return schema.parse(json);
}

async function runGroup(options: Options, groupId: number, token: string): Promise<string> {
  const request: SubmitRequest = {
    questionNumber: options.question,
    answers: options.answers.map((text, i) => ({ blankIndex: i + 1, text })),
  };
  try {
    const result = await post(
      options.baseUrl,
      '/api/submissions',
      SubmitResponseSchema,
      request,
      token,
    );
    return `第 ${groupId} 組：已送出第 ${options.question} 題（伺服器收到時間 ${result.receivedAt}）`;
  } catch (error) {
    return `第 ${groupId} 組：送出失敗 — ${(error as Error).message}`;
  }
}

async function main(): Promise<void> {
  const options = parseOptions();
  // 先讓每一組加入取得 token（token 不顯示），--race 時再同時送出
  const tokens = new Map<number, string>();
  for (const groupId of options.groups) {
    try {
      const auth = await post(options.baseUrl, '/api/auth/student', AuthResponseSchema, {
        groupId,
      });
      tokens.set(groupId, auth.token);
    } catch (error) {
      console.error(`第 ${groupId} 組：加入失敗 — ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
  const entries = [...tokens.entries()];
  const lines = options.race
    ? await Promise.all(entries.map(([groupId, token]) => runGroup(options, groupId, token)))
    : await entries.reduce<Promise<string[]>>(async (acc, [groupId, token]) => {
        const done = await acc;
        return [...done, await runGroup(options, groupId, token)];
      }, Promise.resolve([]));
  for (const line of lines) console.log(line);
}

await main();
