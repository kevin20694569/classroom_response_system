import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GroupMemberList } from '../src/pages/student/GroupMemberList';
import { groupIdentity } from '../src/ui/groupIdentity';

const SELF = '3f0b2c1e-1111-4222-8333-444455556666';

/** jsdom 會把 inline style 的顏色轉成 rgb()，比對前先轉換。 */
function rgbOf(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

describe('GroupMemberList（004 FR-010、contracts/student-ui.md §3）', () => {
  it('顯示「本組成員（K 人）」並依順序列出，自己加「（你）」', () => {
    render(
      <GroupMemberList
        groupId={4}
        selfMemberId={SELF}
        members={[
          { memberId: 'a1b2c3d4-0000-4000-8000-000000000001', nickname: 'Ava' },
          { memberId: SELF, nickname: 'Milo' },
          { memberId: 'a1b2c3d4-0000-4000-8000-000000000003', nickname: 'Leo' },
        ]}
      />,
    );
    const list = screen.getByRole('region', { name: '本組成員（3 人）' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Ava', 'Milo（你）', 'Leo']);
  });

  it('暱稱相同的成員都列出，人數照算', () => {
    render(
      <GroupMemberList
        groupId={4}
        selfMemberId={SELF}
        members={[
          { memberId: SELF, nickname: 'Milo' },
          { memberId: 'a1b2c3d4-0000-4000-8000-000000000002', nickname: 'Milo' },
        ]}
      />,
    );
    expect(screen.getByText('本組成員（2 人）')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Milo（你）',
      'Milo',
    ]);
  });

  it('標題有本組顏色與圖示的標記，卡片左側為本組顏色邊條（007 FR-009、FR-009a）', () => {
    render(
      <GroupMemberList
        groupId={4}
        selfMemberId={SELF}
        members={[{ memberId: SELF, nickname: 'Milo' }]}
      />,
    );
    const list = screen.getByRole('region', { name: '本組成員（1 人）' });
    expect(list.style.borderLeftColor).toBe(rgbOf(groupIdentity(4).color));
    const mark = list.querySelector(`svg[data-icon="${groupIdentity(4).icon}"]`);
    expect(mark).not.toBeNull();
  });
});
