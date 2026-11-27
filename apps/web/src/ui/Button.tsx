import type { ComponentPropsWithRef } from 'react';
import { Icon } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** 處理中：顯示旋轉圖示、aria-busy，並停用按鈕避免重複送出 */
  pending?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition duration-150 ' +
  'select-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 ' +
  'enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 motion-reduce:transform-none ' +
  'disabled:cursor-not-allowed disabled:opacity-55';

/**
 * 三種按鈕（contracts/ui-visual.md §2）：
 * - primary：主要操作，鮮豔底色、白字、下方實色陰影（按下時陰影消失，像真的按下去）
 * - secondary：次要操作，白底、彩色外框與字
 * - danger：危險操作，紅色系
 */
const VARIANT: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-primary text-white shadow-[0_4px_0_0_var(--color-primary-deep)] focus-visible:ring-violet-300 ' +
    'enabled:hover:brightness-110 enabled:active:shadow-none',
  secondary:
    'border-2 border-secondary-ink/35 bg-card text-secondary-ink focus-visible:ring-violet-200 ' +
    'enabled:hover:border-secondary-ink enabled:hover:bg-violet-50 enabled:active:bg-violet-100',
  danger:
    'bg-danger text-white shadow-[0_4px_0_0_var(--color-danger-deep)] focus-visible:ring-red-300 ' +
    'enabled:hover:brightness-110 enabled:active:shadow-none',
};

const SIZE = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
} as const;

/** 全站共用的按鈕（007 FR-004）：四種狀態（移上、按下、停用、處理中）都有可見差異，鍵盤焦點有明顯外框。 */
export function Button({
  variant,
  size = 'md',
  pending = false,
  type = 'button',
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || pending}
      {...(pending && { 'aria-busy': true })}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]}${className === undefined ? '' : ` ${className}`}`}
    >
      {pending && <Icon name="loading" size={18} className="ui-anim animate-spin" />}
      {children}
    </button>
  );
}
