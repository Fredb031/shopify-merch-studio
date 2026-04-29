import { describe, it, expect } from 'vitest';
import { normalize } from '../normalize';

// The site speaks French + English in the same UI: shoppers paste SKUs,
// French admins type accent-stripped queries on phones with no compose
// keys, and the Quebec catalogue is full of "Écran" / "Crème" / "Café"
// / "Saint-Jean-sur-Richelieu". The producer (search index, color map,
// admin tables) and the matcher (search query, palette filter) must
// both pass strings through this exact helper or .includes() silently
// returns false on every accented row. This test pins the contract so
// a refactor can't drift the producer/matcher pair without flagging.
describe('normalize', () => {
  it('strips combining acute on Café → cafe', () => {
    expect(normalize('Café')).toBe('cafe');
  });

  it('strips combining acute on Écran → ecran (uppercase decomposes too)', () => {
    expect(normalize('Écran')).toBe('ecran');
  });

  it('strips circumflex inside a multi-word phrase: Bleu pâle → bleu pale', () => {
    expect(normalize('Bleu pâle')).toBe('bleu pale');
  });

  it('preserves hyphens in compound place names: Saint-Jean-sur-Richelieu', () => {
    expect(normalize('Saint-Jean-sur-Richelieu')).toBe('saint-jean-sur-richelieu');
  });

  it('strips multiple acutes: Frédérick → frederick', () => {
    expect(normalize('Frédérick')).toBe('frederick');
  });

  it('passes emoji through unchanged: "🎉 Café" → "🎉 cafe"', () => {
    // Emojis are outside the combining-mark range and outside the Latin
    // case map, so they survive NFD + lowercase intact. Important — the
    // chat KB and product titles occasionally contain emoji and we don't
    // want them stripped along with the diacritics.
    expect(normalize('🎉 Café')).toBe('🎉 cafe');
  });

  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });

  it('is idempotent on already-normalised input: "cafe" → "cafe"', () => {
    // Calling normalize twice must not change the result — consumers
    // sometimes route a value through the helper at both producer and
    // matcher sites, and the second pass should be a no-op.
    expect(normalize('cafe')).toBe('cafe');
    expect(normalize(normalize('Café'))).toBe('cafe');
  });
});
