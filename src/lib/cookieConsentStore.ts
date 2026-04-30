/**
 * Cookie consent storage primitives.
 *
 * Extracted from src/components/CookieConsent.tsx so that the
 * synchronous read path (analytics bootstrap + useVisitorTracking)
 * can stay tiny and tree-shakeable, while the actual banner UI
 * (which pulls lucide-react + dialog markup) can be code-split and
 * lazy-loaded after first paint.
 *
 * Quebec Law 25 (CCQ) requires explicit opt-in for non-essential
 * cookies and analytics. Default is "no choice yet" → show banner.
 */

export const COOKIE_CONSENT_STORAGE_KEY = 'vision-cookie-consent';

export interface ConsentState {
  essentials: true;
  analytics: boolean;
  marketing: boolean;
  at: string; // ISO timestamp of the user's decision
}

/**
 * Read the persisted consent choice, if any. Returns null when the
 * user has not yet made a decision (banner should still be shown).
 * Safe in private-mode browsers where localStorage access throws.
 */
export function getCookieConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      parsed.essentials === true &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean' &&
      typeof parsed.at === 'string'
    ) {
      return parsed as ConsentState;
    }
    return null;
  } catch {
    return null;
  }
}

export function persistCookieConsent(state: ConsentState) {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — silent is fine, banner will show again next visit */
  }
}
