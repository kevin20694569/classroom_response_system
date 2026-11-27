import type { TeacherResultView } from '@crs/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherDashboard } from '../src/pages/teacher/TeacherDashboard';
import { PHASE_TOAST_MS } from '../src/ui/timing';
import { installMatchMedia } from './fakeMatchMedia';
import { currentSocket, resetSockets } from './fakeSocket';
import { teacherView } from './viewBuilders';

vi.mock('../src/api/socket', async () => ({
  createSessionSocket: (await import('./fakeSocket')).createFakeSocket,
}));

/** 第 1 題（題組）由第 2 組搶到；第 3 題由第 1 組搶到；第 2、4 題無人送出。 */
const RESULTS: TeacherResultView[] = [
  {
    questionNumber: 1,
    winnerGroupId: 2,
    answers: [
      { blankIndex: 1, text: 'CPU' },
      { blankIndex: 2, text: '作業系統' },
    ],
    submitterNickname: 'Milo',
    receivedAt: '2026-11-23T02:00:05.000Z',
  },
  {
    questionNumber: 2,
    winnerGroupId: null,
    answers: null,
    submitterNickname: null,
    receivedAt: null,
  },
  {
    questionNumber: 3,
    winnerGroupId: 1,
    answers: [{ blankIndex: 1, text: '0' }],
    submitterNickname: 'Ava',
    receivedAt: '2026-11-23T02:00:07.000Z',
  },
  {
    questionNumber: 4,
    winnerGroupId: null,
    answers: null,
    submitterNickname: null,
    receivedAt: null,
  },
];

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
const dialog = () => screen.queryByRole('dialog', { name: '結果揭曉' });

function openThenClose() {
  installMatchMedia(false);
  render(<TeacherDashboard token="teacher-token" onLogout={() => undefined} />);
  const socket = currentSocket();
  socket.serverConnect();
  socket.sendState(teacherView({ status: 'OPEN' }));
  socket.sendState(teacherView({ status: 'CLOSED', results: RESULTS }));
  return socket;
}

beforeEach(() => {
  resetSockets();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('結果揭曉（007 FR-029、contracts/ui-effects.md §7）', () => {
  it('當場看到結束：提示消失後出現，依題號列出組別、送出者與答案，焦點在「關閉」', () => {
    openThenClose();
    expect(dialog()).toBeNull();
    advance(PHASE_TOAST_MS);
    const reveal = dialog();
    expect(reveal?.getAttribute('aria-modal')).toBe('true');
    const panel = within(reveal as HTMLElement);
    const q1 = within(panel.getByRole('listitem', { name: '第 1 題' }));
    expect(q1.getByText('第 2 組')).toBeTruthy();
    expect(q1.getByText('Milo')).toBeTruthy();
    expect(q1.getByText('（1）CPU')).toBeTruthy();
    expect(q1.getByText('（2）作業系統')).toBeTruthy();
    expect(
      within(panel.getByRole('listitem', { name: '第 2 題' })).getByText('本題無人搶答'),
    ).toBeTruthy();
    expect(within(panel.getByRole('listitem', { name: '第 3 題' })).getByText('0')).toBeTruthy();
    expect(document.activeElement).toBe(panel.getByRole('button', { name: '關閉' }));
    // 老師端不播放慶祝效果
    expect(screen.queryByTestId('celebration')).toBeNull();
  });

  it('按「關閉」關閉', () => {
    openThenClose();
    advance(PHASE_TOAST_MS);
    fireEvent.click(within(dialog() as HTMLElement).getByRole('button', { name: '關閉' }));
    expect(dialog()).toBeNull();
  });

  it('按 Esc 關閉', () => {
    openThenClose();
    advance(PHASE_TOAST_MS);
    fireEvent.keyDown(dialog() as HTMLElement, { key: 'Escape' });
    expect(dialog()).toBeNull();
  });

  it('第一次載入就是已結束（重新整理）時不出現', () => {
    installMatchMedia(false);
    render(<TeacherDashboard token="teacher-token" onLogout={() => undefined} />);
    const socket = currentSocket();
    socket.serverConnect();
    socket.sendState(teacherView({ status: 'CLOSED', results: RESULTS }));
    advance(PHASE_TOAST_MS);
    expect(dialog()).toBeNull();
  });

  it('開著時另一個老師分頁重新匯入（activityId 改變、回到待開始）會自動關閉', () => {
    const socket = openThenClose();
    advance(PHASE_TOAST_MS);
    expect(dialog()).not.toBeNull();
    socket.sendState(
      teacherView({ status: 'READY', activityId: '9d2e8b1f-0000-4000-8000-000000000001' }),
    );
    expect(dialog()).toBeNull();
  });
});
