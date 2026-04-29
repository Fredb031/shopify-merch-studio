import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { findProductByHandle } from '@/data/products';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLang } from '@/lib/langContext';
import { AIChat } from '@/components/AIChat';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Master Prompt clean grid layout. Categories match the seven uniform
// types named in the brief: Tous / T-shirts / Hoodies / Polos /
// Casquettes / Tuques / Vestes. Search-tuning constants stay in
// searchIndex; this page filters in-memory by category + free text.
const CATEGORIES: Array<{ id: string; fr: string; en: string }> = [
  { id: 'overview',   fr: 'Tous',        en: 'All' },
  { id: 'tshirts',    fr: 'T-shirts',    en: 'T-shirts' },
  { id: 'hoodies',    fr: 'Hoodies',     en: 'Hoodies' },
  { id: 'polos',      fr: 'Polos',       en: 'Polos' },
  { id: 'casquettes', fr: 'Casquettes',  en: 'Caps' },
  { id: 'tuques',     fr: 'Tuques',      en: 'Beanies' },
  { id: 'vestes',     fr: 'Vestes',      en: 'Jackets' },
];

const KNOWN_CATS = new Set(CATEGORIES.map(c => c.id));

function matchesCategory(
  product: { node: { handle: string; productType: string; title: string } },
  catId: string,
): boolean {
  const handle = product?.node?.handle;
  if (!handle) return false;
  const local = findProductByHandle(handle);
  if (!local) return false;
  switch (catId) {
    case 'tshirts':    return ['tshirt', 'longsleeve', 'sport'].includes(local.category);
    case 'hoodies':    return ['hoodie', 'crewneck'].includes(local.category);
    case 'polos':      return local.category === 'polo';
    case 'casquettes': return local.category === 'cap';
    case 'tuques':     return local.category === 'toque';
    case 'vestes':     return (local as { category: string }).category === 'jacket';
    default:           return true;
  }
}

