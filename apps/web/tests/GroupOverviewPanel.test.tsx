import type { GroupOverview, OverviewMember } from '@crs/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GroupOverviewPanel } from '../src/pages/teacher/GroupOverviewPanel';
import { teacherView } from './viewBuilders';

const id = (n: number): string => `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, '0')}`;

function member(n: number, nickname: string, overrides: Partial<OverviewMember> = {}) {
  return {
    memberId: id(n),
    nickname,
    inGroup: true,
    disconnected: false,
    answered: [],
    ...overrides,
  } satisfies OverviewMember;
}

const sampleOverview: GroupOverview[] = [
  {
    groupId: 1,
    memberCount: 2,
    members: [member(1, 'Milo'), member(2, 'Ava', { disconnected: true })],
  },
  { groupId: 2, memberCount: 0, members: [] },
];

const itemsOf = (section: HTMLElement): HTMLElement[] => within(section).queryAllByRole('listitem');

describe('GroupOverviewPanel（006 US1、contracts/teacher-ui.md）', () => {
  it('尚未匯入時顯示提示，不顯示任何組別', () => {
    render(<GroupOverviewPanel view={teacherView({ status: 'NOT_IMPORTED' })} />);
    expect(screen.getByRole('heading', { name: '分組情況' })).toBeTruthy();
    expect(screen.getByText('匯入 Guided Notes 後會在這裡顯示各組組員。')).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('每組有「第 N 組」標示與人數，組員依資料順序列出', () => {
    render(<GroupOverviewPanel view={teacherView({ groupOverview: sampleOverview })} />);
    expect(screen.getByRole('heading', { name: '分組情況' })).toBeTruthy();
    const first = screen.getByRole('region', { name: '第 1 組' });
    expect(within(first).getByText('2 人')).toBeTruthy();
    expect(itemsOf(first).map((li) => li.textContent)).toEqual(['Milo', 'Ava連線中斷']);
    const second = screen.getByRole('region', { name: '第 2 組' });
    expect(within(second).getByText('0 人')).toBeTruthy();
    expect(within(second).getByText('尚無組員')).toBeTruthy();
  });

  it('各組卡片為白底並有淺陰影，與面板形成層次（contracts/teacher-ui.md）', () => {
    render(<GroupOverviewPanel view={teacherView({ groupOverview: sampleOverview })} />);
    for (const name of ['第 1 組', '第 2 組']) {
      const classes = screen.getByRole('region', { name }).className.split(' ');
      expect(classes).toContain('bg-white');
      expect(classes).toContain('shadow-sm');
    }
  });

  it('連線中斷以文字標示，不只靠顏色（FR-021）', () => {
    render(<GroupOverviewPanel view={teacherView({ groupOverview: sampleOverview })} />);
    const first = screen.getByRole('region', { name: '第 1 組' });
    expect(within(first).getAllByText('連線中斷')).toHaveLength(1);
    expect(within(itemsOf(first)[0] as HTMLElement).queryByText('連線中斷')).toBeNull();
  });

  it('暱稱相同的組員分別列出', () => {
    const overview: GroupOverview[] = [
      { groupId: 1, memberCount: 2, members: [member(1, 'Milo'), member(2, 'Milo')] },
      { groupId: 2, memberCount: 0, members: [] },
    ];
    render(<GroupOverviewPanel view={teacherView({ groupOverview: overview })} />);
    const first = screen.getByRole('region', { name: '第 1 組' });
    expect(itemsOf(first).map((li) => li.textContent)).toEqual(['Milo', 'Milo']);
  });

  it('長暱稱可在面板內換行（FR-015），面板沒有任何操作按鈕（FR-017）', () => {
    const long = 'Bartholomewsonnnnnnn';
    const overview: GroupOverview[] = [
      { groupId: 1, memberCount: 1, members: [member(1, long)] },
      { groupId: 2, memberCount: 0, members: [] },
    ];
    render(<GroupOverviewPanel view={teacherView({ groupOverview: overview })} />);
    expect(screen.getByText(long).className).toContain('break-words');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('GroupOverviewPanel：回答標註與不在組內（006 US2、FR-009）', () => {
  const tagged: GroupOverview[] = [
    {
      groupId: 1,
      memberCount: 1,
      members: [
        member(1, 'Milo', { answered: [{ questionNumber: 1, isWinner: true }] }),
        member(2, 'Ava', {
          inGroup: false,
          answered: [{ questionNumber: 2, isWinner: false }],
        }),
      ],
    },
    {
      groupId: 2,
      memberCount: 0,
      members: [
        member(3, 'Leo', { inGroup: false, answered: [{ questionNumber: 3, isWinner: false }] }),
      ],
    },
  ];

  it('組員下方顯示題號標記', () => {
    render(<GroupOverviewPanel view={teacherView({ groupOverview: tagged })} />);
    const first = screen.getByRole('region', { name: '第 1 組' });
    expect(within(first).getByText('第 1 題')).toBeTruthy();
    expect(within(first).getByText('第 2 題')).toBeTruthy();
  });

  it('不在組內的成員灰色顯示並標「不在組內」，排在組員之後', () => {
    render(<GroupOverviewPanel view={teacherView({ groupOverview: tagged })} />);
    const first = screen.getByRole('region', { name: '第 1 組' });
    const members = within(first)
      .getAllByRole('listitem')
      .filter((li) => li.dataset.member !== undefined);
    expect(members.map((li) => li.dataset.member)).toEqual(['Milo', 'Ava']);
    expect(within(members[1] as HTMLElement).getByText('不在組內')).toBeTruthy();
    expect((members[1] as HTMLElement).className).toContain('text-slate-400');
    expect(within(members[0] as HTMLElement).queryByText('不在組內')).toBeNull();
  });

  it('只有不在組內的送出者時顯示「0 人」，不顯示「尚無組員」', () => {
    render(<GroupOverviewPanel view={teacherView({ groupOverview: tagged })} />);
    const second = screen.getByRole('region', { name: '第 2 組' });
    expect(within(second).getByText('0 人')).toBeTruthy();
    expect(within(second).queryByText('尚無組員')).toBeNull();
    expect(within(second).getByText('Leo')).toBeTruthy();
  });
});
