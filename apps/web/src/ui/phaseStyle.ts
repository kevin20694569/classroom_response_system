import { SESSION_STATUS_LABEL, type SessionStatus } from '@crs/shared';
import type { MeaningIconName } from './icons';
import { PHASE_COLORS } from './theme';

/** 階段樣式（007 data-model §2）：每個活動階段的文字、強調色與圖示。 */
export interface PhaseStyle {
  status: SessionStatus;
  /** 沿用既有的階段文字 SESSION_STATUS_LABEL */
  label: string;
  /** 階段強調色（對白底 ≥ 4.5:1） */
  color: string;
  icon: MeaningIconName;
}

const ICON: Readonly<Record<SessionStatus, MeaningIconName>> = {
  NOT_IMPORTED: 'notImported',
  READY: 'waiting',
  OPEN: 'open',
  CLOSED: 'closed',
};

/** 四個階段的顏色與圖示兩兩不同（FR-010、SC-002）。 */
export function phaseStyle(status: SessionStatus): PhaseStyle {
  return {
    status,
    label: SESSION_STATUS_LABEL[status],
    color: PHASE_COLORS[status],
    icon: ICON[status],
  };
}
