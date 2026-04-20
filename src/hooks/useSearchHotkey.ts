import { useEffect, useRef } from 'react';

/**
 * useSearchHotkey — bind Cmd+K (macOS) / Ctrl+K (Win/Linux) to focus a
 * search input, plus Escape (when that input is focused) to clear and
 * blur it. Standard power-user shortcut popularised by Linear / Vercel
 * / GitHub admin surfaces — admins running multiple admin tabs can
 * jump straight to filtering without reaching for the mouse.
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Don't grab Cmd+K when the user is mid-edit in a different
        // input/textarea/contentEditable surface (e.g. invite modal).
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' ||
          (document.activeElement as HTMLElement | null)?.isContentEditable;
        if (isEditing && document.activeElement !== ref.current) return;
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
