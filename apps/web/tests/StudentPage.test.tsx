import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setStudentIdentity, setToken } from '../src/api/identity';
import { StudentPage } from '../src/pages/student/StudentPage';
import { currentSocket, resetSockets } from './fakeSocket';
import { mockFetch } from './helpers';
import { publicView, studentView, teacherView } from './viewBuilders';

vi.mock('../src/api/socket', async () => ({
  createSessionSocket: (await import('./fakeSocket')).createFakeSocket,
}));

const ACTIVITY = '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11';
const identity = {
  role: 'student' as const,
  groupId: 2,
  activityId: ACTIVITY,
  expiresAt: '2999-01-01T00:00:00.000Z',
};

/** 模擬已加入第 2 組的分頁（重新整理後的狀態）。 */
function joinedTab() {
  setToken('token-2');
  setStudentIdentity(identity);
}

beforeEach(() => {
  resetSockets();
});

describe('StudentPage — US1 選組加入與階段同步', () => {
  it('尚未收到資料時顯示「連線中…」', () => {
    render(<StudentPage />);
    expect(screen.getByText('連線中…')).toBeTruthy();
  });

  it('尚未匯入時等待，老師匯入後自動出現組別', () => {
    render(<StudentPage />);
    currentSocket().sendState(publicView({ status: 'NOT_IMPORTED' }));
    expect(screen.getByText('老師尚未匯入題目，請稍候')).toBeTruthy();
    currentSocket().sendState(publicView({ status: 'READY' }));
    expect(screen.getByRole('button', { name: '第 1 組' })).toBeTruthy();
  });

  it('選組後以新 token 重新連線並顯示頂端列', async () => {
    mockFetch([{ status: 200, body: { token: 'token-2', identity } }]);
    render(<StudentPage />);
    currentSocket().sendState(publicView());
    await userEvent.click(screen.getByRole('button', { name: '第 2 組' }));
    const socket = currentSocket();
    expect(socket.token).toBe('token-2');
    socket.sendState(studentView({ status: 'READY' }));
    expect(screen.getByText('第 2 組')).toBeTruthy();
    expect(screen.getByTestId('status-badge').textContent).toBe('待開始');
  });

  it('老師開啟、結束搶答時階段即時更新', () => {
    joinedTab();
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(studentView({ status: 'READY' }));
    expect(screen.getByTestId('status-badge').textContent).toBe('待開始');
    socket.sendState(studentView({ status: 'OPEN' }));
    expect(screen.getByTestId('status-badge').textContent).toBe('搶答進行中');
    socket.sendState(studentView({ status: 'CLOSED', results: [] }));
    expect(screen.getByTestId('status-badge').textContent).toBe('已結束');
    expect(screen.queryByRole('button', { name: '離開組別' })).toBeNull();
  });

  it('收到 session:reset 回到選組並說明原因', () => {
    joinedTab();
    render(<StudentPage />);
    currentSocket().sendState(studentView());
    currentSocket().reset();
    expect(getToken()).toBeNull();
    const fresh = currentSocket();
    expect(fresh.token).toBeNull();
    fresh.sendState(publicView());
    expect(screen.getByText('老師已開始新的活動，請重新選擇組別。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '第 1 組' })).toBeTruthy();
  });

  it('連線被拒（UNAUTHORIZED）時回到選組並說明身分已失效', () => {
    joinedTab();
    render(<StudentPage />);
    currentSocket().connectError('UNAUTHORIZED');
    currentSocket().sendState(publicView());
    expect(screen.getByText('這個分頁的組別身分已失效，請重新選擇組別。')).toBeTruthy();
  });

  it('待開始時可以離開組別，回到選組畫面', async () => {
    joinedTab();
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'READY' }));
    await userEvent.click(screen.getByRole('button', { name: '離開組別' }));
    expect(getToken()).toBeNull();
    currentSocket().sendState(publicView());
    expect(screen.getByRole('button', { name: '第 2 組' })).toBeTruthy();
  });

  it('老師身分的分頁顯示提示、沒有作答功能，也不清除老師 token（FR-008）', () => {
    setToken('teacher-token');
    render(<StudentPage />);
    currentSocket().sendState(teacherView());
    expect(screen.getByText('這個分頁目前是老師身分，請另開新分頁以學生身分加入。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '第 1 組' })).toBeNull();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(getToken()).toBe('teacher-token');
  });
});

describe('StudentPage — US2 作答與送出', () => {
  it('待開始時輸入停用；開啟後可作答；本組送出推播後該題變為已送出', () => {
    joinedTab();
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(studentView({ status: 'READY' }));
    expect(screen.getByLabelText<HTMLInputElement>('第 3 題答案').disabled).toBe(true);
    socket.sendState(studentView({ status: 'OPEN' }));
    expect(screen.getByLabelText<HTMLInputElement>('第 3 題答案').disabled).toBe(false);
    socket.sendState(
      studentView({
        status: 'OPEN',
        ownSubmissions: [{ questionNumber: 3, answers: [{ blankIndex: 1, text: '本組的答案' }] }],
      }),
    );
    expect(screen.getByText('本組的答案')).toBeTruthy();
    expect(screen.queryByLabelText('第 3 題答案')).toBeNull();
    expect(screen.getByRole('button', { name: '第 3 題 已送出' })).toBeTruthy();
  });
});
