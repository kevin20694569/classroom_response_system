import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState, LoadingState } from '../src/ui/EmptyState';

describe('EmptyState、LoadingState（007 FR-020）', () => {
  it('顯示說明文字與圖示，圖示對螢幕閱讀器隱藏', () => {
    render(<EmptyState icon="waiting" message="等待老師開啟搶答" />);
    const message = screen.getByText('等待老師開啟搶答');
    const box = message.parentElement as HTMLElement;
    const icon = box.querySelector('svg[data-icon="waiting"]');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(box.querySelector('.ui-anim')).toBeNull();
  });

  it('animated 時圖示有循環動態（.ui-anim，減少動態時由 CSS 停用）', () => {
    render(<EmptyState icon="notImported" message="老師尚未匯入題目，請稍候" animated />);
    const box = screen.getByText('老師尚未匯入題目，請稍候').parentElement as HTMLElement;
    expect(box.querySelector('.ui-anim')).not.toBeNull();
  });

  it('LoadingState 顯示「連線中…」', () => {
    render(<LoadingState />);
    expect(screen.getByText('連線中…')).toBeTruthy();
  });
});
