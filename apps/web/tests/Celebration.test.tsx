import type { ResultView } from '@crs/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStudentIdentity, setToken } from '../src/api/identity';
import { StudentPage } from '../src/pages/student/StudentPage';
import { CELEBRATION_MS, PHASE_TOAST_MS } from '../src/ui/timing';
import { installMatchMedia } from './fakeMatchMedia';
import { currentSocket, resetSockets } from './fakeSocket';
import { studentView } from './viewBuilders';

vi.mock('../src/api/socket', async () => ({
  createSessionSocket: (await import('./fakeSocket')).createFakeSocket,
}));

/** 第 2 組搶到第 1 題；第 2 題由第 1 組搶到。 */
const WON: ResultView[] = [
  {
    questionNumber: 1,
    winnerGroupId: 2,
    answers: [{ blankIndex: 1, text: 'CPU' }],
    submitterNickname: 'Milo',
  },
  {
    questionNumber: 2,
    winnerGroupId: 1,
    answers: [{ blankIndex: 1, text: '演算法' }],
    submitterNickname: 'Ava',
  },
];
const LOST: ResultView[] = WON.map((r) => ({ ...r, winnerGroupId: 1 }));

function joinedTab() {
  setToken('token-2');
  setStudentIdentity({
    role: 'student',
    groupId: 2,
    activityId: '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11',
    memberId: '3f0b2c1e-1111-4222-8333-444455556666',
    nickname: 'Milo',
    expiresAt: '2999-01-01T00:00:00.000Z',
  });
  sessionStorage.setItem('crs.nickname', 'Milo');
}

const celebration = () => screen.queryByTestId('celebration');
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  resetSockets();
  vi.useFakeTimers();
  joinedTab();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('慶祝效果（007 FR-019、FR-023、contracts/ui-effects.md §6）', () => {
  it('當場看到結束且本組搶到題目：提示消失後播放，3 秒內移除，不攔截點擊與捲動', () => {
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(studentView({ status: 'OPEN' }));
    socket.sendState(studentView({ status: 'CLOSED', results: WON }));
    expect(celebration()).toBeNull();
    advance(PHASE_TOAST_MS);
    const confetti = celebration();
    expect(confetti?.getAttribute('aria-hidden')).toBe('true');
    expect(confetti?.className).toContain('pointer-events-none');
    // 播放期間結果畫面仍可操作
    const heading = screen.getByText('本組搶答成功 1 題');
    fireEvent.click(heading);
    expect(CELEBRATION_MS).toBeLessThanOrEqual(3000);
    advance(CELEBRATION_MS);
    expect(celebration()).toBeNull();
  });

  it('本組沒有搶到任何題目時不播放', () => {
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(studentView({ status: 'OPEN' }));
    socket.sendState(studentView({ status: 'CLOSED', results: LOST }));
    advance(PHASE_TOAST_MS);
    expect(celebration()).toBeNull();
  });

  it('第一次載入就是已結束（重新整理）時不播放', () => {
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'CLOSED', results: WON }));
    advance(PHASE_TOAST_MS);
    expect(celebration()).toBeNull();
  });

  it('斷線重連後才收到已結束時不播放', () => {
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(studentView({ status: 'OPEN' }));
    socket.serverDisconnect();
    socket.serverConnect();
    socket.sendState(studentView({ status: 'CLOSED', results: WON }));
    advance(PHASE_TOAST_MS);
    expect(celebration()).toBeNull();
  });

  it('系統設定減少動態效果時不播放', () => {
    installMatchMedia(true);
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(studentView({ status: 'OPEN' }));
    socket.sendState(studentView({ status: 'CLOSED', results: WON }));
    advance(PHASE_TOAST_MS);
    expect(celebration()).toBeNull();
  });
});
