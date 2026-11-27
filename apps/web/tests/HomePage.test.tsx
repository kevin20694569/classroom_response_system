import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from '../src/pages/HomePage';

describe('首頁（007 FR-005）', () => {
  it('顯示系統名稱與一句說明', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: '課堂搶答系統' })).toBeTruthy();
    expect(screen.getByText('用 Guided Notes 進行分組搶答的課堂互動')).toBeTruthy();
  });

  it('老師端、學生端入口各有圖示與用途說明，連到原本的路徑', () => {
    render(<HomePage />);
    const teacher = screen.getByRole('link', { name: /^老師端/ });
    const student = screen.getByRole('link', { name: /^學生端/ });
    expect(teacher.getAttribute('href')).toBe('/teacher');
    expect(student.getAttribute('href')).toBe('/student');
    expect(teacher.textContent).toContain('匯入題目、控制搶答');
    expect(student.textContent).toContain('輸入暱稱、選組作答');
    for (const link of [teacher, student]) {
      const icon = link.querySelector('svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
