import type { SessionStatus } from '@crs/shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePhaseTransition } from '../src/ui/usePhaseTransition';

interface Props {
  status: SessionStatus | null;
  connected: boolean;
}

function setup(initial: Props) {
  return renderHook((props: Props) => usePhaseTransition(props.status, props.connected), {
    initialProps: initial,
  });
}

describe('usePhaseTransition（007 data-model §3，FR-014）', () => {
  it('第一份階段只建立 baseline，不產生變化', () => {
    const { result } = setup({ status: 'OPEN', connected: true });
    expect(result.current).toBeNull();
  });

  it('READY → OPEN：「搶答開始！」', () => {
    const { result, rerender } = setup({ status: 'READY', connected: true });
    rerender({ status: 'OPEN', connected: true });
    expect(result.current).toMatchObject({ from: 'READY', to: 'OPEN', text: '搶答開始！' });
  });

  it('OPEN → CLOSED：「搶答結束」', () => {
    const { result, rerender } = setup({ status: 'OPEN', connected: true });
    rerender({ status: 'CLOSED', connected: true });
    expect(result.current).toMatchObject({ from: 'OPEN', to: 'CLOSED', text: '搶答結束' });
  });

  it('CLOSED → READY（重新匯入）：有變化但沒有提示文字', () => {
    const { result, rerender } = setup({ status: 'CLOSED', connected: true });
    rerender({ status: 'READY', connected: true });
    expect(result.current).toMatchObject({ from: 'CLOSED', to: 'READY', text: null });
  });

  it('斷線後下一份不同的階段只建立 baseline（重連不重播）', () => {
    const { result, rerender } = setup({ status: 'OPEN', connected: true });
    rerender({ status: 'OPEN', connected: false });
    rerender({ status: 'OPEN', connected: true });
    rerender({ status: 'CLOSED', connected: true });
    expect(result.current).toBeNull();
    rerender({ status: 'READY', connected: true });
    expect(result.current).toMatchObject({ from: 'CLOSED', to: 'READY' });
  });

  it('階段變為 null（身分改變、連線中）後同樣重新建立 baseline', () => {
    const { result, rerender } = setup({ status: 'READY', connected: true });
    rerender({ status: null, connected: true });
    rerender({ status: 'OPEN', connected: true });
    expect(result.current).toBeNull();
  });

  it('連續變化時 key 遞增，同一階段重新渲染不產生新的變化', () => {
    const { result, rerender } = setup({ status: 'READY', connected: true });
    rerender({ status: 'OPEN', connected: true });
    const first = result.current;
    rerender({ status: 'OPEN', connected: true });
    expect(result.current).toBe(first);
    rerender({ status: 'CLOSED', connected: true });
    expect(result.current?.key).toBeGreaterThan(first?.key ?? Infinity);
  });
});
