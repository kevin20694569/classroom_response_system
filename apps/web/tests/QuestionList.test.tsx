import type { SessionStatus } from '@crs/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionList, togglePreview } from '../src/components/QuestionList';
import { NO_PROMPT_TEXT } from '../src/components/QuestionPreview';
import { teacherView } from './viewBuilders';

function questionButton(number: number) {
  return screen.getByRole<HTMLButtonElement>('button', {
    name: new RegExp(`^第 ${String(number)} 題`),
  });
}

function pressedNumbers(): string[] {
  return screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent);
}

describe('togglePreview（002 FR-003、FR-004）', () => {
  it('四種組合', () => {
    expect(togglePreview(null, 1)).toBe(1);
    expect(togglePreview(1, 1)).toBeNull();
    expect(togglePreview(1, 3)).toBe(3);
    expect(togglePreview(3, 1)).toBe(1);
  });
});

describe('QuestionList 題目預覽（002 US1）', () => {
  it('點題組 → 預覽兩個子題；點另一題 → 切換；再點同一題 → 收起', async () => {
    const user = userEvent.setup();
    render(<QuestionList view={teacherView()} />);
    expect(screen.queryByRole('region', { name: '題目預覽' })).toBeNull();
    expect(pressedNumbers()).toEqual([]);

    await user.click(questionButton(1));
    const preview = within(screen.getByRole('region', { name: '題目預覽' }));
    expect(preview.getByText('題組（2 子題）')).toBeTruthy();
    expect(preview.getByText('電腦的「大腦」英文簡稱是什麼？')).toBeTruthy();
    expect(preview.getByText('管理軟硬體資源的系統軟體稱為什麼？')).toBeTruthy();
    expect(pressedNumbers()).toHaveLength(1);
    expect(questionButton(1).getAttribute('aria-pressed')).toBe('true');
    expect(questionButton(1).textContent).toContain('預覽中');

    await user.click(questionButton(3));
    expect(
      within(screen.getByRole('region', { name: '題目預覽' })).getByText(
        '二進位由數字 1 和哪一個數字構成？',
      ),
    ).toBeTruthy();
    expect(questionButton(1).getAttribute('aria-pressed')).toBe('false');
    expect(questionButton(1).textContent).not.toContain('預覽中');
    expect(questionButton(3).getAttribute('aria-pressed')).toBe('true');
    expect(pressedNumbers()).toHaveLength(1);

    await user.click(questionButton(3));
    expect(screen.queryByRole('region', { name: '題目預覽' })).toBeNull();
    expect(pressedNumbers()).toEqual([]);
  });

  it('鍵盤 Enter 與 Space 都能切換', async () => {
    const user = userEvent.setup();
    render(<QuestionList view={teacherView()} />);
    questionButton(2).focus();
    await user.keyboard('{Enter}');
    expect(questionButton(2).getAttribute('aria-pressed')).toBe('true');
    await user.keyboard(' ');
    expect(questionButton(2).getAttribute('aria-pressed')).toBe('false');
  });

  it('沒有敘述顯示提示；題組沒有標記時以（序號）呈現', async () => {
    const user = userEvent.setup();
    render(<QuestionList view={teacherView()} />);
    await user.click(questionButton(2));
    const preview = within(screen.getByRole('region', { name: '題目預覽' }));
    expect(preview.getByText('（1）')).toBeTruthy();
    expect(preview.getByText('（2）')).toBeTruthy();
    expect(preview.getByText(NO_PROMPT_TEXT)).toBeTruthy();

    await user.click(questionButton(4));
    expect(
      within(screen.getByRole('region', { name: '題目預覽' })).getByText(NO_PROMPT_TEXT),
    ).toBeTruthy();
  });

  it.each<SessionStatus>(['READY', 'OPEN', 'CLOSED'])(
    '%s 狀態下預覽行為相同（FR-007）',
    async (status) => {
      const user = userEvent.setup();
      render(<QuestionList view={teacherView({ status })} />);
      await user.click(questionButton(3));
      expect(screen.getByRole('region', { name: '題目預覽' })).toBeTruthy();
      await user.click(questionButton(3));
      expect(screen.queryByRole('region', { name: '題目預覽' })).toBeNull();
    },
  );

  it('活動識別改變（重新匯入）後預覽清除（FR-008）', async () => {
    const user = userEvent.setup();
    const view = teacherView();
    const { rerender } = render(<QuestionList key={view.activityId} view={view} />);
    await user.click(questionButton(1));
    expect(screen.getByRole('region', { name: '題目預覽' })).toBeTruthy();

    const next = teacherView({ activityId: '0b3f0a52-2a7e-4f0e-9a1c-3d8d4c2a1b10' });
    rerender(<QuestionList key={next.activityId} view={next} />);
    expect(screen.queryByRole('region', { name: '題目預覽' })).toBeNull();
    expect(pressedNumbers()).toEqual([]);
  });

  it('預覽中的題號已不存在時視為沒有預覽', async () => {
    const user = userEvent.setup();
    const view = teacherView();
    const { rerender } = render(<QuestionList view={view} />);
    await user.click(questionButton(4));
    rerender(<QuestionList view={{ ...view, questions: view.questions.slice(0, 2) }} />);
    expect(screen.queryByRole('region', { name: '題目預覽' })).toBeNull();
  });

  it('預覽不呼叫任何 API（FR-007）', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<QuestionList view={teacherView()} />);
    await user.click(questionButton(1));
    await user.click(questionButton(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
