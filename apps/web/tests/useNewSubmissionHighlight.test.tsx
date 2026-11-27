import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNewSubmissionHighlight } from '../src/ui/useNewSubmissionHighlight';

interface Props {
  submissions: readonly { id: string }[];
  connected: boolean;
}

/** 每次推播都是新的陣列（與 useSessionState 相同）。 */
const push = (...ids: string[]) => ids.map((id) => ({ id }));

function setup(initial: Props) {
  return renderHook(
    (props: Props) => useNewSubmissionHighlight(props.submissions, props.connected),
    {
      initialProps: initial,
    },
  );
}

describe('useNewSubmissionHighlight（007 data-model §5，FR-030）', () => {
  it('第一份清單（首次載入、重新整理）全部視為已看過', () => {
    const { result } = setup({ submissions: push('a', 'b'), connected: true });
    expect([...result.current]).toEqual([]);
  });

  it('之後新增的送出標記為新送出，同一次新增的多筆一起標記', () => {
    const { result, rerender } = setup({ submissions: push('a'), connected: true });
    rerender({ submissions: push('a', 'b', 'c'), connected: true });
    expect([...result.current].sort()).toEqual(['b', 'c']);
    rerender({ submissions: push('a', 'b', 'c', 'd'), connected: true });
    expect(result.current.has('d')).toBe(true);
    // 已標記過的送出維持標記，列不會因重新渲染而重播動畫
    expect(result.current.has('b')).toBe(true);
    expect(result.current.has('a')).toBe(false);
  });

  it('斷線後的第一份新清單全部視為已看過', () => {
    const before = push('a');
    const { result, rerender } = setup({ submissions: before, connected: true });
    // 斷線與重新連線時，畫面上仍是斷線前同一份清單
    rerender({ submissions: before, connected: false });
    rerender({ submissions: before, connected: true });
    rerender({ submissions: push('a', 'b'), connected: true });
    expect(result.current.has('b')).toBe(false);
    rerender({ submissions: push('a', 'b', 'c'), connected: true });
    expect(result.current.has('c')).toBe(true);
  });
});
