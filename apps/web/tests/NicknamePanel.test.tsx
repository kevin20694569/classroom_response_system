import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NicknamePanel } from '../src/pages/student/NicknamePanel';

const RULE = '暱稱需為 1～20 字，且不能只有空白。';

function input(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>('暱稱');
}

describe('NicknamePanel（004 US1、contracts/student-ui.md §1）', () => {
  it('第一次進入時預填一個隨機的英文短名字，沒有「取消」', () => {
    render(<NicknamePanel initial={null} onConfirm={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '輸入你的暱稱' })).toBeTruthy();
    expect(input().value).toMatch(/^[A-Za-z]{3,10}$/);
    expect(screen.queryByRole('button', { name: '取消' })).toBeNull();
  });

  it('按「換一個」換成另一個隨機名字', async () => {
    render(<NicknamePanel initial={null} onConfirm={vi.fn()} />);
    const before = input().value;
    await userEvent.click(screen.getByRole('button', { name: '換一個' }));
    expect(input().value).toMatch(/^[A-Za-z]{3,10}$/);
    expect(input().value).not.toBe(before);
  });

  it('顯示字數「N / 20」', async () => {
    render(<NicknamePanel initial={null} onConfirm={vi.fn()} />);
    await userEvent.clear(input());
    await userEvent.type(input(), '小明');
    expect(screen.getByText('2 / 20')).toBeTruthy();
  });

  it('確認時以去除前後空白的暱稱呼叫 onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<NicknamePanel initial={null} onConfirm={onConfirm} />);
    await userEvent.clear(input());
    await userEvent.type(input(), '  小明 ');
    await userEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledWith('小明');
  });

  it('按 Enter 等同確認', async () => {
    const onConfirm = vi.fn();
    render(<NicknamePanel initial={null} onConfirm={onConfirm} />);
    const name = input().value;
    await userEvent.type(input(), '{Enter}');
    expect(onConfirm).toHaveBeenCalledWith(name);
  });

  it.each([
    ['清空', ''],
    ['只有空白', '   '],
    ['21 字', '字'.repeat(21)],
  ])('%s時不前進並顯示規則', async (_label, text) => {
    const onConfirm = vi.fn();
    render(<NicknamePanel initial={null} onConfirm={onConfirm} />);
    await userEvent.clear(input());
    if (text !== '') await userEvent.type(input(), text);
    await userEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(RULE);
  });

  it('修改暱稱時顯示目前暱稱，並可「取消」', async () => {
    const onCancel = vi.fn();
    render(<NicknamePanel initial="小明" onConfirm={vi.fn()} onCancel={onCancel} />);
    expect(input().value).toBe('小明');
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
