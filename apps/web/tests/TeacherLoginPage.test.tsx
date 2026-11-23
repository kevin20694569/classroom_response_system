import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TeacherPage } from '../src/pages/teacher/TeacherPage';
import { mockFetch } from './helpers';

// 不建立真實的 Socket.IO 連線
vi.mock('../src/api/socket', () => ({
  createSessionSocket: () => ({ on: vi.fn(), close: vi.fn() }),
}));

describe('老師登入（FR-003、FR-003a）', () => {
  it('登入成功後 token 只寫入 sessionStorage，並進入老師端', async () => {
    mockFetch([
      {
        status: 200,
        body: {
          token: 'token-abc',
          identity: { role: 'teacher', expiresAt: '2026-11-23T20:00:00.000Z' },
        },
      },
    ]);
    render(<TeacherPage />);
    await userEvent.type(screen.getByLabelText('密碼'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));

    expect(await screen.findByText('課堂搶答 — 老師端')).toBeTruthy();
    expect(sessionStorage.getItem('crs.token')).toBe('token-abc');
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('密碼錯誤時顯示伺服器訊息，不寫入 token', async () => {
    mockFetch([
      {
        status: 401,
        body: { error: { code: 'INVALID_PASSWORD', message: '密碼錯誤，請再試一次。' } },
      },
    ]);
    render(<TeacherPage />);
    await userEvent.type(screen.getByLabelText('密碼'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));

    expect((await screen.findByRole('alert')).textContent).toContain('密碼錯誤');
    expect(sessionStorage.getItem('crs.token')).toBeNull();
  });

  it('已有 token 的分頁直接進入老師端', () => {
    sessionStorage.setItem('crs.token', 'existing');
    render(<TeacherPage />);
    expect(screen.getByText('課堂搶答 — 老師端')).toBeTruthy();
  });
});
