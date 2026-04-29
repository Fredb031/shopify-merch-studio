/**
 * NFD diacritic-strip + lowercase normalizer.
 *
 * Used by: search index/queries, color name matching, admin table search,
 * autocomplete highlight, AI chat KB, etc.
 *
 * Contract: every consumer (producer + matcher) must run input through this
 * exact same function so that a French query "ecran" matches "Écran" in the
 * haystack. Originally added piecemeal in commits 2a831fb (searchIndex),
 * 8797ad5 (search/synonyms), 1e7268d (colorMap), 98eeadc (Highlight),
 * 4f11109 (aiKnowledgeBase), 3a536ec (AdminClients), c2873fa (AdminProducts),
 * 121d713 (QuoteList), 2906d98 (CommandPalette) — extracted here to prevent
 * drift between producer and consumer.
 *
 * For Highlight.tsx's per-codepoint walk variant, use normalizeChar() which
 * decomposes a single character so the posMap can stay byte-aligned with the
 * original.
 */

// Combining-mark range U+0300–U+036F. Stored as a single shared instance so
// every consumer references the same source of truth — but note that this
// regex carries the `g` flag and therefore stateful `lastIndex`; consumers
// that need a stateless predicate should use `.replace(DIACRITICS_REGEX, '')`
// (which resets state internally) rather than `.test()`.
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Strip diacritics + lowercase a string. Idempotent for already-normalised
 * input (no combining marks, all lowercase) so it's safe to call twice.
 */
export function normalize(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/**
 * Per-character variant for callers (Highlight.tsx) that walk the original
 * string codepoint-by-codepoint to keep a `posMap` aligned with the source.
 * Implementation is intentionally identical to {@link normalize} — exposing
 * a separate name documents intent at the call site and lets us evolve the
 * per-char path independently if we ever need to.
 */
export function normalizeChar(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

// Re-export the regex for the rare case a consumer needs the raw class
// (e.g. Highlight.tsx's posMap walk). This is the SAME RegExp instance the
// `normalize()` helpers use, so the source-of-truth lives in one place.
export { COMBINING_MARKS as DIACRITICS_REGEX };
