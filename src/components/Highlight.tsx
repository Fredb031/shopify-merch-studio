/**
 * Highlight — wraps every case-insensitive, accent-insensitive
 * occurrence of `query` inside `text` with a <mark> using a gold tint.
 * Task 2.18.
 *
 * Scanning a grid of results after typing "shirt" gave the user no
 * visual signal for WHICH part of each title matched — the eye had to
 * re-parse every card. This component surfaces the match inline.
 *
 * Behaviour:
 *  - Empty / whitespace-only query → returns plain text (no <mark>).
 *  - Non-string text/query (e.g. accidental null/undefined leaking
 *    through from upstream API data) → returns plain text rather than
 *    throwing on `.trim()` / `.replace()`.
 *  - Query special chars are regex-escaped so a user typing ".",
 *    "(", "+", etc. doesn't blow up the RegExp constructor or match
 *    unintended characters.
 *  - Match is case-insensitive AND diacritic-insensitive: a query of
 *    "ecran" highlights inside "Écran", "creme" inside "Crème", etc.
 *    This mirrors the NFD-strip + lowercase contract used by
 *    src/lib/search.ts (2a831fb), src/lib/searchIndex.ts and
 *    src/lib/colorMap.ts (1e7268d). Without this, search hits arrive
 *    on the result list (because the index normalises) but the
 *    Highlight finds nothing — the user sees a card with no visible
 *    match and assumes the search is broken. The ORIGINAL casing AND
 *    diacritics from `text` are preserved inside the <mark> (we slice
 *    by index in the original string via a position map, not by
 *    splicing the normalised form).
 *  - Zero-width matches (which shouldn't happen after the empty-query
 *    guard, but defensively) are skipped so we don't infinite-loop.
 *  - Ridiculously long text (>10k chars) is rendered as plain text —
 *    this component lives in product cards & search rows, anything
 *    that big is almost certainly a bug upstream and we don't want to
 *    burn CPU regex-scanning a novel.
 *  - Result is memoised on (text, query) so a parent re-render that
 *    leaves both props stable reuses the previous parts array instead
 *    of running the regex scan again — meaningful when a search grid
 *    re-renders for an unrelated state change.
 */
import { useMemo } from 'react';
import { normalizeChar } from '@/lib/normalize';

interface HighlightProps {
  text: string;
  query: string;
}

// Belt-and-braces cap. The hot path renders Highlight once per card in
// a grid, so a runaway string would multiply across the viewport.
const MAX_TEXT_LEN = 10_000;

// Escape the 12 regex metacharacters so user input like "t-shirt (v2)"
// matches literally instead of being interpreted as a pattern.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip diacritics + lowercase `text`, AND emit a parallel `posMap`
 * such that `posMap[i]` is the index in the ORIGINAL string at which
 * the i-th character of the stripped form begins. `posMap` always has
 * one extra trailing entry equal to original length, so a slice that
 * ends at `posMap[strippedLen]` is well-defined.
 *
 * Why per-base-codepoint rather than naive `.normalize().replace()`:
 * `'café'` is a single precomposed codepoint (U+00E9) of length 1, but
 * after NFD it's `'café'` of length 5. Stripping combining marks
 * gives `'cafe'` — its index 3 corresponds to original index 3, which
 * works here, but `'éfoo'` (length 4) decomposes to length 5 and
 * strips to length 4: the mapping from stripped index back to original
 * index is no longer the identity. We therefore walk the original
 * codepoint-by-codepoint (NOT the decomposed form) so each base char
 * we emit maps to a known original index.
 */
function buildNormalized(text: string): { norm: string; posMap: number[] } {
  let norm = '';
  const posMap: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    // Decompose this single char, strip combining marks, and lowercase
    // via the canonical helper in src/lib/normalize.ts so this module
    // shares a source of truth with searchIndex.ts / search.ts /
    // colorMap.ts. Most Latin chars are 1:1; precomposed accented
    // letters become base+mark(s) and we keep only the base. The shape
    // of the per-codepoint walk is preserved: we still emit one posMap
    // entry per produced output char so a slice of the ORIGINAL string
    // by stripped index lands on the right boundary.
    const lower = normalizeChar(ch);
    if (lower.length === 0) {
      // Pure combining mark in the original (rare — would happen if
      // upstream data is already decomposed). Skip; it folds into the
      // previous base char's normalised representation.
      continue;
    }
    for (let j = 0; j < lower.length; j++) {
      norm += lower[j];
      posMap.push(i);
    }
  }
  posMap.push(text.length);
  return { norm, posMap };
}

export function Highlight({ text, query }: HighlightProps) {
  const parts = useMemo<Array<string | JSX.Element>>(() => {
    // Defensive coercion — TS says these are strings but upstream data
    // (product titles, search hits) occasionally arrives null when an
    // API field is missing. Bail to a single string rather than crash.
    if (typeof text !== 'string' || typeof query !== 'string') {
      return [typeof text === 'string' ? text : ''];
    }
    if (text.length > MAX_TEXT_LEN) return [text];
    const q = query.trim();
    if (!q || !text) return [text];

    // Normalise BOTH sides to the same NFD-stripped lowercase form so
    // an FR query like "ecran" can find "Écran" — mirrors the search
    // index contract. We slice the ORIGINAL text via posMap so the
    // <mark> shows accents/case as the user expects.
    const { norm: normText, posMap } = buildNormalized(text);
    const { norm: normQuery } = buildNormalized(q);
    if (!normQuery || !normText) return [text];

    const escaped = escapeRegex(normQuery);
    let re: RegExp;
    try {
      // Already lowercased by buildNormalized, but keep the `i` flag
      // as a belt-and-braces guard against any non-Latin casing edge
      // case where toLowerCase() isn't fully idempotent.
      re = new RegExp(escaped, 'gi');
    } catch {
      // Escaping should make this unreachable, but if the RegExp
      // constructor somehow throws, bail to plain text rather than
      // crashing the whole product card.
      return [text];
    }

    const out: Array<string | JSX.Element> = [];
    let lastOrigIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(normText)) !== null) {
      // Defensive guard against zero-width matches causing an infinite
      // loop. The empty-query check above should prevent this, but an
      // exotic input could still produce a 0-width regex.
      if (match.index === re.lastIndex) {
        re.lastIndex++;
        continue;
      }
      const startOrig = posMap[match.index];
      const endOrig = posMap[match.index + match[0].length];
      if (startOrig > lastOrigIndex) {
        out.push(text.slice(lastOrigIndex, startOrig));
      }
      out.push(
        <mark
          key={key++}
          className="bg-[#E8A838]/25 text-inherit rounded-sm px-0.5"
        >
          {text.slice(startOrig, endOrig)}
        </mark>,
      );
      lastOrigIndex = endOrig;
    }
    if (lastOrigIndex < text.length) {
      out.push(text.slice(lastOrigIndex));
    }
    return out;
  }, [text, query]);

  return <>{parts}</>;
}
