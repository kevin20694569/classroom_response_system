import { vi } from 'vitest';

/** 以佇列方式回應 fetch；每個元素是一次回應（status 與 JSON body）。 */
export function mockFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next === undefined) return Promise.reject(new Error('沒有預設的回應'));
    return Promise.resolve(
      // 204 不能有內容（Response 會拒絕），以 null body 模擬伺服器的空回應
      new Response(next.status === 204 ? null : JSON.stringify(next.body), {
        status: next.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

/** 讀取 fetch 呼叫的 JSON body。 */
export function bodyOf(init: RequestInit | undefined): unknown {
  return typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
}
