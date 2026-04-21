// Task 13.5 — Intl.PluralRules helper.
// ----------------------------------------------------------------------------
// Count-based UI strings ("N produits", "1 article", "0 items") were being
// hand-forked across Products.tsx, Cart.tsx, WishlistGrid.tsx, ProductCard.tsx
// and AdminCustomers.tsx. Each site reinvented the same `count !== 1 ? 's' :
// ''` ternary, sometimes with subtle drift (e.g. the FR "disponible" concord
// vs. the EN plural-only noun). This helper routes every site through
// Intl.PluralRules so the locale picks the form — fr-CA groups 0 and 1 under
// `one`, en-CA reserves `one` strictly for 1, and future locales plug in
// without touching call sites.
//
// `{count}` in the returned string is replaced with the numeric count so the
// number lives inside the phrase rather than adjacent to it — gives callers
// the option of "1 article" or "article unique" / "1 item" without rewiring.

export type PluralLang = 'fr' | 'en';

export interface PluralForms {
  one: string;
  other: string;
  // Optional categories. `zero`/`few`/`many` aren't emitted by Intl for fr/en
  // integers, but we accept them as explicit overrides (e.g. copy wants a
  // distinct empty-state string like "Aucun article" for count=0).
  zero?: string;
  few?: string;
  many?: string;
}

// Cache Intl.PluralRules instances. Construction isn't free and we hit this
// on every render of any list-count string.
const pluralRulesCache = new Map<PluralLang, Intl.PluralRules>();

function getPluralRules(lang: PluralLang): Intl.PluralRules {
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, rules);
  }
  return rules;
}

/**
 * Resolve the correct plural form for `count` in `lang`, then substitute
 * `{count}` with the numeric count.
 *
 * Callers can short-circuit a specific cardinal by passing `zero`. The
 * helper checks `zero` first when the count is exactly 0 so copy like
 * "Aucun article" wins over the generic plural form.
 */
export function plural(
  count: number,
  forms: PluralForms,
  lang: PluralLang = 'fr',
): string {
  // Explicit zero override wins regardless of what Intl decides — fr/en
  // both bucket 0 under `one`/`other` respectively, so a caller that wants
  // a distinct empty-state string has no other way to hook it.
  if (count === 0 && forms.zero != null) {
    return forms.zero.replace('{count}', String(count));
  }

  const category = getPluralRules(lang).select(count);
  // Prefer the named category if the caller supplied it; otherwise fall
  // back through `other` (always defined). This keeps FR `many` (large
  // numbers in some locales) routable without forcing every call site to
  // define it.
  const template =
    (category === 'zero' && forms.zero) ||
    (category === 'one' && forms.one) ||
    (category === 'two' && forms.other) ||
    (category === 'few' && forms.few) ||
    (category === 'many' && forms.many) ||
    forms.other;

  return template.replace('{count}', String(count));
}
