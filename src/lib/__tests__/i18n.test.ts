import { describe, it, expect } from 'vitest';
import { translations, t, type Lang } from '../i18n';

// Task 13.7 — Translation validation: missing key = fail build.
//
// A missing key falls back to the French string (see t() in i18n.ts),
// which silently degrades UX for EN users rather than throwing. Empty
// strings render as blank UI with no warning. Both failure modes should
// surface in CI instead of production, so this suite pins the shape of
// the dictionaries: same keys on both sides, non-empty values, and the
// %-placeholder counts match so that formatted strings like
// `commanderPlus: 'Order %d+ for -%d% off'` don't lose an arg in one
// locale but not the other.
describe('translations dictionaries', () => {
  const frKeys = Object.keys(translations.fr).sort();
  const enKeys = Object.keys(translations.en).sort();

  it('fr and en have the exact same set of keys', () => {
    const missingInEn = frKeys.filter((k) => !enKeys.includes(k));
    const missingInFr = enKeys.filter((k) => !frKeys.includes(k));
    expect(missingInEn, `keys present in fr but missing in en: ${missingInEn.join(', ')}`).toEqual([]);
    expect(missingInFr, `keys present in en but missing in fr: ${missingInFr.join(', ')}`).toEqual([]);
  });

  it('no translation value is an empty string', () => {
    const langs: Lang[] = ['fr', 'en'];
    for (const lang of langs) {
      const dict = translations[lang] as Record<string, string>;
      for (const key of Object.keys(dict)) {
        const value = dict[key];
        expect(typeof value, `${lang}.${key} is not a string`).toBe('string');
        expect(value.trim(), `${lang}.${key} is empty`).not.toBe('');
      }
    }
  });

  it('every key has a non-empty string for all langs via t()', () => {
    // Hit the public helper too so fallback logic stays honest: even a
    // future regression where t() returns the key path for a truly
    // absent entry would fail here as long as dict symmetry holds.
    for (const key of frKeys) {
      for (const lang of ['fr', 'en'] as Lang[]) {
        const out = t(lang, key as Parameters<typeof t>[1]);
        expect(out, `${lang}.${key} via t() is empty`).toBeTruthy();
        expect(typeof out).toBe('string');
      }
    }
  });

  it('%d/%s placeholder counts match between fr and en', () => {
    // If one locale has `Order %d+ for -%d%` and the other drops a %d,
    // the formatter silently leaves a stray %d in the UI. Catch drift.
    const count = (s: string, token: string) => s.split(token).length - 1;
    for (const key of frKeys) {
      const frVal = (translations.fr as Record<string, string>)[key];
      const enVal = (translations.en as Record<string, string>)[key];
      expect(count(enVal, '%d'), `%d count mismatch on ${key}`).toBe(count(frVal, '%d'));
      expect(count(enVal, '%s'), `%s count mismatch on ${key}`).toBe(count(frVal, '%s'));
    }
  });
});
