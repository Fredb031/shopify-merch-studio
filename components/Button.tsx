import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'secondary' | 'tertiary';
type Size = 'sm' | 'md' | 'lg';

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

type AnchorProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
    external?: boolean;
  };

type ButtonElProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type Props = AnchorProps | ButtonElProps;

const variantClass: Record<Variant, string> = {
  primary:
    'bg-ink-950 text-canvas-000 hover:bg-ink-800 active:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700',
  secondary:
    'bg-canvas-000 text-ink-950 border border-ink-950 hover:bg-sand-100 active:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700',
  tertiary:
    'bg-transparent text-ink-950 hover:bg-sand-100 active:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-3 text-body-sm rounded-sm',
  md: 'h-11 px-4 text-body-md rounded-md',
  lg: 'h-12 px-6 text-body-md rounded-md',
};

const baseClass =
  'inline-flex items-center justify-center font-medium transition-colors duration-base ease-standard focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

export function Button(props: Props) {
  const {
    variant = 'primary',
    size = 'md',
    className = '',
    children,
  } = props;

  const cls = `${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim();

  if ('href' in props && typeof props.href === 'string') {
    const { href, external, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    void _v;
    void _s;
    void _c;
    void _ch;
    if (external || /^https?:\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return (
        <a href={href} className={cls} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props as ButtonElProps;
  void _v;
  void _s;
  void _c;
  void _ch;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
