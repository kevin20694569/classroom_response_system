import type { SessionStatus } from '@crs/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../src/components/StatusBadge';
import { phaseStyle } from '../src/ui/phaseStyle';

function rgbOf(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

describe('StatusBadge（007 FR-010、FR-011）', () => {
  it.each<SessionStatus>(['NOT_IMPORTED', 'READY', 'OPEN', 'CLOSED'])(
    '%s：白底、階段色文字與圖示，文字與 data-testid 不變',
    (status) => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByTestId('status-badge');
      const style = phaseStyle(status);
      expect(badge.textContent).toBe(style.label);
      expect(badge.style.color).toBe(rgbOf(style.color));
      expect(badge.className).toContain('bg-white');
      const icon = badge.querySelector(`svg[data-icon="${style.icon}"]`);
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    },
  );
});
