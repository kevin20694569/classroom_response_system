import type { SessionStatus } from '@crs/shared';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionTimer } from '../src/components/SessionTimer';

/** 以手動推進的假 requestAnimationFrame 取代瀏覽器影格（research R5）。 */
let frames = new Map<number, FrameRequestCallback>();
let nextId = 1;
const requestFrame = vi.fn((cb: FrameRequestCallback) => {
  const id = nextId++;
  frames.set(id, cb);
  return id;
});
const cancelFrame = vi.fn((id: number) => {
  frames.delete(id);
});
function runFrame() {
  const pending = [...frames.values()];
  frames = new Map();
  act(() => {
    for (const cb of pending) cb(performance.now());
  });
}

const OPENED = '2026-11-23T02:00:00.000Z';
const timer = () => screen.getByLabelText('搶答計時');

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  requestFrame.mockClear();
  cancelFrame.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-23T02:00:30.000Z'));
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SessionTimer（002 US2）', () => {
  it.each<SessionStatus>(['NOT_IMPORTED', 'READY'])('%s：顯示 00:00.00 且不排程影格', (status) => {
    render(
      <SessionTimer
        status={status}
        openedAt={null}
        closedAt={null}
        serverNow={new Date().toISOString()}
      />,
    );
    expect(timer().textContent).toBe('00:00.00');
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('搶答進行中：依 openedAt 計算，推進時間後更新，每格都再排下一格（FR-010）', () => {
    render(
      <SessionTimer
        status="OPEN"
        openedAt={OPENED}
        closedAt={null}
        serverNow={new Date().toISOString()}
      />,
    );
    runFrame();
    expect(timer().textContent).toBe('00:30.00');
    vi.setSystemTime(new Date('2026-11-23T02:00:31.234Z'));
    runFrame();
    expect(timer().textContent).toBe('00:31.23');
    const calls = requestFrame.mock.calls.length;
    runFrame();
    expect(requestFrame.mock.calls.length).toBe(calls + 1);
  });

  it('瀏覽器時鐘與伺服器相差 5 秒時，仍以伺服器時間為準且不出現負數（FR-012）', () => {
    // 瀏覽器慢 5 秒：瀏覽器時間 02:00:25，伺服器時間 02:00:30
    vi.setSystemTime(new Date('2026-11-23T02:00:25.000Z'));
    render(
      <SessionTimer
        status="OPEN"
        openedAt={OPENED}
        closedAt={null}
        serverNow="2026-11-23T02:00:30.000Z"
      />,
    );
    runFrame();
    expect(timer().textContent).toBe('00:30.00');

    // 伺服器剛開啟、瀏覽器時鐘較快：不顯示負數
    vi.setSystemTime(new Date('2026-11-23T02:00:05.000Z'));
    render(
      <SessionTimer
        status="OPEN"
        openedAt="2026-11-23T02:00:10.000Z"
        closedAt={null}
        serverNow="2026-11-23T02:00:09.000Z"
      />,
    );
    runFrame();
    expect(screen.getAllByLabelText('搶答計時')[1]?.textContent).toBe('00:00.00');
  });

  it('改為已結束：取消影格並顯示 closedAt − openedAt，之後不再變化', () => {
    const { rerender } = render(
      <SessionTimer
        status="OPEN"
        openedAt={OPENED}
        closedAt={null}
        serverNow={new Date().toISOString()}
      />,
    );
    runFrame();
    rerender(
      <SessionTimer
        status="CLOSED"
        openedAt={OPENED}
        closedAt="2026-11-23T02:03:07.429Z"
        serverNow={new Date().toISOString()}
      />,
    );
    expect(cancelFrame).toHaveBeenCalled();
    expect(timer().textContent).toBe('03:07.42');
    vi.setSystemTime(new Date('2026-11-23T03:00:00.000Z'));
    runFrame();
    expect(timer().textContent).toBe('03:07.42');
  });

  it('卸載時取消影格', () => {
    const { unmount } = render(
      <SessionTimer
        status="OPEN"
        openedAt={OPENED}
        closedAt={null}
        serverNow={new Date().toISOString()}
      />,
    );
    unmount();
    expect(cancelFrame).toHaveBeenCalled();
  });
});
