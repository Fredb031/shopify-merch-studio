import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button — Section 1.5 of the Freud × Bernays redesign.
 *
 * Six canonical variants are exposed; the className strings come
 * verbatim from the brief so any component reaching for "the brand
 * button" gets pixel-perfect chrome without re-deriving spacing,
 * radius, or hover treatment locally.
 *
 *   primary   — filled brand-blue, white text. Default.
 *   secondary — soft brand-blue-light tint with brand-blue text.
 *   outline   — transparent, grey border, dark text.
 *   ghost     — transparent until hover; reads as a tertiary action.
 *   fullWidth — primary chrome, w-full for stacked CTAs (mobile).
 *   danger    — red destructive action.
 *
 * The component is a thin wrapper over <button> so existing callers
 * passing onClick / type / disabled keep working untouched.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'fullWidth'
  | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Section 1.5 — exact className strings from the redesign brief.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-brand-blue text-white font-semibold text-base hover:bg-brand-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-brand-blue-light text-brand-blue font-semibold text-base hover:bg-brand-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  outline:
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-brand-grey-border text-brand-dark font-semibold text-base hover:border-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-brand-dark font-semibold text-base hover:bg-brand-grey-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  fullWidth:
    'w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-brand-blue text-white font-semibold text-base hover:bg-brand-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-white font-semibold text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(VARIANTS[variant], className)}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export default Button;
