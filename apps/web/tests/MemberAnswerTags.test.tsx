import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemberAnswerTags } from '../src/pages/teacher/MemberAnswerTags';

describe('MemberAnswerTags（006 FR-007、FR-010、contracts/teacher-ui.md）', () => {
  it('依資料順序顯示「第 N 題」，容器可換行', () => {
    render(
      <MemberAnswerTags
        tags={[
          { questionNumber: 1, isWinner: false },
          { questionNumber: 3, isWinner: false },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['第 1 題', '第 3 題']);
    expect(screen.getByRole('list').className).toContain('flex-wrap');
  });

  it('搶答成功有「★」、title 與輔助技術可讀的文字，不只靠顏色', () => {
    render(
      <MemberAnswerTags
        tags={[
          { questionNumber: 1, isWinner: true },
          { questionNumber: 2, isWinner: false },
        ]}
      />,
    );
    const [winner, normal] = screen.getAllByRole('listitem');
    expect(winner?.textContent).toBe('★第 1 題（搶答成功）');
    expect(winner?.getAttribute('title')).toBe('搶答成功');
    expect(normal?.textContent).toBe('第 2 題');
    expect(normal?.getAttribute('title')).toBeNull();
    expect(screen.getAllByText(/搶答成功/)).toHaveLength(1);
  });

  it('搶答成功與一般標記共用相同膠囊樣式，★ 與文字分開並有固定間距（contracts/teacher-ui.md）', () => {
    render(
      <MemberAnswerTags
        tags={[
          { questionNumber: 1, isWinner: true },
          { questionNumber: 2, isWinner: false },
        ]}
      />,
    );
    const [winner, normal] = screen.getAllByRole('listitem');
    for (const li of [winner, normal]) {
      const classes = li?.className.split(' ') ?? [];
      for (const cls of ['inline-flex', 'items-center', 'px-2.5', 'py-0.5']) {
        expect(classes).toContain(cls);
      }
    }
    expect(winner?.className.split(' ')).toContain('gap-1');
    const [star, text] = Array.from(winner?.children ?? []);
    expect(star?.textContent).toBe('★');
    expect(star?.getAttribute('aria-hidden')).toBe('true');
    expect(text?.textContent).toBe('第 1 題');
  });

  it('沒有標記時不渲染任何清單', () => {
    const { container } = render(<MemberAnswerTags tags={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
