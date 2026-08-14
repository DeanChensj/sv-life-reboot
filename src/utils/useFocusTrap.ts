import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Minimal accessible-dialog helper.
 *
 * - Moves keyboard focus into the dialog when it opens.
 * - Restores focus to the previously-focused element when it closes.
 * - Traps Tab / Shift+Tab within the dialog so keyboard users can't wander into
 *   the still-mounted game UI behind the modal.
 *
 * Escape-to-close is handled by existing App-level key handlers; this hook only
 * manages focus. Pair it with role="dialog" aria-modal="true" on the container
 * (and tabIndex={-1} so the container itself is focusable as a fallback).
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof document === 'undefined') return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    // Move focus into the dialog on open.
    const initial = getFocusable();
    (initial[0] ?? node).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // Restore focus to whatever was focused before the dialog opened.
      previouslyFocused?.focus?.();
    };
  }, [ref]);
}
