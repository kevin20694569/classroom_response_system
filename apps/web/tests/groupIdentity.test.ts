import { groupName } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { groupIdentity } from '../src/ui/groupIdentity';
import { GROUP_ICON_NAMES } from '../src/ui/icons';
import { GROUP_COLORS } from '../src/ui/theme';

const IDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('groupIdentity（007 data-model §1，FR-007、FR-008、SC-003）', () => {
  it('依組別編號固定指派顏色、圖示與名稱', () => {
    for (const n of IDS) {
      const identity = groupIdentity(n);
      expect(identity).toEqual({
        groupId: n,
        color: GROUP_COLORS[(n - 1) % 10],
        icon: GROUP_ICON_NAMES[n - 1],
        name: groupName(n),
      });
      expect(groupIdentity(n)).toEqual(identity);
    }
  });

  it('1～20 任兩組的 (color, icon) 不相同', () => {
    const keys = IDS.map((n) => {
      const { color, icon } = groupIdentity(n);
      return `${color}/${icon}`;
    });
    expect(new Set(keys).size).toBe(20);
  });

  it('第 1 組與第 11 組同色但圖示不同', () => {
    expect(groupIdentity(1).color).toBe(groupIdentity(11).color);
    expect(groupIdentity(1).icon).not.toBe(groupIdentity(11).icon);
  });
});
