import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setStudentIdentity, setToken } from '../src/api/identity';
import { StudentPage } from '../src/pages/student/StudentPage';
import { currentSocket, resetSockets } from './fakeSocket';
import { bodyOf, mockFetch } from './helpers';
import { publicView, studentView, teacherView } from './viewBuilders';

vi.mock('../src/api/socket', async () => ({
  createSessionSocket: (await import('./fakeSocket')).createFakeSocket,
}));

const ACTIVITY = '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11';
const identity = {
  role: 'student' as const,
  groupId: 2,
  activityId: ACTIVITY,
  memberId: '3f0b2c1e-1111-4222-8333-444455556666',
  nickname: 'Milo',
  expiresAt: '2999-01-01T00:00:00.000Z',
};

/** 模擬已加入第 2 組的分頁（重新整理後的狀態）。 */
function joinedTab() {
  setToken('token-2');
  setStudentIdentity(identity);
}

beforeEach(() => {
  resetSockets();
  // 003 的情境都在「已確認暱稱」的前提下進行；暱稱頁另見下方 004 的測試
  sessionStorage.setItem('crs.nickname', 'Milo');
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
    // 004：先通知伺服器（204），成功後才清除身分
    const { calls } = mockFetch([{ status: 204, body: null }]);
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'READY' }));
    await userEvent.click(screen.getByRole('button', { name: '離開組別' }));
    expect(calls[0]?.url).toBe('/api/auth/student/leave');
    await waitFor(() => {
      expect(getToken()).toBeNull();
    });
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
        ownSubmissions: [
          {
            questionNumber: 3,
            answers: [{ blankIndex: 1, text: '本組的答案' }],
            submitterNickname: null,
          },
        ],
      }),
    );
    expect(screen.getByText('本組的答案')).toBeTruthy();
    expect(screen.queryByLabelText('第 3 題答案')).toBeNull();
    expect(screen.getByRole('button', { name: '第 3 題 已送出' })).toBeTruthy();
  });
});

describe('StudentPage — US3 結果檢視', () => {
  const closedView = () =>
    studentView({
      status: 'CLOSED',
      ownSubmissions: [
        {
          questionNumber: 3,
          answers: [{ blankIndex: 1, text: '本組的答案' }],
          submitterNickname: null,
        },
      ],
      results: [
        { questionNumber: 1, winnerGroupId: null, answers: null, submitterNickname: null },
        { questionNumber: 2, winnerGroupId: null, answers: null, submitterNickname: null },
        {
          questionNumber: 3,
          winnerGroupId: 2,
          answers: [{ blankIndex: 1, text: '本組的答案' }],
          submitterNickname: null,
        },
        { questionNumber: 4, winnerGroupId: null, answers: null, submitterNickname: null },
      ],
    });

  it('結束後自動顯示結果；沒有未送出內容時不顯示提示', () => {
    joinedTab();
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'OPEN' }));
    currentSocket().sendState(closedView());
    expect(screen.getByText('本組搶答成功 1 題')).toBeTruthy();
    expect(screen.queryByText('搶答已結束，尚未送出的答案不會被採計')).toBeNull();
  });

  it('作答中有未送出內容時，結束後結果上方顯示提示（FR-018）', async () => {
    joinedTab();
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'OPEN' }));
    await userEvent.type(screen.getByLabelText('第 4 題答案'), '來不及送出');
    currentSocket().sendState(closedView());
    expect(screen.getByText('搶答已結束，尚未送出的答案不會被採計')).toBeTruthy();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('重新整理後仍顯示相同結果，且沒有離開組別', () => {
    joinedTab();
    const { unmount } = render(<StudentPage />);
    currentSocket().sendState(closedView());
    expect(screen.getByText('本組搶答成功 1 題')).toBeTruthy();
    unmount();
    render(<StudentPage />);
    currentSocket().sendState(closedView());
    expect(screen.getByText('本組搶答成功 1 題')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '離開組別' })).toBeNull();
  });
});

