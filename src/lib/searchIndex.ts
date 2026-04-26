/**
 * searchIndex.ts — in-memory product search index.
 *
 * Volume II §2.1. Builds a flat `SearchIndex[]` from `PRODUCTS` with the
 * exact shape called out in the brief: sku, typeName (FR), typeNameEn,
 * category, colors (FR + EN names), tags, href, image. The index is
 * computed once at module load — products.ts is a static source so there's
 * no value in rebuilding per query, and ~25 products * ~15 colors stays
 * well under any "do this work in a worker" threshold.
 *
 * Defensive fallbacks: if a product lacks one of the optional fields
 * (shortName missing, no imageDevant, etc.) we substitute a sensible
 * default so search() never crashes on malformed records — the catalog
 * gets edited by hand and an over-strict index would silently hide a
 * product the moment a teammate forgot a field.
 */
import { PRODUCTS, type Product } from '@/data/products';

export interface SearchIndexEntry {
  /** Lowercase SKU, used as stable id */
  sku: string;
  /** French short/display name — what shoppers see in the dropdown */
  typeName: string;
  /** English name — matched when query is in English */
  typeNameEn: string;
  /** Product category (tshirt, hoodie, etc.) — also a search token */
  category: string;
  /** All color names, FR + EN, lowercased — for "rouge"/"red" lookups */
  colors: string[];
  /** Number of color variants — surfaced in the dropdown ("12 couleurs") */
  colorCount: number;
  /** Free-form tags compiled from features + gender + category */
  tags: string[];
  /** Route to the product detail page */
  href: string;
  /** Thumbnail src for the dropdown row */
  image: string;
  /** Lowest possible price (basePrice) — drives the "À partir de Xs" line */
  basePrice: number;
  /** Pre-flattened lowercase haystack — search.ts reads this for scoring */
  haystack: string;
}

export type SearchIndex = SearchIndexEntry[];

/**
 * Build a single index entry from a Product. Pure, no side effects, and
 * tolerant of missing optional fields so a half-filled product still
 * shows up in search rather than disappearing.
 */
function buildEntry(p: Product): SearchIndexEntry {
  const typeName = p.shortName || p.name || p.sku;
  // ATC catalogue is bilingual but Product.shortName is always FR. We
  // derive a serviceable English label by mapping the category — good
  // enough for English queries to score against, without forcing a
  // second translation column on every product row.
  const categoryEnMap: Record<string, string> = {
    tshirt:     'T-shirt',
    hoodie:     'Hoodie',
    crewneck:   'Crewneck sweater',
    polo:       'Polo',
    longsleeve: 'Long sleeve',
    sport:      'Sport jersey',
    cap:        'Cap',
    toque:      'Beanie',
  };
  const typeNameEn = categoryEnMap[p.category] ?? typeName;

  const colorNamesFr = (p.colors ?? []).map(c => (c.name || '').toLowerCase());
  const colorNamesEn = (p.colors ?? []).map(c => (c.nameEn || '').toLowerCase());
  const colors = Array.from(new Set([...colorNamesFr, ...colorNamesEn].filter(Boolean)));

  const tags = Array.from(new Set([
    p.category,
    p.gender,
    ...(p.features ?? []).map(f => f.toLowerCase()),
  ].filter(Boolean)));

  const image = p.imageDevant || p.imageDos || '/placeholder.svg';
  const href = `/product/${p.shopifyHandle || p.id}`;

  // The haystack is a single lowercase string we scan for partial
  // matches — assembling it once per product is far cheaper than the
  // alternative of looping over every field on every keystroke.
  const haystack = [
    p.sku,
    typeName,
    typeNameEn,
    p.category,
    p.gender,
    ...colors,
    ...tags,
  ].join(' ').toLowerCase();

  return {
    sku: p.sku.toLowerCase(),
    typeName,
    typeNameEn,
    category: p.category,
    colors,
    colorCount: (p.colors ?? []).length,
    tags,
    href,
    image,
    basePrice: p.basePrice ?? 0,
    haystack,
  };
}

/** Computed once at module load — see file header for rationale. */
export const SEARCH_INDEX: SearchIndex = PRODUCTS.map(buildEntry);
