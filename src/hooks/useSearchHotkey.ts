import { useEffect, useRef } from 'react';

/**
 * useSearchHotkey — bind Cmd+K (macOS) / Ctrl+K (Win/Linux) AND bare
 * "/" to focus a search input, plus Escape (when that input is
 * focused) to clear and blur it. Standard power-user shortcuts
 * popularised by Linear / Vercel / GitHub admin surfaces — admins
 * running multiple admin tabs can jump straight to filtering without
 * reaching for the mouse.
 *
 * Usage:
 *   const ref = useSearchHotkey({ onClear: () => setQuery('') });
 *   <input ref={ref} value={query} onChange={...} />
 *
 * The hook returns a ref the caller wires to the target input. Don't
 * fire the shortcut when the user is typing inside another field —
 * forms (signup, contact) shouldn't have their text intercepted by a
 * Cmd+K that's meant for the surrounding admin chrome.
 */
export function useSearchHotkey(opts?: { onClear?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const onClearRef = useRef(opts?.onClear);
  // Keep onClear current without re-running the keydown effect — would
  // otherwise rebind every render that passed a fresh closure.
  onClearRef.current = opts?.onClear;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Shared skip: mid-edit in another surface, or any aria-modal
      // dialog is open and the target input is outside it. Centralised
      // so the Cmd+K and "/" branches can't drift apart.
      const shouldBailForFocusContext = () => {
        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName;
        // Explicit contentEditable check in addition to isContentEditable
        // — some consumers stamp `contenteditable="true"` on wrappers
        // where the DOM attribute is the source of truth (e.g. TipTap).
        const editableAttr = active?.getAttribute('contenteditable') === 'true';
        const isEditing =
          tag === 'INPUT' || tag === 'TEXTAREA' || !!active?.isContentEditable || editableAttr;
        if (isEditing && active !== ref.current) return true;
        // Don't yank focus out of an open modal / dialog surface. Admin
        // pages mount confirm-modals + the global Cmd+K command palette
        // that share this shortcut — without this guard, pressing Cmd+K
        // inside an invite-dialog button would race the palette open
        // AND focus the table's search input behind the backdrop, so
        // Tab'ing away from the modal would land on an underlying cell.
        // Only bail when the target input isn't inside the open dialog.
        const openDialog = document.querySelector<HTMLElement>(
          '[role="dialog"][aria-modal="true"], [aria-modal="true"]'
        );
        if (openDialog && !openDialog.contains(ref.current)) return true;
        return false;
      };

      // CapsLock flips e.key to 'K'; the original `=== 'k'` check
      // silently dropped the shortcut for anyone with CapsLock on,
      // which reads like 'Cmd+K is broken on my machine'. Compare
      // case-insensitively and skip Shift/Alt so Cmd+Shift+K (devtools-
      // style bindings) and Option+Cmd+K (types special chars like '˚'
      // on macOS French/AZERTY layouts) don't accidentally steal focus.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        if (shouldBailForFocusContext()) return;
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      } else if (
        // Linear / GitHub / Discord popularised bare "/" as a
        // secondary "jump to search" shortcut. Only fire on a literal
        // '/' with no modifiers — Shift+/ yields '?' on US layouts
        // (keyboard help popover convention) and Ctrl+/ toggles
        // comments in dev tools we don't want to shadow. Cmd+/ is the
        // browser's own URL bar shortcut on some OSes.
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        if (shouldBailForFocusContext()) return;
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === ref.current) {
        if (onClearRef.current) onClearRef.current();
        ref.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return ref;
}
