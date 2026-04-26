/**
 * Thin wrapper around sonner so non-React modules (zustand stores, plain
 * helpers) can fire toasts without importing sonner directly. The repo
 * already has the Toaster mounted at App root via @/components/ui/sonner;
 * this module just exposes the four call shapes the Phase 3.3 master prompt
 * standardised on (success / error / info / warning) and lets cartStore +
 * checkout error paths route through one import.
 *
 * Existing call sites that already do `import { toast } from 'sonner'`
 * keep working — this wrapper is additive. New non-component callers are
 * encouraged to use this module so we have one place to swap the
 * underlying toast lib if we ever migrate off sonner.
 */
import { toast as sonnerToast } from 'sonner';

type ToastOpts = Parameters<typeof sonnerToast>[1];

export const toast = {
  success: (message: string, opts?: ToastOpts) => sonnerToast.success(message, opts),
  error: (message: string, opts?: ToastOpts) => sonnerToast.error(message, opts),
  info: (message: string, opts?: ToastOpts) => sonnerToast(message, opts),
  warning: (message: string, opts?: ToastOpts) => sonnerToast.warning(message, opts),
};

export default toast;
