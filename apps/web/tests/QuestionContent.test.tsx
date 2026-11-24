import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NO_PROMPT_TEXT, QuestionContent } from '../src/components/QuestionContent';

describe('QuestionContent（004 FR-017、research R8）', () => {
  it('單題顯示「第 N 題」「單題」與敘述，保留換行', () => {
    render(
      <QuestionContent
        number={3}
        kind="single"
        blankCount={1}
        prompt={'第一行\n第二行'}
        blanks={[{ label: null, prompt: null }]}
      />,
    );
    expect(screen.getByText('第 3 題').textContent).toBe('第 3 題單題');
    const prompt = screen.getByText(/第一行/);
    expect(prompt.textContent).toBe('第一行\n第二行');
    expect(prompt.className).toContain('whitespace-pre-wrap');
  });

  it('題組顯示「題組（K 子題）」、題組說明、子題標記與子題敘述；沒有標記時以「（序號）」呈現', () => {
    render(
      <QuestionContent
        number={1}
        kind="group"
        blankCount={2}
        prompt="題組說明"
        blanks={[
          { label: '（甲）', prompt: '子題一' },
          { label: null, prompt: '子題二' },
        ]}
      />,
    );
    expect(screen.getByText('題組（2 子題）')).toBeTruthy();
    expect(screen.getByText('題組說明')).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['（甲）子題一', '（2）子題二']);
  });

  it('敘述為 null 時顯示「文件未提供題目敘述」', () => {
    render(
      <QuestionContent
        number={4}
        kind="single"
        blankCount={1}
        prompt={null}
        blanks={[{ label: null, prompt: null }]}
      />,
    );
    expect(screen.getByText(NO_PROMPT_TEXT)).toBeTruthy();
  });

  it('renderBlank 的內容出現在對應子題下方；單題出現在敘述下方', () => {
    const { unmount } = render(
      <QuestionContent
        number={1}
        kind="group"
        blankCount={2}
        prompt={null}
        blanks={[
          { label: '（1）', prompt: '子題一' },
          { label: '（2）', prompt: '子題二' },
        ]}
        renderBlank={(index) => <span>輸入欄 {index}</span>}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(within(items[0] as HTMLElement).getByText('輸入欄 1')).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText('輸入欄 2')).toBeTruthy();
    unmount();

    render(
      <QuestionContent
        number={2}
        kind="single"
        blankCount={1}
        prompt="單題敘述"
        blanks={[{ label: null, prompt: null }]}
        renderBlank={(index) => <span>輸入欄 {index}</span>}
      />,
    );
    expect(screen.getByText('輸入欄 1')).toBeTruthy();
  });

  it('可用標題元素呈現題號，或隱藏題號列', () => {
    const { unmount } = render(
      <QuestionContent
        number={5}
        kind="single"
        blankCount={1}
        prompt="敘述"
        blanks={[{ label: null, prompt: null }]}
        titleAs="h2"
      />,
    );
    expect(screen.getByRole('heading', { name: /第 5 題/ })).toBeTruthy();
    unmount();
    render(
      <QuestionContent
        number={5}
        kind="single"
        blankCount={1}
        prompt="敘述"
        blanks={[{ label: null, prompt: null }]}
        hideTitle
      />,
    );
    expect(screen.queryByText(/第 5 題/)).toBeNull();
  });
});
