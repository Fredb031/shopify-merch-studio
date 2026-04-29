/**
 * Compare — Volume II §15.1.
 *
 * Renders the side-by-side comparison table for the SKUs flagged via
 * compareStore. The brief's COMPARE_FIELDS:
 *   Image / Nom / Prix / Matière / Poids / Couleurs / Tailles /
 *   Idéal pour / Coupe / Lavage / Garantie / CTA
 *
 * data/products.ts only exposes a subset directly (image, name,
 * price, colors, sizes, description, features). Material / weight /
 * fit / care / warranty aren't first-class fields — we extract what
 * we can from `description` + `features` strings, falling back to
 * "—" gracefully so the row is still readable.
 *
 * Lazy-loaded from App.tsx; the customizer's fabric.js dependency
 * never enters the bundle for users who only want to compare specs.
 *
 * Visual: Master Prompt Audi system — `va.*` tokens, Syne display
 * for headers, neutral cool surface (`va-bg-2`) on table head, Audi
 * blue (`va-blue`) for primary actions. Stale-SKU reconciler from
 * commit 7a78b85 preserved verbatim.
 */
import { useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useCompareStore } from '@/lib/compareStore';
import { PRODUCTS, PRINT_PRICE, type Product } from '@/data/products';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { categoryLabel } from '@/lib/productLabels';
import { fmtMoney } from '@/lib/format';
import { filterRealColors } from '@/lib/colorFilter';

// Customizer pulls in fabric.js (~310kB). Same lazy strategy as
// ProductCard — only fetch the chunk if the user actually clicks
// "Personnaliser" from a row.
const ProductCustomizer = lazy(() =>
  import('@/components/customizer/ProductCustomizer').then(m => ({ default: m.ProductCustomizer })),
);

const DASH = '—';

/** Best-effort weight extractor — looks for "9.1 oz", "13 oz",
 * "250 g/m²" patterns in either description or features text.
 * Returns DASH when nothing matches so the table cell stays aligned. */
function extractWeight(p: Product): string {
  const haystack = `${p.description} ${p.features.join(' ')}`;
  const oz = haystack.match(/(\d+(?:[,.]\d+)?)\s*oz/i);
  if (oz) return `${oz[1].replace(',', '.')} oz`;
  const gsm = haystack.match(/(\d{2,4})\s*g\/m[²2]?/i);
  if (gsm) return `${gsm[1]} g/m²`;
  return DASH;
}

/** Material extractor — pulls "100% coton", "polyester", "ringspun"-
 * style clues out of description. Falls back to DASH. */
function extractMaterial(p: Product, lang: 'fr' | 'en'): string {
  const haystack = `${p.description} ${p.features.join(' ')}`;
  const ringspun = /ringspun|ring spun/i.test(haystack);
  const cotton = /\bcoton\b|\bcotton\b/i.test(haystack);
  const poly = /polyester/i.test(haystack);
  const tech = /technique|performance|évacuation|wicking/i.test(haystack);
  const french = /french terry|molleton/i.test(haystack);
  const parts: string[] = [];
  if (cotton) parts.push(lang === 'en' ? 'Cotton' : 'Coton');
  if (ringspun) parts.push(lang === 'en' ? 'ringspun' : 'ringspun');
  if (poly) parts.push(lang === 'en' ? 'Polyester' : 'Polyester');
  if (tech) parts.push(lang === 'en' ? 'Technical' : 'Technique');
  if (french) parts.push(lang === 'en' ? 'French Terry' : 'French Terry');
  if (parts.length === 0) return DASH;
  return parts.join(', ');
}

/** Care label — shared default across the catalogue. Shopify product
 * imports don't carry per-SKU laundry codes, so the merchandise sheet
 * locks the "Lavage à froid, séchage à basse température" baseline. */
function careLabel(lang: 'fr' | 'en'): string {
  return lang === 'en'
    ? 'Cold wash, tumble low'
    : 'Lavage à froid, séchage basse';
}

/** Warranty — every Vision Affichage product ships with the same
 * "Satisfaction garantie 30 jours" promise per Volume II §10. */
function warrantyLabel(lang: 'fr' | 'en'): string {
  return lang === 'en' ? '30-day satisfaction' : 'Satisfaction 30 jours';
}

