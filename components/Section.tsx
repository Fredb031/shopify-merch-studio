import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'default' | 'warm' | 'sand' | 'ink';

type Props = HTMLAttributes<HTMLElement> & {
  tone?: Tone;
  children: ReactNode;
  as?: 'section' | 'div';
};

const toneClass: Record<Tone, string> = {
  default: 'bg-canvas-000 text-ink-950',
  warm: 'bg-canvas-050 text-ink-950',
  sand: 'bg-sand-100 text-ink-950',
  ink: 'bg-ink-950 text-canvas-050',
};

export function Section({
  tone = 'default',
  className = '',
  children,
  as: Tag = 'section',
  ...rest
}: Props) {
  return (
    <Tag
      {...rest}
      className={`${toneClass[tone]} py-16 md:py-24 ${className}`}
    >
      {children}
    </Tag>
  );
}
