import type { SessionStatus } from '@crs/shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePhaseTransition, type PhaseSource } from '../src/ui/usePhaseTransition';

interface Props {
  view: PhaseSource | null;
  connected: boolean;
}

/** 每次推播都是新的 view 物件（與 useSessionState 相同）。 */
const push = (status: SessionStatus): PhaseSource => ({ status });

function setup(initial: Props) {
  return renderHook((props: Props) => usePhaseTransition(props.view, props.connected), {
    initialProps: initial,
  });
}

describe('usePhaseTransition（007 data-model §3，FR-014）', () => {
  it('第一份 view 只建立 baseline，不產生變化', () => {
    const { result } = setup({ view: push('OPEN'), connected: true });
    expect(result.current).toBeNull();
  });

  it('READY → OPEN：「搶答開始！」', () => {
    const { result, rerender } = setup({ view: push('READY'), connected: true });
    rerender({ view: push('OPEN'), connected: true });
    expect(result.current).toMatchObject({ from: 'READY', to: 'OPEN', text: '搶答開始！' });
  });

  it('OPEN → CLOSED：「搶答結束」', () => {
    const { result, rerender } = setup({ view: push('OPEN'), connected: true });
    rerender({ view: push('CLOSED'), connected: true });
    expect(result.current).toMatchObject({ from: 'OPEN', to: 'CLOSED', text: '搶答結束' });
  });

  it('CLOSED → READY（重新匯入）：有變化但沒有提示文字', () => {
    const { result, rerender } = setup({ view: push('CLOSED'), connected: true });
    rerender({ view: push('READY'), connected: true });
    expect(result.current).toMatchObject({ from: 'CLOSED', to: 'READY', text: null });
  });

  it('斷線後的第一份新 view 只建立 baseline（重連不重播），之後的變化照常', () => {
    const before = push('OPEN');
    const { result, rerender } = setup({ view: before, connected: true });
    // 斷線與重新連線時，畫面上仍是斷線前同一個 view 物件
    rerender({ view: before, connected: false });
    rerender({ view: before, connected: true });
    rerender({ view: push('CLOSED'), connected: true });
    expect(result.current).toBeNull();
    rerender({ view: push('READY'), connected: true });
    expect(result.current).toMatchObject({ from: 'CLOSED', to: 'READY' });
  });

  it('重連後階段沒變，下一次真正的變化仍會出現', () => {
    const before = push('OPEN');
    const { result, rerender } = setup({ view: before, connected: true });
    rerender({ view: before, connected: false });
    rerender({ view: before, connected: true });
    rerender({ view: push('OPEN'), connected: true });
    expect(result.current).toBeNull();
    rerender({ view: push('CLOSED'), connected: true });
    expect(result.current).toMatchObject({ from: 'OPEN', to: 'CLOSED', text: '搶答結束' });
  });

  it('view 變為 null（身分改變、連線中）後同樣重新建立 baseline', () => {
    const { result, rerender } = setup({ view: push('READY'), connected: true });
    rerender({ view: null, connected: true });
    rerender({ view: push('OPEN'), connected: true });
    expect(result.current).toBeNull();
  });

  it('連續變化時 key 遞增，同一階段的新推播不產生新的變化', () => {
    const { result, rerender } = setup({ view: push('READY'), connected: true });
    rerender({ view: push('OPEN'), connected: true });
    const first = result.current;
    rerender({ view: push('OPEN'), connected: true });
    expect(result.current).toBe(first);
    rerender({ view: push('CLOSED'), connected: true });
    expect(result.current?.key).toBeGreaterThan(first?.key ?? Infinity);
  });
});