export default function Products() {
  const { lang } = useLang();
  const { data: products, isLoading, isError, refetch } = useProducts();
  const [cartOpen, setCartOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawCat = searchParams.get('cat');
  const initialCat = rawCat && KNOWN_CATS.has(rawCat) ? rawCat : 'overview';

  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  // URL <-> state sync. Category + free-text query round-trip through
  // ?cat= and ?q= so deep-links and browser history Just Work.
  useEffect(() => {
    const curCat = searchParams.get('cat') ?? 'overview';
    const curQ = searchParams.get('q') ?? '';
    const trimmedQ = debouncedQuery.trim();
    if (activeCategory === curCat && trimmedQ === curQ) return;
    const next = new URLSearchParams(searchParams);
    if (activeCategory === 'overview') next.delete('cat');
    else next.set('cat', activeCategory);
    if (trimmedQ === '') next.delete('q');
    else next.set('q', trimmedQ);
    setSearchParams(next, { replace: true });
  }, [activeCategory, debouncedQuery, searchParams, setSearchParams]);

  useEffect(() => {
    const urlCatRaw = searchParams.get('cat') ?? 'overview';
    const urlCat = KNOWN_CATS.has(urlCatRaw) ? urlCatRaw : 'overview';
    const urlQ = searchParams.get('q') ?? '';
    if (urlCat !== activeCategory) setActiveCategory(urlCat);
    if (urlQ !== debouncedQuery.trim()) setSearchQuery(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Catalog-specific meta description. Bilingual swap on EN toggle.
  // Master Prompt SEO: 50-60 char title with category bouquet, outcome-
  // first description mentioning the 5-day SLA + 1-piece minimum.
  useDocumentTitle(
    lang === 'en'
      ? 'Shop uniforms · Vision Affichage'
      : 'Boutique uniformes · Vision Affichage',
    lang === 'en'
      ? 'Browse t-shirts, polos, hoodies and jackets. Customize with your logo, printed in Quebec, delivered in 5 business days. Starting at 1 piece.'
      : 'Parcours t-shirts, polos, hoodies et vestes. Personnalise avec ton logo, imprimé au Québec, livré en 5 jours ouvrables. À partir d\u2019une pièce.',
    {},
  );

  const clearAllFilters = () => {
    setActiveCategory('overview');
    setSearchQuery('');
  };

  // SEARCH_TUNING-aligned in-memory filter: category gate first, then
  // free-text on title/handle. NFD normalization lives in searchIndex
  // for the navbar dropdown; here we keep the page-local filter
  // straightforward — same behaviour as the previous version.
  const filteredProducts = useMemo(() => {
    try {
      if (!products || !Array.isArray(products)) return [];
      const safeProducts = products.filter(p => p && p.node && typeof p.node === 'object');
      let result = activeCategory === 'overview'
        ? safeProducts
        : safeProducts.filter(p => {
            try {
              return matchesCategory(p, activeCategory);
            } catch {
              return false;
            }
          });
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase();
        result = result.filter(p => {
          const title = p?.node?.title ?? '';
          const handle = p?.node?.handle ?? '';
          return title.toLowerCase().includes(q) || handle.toLowerCase().includes(q);
        });
      }
      return result;
    } catch {
      return [];
    }
  }, [products, activeCategory, debouncedQuery]);

  // Screen-reader live count — pattern from bb8633f (sr-only region).
  const liveRegionMessage = useMemo(() => {
    if (isLoading) {
      return lang === 'en' ? 'Loading products…' : 'Chargement des produits…';
    }
    const count = filteredProducts.length;
    const trimmed = debouncedQuery.trim();
    if (count === 0 && trimmed) {
      return lang === 'en'
        ? `No results for « ${trimmed} »`
        : `Aucun résultat pour « ${trimmed} »`;
    }
    if (count === 0) return '';
    return lang === 'en'
      ? `${count} ${count === 1 ? 'product' : 'products'} shown`
      : `${count} ${count === 1 ? 'produit affiché' : 'produits affichés'}`;
  }, [isLoading, filteredProducts, debouncedQuery, lang]);

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-va-bg-1 focus:outline-none">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveRegionMessage}
      </div>

      {/* ============================================================
          1. TOP STRIP — minimal eyebrow + display H1, no hero noise.
          ============================================================ */}
      <section className="bg-va-bg-1 px-6 md:px-10 pt-28 pb-10 md:pb-14">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-va-muted text-xs uppercase tracking-[0.15em] font-semibold mb-3">
            {lang === 'en' ? 'Shop' : 'Boutique'}
          </div>
          <h1 className="font-display font-black text-va-ink text-4xl md:text-6xl tracking-[-0.03em] leading-[1.02]">
            {lang === 'en' ? 'Pick your uniform.' : 'Choisis ton uniforme.'}
          </h1>
        </div>
      </section>

      {/* ============================================================
          2. STICKY FILTER ROW — category pill chips, top-16.
          ============================================================ */}
      <div className="sticky top-16 z-30 bg-va-bg-1/95 backdrop-blur-md border-b border-va-line">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-3">
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:flex-wrap md:overflow-visible md:snap-none"
            role="tablist"
            aria-label={lang === 'en' ? 'Product categories' : 'Catégories de produits'}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap snap-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-va-ink text-white'
                      : 'bg-va-bg-2 text-va-dim hover:bg-va-bg-3'
                  }`}
                >
                  {lang === 'en' ? cat.en : cat.fr}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================
          3. GRID + STATES.
          ============================================================ */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 pb-32">
        {isLoading ? (
          <div
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8"
            role="status"
            aria-live="polite"
            aria-label={lang === 'en' ? 'Loading products' : 'Chargement des produits'}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="va-skel-card border border-va-line rounded-[18px] overflow-hidden bg-va-bg-1"
                aria-hidden="true"
              >
                <div className="va-skel-block bg-va-bg-2" style={{ aspectRatio: '1' }} />
                <div className="p-3.5 pb-4">
                  <div className="va-skel-block h-3 w-3/4 rounded bg-va-bg-2 mb-2" />
                  <div className="va-skel-block h-2.5 w-1/2 rounded bg-va-bg-2 mb-3" />
                  <div className="va-skel-block h-3 w-1/3 rounded bg-va-bg-2" />
                </div>
              </div>
            ))}
            <span className="sr-only">{lang === 'en' ? 'Loading products…' : 'Chargement des produits…'}</span>
            <style>{`
              @keyframes va-skel-shimmer {
                0%   { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
              .va-skel-block {
                background-image: linear-gradient(
                  90deg,
                  #F8F7F4 0%,
                  #F3F2EF 50%,
                  #F8F7F4 100%
                );
                background-size: 200% 100%;
                animation: va-skel-shimmer 1.4s ease-in-out infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .va-skel-block { animation: none; background-image: none; }
              }
            `}</style>
          </div>
        ) : isError ? (
          <div className="text-center py-20" role="alert">
            <h2 className="font-display font-bold text-2xl text-va-ink mb-2">
              {lang === 'en' ? 'Couldn’t load the catalog' : 'Impossible de charger le catalogue'}
            </h2>
            <p className="text-va-muted mb-5">
              {lang === 'en'
                ? 'Check your connection and try again.'
                : 'Vérifie ta connexion et réessaie.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="bg-va-blue text-white px-6 py-3 rounded-xl font-semibold hover:bg-va-blue-h transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Retry' : 'Réessayer'}
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="font-display font-bold text-2xl text-va-ink mb-2">
              {lang === 'en'
                ? 'No product in this category.'
                : 'Aucun produit dans cette catégorie.'}
            </h2>
            <p className="text-va-muted mb-6">
              {lang === 'en'
                ? 'Reset the filters to see the full inventory.'
                : 'Réinitialise les filtres pour voir l’inventaire complet.'}
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="bg-va-blue text-white px-6 py-3 rounded-xl font-semibold hover:bg-va-blue-h transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Reset filters' : 'Réinitialiser les filtres'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {filteredProducts.map((product, i) => {
                const key = product?.node?.id ?? product?.node?.handle ?? `idx-${i}`;
                try {
                  return (
                    <ProductCard
                      key={key}
                      product={product}
                      eager={i < 4}
                      highlight={debouncedQuery}
                    />
                  );
                } catch {
                  return null;
                }
              })}
            </div>

            {/* Stats row below grid. */}
            <p className="mt-12 text-va-muted text-sm text-center">
              {lang === 'en'
                ? `${filteredProducts.length} products · 5-day delivery · starting at one piece`
                : `${filteredProducts.length} produits · livraison en 5 jours · à partir d’une pièce`}
            </p>
          </>
        )}
      </div>

      <AIChat />
      <BottomNav />
    </div>
  );
}