describe('StudentPage — 004 US1 暱稱', () => {
  beforeEach(() => {
    sessionStorage.removeItem('crs.nickname');
  });

  it('還沒有暱稱時先顯示暱稱頁（直接開啟 /student 也一樣，FR-001）', () => {
    render(<StudentPage />);
    currentSocket().sendState(publicView());
    expect(screen.getByRole('heading', { name: '輸入你的暱稱' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '第 1 組' })).toBeNull();
  });

  it('確認暱稱後進入選組畫面並顯示暱稱；重新整理後暱稱保留', async () => {
    const first = render(<StudentPage />);
    currentSocket().sendState(publicView());
    const input = screen.getByLabelText<HTMLInputElement>('暱稱');
    await userEvent.clear(input);
    await userEvent.type(input, '小明');
    await userEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(screen.getByText('暱稱：小明')).toBeTruthy();
    expect(screen.getByRole('button', { name: '第 1 組' })).toBeTruthy();
    first.unmount();

    resetSockets();
    render(<StudentPage />);
    currentSocket().sendState(publicView());
    expect(screen.getByText('暱稱：小明')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '輸入你的暱稱' })).toBeNull();
  });

  it('老師尚未匯入時也先完成暱稱，再顯示等待訊息與暱稱', async () => {
    render(<StudentPage />);
    currentSocket().sendState(publicView({ status: 'NOT_IMPORTED' }));
    await userEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(screen.getByText('老師尚未匯入題目，請稍候')).toBeTruthy();
    expect(screen.getByText(/^暱稱：[A-Za-z]{3,10}$/)).toBeTruthy();
  });

  it('選組時加入請求帶目前的暱稱', async () => {
    sessionStorage.setItem('crs.nickname', '小明');
    const { calls } = mockFetch([
      { status: 200, body: { token: 'token-2', identity: { ...identity, nickname: '小明' } } },
    ]);
    render(<StudentPage />);
    currentSocket().sendState(publicView());
    await userEvent.click(screen.getByRole('button', { name: '第 2 組' }));
    expect(bodyOf(calls[0]?.init)).toEqual({ groupId: 2, nickname: '小明' });
  });

  it('尚未加入時可「修改暱稱」回到暱稱頁，取消則回到選組（FR-007）', async () => {
    sessionStorage.setItem('crs.nickname', '小明');
    render(<StudentPage />);
    currentSocket().sendState(publicView());
    await userEvent.click(screen.getByRole('button', { name: '修改暱稱' }));
    expect(screen.getByLabelText<HTMLInputElement>('暱稱').value).toBe('小明');
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByText('暱稱：小明')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: '修改暱稱' }));
    const input = screen.getByLabelText<HTMLInputElement>('暱稱');
    await userEvent.clear(input);
    await userEvent.type(input, 'Leo');
    await userEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(screen.getByText('暱稱：Leo')).toBeTruthy();
  });

  it('已加入組別時頂端列顯示暱稱，沒有「修改暱稱」（FR-007、FR-008）', () => {
    sessionStorage.setItem('crs.nickname', 'Milo');
    joinedTab();
    render(<StudentPage />);
    currentSocket().sendState(studentView());
    expect(screen.getByText('・Milo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '修改暱稱' })).toBeNull();
  });

  it('身分失效或離開組別後暱稱保留（FR-006）', () => {
    sessionStorage.setItem('crs.nickname', 'Milo');
    joinedTab();
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'READY' }));
    currentSocket().reset();
    currentSocket().sendState(publicView());
    expect(screen.getByText('暱稱：Milo')).toBeTruthy();
  });

  it('老師身分分頁不顯示暱稱頁（003 FR-008）', () => {
    setToken('teacher-token');
    render(<StudentPage />);
    currentSocket().sendState(teacherView());
    expect(screen.queryByRole('heading', { name: '輸入你的暱稱' })).toBeNull();
    expect(screen.getByText('這個分頁目前是老師身分，請另開新分頁以學生身分加入。')).toBeTruthy();
  });
});

describe('StudentPage — 004 US2 各組人數與本組成員', () => {
  const MEMBERS = [
    { memberId: '3f0b2c1e-1111-4222-8333-444455556666', nickname: 'Milo' },
    { memberId: 'a1b2c3d4-0000-4000-8000-000000000002', nickname: 'Ava' },
  ];

  it('選組畫面顯示各組人數，推播更新後同步', () => {
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(publicView());
    expect(screen.getByRole('button', { name: '第 1 組' }).textContent).toContain('已加入：0 人');
    socket.sendState(
      publicView({
        headcounts: [
          { groupId: 1, memberCount: 3 },
          { groupId: 2, memberCount: 0 },
          { groupId: 3, memberCount: 1 },
        ],
      }),
    );
    expect(screen.getByRole('button', { name: '第 1 組' }).textContent).toContain('已加入：3 人');
  });

  it('作答畫面顯示本組成員並標示自己，推播更新後同步', () => {
    joinedTab();
    render(<StudentPage />);
    const socket = currentSocket();
    socket.sendState(studentView({ members: MEMBERS.slice(0, 1) }));
    expect(screen.getByText('本組成員（1 人）')).toBeTruthy();
    expect(screen.getByText('Milo（你）')).toBeTruthy();
    socket.sendState(studentView({ status: 'OPEN', members: MEMBERS }));
    expect(screen.getByText('本組成員（2 人）')).toBeTruthy();
    expect(screen.getByText('Ava')).toBeTruthy();
  });

  it('結果畫面仍顯示本組成員', () => {
    joinedTab();
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'CLOSED', results: [], members: MEMBERS }));
    expect(screen.getByText('本組成員（2 人）')).toBeTruthy();
  });

  it('離開組別被拒（409）時留在組內並顯示伺服器訊息', async () => {
    joinedTab();
    mockFetch([
      {
        status: 409,
        body: { error: { code: 'LEAVE_NOT_ALLOWED', message: '搶答已開始，無法離開組別。' } },
      },
    ]);
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'READY' }));
    await userEvent.click(screen.getByRole('button', { name: '離開組別' }));
    expect(await screen.findByText('搶答已開始，無法離開組別。')).toBeTruthy();
    expect(getToken()).toBe('token-2');
    expect(screen.getByText('第 2 組')).toBeTruthy();
  });

  it('離開組別時網路錯誤：留在組內並請學生再試一次', async () => {
    joinedTab();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    render(<StudentPage />);
    currentSocket().sendState(studentView({ status: 'READY' }));
    await userEvent.click(screen.getByRole('button', { name: '離開組別' }));
    expect(await screen.findByText('離開組別失敗，請確認連線後再試一次。')).toBeTruthy();
    expect(getToken()).toBe('token-2');
  });
});
