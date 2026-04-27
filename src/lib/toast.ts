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
 *
 * Defensive: empty/whitespace messages no-op rather than rendering an
 * empty toast bubble. This guards against backend error paths that bubble
 * up `error.message` strings that can be undefined/'' (e.g. a Shopify
 * GraphQL error with no `message` field), which previously produced a
 * blank, dismissible toast with no useful content for the user.
 */
import { toast as sonnerToast } from 'sonner';

type ToastOpts = Parameters<typeof sonnerToast>[1];

const isRenderable = (message: unknown): message is string =>
  typeof message === 'string' && message.trim().length > 0;

export const toast = {
  success: (message: string, opts?: ToastOpts) =>
    isRenderable(message) ? sonnerToast.success(message, opts) : undefined,
  error: (message: string, opts?: ToastOpts) =>
    isRenderable(message) ? sonnerToast.error(message, opts) : undefined,
  info: (message: string, opts?: ToastOpts) =>
    isRenderable(message) ? sonnerToast(message, opts) : undefined,
  warning: (message: string, opts?: ToastOpts) =>
    isRenderable(message) ? sonnerToast.warning(message, opts) : undefined,
};

export default toast;
