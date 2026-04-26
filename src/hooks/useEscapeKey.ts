import { useEffect } from 'react';

/**
 * Options accepted by {@link useEscapeKey}. Exported so wrapper hooks
 * and HOCs that forward these flags can type their own props without
 * re-declaring the shape inline (or reaching for `Parameters<typeof
 * useEscapeKey>[2]`, which is brittle when the signature evolves).
 */
export interface UseEscapeKeyOptions {
  /** Skip Escape when focus is in a text input / textarea — e.g. so
   *  Esc clears a field instead of killing the whole overlay. */
  skipInTextInputs?: boolean;
}

// Module-level LIFO stack of currently-active Escape handlers. Only the
// top-most (most-recently-mounted) active handler fires on a given Escape
// keystroke — preventing the classic "toast + modal + drawer all close at
// once" cascade where a single Escape collapses every open overlay. Each
// hook invocation pushes its wrapper on mount (when active) and pops on
// unmount/deactivation. React effect ordering guarantees a newly-opened
// inner overlay mounts after its parent, so it naturally lands on top.
const escapeStack: Array<(e: KeyboardEvent) => void> = [];
let escapeListenerAttached = false;
const dispatchEscape = (e: KeyboardEvent) => {
  const top = escapeStack[escapeStack.length - 1];
  if (top) top(e);
};

/**
 * Trigger `onEscape` when the user presses the Escape key, only while
 * `active` is true. Centralizes the modal/drawer dismiss pattern. When
 * multiple overlays are open, only the top-most receives Escape.
 */
export function useEscapeKey(
  active: boolean,
  onEscape: () => void,
  { skipInTextInputs = false }: UseEscapeKeyOptions = {},
): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Respect deeper handlers that already consumed the Esc — e.g. a
      // combobox inside a modal clearing its own input, or a datepicker
      // popover closing itself. Without this guard the outer overlay
      // would also dismiss on the same keystroke, forcing the user to
      // reopen it after every inline cancel.
      if (e.defaultPrevented) return;
      if (skipInTextInputs) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        // Also treat contentEditable elements as text inputs — rich-text
        // surfaces (fabric.IText's hidden editor, any future WYSIWYG)
        // expect Esc to exit editing mode, not kill the containing modal.
        // For <input>, only skip when it's actually a text-bearing type —
        // checkboxes/radios/buttons have no field to clear, so Esc should
        // still dismiss the surrounding overlay.
        if (tag === 'TEXTAREA' || t?.isContentEditable) return;
        if (tag === 'INPUT') {
          const inputType = (t as HTMLInputElement).type;
          if (
            inputType !== 'checkbox' &&
            inputType !== 'radio' &&
            inputType !== 'button' &&
            inputType !== 'submit' &&
            inputType !== 'reset' &&
            inputType !== 'file' &&
            inputType !== 'image' &&
            inputType !== 'range' &&
            inputType !== 'color'
          ) {
            return;
          }
        }
      }
      onEscape();
    };
    // Push this handler; a single module-level window listener dispatches
    // to the top of the stack. Attach lazily on first use, keep attached
    // thereafter — keydown with no stack is a no-op so the overhead is
    // negligible and we avoid add/remove churn on every mount.
    escapeStack.push(onKey);
    if (!escapeListenerAttached) {
      window.addEventListener('keydown', dispatchEscape);
      escapeListenerAttached = true;
    }
    return () => {
      const idx = escapeStack.lastIndexOf(onKey);
      if (idx !== -1) escapeStack.splice(idx, 1);
    };
  }, [active, onEscape, skipInTextInputs]);
}
