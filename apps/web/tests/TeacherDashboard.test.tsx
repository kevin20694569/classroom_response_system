import type { GroupOverview } from '@crs/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherDashboard } from '../src/pages/teacher/TeacherDashboard';
import { installMatchMedia } from './fakeMatchMedia';
import { currentSocket, resetSockets } from './fakeSocket';
import { teacherView } from './viewBuilders';

vi.mock('../src/api/socket', async () => ({
  createSessionSocket: (await import('./fakeSocket')).createFakeSocket,
}));

const id = (n: number): string => `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, '0')}`;
const member = (n: number, nickname: string) => ({
  memberId: id(n),
  nickname,
  inGroup: true,
  disconnected: false,
  answered: [],
});
const overview = (extra: string[] = []): GroupOverview[] => [
  {
    groupId: 1,
    memberCount: 1 + extra.length,
    members: [member(1, 'Milo'), ...extra.map((name, i) => member(10 + i, name))],
  },
  { groupId: 2, memberCount: 1, members: [member(2, 'Leo')] },
];

/** 渲染老師端主畫面並推送一份老師檢視。 */
function renderDashboard(wide: boolean) {
  const media = installMatchMedia(wide);
  render(<TeacherDashboard token="teacher-token" onLogout={() => undefined} />);
  const socket = currentSocket();
  socket.serverConnect();
  socket.sendState(teacherView({ groupOverview: overview() }));
  return { media, socket };
}

const toggle = () => screen.getByRole('button', { name: '分組情況' });

beforeEach(() => {
  resetSockets();
});

describe('TeacherDashboard 寬螢幕（006 US3、FR-011、FR-013）', () => {
  it('主畫面置中；分組情況在主畫面右緣到視窗右緣的固定框架中置中，框架內捲動', () => {
    renderDashboard(true);
    // 主畫面內容維持最寬 1024 px 並水平置中（不為側欄讓出寬度）
    const header = screen.getByRole('heading', { name: '課堂搶答 — 老師端' });
    const content = header.closest('header')?.parentElement;
    expect(content?.className).toContain('mx-auto');
    expect(content?.className).toContain('max-w-5xl');
    expect(content?.closest('main')?.className ?? '').not.toContain('flex');

    const aside = screen.getByRole('complementary', { name: '分組情況' });
    for (const cls of [
      'fixed',
      'top-0',
      'right-0',
      'bottom-0',
      'left-[calc(50%+32rem)]',
      'overflow-y-auto',
      'overscroll-contain',
      // 兩側預留捲軸空間：出現捲軸時面板仍左右對稱置中
      '[scrollbar-gutter:stable_both-edges]',
    ]) {
      expect(aside.className.split(' ')).toContain(cls);
    }
    // 面板在框架內水平置中
    const frameContent = screen.getByRole('heading', { name: '分組情況' }).closest('aside > div');
    expect(frameContent?.className).toContain('mx-auto');
    expect(frameContent?.className).toContain('max-w-xs');
    // 浮起的卡片：圓角、細外框與陰影（contracts/teacher-ui.md）
    const frameClasses = frameContent?.className.split(' ') ?? [];
    expect(frameClasses).toContain('rounded-2xl');
    expect(frameClasses).toContain('ring-1');
    expect(frameClasses.some((c) => c.startsWith('shadow-'))).toBe(true);
    expect(within(aside).getByText('Milo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '分組情況' })).toBeNull();
    expect(screen.queryByRole('button', { name: /收起/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('TeacherDashboard 窄螢幕（006 US3、FR-012）', () => {
  it('預設收合，只有固定在右上角的「分組情況」按鈕', () => {
    renderDashboard(false);
    expect(screen.queryByRole('complementary', { name: '分組情況' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle().className).toContain('fixed');
    expect(screen.queryByText('Milo')).toBeNull();
  });

  it('按下按鈕展開抽屜，內容相同，焦點移到「關閉」；按「關閉」收合並把焦點還給按鈕', () => {
    renderDashboard(false);
    fireEvent.click(toggle());
    const dialog = screen.getByRole('dialog', { name: '分組情況' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('Milo')).toBeTruthy();
    expect(within(dialog).getByText('Leo')).toBeTruthy();
    const close = within(dialog).getByRole('button', { name: '關閉' });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  it('點背景或按 Esc 都能關閉', () => {
    renderDashboard(false);
    fireEvent.click(toggle());
    fireEvent.click(screen.getByTestId('group-overview-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(toggle());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  it('展開中收到新的資料時抽屜立即更新（US3-6）', () => {
    const { socket } = renderDashboard(false);
    fireEvent.click(toggle());
    socket.sendState(teacherView({ groupOverview: overview(['Ava']) }));
    expect(within(screen.getByRole('dialog')).getByText('Ava')).toBeTruthy();
  });
});

describe('TeacherDashboard 跨過 1600 px（006 FR-014）', () => {
  it('窄且展開時變寬 → 改為右側側欄；再變窄 → 回到收合', () => {
    const { media } = renderDashboard(false);
    fireEvent.click(toggle());
    expect(screen.getByRole('dialog')).toBeTruthy();

    media.setMatches(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('complementary', { name: '分組情況' })).toBeTruthy();

    media.setMatches(false);
    expect(screen.queryByRole('complementary', { name: '分組情況' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toBeTruthy();
  });
});
