import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  DollarSign,
  FileText,
  Package,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  ChevronRight,
} from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { TodayWidget } from '@/components/admin/TodayWidget';
import {
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_PRODUCTS_SNAPSHOT,
  SHOPIFY_STATS,
  SHOPIFY_SNAPSHOT_META,
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
} from '@/data/shopifySnapshot';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-50 text-amber-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  awaiting: 'bg-blue-50 text-blue-700',
  refunded: 'bg-rose-50 text-rose-700',
  voided: 'bg-zinc-100 text-zinc-700',
};

// ───────────── Task 9.9 — Activity feed deep-links ─────────────
// Synthesizes recent orders / quotes / abandoned carts into a single
// freshest-first stream and deep-links each row back to its source
// record (with a ?highlight=<id> param so the target page can flash
// the specific row). Capped at 10 so the card stays a glance surface.

type ActivityIcon = typeof ShoppingBag;

interface ActivityItem {
  id: string;
  ts: number;
  icon: ActivityIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  detail: string;
  href: string;
}

function relativeTimeFr(ts: number): string {
  // Clamp so a source ts a few seconds ahead of the browser clock
  // doesn't render "il y a -1 min" (NTP drift / Shopify server clock).
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// Quotes live in localStorage under `vision-quotes` (same source
// AdminQuotes reads). Defensive per-row try/catch so one corrupted
// entry doesn't hide every quote from the activity feed.
interface StoredQuoteShape {
  id?: string | number;
  number?: string;
  clientName?: string;
  clientEmail?: string;
  total?: number;
  createdAt?: string;
}

function readQuoteActivities(): ActivityItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem('vision-quotes') ?? '[]');
    if (!Array.isArray(raw)) return [];
    const out: ActivityItem[] = [];
    for (const q of raw as StoredQuoteShape[]) {
      try {
        if (!q || typeof q !== 'object') continue;
        const ts = q.createdAt ? new Date(q.createdAt).getTime() : NaN;
        // Skip rows with an unparseable createdAt instead of pinning
        // them to "now" — a fleet of "à l'instant" quotes would
        // dominate the 10-row cap and hide real recent orders.
        if (!Number.isFinite(ts)) continue;
        const email = typeof q.clientEmail === 'string' ? q.clientEmail : '';
        const clientFromEmail = email.includes('@') ? email.split('@')[0] : email;
        const client =
          (typeof q.clientName === 'string' && q.clientName.trim()) || clientFromEmail || '—';
        const total = Number.isFinite(q.total) ? (q.total as number) : 0;
        const number = typeof q.number === 'string' && q.number ? q.number : '—';
        const qid = q.id ?? number;
        out.push({
          id: `quote-${qid}`,
          ts,
          icon: FileText,
          iconColor: 'text-[#0052CC]',
          iconBg: 'bg-blue-50',
          title: `Nouvelle soumission ${number}`,
          detail: `${client} · ${total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
          href: `/admin/quotes?highlight=${encodeURIComponent(String(qid))}`,
        });
      } catch {
        // Skip this row; keep the rest of the list visible.
      }
    }
    return out;
  } catch {
    return [];
  }
}

function useActivityItems(): ActivityItem[] {
  // Tick every 60s so "à l'instant" / "il y a 5 min" labels actually
  // advance while an admin keeps the dashboard open. Without this
  // the relative timestamps were frozen at the values from first
  // paint — a dashboard left open for an hour still read
  // "à l'instant".
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo<ActivityItem[]>(() => {
    const all: ActivityItem[] = [];

    SHOPIFY_ORDERS_SNAPSHOT.forEach(o => {
      // Shopify order.name is "#1570"; highlight param is the bare
      // number so AdminOrders can flash the matching row. Fall back
      // to the raw id for custom-named orders that don't match the
      // "#NNNN" shape.
      const num = o.name.startsWith('#') ? o.name.slice(1) : String(o.id);
      all.push({
        id: `order-${o.id}`,
        ts: new Date(o.createdAt).getTime(),
        icon: ShoppingBag,
        iconColor: 'text-emerald-700',
        iconBg: 'bg-emerald-50',
        title: `Nouvelle commande ${o.name}`,
        detail: `${o.customerName.trim() || o.email} · ${o.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
        href: `/admin/orders?highlight=${encodeURIComponent(num)}`,
      });
    });

    SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.forEach(c => {
      all.push({
        id: `abandoned-${c.id}`,
        ts: new Date(c.createdAt).getTime(),
        icon: ShoppingCart,
        iconColor: 'text-amber-700',
        iconBg: 'bg-amber-50',
        title: 'Panier abandonné',
        detail: `${c.customerName.trim() || c.email} · ${c.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $`,
        href: `/admin/abandoned-carts?highlight=${encodeURIComponent(String(c.id))}`,
      });
    });

    for (const q of readQuoteActivities()) all.push(q);

    // Freshest first, capped at 10. Anything older is reachable via
    // the per-section "Voir tout" links — this card is a glance
    // surface, not a full history.
    return all.sort((a, b) => b.ts - a.ts).slice(0, 10);
  }, []);
}