/** Ideal-for inference from category. Mirrors the "idéal pour" copy
 * in product descriptions where present, otherwise infers a sensible
 * use case from the category alone. */
function idealForLabel(p: Product, lang: 'fr' | 'en'): string {
  const m = p.description.match(/Id[éeè]al pour ([^.]+)\./i);
  if (m) return m[1].trim();
  const en = p.description.match(/Ideal for ([^.]+)\./i);
  if (en) return en[1].trim();
  // Per-category fallback — short, scannable.
  switch (p.category) {
    case 'tshirt':     return lang === 'en' ? 'Teams, events, uniforms' : 'Équipes, événements, uniformes';
    case 'hoodie':     return lang === 'en' ? 'Worksites, cool weather' : 'Chantiers, temps frais';
    case 'crewneck':   return lang === 'en' ? 'Layering, casual teams' : 'Superposition, équipes';
    case 'polo':       return lang === 'en' ? 'Corporate, reception' : 'Corporatif, réception';
    case 'longsleeve': return lang === 'en' ? 'Outdoor, autumn-winter' : 'Extérieur, automne-hiver';
    case 'sport':      return lang === 'en' ? 'Sports teams, racing' : 'Équipes sportives, courses';
    case 'cap':        return lang === 'en' ? 'Outdoor, branded swag' : 'Extérieur, articles promotionnels';
    case 'toque':      return lang === 'en' ? 'Winter, outdoor crews' : 'Hiver, équipes extérieures';
    default:           return DASH;
  }
}

/** Fit / coupe — pulls the word from description when present
 * ("coupe ajustée", "coupe classique", "coupe athlétique"). */
function fitLabel(p: Product, lang: 'fr' | 'en'): string {
  const m = p.description.match(/coupe (\w+(?:e?s?))/i);
  if (m) {
    const word = m[1].toLowerCase();
    if (lang === 'en') {
      if (word.startsWith('ajust')) return 'Fitted';
      if (word.startsWith('classi')) return 'Classic';
      if (word.startsWith('athl'))  return 'Athletic';
      if (word.startsWith('struct')) return 'Structured';
      // Unknown French fit word — fall back to the neutral EN default
      // rather than leaking "Coupe <french>" into the English table.
      return 'Regular';
    }
    return `Coupe ${word}`;
  }
  return lang === 'en' ? 'Regular' : 'Régulière';
}

