import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}

const variants: Record<ButtonVariant, string> = {
  // Dark text on bright emerald passes WCAG AA in both themes (white text would not).
  primary:
    'bg-linear-to-br from-[#34d399] to-[#10b981] text-[#022c22] shadow-[0_8px_24px_-6px_var(--accent-glow)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-6px_var(--accent-glow)]',
  ghost: 'glass text-text hover:bg-glass-strong',
  danger:
    'bg-linear-to-br from-[#dc2626] to-[#b91c1c] text-white shadow-[0_8px_24px_-8px_rgba(239,68,68,0.5)] hover:-translate-y-0.5',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs gap-1.5',
  md: 'min-h-11 px-5 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap transition-all duration-200',
        'disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={iconSize} aria-hidden="true" />
      )}
      {children}
    </button>
  );
});
