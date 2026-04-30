import { describe, it, expect } from 'vitest';
import { categorizeError } from '../errorMessages';

// `categorizeError` is the single decision point that maps raw SanMar /
// Supabase / network errors to operator-facing copy. The 7 categories below
// are tested in both FR and EN to lock the bilingual surface, plus edge
// cases that document the matcher's specific → generic priority order.
//
// Priority order (specific wins over generic, top of fn → bottom):
//   1. 401/403/42501/auth keywords
//   2. 404 / not-found keywords
//   3. 5xx / service-unavailable keywords
//   4. timeout / network keywords
//   5. PGRST202 / function-missing keywords
//   6. 429 / rate-limit keywords
//   7. generic fallback
//
// Tests assert behaviour, not exact copy, so future i18n tweaks don't
// require test churn — but title patterns are tight enough to catch a
// truly broken mapping.
describe('categorizeError', () => {
  describe('FR locale', () => {
    it('maps 401 to invalid credentials with error severity', () => {
      const result = categorizeError({ status: 401, message: 'Unauthorized' }, 'fr');
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/identifiants invalides|permission/i);
      expect(result.action).toMatch(/SANMAR_|secrets|sanmar:read/i);
    });

    it('maps 403 to invalid credentials', () => {
      const result = categorizeError({ status: 403, message: 'Forbidden' }, 'fr');
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/identifiants invalides|permission/i);
    });

    it('maps Supabase 42501 (RLS) to invalid credentials', () => {
      const result = categorizeError(
        { code: '42501', message: 'permission denied for table sanmar_orders' },
        'fr',
      );
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/identifiants|permission/i);
    });

    it('maps "authentication" string to invalid credentials', () => {
      const result = categorizeError({ message: 'authentication failed' }, 'fr');
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/identifiants|permission/i);
    });

    it('maps 404 to not found with info severity', () => {
      const result = categorizeError({ status: 404, message: 'Not Found' }, 'fr');
      expect(result.severity).toBe('info');
      expect(result.title).toMatch(/introuvable/i);
      expect(result.action).toMatch(/PO|identifiant/i);
    });

    it('maps "Order not found" message to not found', () => {
      const result = categorizeError({ message: 'Order not found' }, 'fr');
      expect(result.severity).toBe('info');
      expect(result.title).toMatch(/introuvable/i);
    });

    it('maps 503 to service unavailable with warning severity', () => {
      const result = categorizeError({ status: 503, message: 'Service Unavailable' }, 'fr');
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/service sanmar indisponible/i);
      expect(result.action).toMatch(/5 min|ops|PromoStandards/i);
    });

    it('maps 502 (bad gateway) to service unavailable', () => {
      const result = categorizeError({ status: 502, message: 'Bad Gateway' }, 'fr');
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/indisponible/i);
    });

    it('maps "service unavailable" string (no status) to service unavailable', () => {
      const result = categorizeError({ message: 'service unavailable, try later' }, 'fr');
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/indisponible/i);
    });

    it('maps timeout / aborted / ECONNRESET to timeout with warning severity', () => {
      const cases = ['Request timeout', 'aborted by user', 'ECONNRESET', 'fetch failed'];
      for (const message of cases) {
        const result = categorizeError({ message }, 'fr');
        expect(result.severity).toBe('warning');
        expect(result.title).toMatch(/délai dépassé/i);
        expect(result.action).toMatch(/réseau|connectivité|passerelle/i);
      }
    });

    it('maps PGRST202 to DB function missing with warning severity', () => {
      const result = categorizeError(
        { code: 'PGRST202', message: 'Could not find the function public.sanmar_health' },
        'fr',
      );
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/fonction.*non déployée|base de données/i);
      expect(result.action).toMatch(/migrations|supabase|RPC/i);
    });

    it('maps "function does not exist" message to DB function missing', () => {
      const result = categorizeError(
        { message: 'ERROR: function does not exist (public.sanmar_xyz)' },
        'fr',
      );
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/fonction|base de données/i);
    });

    it('maps 429 to rate limit with warning severity', () => {
      const result = categorizeError({ status: 429, message: 'Too Many Requests' }, 'fr');
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/limite de requêtes/i);
      expect(result.action).toMatch(/minute|quota|SanMar/i);
    });

    it('maps "rate limit" string to rate limit', () => {
      const result = categorizeError({ message: 'rate limit exceeded' }, 'fr');
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/limite/i);
    });

    it('falls back to generic for unrecognized errors', () => {
      const result = categorizeError({ message: 'something weird happened' }, 'fr');
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/erreur inattendue/i);
      expect(result.action).toMatch(/réessayer|escalader|détails techniques/i);
    });
  });

  describe('EN locale', () => {
    it('mirrors FR severity but uses English copy for 401', () => {
      const fr = categorizeError({ status: 401, message: 'x' }, 'fr');
      const en = categorizeError({ status: 401, message: 'x' }, 'en');
      expect(en.severity).toBe(fr.severity);
      expect(en.title).not.toBe(fr.title);
      expect(en.title).toMatch(/invalid credentials|permission denied/i);
      expect(en.action).toMatch(/SANMAR_|secrets|sanmar:read/i);
    });

    it('returns English copy for 404', () => {
      const en = categorizeError({ status: 404, message: 'x' }, 'en');
      expect(en.severity).toBe('info');
      expect(en.title).toMatch(/not found/i);
      expect(en.action).toMatch(/PO number|resource identifier/i);
    });

    it('returns English copy for 503', () => {
      const en = categorizeError({ status: 503, message: 'x' }, 'en');
      expect(en.severity).toBe('warning');
      expect(en.title).toMatch(/service unavailable/i);
    });

    it('returns English copy for timeout', () => {
      const en = categorizeError({ message: 'request timed out' }, 'en');
      expect(en.severity).toBe('warning');
      expect(en.title).toMatch(/timed out/i);
    });

    it('returns English copy for PGRST202', () => {
      const en = categorizeError({ code: 'PGRST202', message: 'x' }, 'en');
      expect(en.severity).toBe('warning');
      expect(en.title).toMatch(/database function not deployed/i);
    });

    it('returns English copy for 429', () => {
      const en = categorizeError({ status: 429, message: 'x' }, 'en');
      expect(en.severity).toBe('warning');
      expect(en.title).toMatch(/rate limit reached/i);
    });

    it('returns English copy for generic fallback', () => {
      const en = categorizeError({ message: 'mystery boom' }, 'en');
      expect(en.severity).toBe('error');
      expect(en.title).toMatch(/unexpected error/i);
    });
  });

  describe('edge cases & priority', () => {
    it('handles undefined status with empty message → generic', () => {
      const result = categorizeError({ message: '' }, 'fr');
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/erreur inattendue/i);
    });

    it('handles missing message defensively (does not throw)', () => {
      // SanmarErrorContext requires `message`, but real callers occasionally
      // pass `{ status: 500 }` after stripping fields; the matcher uses `??`
      // to coerce undefined → '' so no toLowerCase crash. We assert behaviour
      // via a type cast since the public type forbids missing message.
      expect(() =>
        categorizeError({ status: 500 } as unknown as { message: string }, 'en'),
      ).not.toThrow();
    });

    it('handles empty-string message with known status (status wins)', () => {
      const result = categorizeError({ status: 401, message: '' }, 'en');
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/invalid credentials|permission/i);
    });

    it('priority: 401 status beats coincidental "timeout" keyword in message', () => {
      // Documents the specific→generic walk: status 401 is checked before
      // the timeout keyword block, so a 401 with "timeout" in the body
      // resolves to credentials, not timeout.
      const result = categorizeError(
        { status: 401, message: 'unauthorized after timeout' },
        'en',
      );
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/invalid credentials|permission/i);
    });

    it('priority: "auth" keyword beats coincidental "timeout" keyword', () => {
      // Both keywords present, no status — the auth block runs first.
      const result = categorizeError(
        { message: 'authentication error after timeout' },
        'en',
      );
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/invalid credentials|permission/i);
    });

    it('priority: 5xx status beats coincidental "rate limit" keyword', () => {
      // 5xx is checked before 429/rate-limit, so a 503 mentioning "rate
      // limit" still resolves to service-unavailable (warning).
      const result = categorizeError(
        { status: 503, message: 'rate limit and service unavailable' },
        'en',
      );
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/service unavailable/i);
    });

    it('keyword match is case-insensitive', () => {
      const result = categorizeError({ message: 'TIMEOUT REACHED' }, 'en');
      expect(result.severity).toBe('warning');
      expect(result.title).toMatch(/timed out/i);
    });

    it('status outside known ranges (e.g. 418) falls back to generic', () => {
      const result = categorizeError({ status: 418, message: 'I am a teapot' }, 'en');
      expect(result.severity).toBe('error');
      expect(result.title).toMatch(/unexpected error/i);
    });
  });
});