function ActivityFeedCard() {
  const items = useActivityItems();

  if (items.length === 0) {
    return (
      <div
        className="bg-white border border-zinc-200 rounded-2xl p-6 text-center"
        role="status"
      >
        <AlertCircle size={20} className="text-zinc-400 mx-auto mb-2" aria-hidden="true" />
        <div className="text-sm text-zinc-500">Aucune activité récente</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-zinc-900">Activité récente</h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
      <ul className="divide-y divide-zinc-100 -mx-2">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                to={item.href}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                <div
                  className={`w-8 h-8 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon size={14} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{item.title}</div>
                  <div className="text-[11px] text-zinc-500 truncate">{item.detail}</div>
                </div>
                <div className="text-[10px] text-zinc-400 whitespace-nowrap font-medium">
                  {relativeTimeFr(item.ts)}
                </div>
                <ChevronRight
                  size={16}
                  className="text-zinc-300 group-hover:text-zinc-500 transition-colors flex-shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AdminDashboard() {
  useDocumentTitle('Tableau de bord — Admin Vision Affichage');
  const recentOrders = SHOPIFY_ORDERS_SNAPSHOT.slice(0, 6);
  const revenueFmt = SHOPIFY_STATS.revenueLast7Days.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  // Count from the live snapshot instead of a hardcoded "3". Threshold
  // of 10 matches AdminProducts' lowStock/outOfStock split so both
  // surfaces agree on what "stock faible" means. Includes rupture
  // (inventory <= 0) since those also need admin attention — the card
  // is a "products that need a reorder" pointer, not a strict
  // 1–10-units filter. Hides the card entirely when everything is
  // healthy so admins don't see a stale "0 produits" alert.
  const lowStockCount = SHOPIFY_PRODUCTS_SNAPSHOT.filter(p => p.totalInventory <= 10).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Shopify via Zapier
          </span>
          <span className="text-zinc-400">·</span>
          <span>{SHOPIFY_SNAPSHOT_META.shop}</span>
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Commandes (7j)" value={String(SHOPIFY_STATS.ordersLast7Days)} delta={12} deltaLabel="vs. sem. dernière" icon={ShoppingBag} accent="blue" />
        <StatCard label="Revenus (7j)" value={`${revenueFmt} $`} delta={8} deltaLabel="vs. sem. dernière" icon={DollarSign} accent="green" />
        <StatCard label="À expédier" value={String(SHOPIFY_STATS.awaitingFulfillment)} icon={FileText} accent="gold" />
        <StatCard
          label="Paniers à récupérer"
          value={`${SHOPIFY_STATS.abandonedCheckoutsValue.toFixed(0)} $`}
          deltaLabel={`${SHOPIFY_STATS.abandonedCheckoutsCount} paniers`}
          icon={Package}
          accent="gold"
        />
      </div>

      <TodayWidget />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-zinc-900">Commandes récentes <span className="text-xs text-zinc-400 font-normal">(Shopify live)</span></h2>
            <Link
              to="/admin/orders"
              aria-label="Voir toutes les commandes"
              className="text-xs font-semibold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {recentOrders.map(order => {
              const date = new Date(order.createdAt);
              const relTime = (() => {
                // Clamp to 0 — order.createdAt can be a few seconds
                // ahead of the browser clock (NTP drift) and would
                // render "il y a -1h" otherwise.
                const diff = Math.max(0, Date.now() - date.getTime());
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return mins < 1 ? "à l'instant" : `il y a ${mins} min`;
                const h = Math.floor(mins / 60);
                if (h < 24) return `il y a ${h}h`;
                return `il y a ${Math.floor(h / 24)}j`;
              })();
              // Refunded / voided orders used to fall through to the
              // 'paid' branch and render a green "Payé" badge on the
              // dashboard — misleading for the admin trying to spot
              // which orders actually have money in the bank.
              const statusKey = order.fulfillmentStatus === 'fulfilled'
                ? 'fulfilled'
                : order.financialStatus === 'refunded' || order.financialStatus === 'partially_refunded'
                  ? 'refunded'
                  : order.financialStatus === 'voided'
                    ? 'voided'
                    : order.financialStatus === 'pending'
                      ? 'pending'
                      : order.financialStatus === 'paid' && !order.fulfillmentStatus
                        ? 'awaiting'
                        : 'paid';
              const statusLabel = statusKey === 'fulfilled' ? 'Expédié'
                : statusKey === 'pending' ? 'En attente'
                : statusKey === 'awaiting' ? 'À expédier'
                : statusKey === 'refunded' ? 'Remboursé'
                : statusKey === 'voided' ? 'Annulé'
                : 'Payé';
              return (
                <div key={order.id} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{order.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{order.customerName.trim() || order.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{order.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $</div>
                    <div className="text-[10px] text-zinc-500">{relTime}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap ${STATUS_COLORS[statusKey]}`}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-zinc-900 text-sm">Zapier ⇄ Shopify</h2>
              <TrendingUp size={16} className="text-emerald-600" aria-hidden="true" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Boutique</span>
                <span className="font-bold font-mono text-[11px]">visionaffichage-com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Commandes synchronisées</span>
                <span className="font-bold">{SHOPIFY_ORDERS_SNAPSHOT.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Paiements en attente</span>
                <span className="font-bold text-amber-700">{SHOPIFY_STATS.pendingPayments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Dernière sync</span>
                <span className="font-bold">{new Date(SHOPIFY_SNAPSHOT_META.syncedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {lowStockCount > 0 && (
            <div className="bg-gradient-to-br from-[#0F2341] to-[#1B3A6B] text-white rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="font-bold text-sm mb-1">Stock faible</div>
                  <div className="text-xs text-white/70 mb-3">
                    {lowStockCount} produit{lowStockCount > 1 ? 's ont' : ' a'} un inventaire sous 10 unités.
                  </div>
                  <Link
                    to="/admin/products"
                    className="text-[11px] font-bold text-[#E8A838] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
                  >
                    Voir les produits →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ActivityFeedCard />
    </div>
  );
}
