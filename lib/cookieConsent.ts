/**
 * Cookie consent utilities — Loi 25 compliant.
 *
 * Default state when undecided: ALL non-essential categories OFF.
 * Storage: cookie `va-consent-v1` with JSON value, 1-year expiry, SameSite=Lax.
 */

export type ConsentCategory =
  | 'essentials'
  | 'preferences'
  | 'analytics'
  | 'marketing';

export type ConsentState = Record<ConsentCategory, boolean> & { ts: string };

export const CONSENT_COOKIE_NAME = 'va-consent-v1';
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

const ALL_CATEGORIES: readonly ConsentCategory[] = [
  'essentials',
  'preferences',
  'analytics',
  'marketing',
] as const;

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const target = `${encodeURIComponent(name)}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const raw of parts) {
    if (raw.startsWith(target)) {
      return decodeURIComponent(raw.slice(target.length));
    }
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (!isBrowser()) return;
  const encoded = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  const attrs = [
    encoded,
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'SameSite=Lax',
  ];
  // Only mark Secure on HTTPS so it still works on localhost dev.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    attrs.push('Secure');
  }
  document.cookie = attrs.join('; ');
}

function deleteCookie(name: string): void {
  if (!isBrowser()) return;
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function isConsentState(value: unknown): value is ConsentState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.ts !== 'string') return false;
  for (const cat of ALL_CATEGORIES) {
    if (typeof v[cat] !== 'boolean') return false;
  }
  return true;
}

/**
 * Returns the persisted consent state, or `null` if the user has not yet
 * decided (banner should be shown).
 */
export function getConsent(): ConsentState | null {
  const raw = readCookie(CONSENT_COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isConsentState(parsed)) return null;
    // essentials are always true regardless of stored value
    return { ...parsed, essentials: true };
  } catch {
    return null;
  }
}

/**
 * Persist consent. Any missing category defaults to its current persisted
 * value (or `false` for non-essentials, `true` for essentials). Always stamps
 * a fresh ISO timestamp.
 */
export function setConsent(state: Partial<ConsentState>): void {
  const current = getConsent();
  const next: ConsentState = {
    essentials: true,
    preferences: state.preferences ?? current?.preferences ?? false,
    analytics: state.analytics ?? current?.analytics ?? false,
    marketing: state.marketing ?? current?.marketing ?? false,
    ts: new Date().toISOString(),
  };
  writeCookie(CONSENT_COOKIE_NAME, JSON.stringify(next), CONSENT_COOKIE_MAX_AGE);
  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent<ConsentState>('va:consent-changed', { detail: next }),
    );
  }
}

/**
 * Remove the consent cookie entirely. Useful for "reset my preferences" flows
 * and the Loi-25-mandated right to withdraw consent.
 */
export function clearConsent(): void {
  deleteCookie(CONSENT_COOKIE_NAME);
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent('va:consent-cleared'));
  }
}

/**
 * Check whether a specific category currently has consent. `essentials` is
 * always true. Non-essentials default to `false` until the user opts in.
 */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'essentials') return true;
  const state = getConsent();
  if (!state) return false;
  return state[category] === true;
}

export const ALL_CONSENT_CATEGORIES = ALL_CATEGORIES;
