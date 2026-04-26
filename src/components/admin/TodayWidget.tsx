import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ShoppingCart, Clock, Package, ArrowRight } from 'lucide-react';
import {
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_STATS,
} from '@/data/shopifySnapshot';

type Priority = 'urgent' | 'normal' | 'low';

interface ActionItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  icon: typeof AlertCircle;
  priority: Priority;
}

// Thresholds lifted out of the build loop so a product owner tweaking
// what counts as "high-value abandoned" or how many idle prospects
// trigger a nurture nudge edits one symbol instead of hunting two
// inline literals. Currency in CAD; counts are absolute.
const HIGH_VALUE_ABANDONED_MIN_CAD = 200;
const INACTIVE_PROSPECT_NUDGE_THRESHOLD = 5;

// Stable sort order so 'urgent' rows always render above 'normal' /
// 'low' even if a future caller reorders the build steps. Negative
// number == higher priority — Array#sort is stable in modern engines
// (ES2019+) so equal-priority items keep their insertion order.
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, normal: 1, low: 2 };

// Freshness stamp — rounds to the nearest human-friendly bucket so the
// widget header subtly communicates that the list is live. Data itself
// is a static snapshot, but the rendered view re-evaluates on mount,
// so "il y a Ns" reflects how long the operator has been staring at
// this card without refreshing the dashboard. Negative inputs (clock
// skew on a freshly mounted widget) and the > 1 day overflow are both
// flattened to bounded copy rather than letting "il y a 27 h" or "-1s"
// bleed through.
function formatFreshness(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function TodayWidgetInner() {
  // Data is imported from a static snapshot, so the computation below
  // has zero runtime inputs — compute once per mount via useMemo and
  // skip the work on every subsequent render (sidebar toggle, nav,
  // etc.).
  const items = useMemo<ActionItem[]>(() => {
    const acc: ActionItem[] = [];

  // Pending payments — urgent
  const pendingOrders = SHOPIFY_ORDERS_SNAPSHOT.filter(o => o.financialStatus === 'pending');
  if (pendingOrders.length > 0) {
    const total = pendingOrders.reduce((s, o) => s + o.total, 0);
    // fr-CA locale so the amount reads '1 842,50 $' with a comma and
    // NBSP thousands separator, matching every other admin surface
    // (AdminOrders, AdminQuotes, AdminDashboard, ActivityFeed).
    // .toFixed(2) alone renders '1842.50' which looks out of place
    // sitting beside fr-CA-formatted values elsewhere on the page.
    acc.push({
      id: 'pending-payments',
      label: `${pendingOrders.length} paiement${pendingOrders.length > 1 ? 's' : ''} en attente`,
      detail: `${total.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $ à confirmer`,
      href: '/admin/orders?filter=pending',
      icon: AlertCircle,
      priority: 'urgent',
    });
  }

  // Awaiting fulfillment
  if (SHOPIFY_STATS.awaitingFulfillment > 0) {
    acc.push({
      id: 'fulfill',
      label: `${SHOPIFY_STATS.awaitingFulfillment} commande${SHOPIFY_STATS.awaitingFulfillment > 1 ? 's' : ''} à expédier`,
      detail: 'Production prête, à étiqueter',
      href: '/admin/orders?filter=awaiting_fulfillment',
      icon: Package,
      priority: 'normal',
    });
  }

  // High-value abandoned carts — threshold tuned so we surface the carts
  // worth a human follow-up, not every $30 t-shirt that lapsed.
  const highValueAbandoned = SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.filter(
    c => c.total >= HIGH_VALUE_ABANDONED_MIN_CAD,
  );
  if (highValueAbandoned.length > 0) {
    const total = highValueAbandoned.reduce((s, c) => s + c.total, 0);
    acc.push({
      id: 'recover-abandoned',
      label: `${highValueAbandoned.length} panier${highValueAbandoned.length > 1 ? 's' : ''} à récupérer`,
      detail: `${total.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $ en valeur (≥ ${HIGH_VALUE_ABANDONED_MIN_CAD} $/panier)`,
      href: '/admin/abandoned-carts',
      icon: ShoppingCart,
      priority: 'normal',
    });
  }

  // Inactive prospects (no order in last 7d). Defensive max(0,…) so a
  // payingCustomers count that briefly exceeds totalCustomers (e.g. a
  // mid-sync snapshot where the totals are denormalized counters that
  // settle on the next refresh) doesn't yield a negative number that
  // still passes the > threshold compare with NaN-style coercion.
  const inactiveProspects = Math.max(
    0,
    SHOPIFY_STATS.totalCustomers - SHOPIFY_STATS.payingCustomers,
  );
  if (inactiveProspects > INACTIVE_PROSPECT_NUDGE_THRESHOLD) {
    acc.push({
      id: 'nurture',
      label: `${inactiveProspects} prospects sans commande`,
      detail: 'Considérer une séquence de nurturing',
      href: '/admin/customers?filter=prospects',
      icon: Clock,
      priority: 'low',
    });
  }
    // Ensure urgent surfaces first regardless of build order. Sort is
    // stable, so two items at the same priority stay in insertion order.
    acc.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    return acc;
  }, []);

  // "Mis à jour il y a Ns" — a 30 s tick is enough granularity for the
  // copy ("à l'instant" / "il y a Ns" / "il y a N min") without being
  // a source of re-render pressure. The mountedAt ref equivalent is
  // done via a lazy initial state so we don't capture a stale Date on
  // every render.
  const [mountedAt] = useState(() => Date.now());
  const [freshnessSeconds, setFreshnessSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setFreshnessSeconds(Math.floor((Date.now() - mountedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [mountedAt]);
  const freshnessLabel = formatFreshness(freshnessSeconds);

  if (items.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center" role="status">
        <div className="text-4xl mb-2" aria-hidden="true">✨</div>
        <div className="font-bold text-emerald-900">Tout est à jour</div>
        <div className="text-xs text-emerald-700 mt-1">Aucune action requise pour le moment.</div>
        <div
          className="text-[10px] text-emerald-600/80 mt-2"
          aria-label={`Mis à jour ${freshnessLabel}`}
        >
          Mis à jour {freshnessLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 bg-gradient-to-r from-[#0F2341] to-[#1B3A6B]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">À faire aujourd'hui</div>
            <div className="text-sm font-extrabold text-white mt-0.5">{items.length} action{items.length > 1 ? 's' : ''} prioritaire{items.length > 1 ? 's' : ''}</div>
          </div>
          <Link
            to="/admin/orders"
            className="text-[11px] font-semibold text-white/80 hover:text-white underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded px-1 flex-shrink-0"
            aria-label="Voir toutes les actions dans la liste des commandes"
          >
            Voir tout
          </Link>
        </div>
      </div>
      <div className="divide-y divide-zinc-100">
        {items.map(item => {
          const Icon = item.icon;
          const tone = {
            urgent: 'bg-rose-50 text-rose-700',
            normal: 'bg-amber-50 text-amber-700',
            low: 'bg-blue-50 text-blue-700',
          }[item.priority];
          // Left edge stripe — a 3 px coloured rail that makes the
          // urgent / normal / low triage visible without leaning on
          // the icon-tile colour alone (icon tiles only render once
          // the eye lands on them; the rail catches peripheral scan).
          const rail = {
            urgent: 'before:bg-rose-500',
            normal: 'before:bg-amber-500',
            low: 'before:bg-blue-400',
          }[item.priority];
          // Bilingual label so SR users on the EN side of the admin
          // shell don't get a French-only "urgent" / "low" leaking out
          // of an otherwise localized list. Visually hidden — the
          // colour rail above is the sighted cue.
          const priorityLabel = {
            urgent: 'Priorité urgente',
            normal: 'Priorité normale',
            low: 'Priorité faible',
          }[item.priority];
          return (
            <Link
              key={item.id}
              to={item.href}
              className={`relative flex items-center gap-3 p-4 pl-5 hover:bg-zinc-50 transition-colors group focus:outline-none focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-inset before:absolute before:inset-y-2 before:left-1 before:w-1 before:rounded-full ${rail}`}
            >
              <span className="sr-only">{priorityLabel}.</span>
              <div className={`w-9 h-9 rounded-xl ${tone} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{item.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{item.detail}</div>
              </div>
              <ArrowRight size={14} className="text-zinc-300 group-hover:text-[#0052CC] transition-colors" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
      <div
        className="px-5 py-2 bg-zinc-50 border-t border-zinc-100 text-[10px] text-zinc-500"
        aria-label={`Mis à jour ${freshnessLabel}`}
      >
        Mis à jour {freshnessLabel}
      </div>
    </div>
  );
}

// React.memo keeps the dashboard parent from re-rendering the whole
// action list when an unrelated piece of state flips (sidebar open,
// nav link click, etc.).
export const TodayWidget = memo(TodayWidgetInner);
