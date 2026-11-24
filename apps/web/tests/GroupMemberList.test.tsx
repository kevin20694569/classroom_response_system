import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GroupMemberList } from '../src/pages/student/GroupMemberList';

const SELF = '3f0b2c1e-1111-4222-8333-444455556666';

describe('GroupMemberList（004 FR-010、contracts/student-ui.md §3）', () => {
  it('顯示「本組成員（K 人）」並依順序列出，自己加「（你）」', () => {
    render(
      <GroupMemberList
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
});
