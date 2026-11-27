import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../src/ui/Button';

describe('Button（FR-004）', () => {
  it('三種 variant 的外觀不同，文字與 type 保留', () => {
    render(
      <>
        <Button variant="primary">確認</Button>
        <Button variant="secondary" type="submit">
          換一個
        </Button>
        <Button variant="danger" aria-label="結束">
          結束搶答
        </Button>
      </>,
    );
    const primary = screen.getByRole('button', { name: '確認' });
    const secondary = screen.getByRole('button', { name: '換一個' });
    const danger = screen.getByRole('button', { name: '結束' });
    expect(new Set([primary.className, secondary.className, danger.className]).size).toBe(3);
    expect(primary.getAttribute('type')).toBe('button');
    expect(secondary.getAttribute('type')).toBe('submit');
    expect(danger.textContent).toBe('結束搶答');
  });

  it('處理中：aria-busy、停用、顯示旋轉圖示，點擊不觸發', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" pending onClick={onClick}>
        送出中…
      </Button>,
    );
    const button = screen.getByRole('button', { name: '送出中…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.querySelector('[data-icon="loading"]')).not.toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('沒有處理中時不顯示旋轉圖示，點擊會觸發', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="secondary" onClick={onClick}>
        取消
      </Button>,
    );
    const button = screen.getByRole('button', { name: '取消' });
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(button.querySelector('[data-icon="loading"]')).toBeNull();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
