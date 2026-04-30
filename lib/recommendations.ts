import type { Product, ProductCategory } from './types';
import { products } from './products';

/**
 * Phase 2 recommendation heuristic — drives both PDP "Often bought together"
 * and cart upsell suggestions. Phase 3 will replace this with real co-purchase
 * data sourced from order history.
 *
 * COMPLEMENTS captures common bundling patterns we already see in quote
 * requests (e.g. tshirt orders frequently include hoodies for layering, polo
 * orders pair with longsleeve for cooler shifts, etc.). Categories not
 * represented in the current catalog are still listed so the map stays
 * forward-compatible as new SKUs land.
 */
const COMPLEMENTS: Record<string, string[]> = {
  tshirt: ['hoodie', 'polo', 'longsleeve'],
  longsleeve: ['hoodie', 'tshirt', 'jacket'],
  hoodie: ['tshirt', 'longsleeve', 'jacket'],
  polo: ['tshirt', 'longsleeve', 'jacket'],
  jacket: ['hoodie', 'longsleeve', 'polo'],
  youth: ['tshirt', 'hoodie'],
};

/**
 * Get up to `limit` products related to the given product.
 * Mixes same-category siblings with complementary-category items so the
 * shopper sees both alternatives and add-on suggestions.
 */
export function getRelatedProducts(
  currentStyleCode: string,
  limit = 4,
): Product[] {
  const current = products.find((p) => p.styleCode === currentStyleCode);
  if (!current) return [];

  const sameCategory = products.filter(
    (p) => p.category === current.category && p.styleCode !== currentStyleCode,
  );

  const complementCategories = COMPLEMENTS[current.category] ?? [];
  const complements = products.filter(
    (p) =>
      complementCategories.includes(p.category) &&
      p.styleCode !== currentStyleCode,
  );

  // Dedupe: a product can match same-category but never both lists at once,
  // since same-category is filtered to current.category and complements is
  // filtered away from current.category. Belt-and-suspenders Set anyway.
  const seen = new Set<string>();
  const merged: Product[] = [];
  for (const p of [...sameCategory.slice(0, 2), ...complements.slice(0, 2)]) {
    if (seen.has(p.styleCode)) continue;
    seen.add(p.styleCode);
    merged.push(p);
  }

  return merged.slice(0, limit);
}

/**
 * Suggest products that complement what's already in the cart, but exclude
 * categories that are already represented (no point upselling another tshirt
 * if there's already a tshirt in the cart).
 */
export function getCartUpsells(
  cartProductIds: string[],
  limit = 3,
): Product[] {
  if (cartProductIds.length === 0) return [];

  const inCartIds = new Set(cartProductIds);
  const inCartCategories = new Set<ProductCategory>(
    products
      .filter((p) => inCartIds.has(p.styleCode))
      .map((p) => p.category),
  );

  const suggestedCategories = new Set<string>();
  for (const cat of inCartCategories) {
    for (const complement of COMPLEMENTS[cat] ?? []) {
      if (!inCartCategories.has(complement as ProductCategory)) {
        suggestedCategories.add(complement);
      }
    }
  }

  return products
    .filter(
      (p) =>
        suggestedCategories.has(p.category) && !inCartIds.has(p.styleCode),
    )
    .slice(0, limit);
}
