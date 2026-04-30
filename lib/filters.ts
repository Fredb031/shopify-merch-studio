import type { BadgeKey, Product, ProductCategory } from './types';

export type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'lead-time';

export type ProductFilters = {
  categories?: ProductCategory[];
  badges?: BadgeKey[];
  colors?: string[];
};

const VALID_CATEGORIES: readonly ProductCategory[] = [
  'polo',
  'tshirt',
  'longsleeve',
  'hoodie',
  'jacket',
  'youth',
];

const VALID_BADGES: readonly BadgeKey[] = [
  'quick-ship',
  'best-embroidery',
  'best-screen-print',
  'heavyweight',
  'kit-friendly',
];

const VALID_SORTS: readonly SortKey[] = [
  'recommended',
  'price-asc',
  'price-desc',
  'lead-time',
];

function isCategory(value: string): value is ProductCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(value);
}

function isBadge(value: string): value is BadgeKey {
  return (VALID_BADGES as readonly string[]).includes(value);
}

function isSort(value: string): value is SortKey {
  return (VALID_SORTS as readonly string[]).includes(value);
}

function splitParam(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function filterProducts(
  products: Product[],
  filters: ProductFilters,
): Product[] {
  const cats = filters.categories ?? [];
  const badges = filters.badges ?? [];
  const colors = filters.colors ?? [];

  const colorsLower = colors.map((c) => c.toLowerCase());

  return products.filter((p) => {
    if (cats.length > 0 && !cats.includes(p.category)) {
      return false;
    }
    if (badges.length > 0) {
      const productBadges = p.badgeKeys ?? [];
      const matches = badges.some((b) => productBadges.includes(b));
      if (!matches) return false;
    }
    if (colorsLower.length > 0) {
      const productHexes = p.colors.map((c) => c.hex.toLowerCase());
      const matches = colorsLower.some((c) => productHexes.includes(c));
      if (!matches) return false;
    }
    return true;
  });
}

export function sortProducts(
  products: Product[],
  sort: SortKey = 'recommended',
): Product[] {
  const copy = [...products];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.priceFromCents - b.priceFromCents);
    case 'price-desc':
      return copy.sort((a, b) => b.priceFromCents - a.priceFromCents);
    case 'lead-time':
      return copy.sort((a, b) => a.leadTimeDays.min - b.leadTimeDays.min);
    case 'recommended':
    default:
      return copy;
  }
}

export type ParsedSearchParams = {
  filters: ProductFilters;
  sort: SortKey;
};

export function parseSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ParsedSearchParams {
  const categoryRaw = splitParam(searchParams['category']);
  const badgeRaw = splitParam(searchParams['badge']);
  const colorRaw = splitParam(searchParams['color']);
  const sortRaw = searchParams['sort'];

  const categories = categoryRaw.filter(isCategory);
  const badges = badgeRaw.filter(isBadge);
  const colors = colorRaw;

  const sortVal = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;
  const sort: SortKey = sortVal && isSort(sortVal) ? sortVal : 'recommended';

  return {
    filters: {
      categories,
      badges,
      colors,
    },
    sort,
  };
}

export function buildSearchString(
  filters: ProductFilters,
  sort: SortKey,
): string {
  const params = new URLSearchParams();
  if (filters.categories && filters.categories.length > 0) {
    params.set('category', filters.categories.join(','));
  }
  if (filters.badges && filters.badges.length > 0) {
    params.set('badge', filters.badges.join(','));
  }
  if (filters.colors && filters.colors.length > 0) {
    params.set('color', filters.colors.join(','));
  }
  if (sort !== 'recommended') {
    params.set('sort', sort);
  }
  const s = params.toString();
  return s.length > 0 ? `?${s}` : '';
}