export default function Compare() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const items = useCompareStore(s => s.items);
  const remove = useCompareStore(s => s.remove);
  const [customizerProductId, setCustomizerProductId] = useState<string | null>(null);

  useDocumentTitle(
    lang === 'en' ? 'Compare · Vision Affichage' : 'Comparer · Vision Affichage',
    lang === 'en'
      ? 'Compare Vision Affichage products side by side — material, weight, colors, sizes, fit, care, warranty.'
      : 'Comparez les produits Vision Affichage côte à côte — matière, poids, couleurs, tailles, coupe, lavage, garantie.',
  );

  // Memoise the items → products derivation so a parent state change
  // (customizer open/close) doesn't re-walk PRODUCTS once per `items`
  // entry on every render. The compare list is usually 2-3 SKUs but
  // PRODUCTS.find is O(n) per lookup, so this becomes O(items × PRODUCTS)
  // every paint without memoisation. items + PRODUCTS are both stable
  // references between renders, so the memo cache hits on every
  // unrelated re-render and the table's row computations downstream
  // (extractMaterial / extractWeight / fitLabel) skip too.
  const products = useMemo(
    () =>
      items
        .map(sku => PRODUCTS.find(p => p.sku === sku))
        .filter((p): p is Product => Boolean(p)),
    [items],
  );

  // Self-heal: if compareStore holds stale SKUs (retired catalogue entries
  // persisted in localStorage from a prior catalogue version), silently
  // purge them so the store and rendered table stay in lock-step. Without
  // this, users see "3 items in compare" globally but only 1-2 rows here,
  // and `Clear all` is the only escape. (commit 7a78b85)
  useEffect(() => {
    if (items.length === products.length) return;
    const valid = new Set(PRODUCTS.map(p => p.sku));
    items.forEach(sku => {
      if (!valid.has(sku)) remove(sku);
    });
  }, [items, products.length, remove]);

  if (products.length === 0) {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] max-w-6xl mx-auto px-4 py-16">
          <div className="mb-10">
            <div className="text-va-muted text-xs uppercase tracking-[0.15em]">
              {lang === 'en' ? 'Compare' : 'Comparateur'}
            </div>
            <h1 className="font-display font-black text-va-ink text-4xl md:text-5xl tracking-[-0.03em] mt-2">
              {lang === 'en'
                ? 'The right uniform for your crew.'
                : 'Le bon uniforme pour ton équipe.'}
            </h1>
          </div>
          <div className="bg-va-bg-2 rounded-2xl p-12 text-center max-w-2xl mx-auto">
            <h2 className="font-display font-bold text-va-ink text-2xl md:text-3xl tracking-[-0.02em] mb-3">
              {lang === 'en' ? 'Nothing to compare yet.' : 'Aucun produit à comparer.'}
            </h2>
            <p className="text-va-dim text-base mb-8 max-w-md mx-auto">
              {lang === 'en'
                ? 'Add up to 3 products from the shop to see them side by side.'
                : 'Ajoute jusqu’à 3 produits depuis la boutique pour les voir côte à côte.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/boutique')}
              className="bg-va-blue text-white px-8 py-4 rounded-xl font-semibold hover:bg-va-blue-h transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Browse shop' : 'Parcourir la boutique'}
            </button>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const headerLabel = (key: string): string => {
    const labels: Record<string, { fr: string; en: string }> = {
      image:    { fr: 'Image',       en: 'Image' },
      name:     { fr: 'Nom',         en: 'Name' },
      price:    { fr: 'Prix',        en: 'Price' },
      material: { fr: 'Matière',     en: 'Material' },
      weight:   { fr: 'Poids',       en: 'Weight' },
      colors:   { fr: 'Couleurs',    en: 'Colors' },
      sizes:    { fr: 'Tailles',     en: 'Sizes' },
      ideal:    { fr: 'Idéal pour',  en: 'Ideal for' },
      fit:      { fr: 'Coupe',       en: 'Fit' },
      care:     { fr: 'Lavage',      en: 'Care' },
      warranty: { fr: 'Garantie',    en: 'Warranty' },
      cta:      { fr: 'Action',      en: 'Action' },
    };
    return labels[key]?.[lang] ?? key;
  };

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-10 pb-32">
        <div className="mb-10">
          <div className="text-va-muted text-xs uppercase tracking-[0.15em]">
            {lang === 'en' ? 'Compare' : 'Comparateur'}
          </div>
          <h1 className="font-display font-black text-va-ink text-4xl md:text-5xl tracking-[-0.03em] mt-2">
            {lang === 'en'
              ? 'The right uniform for your crew.'
              : 'Le bon uniforme pour ton équipe.'}
          </h1>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full border-collapse min-w-[640px]">
            <thead className="bg-va-bg-2">
              <tr>
                <th
                  className="text-left font-display font-bold text-va-ink uppercase tracking-wider text-xs px-4 py-3 border-b border-va-line w-[160px]"
                  scope="col"
                >
                  <span className="sr-only">{lang === 'en' ? 'Field' : 'Champ'}</span>
                </th>
                {products.map(p => (
                  <th
                    key={p.sku}
                    scope="col"
                    className="text-left align-top px-4 py-3 border-b border-va-line"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="font-mono text-[10px] text-va-muted uppercase tracking-[2px] normal-case">
                        <span className="uppercase">{p.sku}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(p.sku)}
                        aria-label={lang === 'en'
                          ? `Remove ${p.shortName} from compare`
                          : `Retirer ${p.shortName} de la comparaison`}
                        className="text-va-muted hover:text-va-err text-base font-bold leading-none px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue rounded"
                      >
                        ×
                      </button>
                    </div>
                    <div className="aspect-square w-full bg-va-bg-2 rounded-xl overflow-hidden mb-3">
                      <img
                        src={p.imageDevant}
                        alt={p.shortName}
                        width={300}
                        height={300}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                    </div>
                    <div className="font-display font-bold text-va-ink text-base normal-case tracking-normal">
                      {categoryLabel(p.category, lang)}
                    </div>
                    <div className="text-xs text-va-dim mt-0.5 normal-case tracking-normal font-normal">
                      {p.shortName}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/product/${p.shopifyHandle}`)}
                      className="mt-2 text-va-blue text-sm font-semibold normal-case tracking-normal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue rounded"
                    >
                      {lang === 'en' ? 'View' : 'Voir'} →
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Prix */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('price')}
                </th>
                {products.map(p => {
                  const unit = p.basePrice + PRINT_PRICE;
                  return (
                    <td key={p.sku} className="px-4 py-3 align-top">
                      <div className="font-display font-bold text-va-ink text-lg">
                        {fmtMoney(unit, lang)}
                      </div>
                      <div className="text-xs text-va-muted">
                        / {lang === 'en' ? 'unit, print included' : 'unité, impression incluse'}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Matière */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('material')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="px-4 py-3 align-top text-sm text-va-ink">
                    {extractMaterial(p, lang)}
                  </td>
                ))}
              </tr>

              {/* Poids */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('weight')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="px-4 py-3 align-top text-sm text-va-ink">
                    {extractWeight(p)}
                  </td>
                ))}
              </tr>

              {/* Couleurs */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('colors')}
                </th>
                {products.map(p => {
                  const real = filterRealColors(p.sku, p.colors);
                  if (real.length === 0) {
                    return <td key={p.sku} className="px-4 py-3 align-top text-va-muted text-sm">{DASH}</td>;
                  }
                  return (
                    <td key={p.sku} className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {real.slice(0, 6).map(c => (
                          <span
                            key={c.id}
                            title={lang === 'en' ? (c.nameEn || c.name) : c.name}
                            className="w-4 h-4 rounded-full ring-1 ring-va-line"
                            style={{ background: c.hex }}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-va-muted">
                        {real.length} {lang === 'en'
                          ? (real.length === 1 ? 'color' : 'colors')
                          : (real.length === 1 ? 'couleur' : 'couleurs')}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Tailles */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('sizes')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {p.sizes.length === 0
                        ? <span className="text-va-muted text-sm">{DASH}</span>
                        : p.sizes.map(s => (
                            <span
                              key={s}
                              className="text-[10px] font-bold px-2 py-0.5 rounded border border-va-line text-va-ink"
                            >
                              {s}
                            </span>
                          ))}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Idéal pour */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('ideal')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="px-4 py-3 align-top text-sm text-va-ink">
                    {idealForLabel(p, lang)}
                  </td>
                ))}
              </tr>

              {/* Coupe */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('fit')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="px-4 py-3 align-top text-sm text-va-ink">
                    {fitLabel(p, lang)}
                  </td>
                ))}
              </tr>

              {/* Lavage */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('care')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="px-4 py-3 align-top text-sm text-va-ink">
                    {careLabel(lang)}
                  </td>
                ))}
              </tr>

              {/* Garantie */}
              <tr className="border-b border-va-line/50 hover:bg-va-bg-2 transition-colors">
                <th scope="row" className="text-left font-medium text-va-dim px-4 py-3 align-top text-sm">
                  {headerLabel('warranty')}
                </th>
                {products.map(p => (
                  <td key={p.sku} className="px-4 py-3 align-top text-sm text-va-ink">
                    {warrantyLabel(lang)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Choisir CTAs — one per product, aligned to the table columns. */}
        <div
          className="grid mt-6 gap-0"
          style={{ gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))` }}
        >
          <div aria-hidden="true" />
          {products.map(p => (
            <div key={p.sku} className="px-4">
              <button
                type="button"
                onClick={() => setCustomizerProductId(p.id)}
                className="bg-va-blue text-white px-4 py-2 rounded-xl text-sm font-semibold w-full hover:bg-va-blue-h transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Choose' : 'Choisir'}
              </button>
            </div>
          ))}
        </div>
      </main>

      <AnimatePresence>
        {customizerProductId && (
          <Suspense fallback={null}>
            <ProductCustomizer
              productId={customizerProductId}
              onClose={() => setCustomizerProductId(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <SiteFooter />
    </>
  );
}
