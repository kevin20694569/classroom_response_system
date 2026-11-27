import {
  Anchor,
  Ban,
  Bird,
  BookOpen,
  Cat,
  CircleCheckBig,
  CircleExclamationPoint,
  Cloud,
  Crown,
  Dog,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Fish,
  Flag,
  Flame,
  Flower2,
  Gem,
  Guitar,
  Heart,
  Hourglass,
  Inbox,
  KeyRound,
  Leaf,
  LoaderCircle,
  LogOut,
  Medal,
  MessagesSquare,
  Moon,
  Presentation,
  Rabbit,
  Rocket,
  Shuffle,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Timer,
  Trophy,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';

/**
 * 007 的圖示對照表（research R2、R3、R7）：頁面只透過這裡取用圖示，不直接匯入 lucide-react，
 * 讓「同一意義同一圖示」（FR-006）集中在一處。所有圖示都只是裝飾，一律對螢幕閱讀器隱藏（FR-007）。
 */

/** 組別圖示，依組別編號排列（第 n 組用第 n − 1 個）；20 個兩兩不同，保證 2～20 組的識別不重複（FR-008）。 */
export const GROUP_ICON_NAMES = [
  'rocket',
  'star',
  'flame',
  'zap',
  'leaf',
  'fish',
  'bird',
  'cat',
  'dog',
  'rabbit',
  'sun',
  'moon',
  'cloud',
  'anchor',
  'crown',
  'gem',
  'heart',
  'guitar',
  'flower',
  'snowflake',
] as const;
export type GroupIconName = (typeof GROUP_ICON_NAMES)[number];

/** 保留給「意義」的圖示（research R7）；不與組別圖示重複，避免組別圖示被誤認為搶答成功等狀態。 */
export const MEANING_ICON_NAMES = [
  'notImported',
  'waiting',
  'open',
  'closed',
  'submitted',
  'winner',
  'medal',
  'disconnected',
  'reconnected',
  'error',
  'loading',
  'empty',
  'noWinner',
  'home.teacher',
  'home.student',
  'questions',
  'export',
  'csv',
  'submissions',
  'login',
  'logout',
  'nickname',
  'shuffle',
  'sparkles',
] as const;
export type MeaningIconName = (typeof MEANING_ICON_NAMES)[number];

export type IconName = GroupIconName | MeaningIconName;

const ICONS: Readonly<Record<IconName, LucideIcon>> = {
  rocket: Rocket,
  star: Star,
  flame: Flame,
  zap: Zap,
  leaf: Leaf,
  fish: Fish,
  bird: Bird,
  cat: Cat,
  dog: Dog,
  rabbit: Rabbit,
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  anchor: Anchor,
  crown: Crown,
  gem: Gem,
  heart: Heart,
  guitar: Guitar,
  flower: Flower2,
  snowflake: Snowflake,
  notImported: FileUp,
  waiting: Hourglass,
  open: Timer,
  closed: Flag,
  submitted: CircleCheckBig,
  winner: Trophy,
  medal: Medal,
  disconnected: WifiOff,
  reconnected: Wifi,
  error: CircleExclamationPoint,
  loading: LoaderCircle,
  empty: Inbox,
  noWinner: Ban,
  'home.teacher': Presentation,
  'home.student': Users,
  questions: BookOpen,
  export: FileDown,
  csv: FileSpreadsheet,
  submissions: MessagesSquare,
  login: KeyRound,
  logout: LogOut,
  nickname: UserRound,
  shuffle: Shuffle,
  sparkles: Sparkles,
};

/** 取得圖示元件（測試用來確認組別圖示與意義圖示沒有共用同一個圖形）。 */
export function iconComponent(name: IconName): LucideIcon {
  return ICONS[name];
}

export interface IconProps {
  name: IconName;
  className?: string;
  style?: CSSProperties;
  /** 圖示大小（px），預設 20 */
  size?: number;
}

/** 裝飾用圖示：一律 aria-hidden，可存取名稱只由旁邊的文字提供。 */
export function Icon({ name, className, style, size = 20 }: IconProps) {
  const Component = ICONS[name];
  return (
    <Component
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      size={size}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  );
}
