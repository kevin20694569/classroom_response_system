import type { OwnSubmission, ResultView } from '@crs/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentResultBoard } from '../src/pages/student/StudentResultBoard';
import { studentView, withContent } from './viewBuilders';

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
  {
    questionNumber: 1,
    answers: results[0]?.answers ?? [],
    submitterNickname: null,
    grading: 'CORRECT',
  },
  {
    questionNumber: 3,
    answers: [{ blankIndex: 1, text: '本組沒搶到的答案' }],
    submitterNickname: null,
    grading: 'INCORRECT',
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

  it('每題顯示搶答成功組別與答案，題組依子題分列並顯示標記；無人答對', () => {
    renderBoard();
    const first = within(card(1));
    expect(first.getByText('搶答成功：第 2 組')).toBeTruthy();
    expect(first.getAllByText('（1）').length).toBeGreaterThan(0);
    expect(first.getAllByText('CPU').length).toBeGreaterThan(0);
    expect(within(card(4)).getByText('無人答對')).toBeTruthy();
  });

  it('批改完成後的本組成績標籤（004 FR-034）', () => {
    renderBoard();
    expect(within(card(1)).getByText('本組搶答成功')).toBeTruthy();
    expect(within(card(2)).getByText('本組未作答')).toBeTruthy();
    expect(within(card(3)).getByText('答錯')).toBeTruthy();
    expect(within(card(4)).getByText('本組未作答')).toBeTruthy();
  });

  it('答錯時另外列出本組答案', () => {
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

describe('StudentResultBoard — 004 題目敘述（FR-016、SC-007）', () => {
  it('每題結果旁顯示題目敘述，文字與老師端預覽相同', () => {
    render(
      <StudentResultBoard
        questions={withContent()}
        results={results}
        ownSubmissions={own}
        groupId={2}
        showUnsentNotice={false}
      />,
    );
    expect(within(card(1)).getByText('電腦的「大腦」英文簡稱是什麼？')).toBeTruthy();
    expect(within(card(3)).getByText('二進位由數字 1 和哪一個數字構成？')).toBeTruthy();
    expect(within(card(4)).getByText('文件未提供題目敘述')).toBeTruthy();
  });

  it('沒有題目敘述的資料（content 為 null）不顯示敘述', () => {
    renderBoard();
    expect(screen.queryByText('文件未提供題目敘述')).toBeNull();
  });
});

describe('StudentResultBoard — 004 送出者（FR-025）', () => {
  it('搶答成功答案旁顯示「第 N 組・暱稱」；本組未搶到時標示「本組（暱稱）」', () => {
    render(
      <StudentResultBoard
        questions={questions}
        results={[
          {
            questionNumber: 3,
            winnerGroupId: 1,
            answers: [{ blankIndex: 1, text: '0' }],
            submitterNickname: 'Milo',
          },
        ]}
        ownSubmissions={[
          {
            questionNumber: 3,
            answers: [{ blankIndex: 1, text: '1' }],
            submitterNickname: 'Leo',
            grading: 'CORRECT',
          },
        ]}
        groupId={2}
        showUnsentNotice={false}
      />,
    );
    const third = within(card(3));
    expect(third.getByText('搶答成功：第 1 組・Milo')).toBeTruthy();
    expect(third.getByText('本組（Leo）')).toBeTruthy();
  });

  it('送出者為 null 時只顯示組別', () => {
    renderBoard();
    expect(within(card(3)).getByText('搶答成功：第 1 組')).toBeTruthy();
    expect(within(card(3)).getByText('本組答案')).toBeTruthy();
  });
});

describe('StudentResultBoard — 004 批改中（FR-025、FR-033）', () => {
  it('批改完成前顯示「老師批改中」、本組每題的批改狀態與本組答案，不顯示搶答成功組別', () => {
    render(
      <StudentResultBoard
        questions={questions}
        results={null}
        ownSubmissions={[
          { ...(own[0] as OwnSubmission), grading: 'PENDING' },
          { ...(own[1] as OwnSubmission), grading: 'CORRECT' },
        ]}
        groupId={2}
        showUnsentNotice={false}
      />,
    );
    expect(screen.getByText('老師批改中，結果會即時更新')).toBeTruthy();
    expect(screen.queryByText(/本組搶答成功 \d+ 題/)).toBeNull();
    expect(within(card(1)).getByText('等待老師批改')).toBeTruthy();
    expect(within(card(3)).getByText('答對')).toBeTruthy();
    expect(within(card(3)).getByText('本組沒搶到的答案')).toBeTruthy();
    expect(within(card(2)).getByText('本組未作答')).toBeTruthy();
    expect(screen.queryByText(/搶答成功：/)).toBeNull();
    expect(screen.queryByText('無人答對')).toBeNull();
  });

  it('答對但不是最早送出時顯示「回答成功」', () => {
    render(
      <StudentResultBoard
        questions={questions}
        results={results}
        ownSubmissions={[{ ...(own[1] as OwnSubmission), grading: 'CORRECT' }]}
        groupId={2}
        showUnsentNotice={false}
      />,
    );
    expect(within(card(3)).getByText('回答成功')).toBeTruthy();
  });
});
