import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { getPricePerUnit } from '@/data/pricing';

/**
 * QuickPriceCalculator — Phase 3 Vol. III hero conversion widget.
 *
 * Lives on the dark hero (mounted to the right of, or below, the CTA
 * cluster). Frosted-glass card so it reads as a primary tool without
 * stealing focus from the H1. Picks a representative SKU from the five
 * Vol. III hero categories (tee / hoodie / cap / polo / longsleeve),
 * lets the visitor scrub a quantity slider 1–200, and prints the
 * unit price + total in real time using the frozen pricing tiers in
 * `src/data/pricing.ts` (tagged ba33680). Free-shipping badge appears
 * once total ≥ $300 — mirrors the threshold used elsewhere on the
 * site so the hero promise matches checkout reality.
 *
 * Bilingual via `useLang`: FR primary, EN parallel.
 */
const SKUS = [
  { sku: 'ATC1000', fr: 'T-shirt', en: 'T-shirt' },
  { sku: 'ATCF2500', fr: 'Hoodie', en: 'Hoodie' },
  { sku: 'L445', fr: 'Polo', en: 'Polo' },
  { sku: 'ATC6606', fr: 'Casquette', en: 'Cap' },
  { sku: 'ATC1015', fr: 'Manches longues', en: 'Long sleeve' },
] as const;

const FREE_SHIP_THRESHOLD = 300;

export function QuickPriceCalculator() {
  const { lang } = useLang();
  const [sku, setSku] = useState<string>('ATC1000');
  const [qty, setQty] = useState<number>(12);

  const { unit, total } = useMemo(() => {
    const u = getPricePerUnit(sku, qty);
    return { unit: u, total: u * qty };
  }, [sku, qty]);

  const fmt = (n: number) => {
    // NaN.toFixed(2) → "NaN", Infinity.toFixed(2) → "Infinity" — both
    // would render as "NaN$" / "Infinity$" inside the hero card if a
    // missing pricing tier or a divide-by-zero ever leaked through
    // getPricePerUnit. Render an em-dash instead, matching fmtMoney's
    // contract (src/lib/format.ts) so the hero's degraded state looks
    // like every other money slot on the site rather than literal junk.
    if (!Number.isFinite(n)) return '—';
    return lang === 'fr' ? n.toFixed(2).replace('.', ',') : n.toFixed(2);
  };

  return (
    <div
      className="bg-white/8 backdrop-blur-md border border-white/12 rounded-2xl p-6 max-w-sm w-full"
      style={{ animation: 'fadeSlideUp 0.5s 560ms forwards', opacity: 0 }}
    >
      <div className="text-white/55 text-[11px] font-semibold uppercase tracking-[0.15em] mb-4">
        {lang === 'en' ? 'Instant price' : 'Prix instantané'}
      </div>

      {/* Product picker — pill row */}
      <div className="flex flex-wrap gap-2 mb-5">
        {SKUS.map(s => {
          const active = s.sku === sku;
          return (
            <button
              key={s.sku}
              type="button"
              onClick={() => setSku(s.sku)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] ${
                active
                  ? 'bg-va-blue text-white border border-va-blue'
                  : 'bg-white/6 text-white/70 border border-white/12 hover:bg-white/10 hover:text-white'
              }`}
              aria-pressed={active}
            >
              {lang === 'en' ? s.en : s.fr}
            </button>
          );
        })}
      </div>

      {/* Quantity slider */}
      <label className="block">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-white/55 text-xs font-medium">
            {lang === 'en' ? 'Quantity' : 'Quantité'}
          </span>
          <span className="font-mono text-white text-sm font-semibold tabular-nums">
            {qty}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={200}
          step={1}
          value={qty}
          onChange={e => setQty(Number(e.target.value))}
          aria-label={lang === 'en' ? 'Quantity' : 'Quantité'}
          className="w-full accent-va-blue cursor-pointer"
        />
      </label>

      {/* Output */}
      <div className="mt-5 pt-5 border-t border-white/10">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-mono font-black text-white text-3xl tabular-nums leading-none">
            {fmt(unit)}$
          </span>
          <span className="text-white/45 text-xs">
            {lang === 'en' ? '/ piece' : '/ pièce'}
          </span>
        </div>
        <div className="text-white/55 text-sm">
          {lang === 'en' ? 'Total' : 'Total'}{' '}
          <span className="font-mono font-semibold text-white tabular-nums">
            {fmt(total)}$
          </span>
        </div>

        {/* Free-shipping badge */}
        {total >= FREE_SHIP_THRESHOLD && (
          <div
            className="mt-4 inline-flex items-center gap-1.5 bg-va-blue/15 text-va-blue border border-va-blue/30 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ animation: 'fadeIn 0.3s forwards' }}
          >
            <Truck className="w-3.5 h-3.5" aria-hidden="true" />
            {lang === 'en' ? 'Free shipping unlocked' : 'Livraison gratuite débloquée'}
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickPriceCalculator;
