import type { OwnSubmission, ResultView } from '@crs/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentResultBoard } from '../src/pages/student/StudentResultBoard';
import { studentView } from './viewBuilders';

const { questions } = studentView();
const results: ResultView[] = [
  {
    questionNumber: 1,
    winnerGroupId: 2,
    answers: [
      { blankIndex: 1, text: 'CPU' },
      { blankIndex: 2, text: '作業系統' },
    ],
    submitterNickname: null,
  },
  {
    questionNumber: 2,
    winnerGroupId: 1,
    answers: [
      { blankIndex: 1, text: '演算法' },
      { blankIndex: 2, text: '流程圖' },
    ],
    submitterNickname: null,
  },
  {
    questionNumber: 3,
    winnerGroupId: 1,
    answers: [{ blankIndex: 1, text: '0' }],
    submitterNickname: null,
  },
  { questionNumber: 4, winnerGroupId: null, answers: null, submitterNickname: null },
];
const own: OwnSubmission[] = [
  { questionNumber: 1, answers: results[0]?.answers ?? [], submitterNickname: null },
  {
    questionNumber: 3,
    answers: [{ blankIndex: 1, text: '本組沒搶到的答案' }],
    submitterNickname: null,
  },
];

function renderBoard(showUnsentNotice = false) {
  return render(
    <StudentResultBoard
      questions={questions}
      results={results}
      ownSubmissions={own}
      groupId={2}
      showUnsentNotice={showUnsentNotice}
    />,
  );
}

const card = (n: number) => screen.getByRole('region', { name: `第 ${n} 題結果` });

describe('StudentResultBoard（003 FR-024、FR-025、FR-018）', () => {
  it('上方顯示本組搶答成功題數', () => {
    renderBoard();
    expect(screen.getByText('本組搶答成功 1 題')).toBeTruthy();
  });

  it('每題顯示搶答成功組別與答案，題組依子題分列並顯示標記；無人搶答', () => {
    renderBoard();
    const first = within(card(1));
    expect(first.getByText('搶答成功：第 2 組')).toBeTruthy();
    expect(first.getAllByText('（1）').length).toBeGreaterThan(0);
    expect(first.getAllByText('CPU').length).toBeGreaterThan(0);
    expect(within(card(4)).getByText('無人搶答')).toBeTruthy();
  });

  it('三種本組成績標籤', () => {
    renderBoard();
    expect(within(card(1)).getByText('本組搶答成功')).toBeTruthy();
    expect(within(card(2)).getByText('本組未作答')).toBeTruthy();
    expect(within(card(3)).getByText('已送出，未搶到')).toBeTruthy();
    expect(within(card(4)).getByText('本組未作答')).toBeTruthy();
  });

  it('「已送出，未搶到」另外列出本組答案', () => {
    renderBoard();
    const third = within(card(3));
    expect(third.getByText('本組答案')).toBeTruthy();
    expect(third.getByText('本組沒搶到的答案')).toBeTruthy();
    expect(third.getByText('0')).toBeTruthy();
  });

  it('沒有未送出內容時不顯示提示；有時最上方顯示（FR-018）', () => {
    const { unmount } = renderBoard(false);
    expect(screen.queryByText('搶答已結束，尚未送出的答案不會被採計')).toBeNull();
    unmount();
    renderBoard(true);
    expect(screen.getByText('搶答已結束，尚未送出的答案不會被採計')).toBeTruthy();
  });

  it('不顯示送出順序或時間', () => {
    renderBoard();
    expect(document.body.textContent).not.toMatch(/順位|第 \d+ 名|提交時間|:\d\d/);
  });
});
