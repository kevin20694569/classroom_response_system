import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * 可控制的 window.matchMedia（jsdom 沒有實作）：setMatches 會觸發 change 事件，模擬視窗跨過寬度門檻。
 * 呼叫 install 後以 vi.stubGlobal 取代；setup.ts 的 vi.unstubAllGlobals 會在每個測試後還原。
 */
export function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const queries: string[] = [];
  const matchMedia = vi.fn((query: string): MediaQueryList => {
    queries.push(query);
    return {
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  });
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    queries,
    listenerCount: () => listeners.size,
    setMatches(next: boolean) {
      matches = next;
      act(() => {
        for (const listener of [...listeners]) {
          listener({ matches: next } as MediaQueryListEvent);
        }
      });
    },
  };
}
