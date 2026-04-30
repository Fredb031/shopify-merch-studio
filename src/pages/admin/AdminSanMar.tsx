import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw,
  Database,
  Boxes,
  PackageSearch,
  Send,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Download,
  History,
  XCircle,
  Clock,
  CalendarClock,
  DollarSign,
  FileText,
  AlertTriangle,
  Wallet,
  Gauge,
  StickyNote,
  X,
} from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { supabase } from '@/lib/supabase';
import { sanmarClient } from '@/lib/sanmar/client';
import type { SanmarOrderStatus, SanmarOrderInput } from '@/lib/sanmar/types';
import { TablePagination } from '@/components/admin/TablePagination';
import { CacheHealthBadge } from '@/components/sanmar/CacheHealthBadge';
import { downloadCsv, csvFilename } from '@/lib/csv';
import {
  categorizeError,
  severityClasses,
  type SanmarErrorContext,
} from '@/lib/sanmar/errorMessages';

/**
 * /admin/sanmar — operator console for the SanMar Canada PromoStandards
 * integration (Step 4 of the broader rollout).
 *
 * RBAC is enforced one level up via <RequirePermission permission="sanmar:read">
 * in App.tsx, so by the time this page renders we know the operator is
 * either `admin` or `president`. Every panel below still gracefully
 * degrades when VITE_SANMAR_NEXT_GEN=false because the client-side
 * wrapper throws a clear "not deployed" error in that mode — we catch,
 * surface a soft empty/disabled state, and let the operator continue.
 *
 * va.* tokens only — no hardcoded brand hex. Bilingual via useLang.
 */

const NEXT_GEN_ENABLED = import.meta.env.VITE_SANMAR_NEXT_GEN === 'true';

interface SanmarCatalogRow {
  sku: string | null;
  style_id: string | null;
  color: string | null;
  size: string | null;
  price: number | null;
  total_qty: number | null;
  vancouver_qty: number | null;
  mississauga_qty: number | null;
  calgary_qty: number | null;
  last_synced_at: string | null;
}

/**
 * Mirrors the actual `public.sanmar_sync_log` schema (see migration
 * 20260429132247_sanmar_catalog.sql). Earlier revisions of this page
 * used `finished_at`/`total_styles`/`total_parts` which never existed
 * on the table — the select silently returned `data: null` and the
 * dashboard's "Last sync" cell stayed at "—" forever. Now we read the
 * real columns and surface them honestly.
 */
interface SanmarSyncLogRow {
  id?: string | null;
  sync_type: 'catalog' | 'inventory' | 'order_status' | string;
  total_processed: number | null;
  errors: unknown | null;
  duration_ms: number | null;
  created_at: string | null;
}

/**
 * One row of `public.get_sanmar_cron_health()` — the SECURITY DEFINER
 * function that joins `cron.job` and `cron.job_run_details` for jobs
 * named `sanmar-*` (see migration 20260429170000_sanmar_cron_health.sql).
 *
 * Non-admin callers get zero rows back rather than an error, so the
 * dashboard's empty state covers both "no admin" and "no cron jobs
 * registered yet" without surfacing the difference to the operator.
 */
interface SanmarCronHealthRow {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_s: number | null;
  last_message: string | null;
}

/**
 * Phase 19 — one row of /webhook-deliveries returned by the FastAPI
 * cache layer (proxied through the sanmar-webhook-deliveries edge
 * function). ``signature_hex`` is intentionally truncated to the last
 * 8 chars upstream — full HMACs never leave the SQLite row.
 */
interface WebhookDeliveryRow {
  id: number;
  po_number: string;
  event: string;
  status_code: number | null;
  attempt_count: number;
  outcome: string;
  response_ms: number | null;
  signed_at: string | null;
  signature_hex: string;
  event_id: string | null;
  error: string | null;
}

/** Bilingual outcome → colour-coded badge classes for the webhook table. */
const WEBHOOK_OUTCOME_BADGE: Record<string, string> = {
  success:
    'bg-emerald-50 border border-emerald-200 text-emerald-700',
  retry: 'bg-amber-50 border border-amber-200 text-amber-700',
  failed: 'bg-rose-50 border border-rose-200 text-rose-700',
  skipped: 'bg-slate-50 border border-slate-200 text-slate-600',
};

/** Webhook event types the operator can pick when firing a test. */
const WEBHOOK_EVENT_OPTIONS: ReadonlyArray<string> = [
  'order.shipped',
  'order.picked',
  'order.partially_shipped',
  'order.cancelled',
];

/**
 * Aggregated AR snapshot. As of Wave 13 this comes from the
 * `get_sanmar_ar_summary()` SECURITY DEFINER RPC (migration
 * 20260429200000_sanmar_ar_summary_rpc.sql) which performs one
 * server-side aggregate scan instead of shipping every "open" row
 * to the browser. The RPC gates on public.is_admin() so non-admin
 * callers get zero rows back; we render that as the empty-state
 * tiles below.
 *
 * If the RPC isn't deployed yet (early environments) the loader
 * falls back to the original client-side aggregation over
 * `sanmar_orders`. Both paths populate the same shape.
 *
 * Mirrors the digest convention in
 * `supabase/functions/_shared/sanmar/digest.ts`: status_id < 80 = open
 * AR (10/11/41/44/60/75 typical), 80 = complete (paid), 99 = cancelled.
 * status_id IS NULL is also "open" — orders submitted but not yet
 * acknowledged by SanMar.
 */
interface ArSummary {
  /** Sum of every order's `order_data.totalAmount` (CAD) where
   *  status_id IS NULL OR < 80. NaN/missing totals coerced to 0 so the
   *  tile never renders "$NaN". */
  openBalance: number;
  /** Distinct order count over the same predicate. */
  openCount: number;
  /** Max age in days of the oldest still-open order (uses
   *  `created_at` as the proxy for `submitted_at`; the migration
   *  doesn't carry a separate submission timestamp). null when the
   *  table is empty. */
  oldestDays: number | null;
  /** Count of orders that closed (status_id IN (80, 99)) in the
   *  last 30 days. Sourced from the RPC. 0 when the table is empty
   *  or the RPC fallback is in use and no rows match. */
  closedCount30d: number;
  /** Sum of order_data.totalAmount (CAD) for orders that paid
   *  (status_id = 80) in the last 30 days. Cancelled orders (99)
   *  do NOT contribute. */
  paidBalance30d: number;
  /** Per-status_id breakdown (10/11/41/44/60/75/null). Only populated
   *  by the legacy client-side fallback path; the RPC doesn't return
   *  it (we can add per-status if a drilldown lands later). Empty Map
   *  on the RPC path so callers shouldn't rely on it for primary UI. */
  byStatus: Map<string, number>;
}

/** Predicate the open-orders SanMar API table can filter on when the
 * operator clicks an AR tile. The "all" sentinel is the default
 * (no filter), "open" mirrors status_id < 80, "oldest" sorts the
 * existing rows by ship date ascending so the oldest float to the
 * top. The filter is purely client-side over rows already fetched —
 * we never re-call the SanMar gateway just because a tile was clicked. */
type OrderTableFilter = 'all' | 'open' | 'oldest';

/** Threshold below which a sanmar_orders row is "open" (= contributing
 * to AR). Mirrors the digest constant of the same name. */
const OPEN_STATUS_CUTOFF = 80;

/** Warn the operator when the oldest open order has aged past this many
 * days. Two-week SLA is the internal default; bump here if accounting
 * tightens policy. Used purely for tile colour, not for filtering. */
const OLDEST_WARN_DAYS = 14;

const PAGE_SIZE = 50;

/**
 * Hard cap on how many styles a single bulk-refresh operation can hit.
 * Each style fans out to ~3 SOAP calls (product/inventory/pricing) on
 * the SanMar side, so 50 styles = ~150 SOAP requests serialized. That
 * keeps a single bulk run under ~5 minutes even on a slow day and well
 * inside SanMar's per-IP quota. Operators who genuinely need more should
 * run two passes — the cap is a guard against an over-eager "select all
 * 3k SKUs" click that would melt the SOAP endpoint.
 */
const BULK_REFRESH_MAX = 50;

/** Cap for the "Download CSV" export from the Recent runs widget. The
 *  on-screen table only shows the latest 5, but operators investigating
 *  flakey jobs want history — 200 rows is small enough to fit in one
 *  Supabase round-trip and big enough to cover ~6 weeks of daily syncs
 *  plus inventory/order-status churn. Tune up if needed; the CSV builder
 *  doesn't care. */
const SYNC_LOG_EXPORT_LIMIT = 200;

/**
 * Module-level bilingual sync_type formatter used by the Realtime
 * subscription handler — its handlers run inside a useEffect with
 * empty deps to avoid resubscribing on language flips, so they cannot
 * close over the in-component `formatSyncType` (which captures `lang`).
 * Resolving lang explicitly via the langRef inside the handler and
 * funneling through this pure helper keeps the channel mount-stable
 * while still rendering the right label for the current language.
 */
function formatSyncTypeLabel(t: string, lang: 'en' | 'fr'): string {
  if (t === 'catalog') return lang === 'en' ? 'Catalogue' : 'Catalogue';
  if (t === 'inventory') return lang === 'en' ? 'Inventory' : 'Inventaire';
  if (t === 'order_status')
    return lang === 'en' ? 'Order status' : 'Statut commandes';
  return t;
}

/**
 * Ordered SanMar status chain used by the <OrderStatusDots> visualizer
 * in the open-orders table. Mirrors the 4-step indicator on /suivi
 * (TrackOrder.tsx → mapSanmarStatus): 10/11 received, 41/44 logo proof,
 * 60/75 production+shipping, 80 delivered, 99 cancelled. Each entry
 * carries a phase token that drives the dot colour and bilingual labels
 * for the hover tooltip — so this table is the single source of truth
 * for both visuals + accessibility text.
 *
 * Order matters: the operator reads left → right, so the chain is the
 * happy path with 99 (cancelled) appended at the end. When the current
 * status_id matches a chain entry, dots up to and including its index
 * are filled; the rest are empty. 99 short-circuits the fill (every
 * dot stays empty, the cancelled dot itself fills red).
 */
type SanmarStatusPhase = 'received' | 'proof' | 'production' | 'delivered' | 'cancelled';

interface SanmarStatusChainEntry {
  id: number;
  phase: SanmarStatusPhase;
  fr: string;
  en: string;
}

const SANMAR_STATUS_CHAIN: SanmarStatusChainEntry[] = [
  { id: 10, phase: 'received',   fr: 'Reçue',                    en: 'Received' },
  { id: 11, phase: 'received',   fr: 'En attente — service',     en: 'On hold — customer service' },
  { id: 41, phase: 'proof',      fr: 'Épreuve de logo',          en: 'Logo proof' },
  { id: 44, phase: 'proof',      fr: 'Approbation logo',         en: 'Logo approval' },
  { id: 60, phase: 'production', fr: 'En production',            en: 'In production' },
  { id: 75, phase: 'production', fr: 'Expédition partielle',     en: 'Partial shipment' },
  { id: 80, phase: 'delivered',  fr: 'Livrée',                   en: 'Delivered' },
  { id: 99, phase: 'cancelled',  fr: 'Annulée',                  en: 'Cancelled' },
];

/** Tailwind classes per phase for filled vs empty dots. va.* palette
 *  isn't available for every shade so we lean on Tailwind defaults that
 *  match the existing admin console (see tile colours in the AR
 *  dashboard above). Empty dots share a neutral border so the chain
 *  remains legible regardless of how far along the order is. */
const PHASE_FILL_CLASS: Record<SanmarStatusPhase, string> = {
  received:   'bg-slate-500 border-slate-500',
  proof:      'bg-blue-500 border-blue-500',
  production: 'bg-orange-500 border-orange-500',
  delivered:  'bg-emerald-500 border-emerald-500',
  cancelled:  'bg-red-500 border-red-500',
};
const EMPTY_DOT_CLASS = 'bg-transparent border-zinc-300';

/** Bilingual labels per phase used in the active-filter chip and the
 *  per-dot aria-label. Mirrors the chain entries above but flattens to
 *  one phrase per phase (10 + 11 share "Réception", etc.) so the chip
 *  text reads cleanly when the operator clicks any of the dots in a
 *  given phase. */
const PHASE_LABEL: Record<SanmarStatusPhase, { fr: string; en: string }> = {
  received:   { fr: 'Réception',   en: 'Received' },
  proof:      { fr: 'Épreuve',     en: 'Proof' },
  production: { fr: 'Production',  en: 'Production' },
  delivered:  { fr: 'Livrée',      en: 'Delivered' },
  cancelled:  { fr: 'Annulée',     en: 'Cancelled' },
};

/** All status_id values that belong to a given phase. The visualizer
 *  dots filter the open-orders table down to detail rows whose statusId
 *  is in this set when clicked. Derived from SANMAR_STATUS_CHAIN so the
 *  two stay in lockstep — add a new chain entry and the click filter
 *  picks it up automatically. */
const PHASE_STATUS_IDS: Record<SanmarStatusPhase, ReadonlySet<number>> = {
  received:   new Set(SANMAR_STATUS_CHAIN.filter(s => s.phase === 'received').map(s => s.id)),
  proof:      new Set(SANMAR_STATUS_CHAIN.filter(s => s.phase === 'proof').map(s => s.id)),
  production: new Set(SANMAR_STATUS_CHAIN.filter(s => s.phase === 'production').map(s => s.id)),
  delivered:  new Set(SANMAR_STATUS_CHAIN.filter(s => s.phase === 'delivered').map(s => s.id)),
  cancelled:  new Set(SANMAR_STATUS_CHAIN.filter(s => s.phase === 'cancelled').map(s => s.id)),
};

/** Number of full days elapsed since `iso` (status timestamp). Returns
 *  null when the input is missing or unparseable so callers can fall
 *  back to a dash. Uses floor(diff / 86_400_000) so a status set 23h
 *  ago still reads as "0 j" — matches operator intuition (they only
 *  care once a status sticks more than a calendar day). */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const ms = Date.now() - t;
  if (ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

interface OrderStatusDotsProps {
  statusId: number;
  /** ISO timestamp of when this status was last validated by SanMar.
   *  Drives the "X jours" suffix in the tooltip. Optional — when null
   *  the tooltip omits the duration line. */
  validTimestamp?: string | null;
  lang: 'fr' | 'en';
  /** Currently active phase filter (or null for "no phase filter").
   *  Drives aria-pressed on each dot button so AT users hear which
   *  phase is currently driving the table view. */
  activePhase: SanmarStatusPhase | null;
  /** Click handler — toggles the phase filter at the page level. The
   *  parent decides whether clicking the same phase twice clears the
   *  filter (toggle behaviour) or replaces it with another phase. */
  onPhaseClick: (phase: SanmarStatusPhase) => void;
  /** Hover handlers feed a shared "highlighted phase" state so rows
   *  matching the hovered phase get a subtle ring (CSS only, no
   *  re-render of the dots themselves). Optional — when omitted, the
   *  visualizer behaves like before minus the row highlight. */
  onPhaseHover?: (phase: SanmarStatusPhase | null) => void;
}

/**
 * Eight-dot visualizer for the SanMar status chain. Each dot is now an
 * interactive `<button>` that filters the open-orders table to only the
 * rows whose statusId matches that dot's phase. The container is
 * `role="presentation"` since the interactive children expose their own
 * labels — AT users tab to each dot button and hear "Filtrer par {phase}"
 * + the aria-pressed state. The native `title` tooltip (matching the
 * rest of the admin console) still shows the localized status name +
 * days in status on hover so the sighted operator gets the one-glance
 * summary they had before the dots became clickable.
 */
function OrderStatusDots({
  statusId,
  validTimestamp,
  lang,
  activePhase,
  onPhaseClick,
  onPhaseHover,
}: OrderStatusDotsProps) {
  const currentIdx = SANMAR_STATUS_CHAIN.findIndex(s => s.id === statusId);
  const cancelled = statusId === 99;
  const current = currentIdx >= 0 ? SANMAR_STATUS_CHAIN[currentIdx] : null;
  const days = daysSince(validTimestamp ?? null);

  const statusLabel = current
    ? lang === 'en' ? current.en : current.fr
    : lang === 'en' ? `Status ${statusId}` : `Statut ${statusId}`;
  const stepText = current
    ? lang === 'en'
      ? `step ${currentIdx + 1} of ${SANMAR_STATUS_CHAIN.length}`
      : `étape ${currentIdx + 1} sur ${SANMAR_STATUS_CHAIN.length}`
    : '';
  const daysText =
    days != null
      ? lang === 'en'
        ? days === 1 ? '1 day in status' : `${days} days in status`
        : days <= 1 ? `${days} jour dans ce statut` : `${days} jours dans ce statut`
      : '';

  const containerTooltip = [
    lang === 'en' ? `Status: ${statusLabel}` : `Statut : ${statusLabel}`,
    stepText,
    daysText,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      role="presentation"
      title={containerTooltip}
      className="inline-flex items-center gap-1"
    >
      {SANMAR_STATUS_CHAIN.map((entry, i) => {
        // Cancelled: only the last dot fills (red); every other dot is
        // empty so the cancellation reads as a hard stop rather than a
        // happy-path completion. Otherwise: fill every dot up to and
        // including the current index.
        const isFilled = cancelled
          ? entry.id === 99
          : currentIdx >= 0 && i <= currentIdx && entry.id !== 99;
        const cls = isFilled ? PHASE_FILL_CLASS[entry.phase] : EMPTY_DOT_CLASS;
        const phaseLabel = lang === 'en'
          ? PHASE_LABEL[entry.phase].en
          : PHASE_LABEL[entry.phase].fr;
        const dotAria = lang === 'en'
          ? `Filter by ${phaseLabel}`
          : `Filtrer par ${phaseLabel}`;
        const isActive = activePhase === entry.phase;
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onPhaseClick(entry.phase)}
            onMouseEnter={onPhaseHover ? () => onPhaseHover(entry.phase) : undefined}
            onMouseLeave={onPhaseHover ? () => onPhaseHover(null) : undefined}
            onFocus={onPhaseHover ? () => onPhaseHover(entry.phase) : undefined}
            onBlur={onPhaseHover ? () => onPhaseHover(null) : undefined}
            aria-pressed={isActive}
            aria-label={dotAria}
            title={dotAria}
            className={`inline-block w-2 h-2 rounded-full border p-0 cursor-pointer transition-transform hover:scale-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-1 ${cls} ${isActive ? 'ring-2 ring-va-blue ring-offset-1 scale-125' : ''}`}
          />
        );
      })}
    </div>
  );
}

export default function AdminSanMar() {
  const { lang } = useLang();
  useDocumentTitle(lang === 'en' ? 'SanMar Canada · Admin · Vision Affichage' : 'SanMar Canada · Admin · Vision Affichage');

  // ── Sync status ─────────────────────────────────────────────────────────
  // `recentRuns` holds the last 5 rows of sanmar_sync_log so the operator
  // can see at a glance which sync ran (catalog/inventory/order_status),
  // when, whether it succeeded, how long it took, and how many items it
  // processed. `lastSync` + `totalParts` mirror the headline cards above
  // and are derived from the same fetch — saves a round trip and keeps
  // both views consistent.
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: string | null;
    totalParts: number;
    loading: boolean;
  }>({ lastSync: null, totalParts: 0, loading: true });
  const [recentRuns, setRecentRuns] = useState<SanmarSyncLogRow[]>([]);
  const [recentRunsLoading, setRecentRunsLoading] = useState(true);
  // Sync card + sync log share one fetch; capturing the error here
  // surfaces it in two places so the operator sees the diagnostic
  // alongside whichever widget they were looking at first.
  const [syncFetchError, setSyncFetchError] =
    useState<SanmarErrorContext | null>(null);
  // Toggled while the Download-CSV button is fetching the wider history
  // window (up to SYNC_LOG_EXPORT_LIMIT rows) — keeps the button from
  // double-firing if the operator is impatient and re-clicks.
  const [exportingSyncLog, setExportingSyncLog] = useState(false);
  // Mirrors `exportingSyncLog` for the Open Orders Download-CSV button.
  // The export enriches the in-memory `filteredOpenOrders` snapshot with
  // a one-shot `sanmar_orders` query so the operator gets customer PO,
  // total CAD, and submitted-at columns the SanMar API doesn't return.
  // Disabling while inflight prevents a double-fire firing two queries.
  const [exportingOpenOrders, setExportingOpenOrders] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ── pg_cron health ─────────────────────────────────────────────────────
  // Live state of the three sanmar-* scheduled jobs (catalog Sunday 03:00,
  // inventory daily 05:15, order-status every 30min). Comes from the
  // SECURITY DEFINER `get_sanmar_cron_health()` function which gates on
  // is_admin(); rendered as a soft empty state if the function isn't
  // present yet (early-deploy environments) or the operator lacks rights.
  const [cronHealth, setCronHealth] = useState<SanmarCronHealthRow[]>([]);
  const [cronHealthLoading, setCronHealthLoading] = useState(true);
  const [cronHealthError, setCronHealthError] =
    useState<SanmarErrorContext | null>(null);

  // ── AR Summary ─────────────────────────────────────────────────────────
  // Real-time mirror of what the daily digest computes (see
  // supabase/functions/_shared/sanmar/digest.ts) so operators don't have
  // to wait for the 08:00 ET Slack ping to know the open balance. One
  // query → three tiles + a per-status map for future drilldown.
  // `arUpdatedAt` powers the "Mise à jour il y a Xm" caption beneath
  // each tile; null while loading or if the table is empty.
  const [arStats, setArStats] = useState<ArSummary>({
    openBalance: 0,
    openCount: 0,
    oldestDays: null,
    closedCount30d: 0,
    paidBalance30d: 0,
    byStatus: new Map(),
  });
  const [arLoading, setArLoading] = useState(true);
  const [arUpdatedAt, setArUpdatedAt] = useState<Date | null>(null);
  const [arError, setArError] = useState<SanmarErrorContext | null>(null);

  // ── Cache hit ratio (24h) ──────────────────────────────────────────────
  // Per-operation cache health derived from `sanmar_cache_metrics` (Phase
  // 12 migration). Reads the last 24 h of bucketed counters and folds
  // them into a {hit, total} pair per operation so the widget can render
  // a hit ratio + a tiny progress bar (no recharts dependency in this
  // tree, so we draw the bars by hand). Empty / RLS-denied state: zeroes
  // for every operation, no banner.
  const [cacheRatio, setCacheRatio] = useState<Record<
    'products' | 'inventory' | 'pricing' | 'orders',
    { hit: number; total: number }
  >>({
    products: { hit: 0, total: 0 },
    inventory: { hit: 0, total: 0 },
    pricing: { hit: 0, total: 0 },
    orders: { hit: 0, total: 0 },
  });
  const [cacheRatioLoading, setCacheRatioLoading] = useState(true);
  const [cacheRatioUpdatedAt, setCacheRatioUpdatedAt] = useState<Date | null>(
    null,
  );

  // ── Catalogue table ────────────────────────────────────────────────────
  const [catalogRows, setCatalogRows] = useState<SanmarCatalogRow[]>([]);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] =
    useState<SanmarErrorContext | null>(null);
  // Per-style force-refresh state. Keyed by style_id so multiple inflight
  // refreshes (operator clicks several rows fast) each have their own
  // spinner — without this map every row's button would spin in sync.
  const [refreshingStyles, setRefreshingStyles] = useState<Set<string>>(
    () => new Set(),
  );
  // Bulk-refresh selection. Operator ticks rows in the inventory table to
  // queue them for a single sequential refresh pass. Keyed by style_id —
  // multiple SKU rows that share a style collapse to one entry, mirroring
  // how the per-row button already works.
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(
    () => new Set(),
  );
  // Bulk-refresh runtime state. Set to a tracker object while a bulk
  // operation is inflight, null otherwise. Drives the progress indicator
  // in the inventory header and disables row checkboxes during the run.
  const [bulkRefreshState, setBulkRefreshState] = useState<{
    running: boolean;
    current: string | null; // style_id currently being refreshed
    completed: number;
    total: number;
    succeeded: string[];
    failed: { styleId: string; title: string; action: string }[];
  } | null>(null);
  // Cancel signal for the bulk loop. useRef so we don't trigger re-renders
  // and so the running iteration sees the latest value synchronously.
  // The current SOAP call can't be aborted (edge fn doesn't support it),
  // so cancel = "finish current style, skip the rest".
  const bulkCancelRef = useRef(false);

  // ── Webhook deliveries (Phase 19) ──────────────────────────────────────
  // Mirror of the Streamlit Phase-18 webhook panel for operators who only
  // ever touch the storefront. Reads from the FastAPI cache layer via an
  // edge-function proxy (sanmar-webhook-deliveries) — the audit data
  // lives in SQLite on the Python side, not Supabase. Hidden when
  // VITE_SANMAR_CACHE_API_URL is unset so operators not running the
  // cache layer don't see a permanent "no data" widget.
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDeliveryRow[]>(
    [],
  );
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState<SanmarErrorContext | null>(
    null,
  );
  const [webhookOutcomeFilter, setWebhookOutcomeFilter] = useState<string>('all');
  const [webhookEventFilter, setWebhookEventFilter] = useState<string>('all');
  const [webhookLimit, setWebhookLimit] = useState<number>(50);
  const [webhookHasMore, setWebhookHasMore] = useState(false);
  const [webhookTotalCount, setWebhookTotalCount] = useState<number | null>(null);
  // "Fire test event" dialog state.
  const [testFireOpen, setTestFireOpen] = useState(false);
  const [testFirePo, setTestFirePo] = useState<string>('');
  const [testFireEvent, setTestFireEvent] = useState<string>('order.shipped');
  const [testFireSubmitting, setTestFireSubmitting] = useState(false);

  // ── Open orders ────────────────────────────────────────────────────────
  const [openOrders, setOpenOrders] = useState<SanmarOrderStatus[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [openOrdersLastPoll, setOpenOrdersLastPoll] = useState<Date | null>(null);
  const [openOrdersError, setOpenOrdersError] =
    useState<SanmarErrorContext | null>(null);
  // Click-to-filter bridge between the AR tiles and the open-orders
  // table below. Pure UI state — when set to 'open' the table only
  // shows detail rows whose statusId < 80; when 'oldest' it sorts by
  // expectedShipDate ascending. Reset to 'all' clears the filter.
  const [orderTableFilter, setOrderTableFilter] = useState<OrderTableFilter>('all');
  // Phase filter is an independent dimension that layers on top of the
  // 'all'/'open'/'oldest' OrderTableFilter above. Set by clicking a dot
  // in the OrderStatusDots visualizer; null means "no phase filter".
  // Click the same dot twice to toggle off, or use the X on the chip.
  const [phaseFilter, setPhaseFilter] = useState<SanmarStatusPhase | null>(null);
  // Pure-UI hover state so hovering a dot rings the matching rows. Lives
  // here (not inside <OrderStatusDots>) because the row highlight needs
  // to span all detail rows for the same phase, not just the one whose
  // dot is hovered. Reset to null on mouseleave/blur.
  const [hoveredPhase, setHoveredPhase] = useState<SanmarStatusPhase | null>(null);

  // ── Internal notes (operator-only) ────────────────────────────────────
  // Map keyed by purchase_order_number → currently-saved note text.
  // Hydrated once per fetchOpenOrders refresh by selecting
  // (va_order_id, internal_notes) from sanmar_orders for every PO
  // visible in the open-orders payload. We keep this map separate from
  // `openOrders` so a saved note doesn't get wiped when the SanMar API
  // payload is replaced on the next poll. null = no note → clean dot
  // gating (`hasNote = Boolean(notesByPo[po])`).
  const [notesByPo, setNotesByPo] = useState<Record<string, string | null>>({});
  // Editor dialog state. `null` = closed; otherwise carries the PO
  // being edited and the in-flight draft text. We seed `draft` with
  // the saved note on open so the textarea reflects current persisted
  // state, and mirror edits here until Save commits to Supabase.
  const [noteEditor, setNoteEditor] = useState<{
    po: string;
    draft: string;
    saving: boolean;
  } | null>(null);
  // Remember the row-level button that opened the dialog so we can
  // return focus there on close — the focus-trap hook restores
  // document.activeElement automatically, but mounting the trapped
  // container moves focus inside it before the trap runs, which means
  // the trap captures the wrong "previous" element. Saving it
  // explicitly here side-steps that ordering.
  const noteOpenerRef = useRef<HTMLButtonElement | null>(null);
  // Limit must match the DB CHECK constraint in
  // 20260430000000_sanmar_order_notes.sql — keep both in sync.
  const NOTE_MAX = 500;

  // ── Test order form ────────────────────────────────────────────────────
  const [testOrderOpen, setTestOrderOpen] = useState(false);
  const [testOrderSubmitting, setTestOrderSubmitting] = useState(false);
  const [testForm, setTestForm] = useState({
    productId: '',
    partId: '',
    qty: '1',
    unitPrice: '0',
    companyName: 'Vision Affichage',
    address1: '',
    city: '',
    region: 'QC',
    postalCode: '',
    attentionTo: '',
    email: '',
  });

  // ── Effects ────────────────────────────────────────────────────────────

  /**
   * Pull recent sync metadata from `sanmar_sync_log` (last 5 rows) and the
   * row count from `sanmar_catalog`. If the tables don't exist yet we
   * surface a soft empty state instead of an exception — same pattern as
   * the catalogue + open-orders fetches below, the page must render in a
   * half-deployed environment.
   *
   * Historical bug: the original implementation selected
   * `finished_at,total_styles,total_parts` from `sanmar_sync_log`, but
   * the actual schema only has `created_at,total_processed,duration_ms,
   * errors,sync_type`. The select silently returned `null` and the
   * "Last sync" headline stayed at "—" indefinitely. We now read the
   * real columns and derive the latest run from the top of the page.
   */
  const loadRecentRuns = useMemo(
    () => async () => {
      if (!supabase) {
        setSyncStatus(s => ({ ...s, loading: false }));
        setRecentRunsLoading(false);
        return;
      }
      setRecentRunsLoading(true);
      setSyncFetchError(null);
      try {
        const [logRes, countRes] = await Promise.all([
          supabase
            .from('sanmar_sync_log')
            .select('id,sync_type,total_processed,errors,duration_ms,created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('sanmar_catalog').select('*', { count: 'exact', head: true }),
        ]);
        // Surface a structured error if either leg failed but we still
        // have something to render — better than silently swallowing.
        if (logRes.error) {
          setSyncFetchError({
            code: (logRes.error as { code?: string }).code,
            message: logRes.error.message,
          });
        }
        const rows = ((logRes.data ?? []) as SanmarSyncLogRow[]) ?? [];
        const latest = rows[0] ?? null;
        setRecentRuns(rows);
        setSyncStatus({
          lastSync: latest?.created_at ?? null,
          totalParts: countRes.count ?? 0,
          loading: false,
        });
      } catch (e) {
        setRecentRuns([]);
        setSyncStatus(s => ({ ...s, loading: false }));
        setSyncFetchError({
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setRecentRunsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadRecentRuns();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRecentRuns]);

  /**
   * Export the wider sync-log history to CSV for offline triage.
   *
   * The on-screen widget only shows the latest 5 rows (intentionally —
   * it's a glance card, not a forensic tool). When something looks off
   * — a string of inventory failures, a regression after a deploy — the
   * operator wants the full picture without dropping into Supabase
   * Studio. This pulls up to {@link SYNC_LOG_EXPORT_LIMIT} rows ordered
   * newest-first and builds a CSV identical in spirit to the other
   * /admin exporters: RFC 4180 quoting, UTF-8 BOM, CRLF line endings,
   * formula-injection guard — all delegated to {@link downloadCsv}.
   *
   * Columns mirror the on-screen table plus the raw error count so the
   * CSV stays self-explanatory in Excel/Sheets:
   *   When | Type | Status | Duration (ms) | Processed | Errors
   *
   * No analytics implications — this is read-only export, doesn't touch
   * the log table, doesn't trigger a sync. Errors fall through to a
   * toast so the operator knows when the export is empty vs broken.
   */
  const handleExportSyncLogCsv = async () => {
    if (!supabase) {
      toast.error(
        lang === 'en'
          ? 'Supabase client not configured.'
          : 'Client Supabase non configuré.',
      );
      return;
    }
    setExportingSyncLog(true);
    try {
      const { data, error } = await supabase
        .from('sanmar_sync_log')
        .select('id,sync_type,total_processed,errors,duration_ms,created_at')
        .order('created_at', { ascending: false })
        .limit(SYNC_LOG_EXPORT_LIMIT);
      if (error) throw error;
      const rows = (data ?? []) as SanmarSyncLogRow[];
      if (rows.length === 0) {
        toast.info(
          lang === 'en'
            ? 'No sync runs to export yet.'
            : 'Aucune synchro à exporter pour le moment.',
        );
        return;
      }
      const header = [
        lang === 'en' ? 'When' : 'Quand',
        lang === 'en' ? 'Type' : 'Type',
        lang === 'en' ? 'Status' : 'Statut',
        lang === 'en' ? 'Duration (ms)' : 'Durée (ms)',
        lang === 'en' ? 'Processed' : 'Traités',
        lang === 'en' ? 'Errors' : 'Erreurs',
      ];
      const body = rows.map(row => {
        const errCount = Array.isArray(row.errors) ? row.errors.length : 0;
        return [
          // Render the timestamp via the shared Date path so the CSV
          // builder writes ISO-8601, which sorts lexically and round-trips
          // cleanly into spreadsheets.
          row.created_at ? new Date(row.created_at) : '',
          row.sync_type ?? '',
          isSyncOk(row) ? 'success' : 'fail',
          row.duration_ms ?? '',
          row.total_processed ?? 0,
          errCount,
        ];
      });
      downloadCsv([header, ...body], csvFilename('sanmar-sync-log'));
      toast.success(
        lang === 'en'
          ? `Exported ${rows.length} run${rows.length === 1 ? '' : 's'}.`
          : `${rows.length} synchro${rows.length === 1 ? '' : 's'} exportée${rows.length === 1 ? '' : 's'}.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        lang === 'en'
          ? `Export failed: ${msg}`
          : `Échec de l’export : ${msg}`,
      );
    } finally {
      setExportingSyncLog(false);
    }
  };

  /**
   * Pull live state of the sanmar-* pg_cron jobs from the
   * `get_sanmar_cron_health()` RPC. Errors fall through to a soft empty
   * state — the function is missing in pre-Wave-7 environments and
   * non-admin callers get zero rows back by design, so we treat both
   * cases identically rather than hassling the operator with a banner.
   */
  const loadCronHealth = useMemo(
    () => async () => {
      if (!supabase) {
        setCronHealthLoading(false);
        return;
      }
      setCronHealthLoading(true);
      setCronHealthError(null);
      try {
        const { data, error } = await supabase.rpc('get_sanmar_cron_health');
        if (error) {
          // Distinguish "function not deployed" (soft empty) from a real
          // permission / network failure (structured panel). The former
          // is expected in pre-Wave-7 envs and shouldn't alarm; the
          // latter needs the operator to act.
          const msg = (error.message ?? '').toLowerCase();
          const code = (error as { code?: string }).code ?? '';
          const isMissingFn =
            code === 'PGRST202' ||
            msg.includes('could not find the function') ||
            msg.includes('does not exist');
          if (!isMissingFn) {
            setCronHealthError({ code, message: error.message });
          }
          setCronHealth([]);
        } else {
          setCronHealth((data ?? []) as SanmarCronHealthRow[]);
        }
      } catch (e) {
        setCronHealth([]);
        setCronHealthError({
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setCronHealthLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadCronHealth();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCronHealth]);

  /**
   * Load AR aggregate stats. Wave 13: prefer the
   * `get_sanmar_ar_summary()` SECURITY DEFINER RPC (migration
   * 20260429200000_sanmar_ar_summary_rpc.sql) — single round trip,
   * single aggregate row, gated by public.is_admin() which already
   * covers admin AND president roles (see 0001_auth_quotes_invites.sql).
   * If the RPC isn't deployed yet (e.g. running against a Supabase
   * project that hasn't applied the migration) we fall back to the
   * legacy client-side scan over `sanmar_orders` so the widget keeps
   * working through the deploy window.
   *
   * Empty result handling:
   *   - RPC returns zero rows when the caller isn't admin/president
   *     → render zeroes / "—" gracefully, no banner.
   *   - RPC returns one row with COALESCE'd zero columns when the
   *     table is empty → tiles show 0 / 0 / "—".
   *   - RPC errors with "function does not exist" → fall through to
   *     the legacy aggregator below.
   *
   * Currency is always CAD per `SanmarOrderInput.currency` in
   * src/lib/sanmar/types.ts.
   */
  const loadArStats = useMemo(
    () => async () => {
      if (!supabase) {
        setArLoading(false);
        return;
      }
      setArLoading(true);
      setArError(null);

      // ── Path A: server-side RPC (preferred) ───────────────────────────
      try {
        const { data, error } = await supabase.rpc('get_sanmar_ar_summary');
        if (!error) {
          const rows = (data ?? []) as Array<{
            open_count: number | string | null;
            open_balance_cad: number | string | null;
            oldest_open_days: number | null;
            closed_count_30d: number | string | null;
            paid_balance_30d_cad: number | string | null;
          }>;
          // Non-admin callers get zero rows back by design — surface
          // zeroes / "—" rather than treating it as an error.
          if (rows.length === 0) {
            setArStats({
              openBalance: 0,
              openCount: 0,
              oldestDays: null,
              closedCount30d: 0,
              paidBalance30d: 0,
              byStatus: new Map(),
            });
            setArUpdatedAt(new Date());
            setArLoading(false);
            return;
          }
          const r = rows[0];
          // Postgres bigint comes back as a string in PostgREST; numeric
          // can be either depending on driver — coerce both defensively.
          const openCount = Number(r.open_count ?? 0);
          const openBalance = Number(r.open_balance_cad ?? 0);
          const oldestRaw = r.oldest_open_days;
          // Server returns 0 when there are no open rows (COALESCE);
          // map that back to null so the "—" placeholder still renders
          // rather than "0d" (which would imply "submitted today" —
          // misleading on an empty table).
          const oldestDays =
            openCount > 0 && oldestRaw != null && Number.isFinite(Number(oldestRaw))
              ? Number(oldestRaw)
              : null;
          const closedCount30d = Number(r.closed_count_30d ?? 0);
          const paidBalance30d = Number(r.paid_balance_30d_cad ?? 0);
          setArStats({
            openBalance: Number.isFinite(openBalance) ? openBalance : 0,
            openCount: Number.isFinite(openCount) ? openCount : 0,
            oldestDays,
            closedCount30d: Number.isFinite(closedCount30d) ? closedCount30d : 0,
            paidBalance30d: Number.isFinite(paidBalance30d) ? paidBalance30d : 0,
            byStatus: new Map(),
          });
          setArUpdatedAt(new Date());
          setArLoading(false);
          return;
        }
        // Detect "function not deployed" — Supabase surfaces this as
        // PGRST202 ("Could not find the function") or a 404. Anything
        // else is a real error we want to log; only fall through on a
        // missing-function signal so we don't paper over RLS / permission
        // failures.
        const msg = (error.message ?? '').toLowerCase();
        const code = (error as { code?: string }).code ?? '';
        const isMissingFn =
          code === 'PGRST202' ||
          msg.includes('could not find the function') ||
          msg.includes('does not exist');
        if (!isMissingFn) {
          // Real error; record but still try the fallback so the top
          // three tiles keep working under transient RPC errors.
          setArError({ code, message: error.message });
        }
      } catch (e) {
        // Network blip / parse failure / etc. Record and try fallback.
        setArError({ message: e instanceof Error ? e.message : String(e) });
      }

      // ── Path B: legacy client-side aggregate (fallback) ───────────────
      // This covers two cases: (1) the RPC migration hasn't been
      // applied yet, (2) the RPC errored transiently. We query the
      // raw rows under RLS — non-admins get zero rows back per the
      // existing policy. The closed-30d tiles render zeroes here
      // because the legacy fetch only pulls "open" rows; widening
      // it would defeat the purpose of having an RPC at all.
      try {
        const { data, error } = await supabase
          .from('sanmar_orders')
          .select('status_id, created_at, order_data')
          .or(`status_id.is.null,status_id.lt.${OPEN_STATUS_CUTOFF}`);
        if (error) {
          setArError({
            code: (error as { code?: string }).code,
            message: error.message,
          });
          setArStats({
            openBalance: 0,
            openCount: 0,
            oldestDays: null,
            closedCount30d: 0,
            paidBalance30d: 0,
            byStatus: new Map(),
          });
          setArUpdatedAt(new Date());
          return;
        }
        const rows = (data ?? []) as Array<{
          status_id: number | null;
          created_at: string | null;
          order_data: unknown;
        }>;
        let openBalance = 0;
        let openCount = 0;
        let oldestMs: number | null = null;
        const byStatus = new Map<string, number>();
        const nowMs = Date.now();
        for (const row of rows) {
          openCount += 1;
          // Pull totalAmount out of the JSONB blob defensively; missing
          // / non-numeric values contribute 0 rather than NaN.
          const od =
            row.order_data && typeof row.order_data === 'object'
              ? (row.order_data as Record<string, unknown>)
              : {};
          const total = Number(
            (od as { totalAmount?: unknown }).totalAmount ?? 0,
          );
          if (Number.isFinite(total)) openBalance += total;
          // Oldest open order — track the smallest created_at timestamp.
          if (row.created_at) {
            const t = new Date(row.created_at).getTime();
            if (Number.isFinite(t) && (oldestMs == null || t < oldestMs)) {
              oldestMs = t;
            }
          }
          // Per-status histogram. NULL → "unsubmitted" per the digest
          // convention; everything else stringified so the Map key is
          // stable across renders.
          const key = row.status_id == null ? 'null' : String(row.status_id);
          byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
        }
        const oldestDays =
          oldestMs == null
            ? null
            : Math.floor((nowMs - oldestMs) / (1000 * 60 * 60 * 24));
        setArStats({
          openBalance,
          openCount,
          oldestDays,
          closedCount30d: 0,
          paidBalance30d: 0,
          byStatus,
        });
        setArUpdatedAt(new Date());
      } catch (e) {
        // Network blips, JSON parse failures, etc. — never crash the
        // page; surface as an inline error caption instead.
        setArError({ message: e instanceof Error ? e.message : String(e) });
        setArStats({
          openBalance: 0,
          openCount: 0,
          oldestDays: null,
          closedCount30d: 0,
          paidBalance30d: 0,
          byStatus: new Map(),
        });
        setArUpdatedAt(new Date());
      } finally {
        setArLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadArStats();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadArStats]);

  /**
   * Load the last 24 h of `sanmar_cache_metrics` rows and aggregate per
   * operation. The TS-layer router (Phase 12) records one (operation,
   * outcome, reason) tuple per dispatch, batched in-process and flushed
   * every minute via UPSERT, so a 24 h window has at most ~5760 rows
   * (4 ops × 6 reasons × 240 buckets) — small enough to fold client-side
   * without paginating.
   *
   * Failure modes:
   *   - Table missing (pre-Phase-12 environments) → zero counters, no
   *     banner. The widget renders "—" hit ratios and a "no data yet"
   *     caption, mirroring how the AR / sync-runs widgets degrade.
   *   - RLS denies non-admins → zero rows back, same empty-state path.
   */
  const loadCacheRatio = useMemo(
    () => async () => {
      if (!supabase) {
        setCacheRatioLoading(false);
        return;
      }
      setCacheRatioLoading(true);
      try {
        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('sanmar_cache_metrics')
          .select('operation,outcome,count')
          .gte('bucket_at', sinceIso);
        if (error) {
          // Table missing or RLS denied — render zeroes.
          setCacheRatio({
            products: { hit: 0, total: 0 },
            inventory: { hit: 0, total: 0 },
            pricing: { hit: 0, total: 0 },
            orders: { hit: 0, total: 0 },
          });
          setCacheRatioUpdatedAt(new Date());
          return;
        }
        const acc: Record<string, { hit: number; total: number }> = {
          products: { hit: 0, total: 0 },
          inventory: { hit: 0, total: 0 },
          pricing: { hit: 0, total: 0 },
          orders: { hit: 0, total: 0 },
        };
        for (const row of (data ?? []) as Array<{
          operation: string;
          outcome: string;
          count: number | null;
        }>) {
          const op = row.operation;
          if (!(op in acc)) continue;
          const c = Number(row.count ?? 0);
          if (!Number.isFinite(c)) continue;
          acc[op].total += c;
          if (row.outcome === 'hit') acc[op].hit += c;
        }
        setCacheRatio(
          acc as Record<
            'products' | 'inventory' | 'pricing' | 'orders',
            { hit: number; total: number }
          >,
        );
        setCacheRatioUpdatedAt(new Date());
      } catch {
        setCacheRatio({
          products: { hit: 0, total: 0 },
          inventory: { hit: 0, total: 0 },
          pricing: { hit: 0, total: 0 },
          orders: { hit: 0, total: 0 },
        });
        setCacheRatioUpdatedAt(new Date());
      } finally {
        setCacheRatioLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadCacheRatio();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCacheRatio]);

  /**
   * Page through `sanmar_catalog` 50 rows at a time. The query order
   * (style_id, color, size) keeps a deterministic pagination window
   * even as new rows arrive; without an explicit order Supabase can
   * shuffle on each request and the operator sees the same SKU twice.
   *
   * Extracted into a useCallback so the per-style "Force resync" button
   * (handleForceRefreshStyle) can reload the visible page after a
   * successful upsert without bumping `catalogPage` and confusing the
   * operator's pagination context.
   */
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    if (!supabase) {
      setCatalogLoading(false);
      return;
    }
    const from = catalogPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    try {
      const { data, count, error } = await supabase
        .from('sanmar_catalog')
        .select(
          'sku,style_id,color,size,price,total_qty,vancouver_qty,mississauga_qty,calgary_qty,last_synced_at',
          { count: 'exact' },
        )
        .order('style_id', { ascending: true })
        .order('color', { ascending: true })
        .order('size', { ascending: true })
        .range(from, to);
      if (error) {
        // Distinguish missing-table (soft empty) from a permission /
        // connectivity failure (structured panel). The 42P01 code is
        // PostgreSQL's "undefined_table"; PGRST205 is the PostgREST
        // equivalent.
        const code = (error as { code?: string }).code ?? '';
        const msg = (error.message ?? '').toLowerCase();
        const isMissingTable =
          code === '42P01' ||
          code === 'PGRST205' ||
          msg.includes('does not exist') ||
          (msg.includes('relation') && msg.includes('not exist'));
        if (!isMissingTable) {
          setCatalogError({ code, message: error.message });
        }
        setCatalogRows([]);
        setCatalogTotal(0);
      } else {
        setCatalogRows((data ?? []) as SanmarCatalogRow[]);
        setCatalogTotal(count ?? 0);
      }
    } catch (e) {
      setCatalogRows([]);
      setCatalogTotal(0);
      setCatalogError({
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadCatalog();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  /**
   * Supabase Realtime subscription. Pushes two kinds of events into the
   * dashboard so the operator no longer needs to hit "Refresh" after a
   * sync run or an order status transition:
   *
   *   1. INSERT on `sanmar_sync_log` → prepend the new row to
   *      `recentRuns`, update the headline `lastSync` cell, and toast
   *      "Synchro terminée : {sync_type}". Bilingual.
   *   2. UPDATE on `sanmar_orders` → splice the matching purchase
   *      order in `openOrders` so its status_id reflects the new value
   *      immediately. When the new status_id is 80 (delivered/paid) or
   *      99 (cancelled), surface a toast so terminal transitions don't
   *      get lost in the noise.
   *
   * Subscription lifecycle: opened once on mount, torn down on unmount.
   * `liveSubscribed` flips true on SUBSCRIBED status and gates the
   * "En direct" indicator in the header. CHANNEL_ERROR / TIMED_OUT /
   * CLOSED leave it false — silent fallback to existing manual-refresh
   * patterns; we don't nag with a toast because the page still works.
   *
   * Stale-closure guard: lang flips would otherwise force a resubscribe.
   * We park lang in a ref and resolve it inside the handlers, keeping
   * the subscription deps array empty so the channel is created exactly
   * once per mount.
   *
   * RLS still applies on the receive side — the publication is
   * membership but Realtime evaluates SELECT policies before delivering
   * payloads. Non-admin / non-president visitors won't see anything;
   * they also don't reach this page (RequirePermission gate above).
   */
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const sb = supabase;
    const channel = sb
      .channel('admin-sanmar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sanmar_sync_log' },
        payload => {
          const row = payload.new as Partial<SanmarSyncLogRow> | null;
          if (!row) return;
          const safeRow: SanmarSyncLogRow = {
            id: (row.id as string | null | undefined) ?? null,
            sync_type:
              (row.sync_type as SanmarSyncLogRow['sync_type']) ?? '',
            total_processed: (row.total_processed as number | null) ?? null,
            errors: row.errors ?? null,
            duration_ms: (row.duration_ms as number | null) ?? null,
            created_at:
              (row.created_at as string | null) ?? new Date().toISOString(),
          };
          // Prepend + cap at 5 to mirror the original loadRecentRuns()
          // limit; deduplicate on id so a fast sync that completes
          // before the initial fetch lands won't show twice.
          setRecentRuns(prev => {
            const dedup = safeRow.id
              ? prev.filter(r => r.id !== safeRow.id)
              : prev;
            return [safeRow, ...dedup].slice(0, 5);
          });
          // Headline "Last sync" mirrors the freshest row, regardless
          // of sync_type — matches the existing loadRecentRuns
          // derivation.
          setSyncStatus(s => ({
            ...s,
            lastSync: safeRow.created_at,
            loading: false,
          }));
          const t = formatSyncTypeLabel(
            String(safeRow.sync_type ?? ''),
            langRef.current,
          );
          toast.success(
            langRef.current === 'en'
              ? `Sync complete: ${t}`
              : `Synchro terminée : ${t}`,
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sanmar_orders' },
        payload => {
          const newRow = payload.new as {
            va_order_id?: string | null;
            status_id?: number | null;
            status_name?: string | null;
          } | null;
          const oldRow = payload.old as {
            status_id?: number | null;
          } | null;
          if (!newRow) return;
          const poNumber = newRow.va_order_id ?? '';
          const newStatus = newRow.status_id ?? null;
          const prevStatus = oldRow?.status_id ?? null;

          // Surgically update the matching purchase order's primary
          // status detail. The SanMar gateway model is one-to-many
          // (purchaseOrderNumber → orderStatusDetails[]); we update
          // the first detail's statusId because that's what
          // SANMAR_STATUS_CHAIN reads when colouring dots. If the
          // order isn't loaded (operator hasn't clicked "Fetch" yet)
          // we no-op.
          if (poNumber) {
            setOpenOrders(prev => {
              let touched = false;
              const next = prev.map(order => {
                if (order.purchaseOrderNumber !== poNumber) return order;
                touched = true;
                const details = order.orderStatusDetails ?? [];
                const head = details[0];
                const updatedHead = head
                  ? { ...head, statusId: newStatus ?? head.statusId }
                  : head;
                return {
                  ...order,
                  orderStatusDetails: updatedHead
                    ? [updatedHead, ...details.slice(1)]
                    : details,
                };
              });
              return touched ? next : prev;
            });
          }

          // Terminal-transition toast: only fire when the status
          // actually crossed into 80 (delivered/paid) or 99
          // (cancelled), not on every row touch. Compare against
          // payload.old so a re-poll that re-writes the same value
          // stays silent.
          const transitionedToTerminal =
            (newStatus === 80 || newStatus === 99) &&
            prevStatus !== newStatus;
          if (transitionedToTerminal) {
            const isDelivered = newStatus === 80;
            const label =
              poNumber ||
              (langRef.current === 'en' ? 'order' : 'commande');
            if (isDelivered) {
              toast.success(
                langRef.current === 'en'
                  ? `Order delivered: ${label}`
                  : `Commande livrée : ${label}`,
              );
            } else {
              toast.warning(
                langRef.current === 'en'
                  ? `Order cancelled: ${label}`
                  : `Commande annulée : ${label}`,
              );
            }
          }
        },
      )
      .subscribe(status => {
        if (cancelled) return;
        // Realtime publishes a small set of states; only SUBSCRIBED
        // means the channel is hot. Anything else (CHANNEL_ERROR,
        // TIMED_OUT, CLOSED) leaves the indicator dark and the page
        // falls back to the existing manual-refresh / polling pattern
        // — silent, by design, so a transient network blip doesn't
        // spam toasts.
        setLiveSubscribed(status === 'SUBSCRIBED');
      });
    return () => {
      cancelled = true;
      setLiveSubscribed(false);
      // Best-effort teardown — removeChannel is async but we don't
      // need to await it here; React unmount path handles the rest.
      void sb.removeChannel(channel);
    };
    // Mount-only: stale closures are guarded by langRef + the static
    // formatter helper. The handlers don't reference any in-component
    // values that change after mount, so the empty deps array is the
    // correct shape and the rules-of-hooks linter agrees.
  }, []);

  /**
   * Fetch all open orders (queryType = 4 per the SanMar PDF: "all open
   * orders for this customer"). Manual-trigger only after first mount
   * because each call hits the SanMar gateway and counts toward the
   * customer's daily quota.
   */
  const fetchOpenOrders = useMemo(
    () => async () => {
      setOpenOrdersError(null);
      setOpenOrdersLoading(true);
      try {
        const result = await sanmarClient.getOrderStatus(4);
        setOpenOrders(result);
        setOpenOrdersLastPoll(new Date());

        // Hydrate operator notes for every PO in the new payload.
        // Done in a single round-trip via `.in('va_order_id', [...])`
        // rather than per-row to keep AdminSanMar's request count flat
        // as the open-orders list grows. Failures here are non-fatal —
        // the table still renders, the notes column just stays empty
        // and operators see no dot indicators. We swallow the error
        // because notes are auxiliary metadata, not load-bearing.
        const pos = result.map(o => o.purchaseOrderNumber).filter(Boolean);
        if (pos.length === 0) {
          setNotesByPo({});
        } else if (supabase) {
          const { data: noteRows, error: notesErr } = await supabase
            .from('sanmar_orders')
            .select('va_order_id, internal_notes')
            .in('va_order_id', pos);
          if (!notesErr && noteRows) {
            const next: Record<string, string | null> = {};
            for (const row of noteRows as Array<{
              va_order_id: string;
              internal_notes: string | null;
            }>) {
              // Multiple sanmar_orders rows can share a va_order_id
              // when the same VA order produced more than one SanMar
              // PO; keep the first non-empty note seen so the
              // indicator stays accurate when there are duplicates.
              if (!next[row.va_order_id] && row.internal_notes) {
                next[row.va_order_id] = row.internal_notes;
              } else if (!(row.va_order_id in next)) {
                next[row.va_order_id] = row.internal_notes;
              }
            }
            setNotesByPo(next);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Try to extract a status code if the SanMar client surfaced
        // one; fall back to message-only categorization otherwise.
        const status =
          typeof (e as { status?: unknown })?.status === 'number'
            ? (e as { status: number }).status
            : undefined;
        setOpenOrdersError({ status, message: msg });
      } finally {
        setOpenOrdersLoading(false);
      }
    },
    [],
  );

  // ── Internal notes handlers ────────────────────────────────────────────

  /**
   * Open the note editor for a specific PO. Seeds the draft with the
   * currently-saved note (or '') so the textarea reflects persisted
   * state. The trigger button is captured in `noteOpenerRef` so the
   * dialog can return focus to exactly the row it was opened from on
   * close — restoring focus to a generic ancestor would skip past the
   * row and disorient keyboard users navigating a long table.
   */
  const openNoteEditor = useCallback(
    (po: string, opener: HTMLButtonElement | null) => {
      noteOpenerRef.current = opener;
      setNoteEditor({ po, draft: notesByPo[po] ?? '', saving: false });
    },
    [notesByPo],
  );

  /**
   * Close the editor without persisting. Returns focus to the row's
   * Note button so keyboard users land back on the control they
   * activated. Guarded against missing ref (e.g. row unmounted between
   * open and close after a fetchOpenOrders refresh in another tab).
   */
  const closeNoteEditor = useCallback(() => {
    setNoteEditor(null);
    const btn = noteOpenerRef.current;
    noteOpenerRef.current = null;
    if (btn && typeof btn.focus === 'function') {
      // Defer until after the dialog tears down so the focus-trap's
      // own cleanup doesn't immediately steal focus back to body.
      requestAnimationFrame(() => btn.focus({ preventScroll: true }));
    }
  }, []);

  /**
   * Persist the current draft to sanmar_orders.internal_notes. We
   * UPDATE by va_order_id (= purchaseOrderNumber on the SanMar
   * payload — see migration 20260429132247_sanmar_catalog.sql). Empty
   * strings become NULL so the dot indicator gates on truthy cleanly.
   * Optimistically update `notesByPo` on success so the dot flips
   * immediately without waiting for a refetch.
   */
  const saveNote = useCallback(async () => {
    if (!noteEditor) return;
    const trimmed = noteEditor.draft.trim();
    if (trimmed.length > NOTE_MAX) {
      toast.error(
        lang === 'en'
          ? `Note too long (${trimmed.length}/${NOTE_MAX})`
          : `Note trop longue (${trimmed.length}/${NOTE_MAX})`,
      );
      return;
    }
    setNoteEditor(prev => (prev ? { ...prev, saving: true } : prev));
    const next = trimmed === '' ? null : trimmed;
    const { error } = await supabase
      .from('sanmar_orders')
      .update({ internal_notes: next })
      .eq('va_order_id', noteEditor.po);
    if (error) {
      setNoteEditor(prev => (prev ? { ...prev, saving: false } : prev));
      toast.error(
        lang === 'en'
          ? `Couldn't save note: ${error.message}`
          : `Échec de l'enregistrement : ${error.message}`,
      );
      return;
    }
    setNotesByPo(prev => ({ ...prev, [noteEditor.po]: next }));
    toast.success(lang === 'en' ? 'Note saved' : 'Note enregistrée');
    closeNoteEditor();
  }, [noteEditor, lang, closeNoteEditor]);

  // Esc closes the dialog when open. Hook reads its `active` arg each
  // render so the listener attaches/detaches as the dialog mounts.
  useEscapeKey(noteEditor != null, closeNoteEditor);
  // Focus trap activates only while the dialog is open. The hook
  // returns a ref attached to the dialog container below.
  const noteTrapRef = useFocusTrap<HTMLDivElement>(noteEditor != null);

  // ── Handlers ───────────────────────────────────────────────────────────

  /**
   * Operator-triggered catalogue sync. The `sanmar-sync-catalog` edge
   * function ships with Step 5; until then we attempt the invoke and
   * if Supabase reports the function isn't deployed we surface a soft
   * "operator action required" toast instead of crashing the page.
   */
  const handleSync = async () => {
    if (!supabase) {
      toast.error(
        lang === 'en'
          ? 'Supabase client not initialized'
          : 'Client Supabase non initialisé',
      );
      return;
    }
    setSyncing(true);
    toast.message(
      lang === 'en' ? 'Synchronization in progress...' : 'Synchronisation en cours...',
    );
    try {
      const { error } = await supabase.functions.invoke('sanmar-sync-catalog');
      if (error) {
        // Supabase returns { status: 404 } in error.context for missing
        // functions. Either way, the message contains "404" or
        // "Function not found" — surface a friendly explainer.
        const msg = error.message || '';
        if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
          toast.error(
            lang === 'en'
              ? 'Edge function not deployed — operator action required'
              : 'Edge function non déployée — opérateur action requise',
          );
        } else {
          toast.error(
            lang === 'en' ? `Sync failed: ${msg}` : `Échec de la synchro : ${msg}`,
          );
        }
      } else {
        toast.success(
          lang === 'en' ? 'Sync completed' : 'Synchronisation terminée',
        );
        // Refresh the recent-runs widget so the operator sees the row
        // they just triggered without a hard reload.
        await loadRecentRuns();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(lang === 'en' ? `Sync failed: ${msg}` : `Échec : ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Operator-initiated single-style refresh. Bypasses the daily cron
   * and refetches product + inventory + pricing for one style
   * immediately, then reloads the catalogue page so the operator sees
   * the new values without scrolling. Auth is gated server-side
   * (admin role only); we pass the style_id straight through.
   *
   * Multiple parts share a style_id so several rows on screen map to
   * the same SOAP refetch — `refreshingStyles` is keyed by style so a
   * second click on the same style is a no-op while the first is
   * inflight, but a click on a different style spins independently.
   */
  const handleForceRefreshStyle = useCallback(
    async (styleId: string | null) => {
      if (!styleId) return;
      if (!supabase) {
        toast.error(
          lang === 'en'
            ? 'Supabase client not initialized'
            : 'Client Supabase non initialisé',
        );
        return;
      }
      // Idempotent guard — second click while first is inflight is a no-op.
      if (refreshingStyles.has(styleId)) return;
      setRefreshingStyles((prev) => {
        const next = new Set(prev);
        next.add(styleId);
        return next;
      });
      try {
        const { data, error } = await supabase.functions.invoke(
          'sanmar-force-refresh-style',
          { body: { style_id: styleId } },
        );
        if (error) {
          const msg = error.message || '';
          // Mirror handleSync's "function not deployed" branch so the
          // operator gets a clear hint instead of a generic 404.
          if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
            toast.error(
              lang === 'en'
                ? 'Edge function not deployed — operator action required'
                : 'Edge function non déployée — opérateur action requise',
            );
          } else {
            const { title, action } = categorizeError(
              { message: msg },
              lang,
            );
            toast.error(
              lang === 'en'
                ? `Refresh failed for ${styleId}: ${title}`
                : `Échec actualisation ${styleId} : ${title}`,
              { description: action },
            );
          }
          return;
        }
        // Surface server-reported failure (function returned 4xx/5xx body)
        const payload = data as { success?: boolean; error?: string } | null;
        if (!payload || payload.success !== true) {
          const msg = payload?.error ?? 'Unknown error';
          const { title, action } = categorizeError({ message: msg }, lang);
          toast.error(
            lang === 'en'
              ? `Refresh failed for ${styleId}: ${title}`
              : `Échec actualisation ${styleId} : ${title}`,
            { description: action },
          );
          return;
        }
        toast.success(
          lang === 'en'
            ? `Style ${styleId} refreshed`
            : `Style ${styleId} actualisé`,
        );
        // Reload the visible page so the new quantity_available + price
        // land in the row the operator just clicked. Keeps catalogPage
        // unchanged so the operator's pagination context survives.
        await loadCatalog();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const { title, action } = categorizeError({ message: msg }, lang);
        toast.error(
          lang === 'en'
            ? `Refresh failed for ${styleId}: ${title}`
            : `Échec actualisation ${styleId} : ${title}`,
          { description: action },
        );
      } finally {
        setRefreshingStyles((prev) => {
          const next = new Set(prev);
          next.delete(styleId);
          return next;
        });
      }
    },
    [lang, refreshingStyles, loadCatalog],
  );

  /**
   * Distinct style_ids on the *currently visible* catalogue page that
   * are eligible for selection. Multiple SKUs share a style, so we
   * dedupe — the bulk refresh fans out per-style, not per-SKU. Computed
   * via useMemo so the "Select all" checkbox state stays referentially
   * stable across unrelated re-renders.
   */
  const visibleStyleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of catalogRows) {
      if (row.style_id) ids.add(row.style_id);
    }
    return ids;
  }, [catalogRows]);

  /**
   * Bulk refresh selected styles in series. Sequential — NOT parallel —
   * because SanMar's PromoStandards SOAP endpoint rate-limits per-IP
   * and we've seen 429s when more than ~3 inflight requests hit it from
   * the cron job. The edge fn already does ~3 SOAP calls per style
   * (product/inventory/pricing), so even one style at a time produces
   * meaningful concurrency on SanMar's side. Operator can cancel via
   * the progress indicator; the in-flight iteration completes (we have
   * no AbortController plumbing through to the edge fn) but no further
   * styles are kicked off after that. On completion: a single toast
   * summarises the run, with categorized failures listed for triage.
   */
  const handleBulkRefreshSelected = useCallback(async () => {
    if (!supabase) {
      toast.error(
        lang === 'en'
          ? 'Supabase client not initialized'
          : 'Client Supabase non initialisé',
      );
      return;
    }
    // Snapshot the selection at click-time. If new boxes get ticked
    // mid-run we don't want them retroactively swept up — operator's
    // intent was the set as it stood when they hit the button.
    const styleIds = Array.from(selectedStyles).slice(0, BULK_REFRESH_MAX);
    if (styleIds.length === 0) return;
    if (bulkRefreshState?.running) return;

    bulkCancelRef.current = false;
    setBulkRefreshState({
      running: true,
      current: null,
      completed: 0,
      total: styleIds.length,
      succeeded: [],
      failed: [],
    });

    const succeeded: string[] = [];
    const failed: { styleId: string; title: string; action: string }[] = [];

    for (let i = 0; i < styleIds.length; i++) {
      if (bulkCancelRef.current) break;
      const styleId = styleIds[i];
      setBulkRefreshState((prev) =>
        prev
          ? { ...prev, current: styleId, completed: i }
          : prev,
      );
      // Mark the row as refreshing so the per-row spinner kicks in too.
      setRefreshingStyles((prev) => {
        const next = new Set(prev);
        next.add(styleId);
        return next;
      });
      try {
        const { data, error } = await supabase.functions.invoke(
          'sanmar-force-refresh-style',
          { body: { style_id: styleId } },
        );
        if (error) {
          const { title, action } = categorizeError(
            { message: error.message || '' },
            lang,
          );
          failed.push({ styleId, title, action });
        } else {
          const payload = data as { success?: boolean; error?: string } | null;
          if (!payload || payload.success !== true) {
            const { title, action } = categorizeError(
              { message: payload?.error ?? 'Unknown error' },
              lang,
            );
            failed.push({ styleId, title, action });
          } else {
            succeeded.push(styleId);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const { title, action } = categorizeError({ message: msg }, lang);
        failed.push({ styleId, title, action });
      } finally {
        setRefreshingStyles((prev) => {
          const next = new Set(prev);
          next.delete(styleId);
          return next;
        });
      }
    }

    const cancelled = bulkCancelRef.current;
    setBulkRefreshState(null);
    bulkCancelRef.current = false;
    // Refresh the visible page so quantities/prices update for the
    // styles we just hit. Cheaper than re-rendering each row inline.
    await loadCatalog();

    // Summary toast. We *always* surface success even on partial-fail
    // runs so the operator knows the cancel/cap landed where they
    // intended, then list failures so they can re-queue them.
    const okCount = succeeded.length;
    const failCount = failed.length;
    if (failCount === 0) {
      toast.success(
        lang === 'en'
          ? cancelled
            ? `Bulk refresh cancelled: ${okCount}/${styleIds.length} succeeded`
            : `Bulk refresh complete: ${okCount}/${styleIds.length} succeeded`
          : cancelled
            ? `Actualisation groupée annulée : ${okCount}/${styleIds.length} réussis`
            : `Actualisation groupée terminée : ${okCount}/${styleIds.length} réussis`,
      );
    } else {
      const failLines = failed
        .slice(0, 5)
        .map((f) => `• ${f.styleId}: ${f.title}`)
        .join('\n');
      const more =
        failed.length > 5
          ? lang === 'en'
            ? `\n…and ${failed.length - 5} more`
            : `\n…et ${failed.length - 5} de plus`
          : '';
      toast.error(
        lang === 'en'
          ? cancelled
            ? `Bulk refresh cancelled: ${okCount}/${styleIds.length} succeeded, ${failCount} failed`
            : `Bulk refresh complete: ${okCount}/${styleIds.length} succeeded, ${failCount} failed`
          : cancelled
            ? `Actualisation groupée annulée : ${okCount}/${styleIds.length} réussis, ${failCount} échecs`
            : `Actualisation groupée terminée : ${okCount}/${styleIds.length} réussis, ${failCount} échecs`,
        { description: `${failLines}${more}` },
      );
    }
    // Keep the selection alive on partial failures so operator can
    // retry just the failed ones; clear it on a clean run.
    if (failCount === 0 && !cancelled) {
      setSelectedStyles(new Set());
    } else {
      setSelectedStyles(new Set(failed.map((f) => f.styleId)));
    }
  }, [lang, selectedStyles, bulkRefreshState, loadCatalog]);

  /**
   * Cancel a bulk refresh in flight. The current SOAP call still runs
   * to completion (no abort plumbing through the edge fn) but no
   * further iterations are kicked off. The summary toast at the end
   * notes the cancellation so the operator knows it landed.
   */
  const handleCancelBulkRefresh = useCallback(() => {
    bulkCancelRef.current = true;
  }, []);

  /**
   * Test order submission — dispatches a Sample-type order with a
   * single line item so the operator can verify the SOAP plumbing
   * end-to-end without filing a real order. The transactionId is
   * returned in a toast; nothing persists locally.
   */
  const handleTestOrder = async () => {
    const qty = Number(testForm.qty);
    const unitPrice = Number(testForm.unitPrice);
    if (
      !testForm.productId.trim() ||
      !testForm.partId.trim() ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      toast.error(
        lang === 'en'
          ? 'Fill productId, partId, qty (>0), unit price (>=0)'
          : 'Remplir productId, partId, qty (>0), prix (>=0)',
      );
      return;
    }
    if (
      !testForm.address1.trim() ||
      !testForm.city.trim() ||
      !testForm.postalCode.trim() ||
      !testForm.attentionTo.trim() ||
      !testForm.email.trim()
    ) {
      toast.error(
        lang === 'en' ? 'Fill all ship-to fields' : 'Remplir tous les champs livraison',
      );
      return;
    }
    setTestOrderSubmitting(true);
    try {
      const orderData: SanmarOrderInput = {
        orderType: 'Sample',
        orderNumber: `TEST-${Date.now()}`,
        totalAmount: qty * unitPrice,
        currency: 'CAD',
        orderContact: {
          attentionTo: testForm.attentionTo,
          email: testForm.email,
        },
        shipContact: {
          companyName: testForm.companyName,
          address1: testForm.address1,
          city: testForm.city,
          region: testForm.region,
          postalCode: testForm.postalCode,
          country: 'CA',
        },
        shipment: {
          allowConsolidation: false,
          blindShip: false,
          packingListRequired: false,
          carrier: 'UPS',
        },
        lineItems: [
          {
            lineNumber: '1',
            quantity: qty,
            unitPrice,
            productId: testForm.productId,
          },
        ],
      };
      const result = await sanmarClient.submitOrder(orderData);
      toast.success(
        lang === 'en'
          ? `Test order accepted — transactionId ${result.transactionId}`
          : `Commande test acceptée — transactionId ${result.transactionId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        lang === 'en' ? `Submission failed: ${msg}` : `Échec de soumission : ${msg}`,
      );
    } finally {
      setTestOrderSubmitting(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  const formatTimestamp = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA');
  };

  /** Pretty-print a duration in ms as "1.2 s" or "47 s" or "2 min 14 s".
   * Returns "—" if the value is null or non-finite so a half-written log
   * row never renders "NaN ms" on the dashboard. */
  const formatDuration = (ms: number | null | undefined): string => {
    if (ms == null || !Number.isFinite(ms)) return '—';
    if (ms < 1000) return `${ms} ms`;
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) return `${totalSeconds.toFixed(1)} s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds - minutes * 60);
    return `${minutes} min ${seconds.toString().padStart(2, '0')} s`;
  };

  /** Was the sync run successful? A run is "ok" when the `errors` JSONB
   * column is null/empty AND something was processed. We treat an empty
   * array `[]` and `null` as success — partial-success rows where
   * `errors` is a non-empty array show as "fail" so the operator
   * notices and follows up in the sanmar_sync_log table directly. */
  const isSyncOk = (row: SanmarSyncLogRow): boolean => {
    if (row.errors == null) return true;
    if (Array.isArray(row.errors)) return row.errors.length === 0;
    // Anything else (string, object) is treated as a problem — operators
    // can dig into Supabase Studio for the full payload.
    return false;
  };

  /** Bilingual label for a sync_type enum value. */
  const formatSyncType = (t: string): string => {
    if (t === 'catalog') return lang === 'en' ? 'Catalogue' : 'Catalogue';
    if (t === 'inventory') return lang === 'en' ? 'Inventory' : 'Inventaire';
    if (t === 'order_status') return lang === 'en' ? 'Order status' : 'Statut commandes';
    return t;
  };

  /**
   * Humanize a pg_cron jobname into something an operator wants to read.
   * The three known jobs are:
   *   - sanmar-sync-catalog       → Catalogue (hebdomadaire) / Catalogue (weekly)
   *   - sanmar-sync-inventory     → Inventaire (quotidien)   / Inventory (daily)
   *   - sanmar-reconcile-orders   → Statut commandes (30 min) / Order status (30 min)
   * Anything else falls back to the raw jobname so newly-added jobs
   * aren't silently mislabeled.
   */
  const formatJobName = (jobname: string): string => {
    if (jobname === 'sanmar-sync-catalog') {
      return lang === 'en' ? 'Catalogue (weekly)' : 'Catalogue (hebdomadaire)';
    }
    if (jobname === 'sanmar-sync-inventory') {
      return lang === 'en' ? 'Inventory (daily)' : 'Inventaire (quotidien)';
    }
    if (jobname === 'sanmar-reconcile-orders') {
      return lang === 'en' ? 'Order status (30 min)' : 'Statut commandes (30 min)';
    }
    return jobname;
  };

  /**
   * Cheap relative-time formatter — "il y a 2h" / "2h ago". We keep
   * this hand-rolled rather than dragging in date-fns because the dashboard
   * already ships with three near-duplicates of toLocaleString and one
   * more dependency would break the bundle budget. Rounds to the most
   * useful unit; "just now" when under a minute.
   */
  const formatRelativeTime = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) {
      // Future timestamp — rare (clock skew); just show absolute time.
      return formatTimestamp(iso);
    }
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return lang === 'en' ? 'just now' : "à l'instant";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return lang === 'en' ? `${minutes} min ago` : `il y a ${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return lang === 'en' ? `${hours}h ago` : `il y a ${hours}h`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return lang === 'en' ? `${days}d ago` : `il y a ${days}j`;
    }
    // Past a week, the absolute date is more useful than "12d ago".
    return formatTimestamp(iso);
  };

  /**
   * pg_cron writes one of: 'starting', 'running', 'sending', 'connecting',
   * 'succeeded', 'failed'. We collapse the in-flight states to "running"
   * for the badge but preserve the raw value as a tooltip so an operator
   * debugging a stuck job can still see exactly what cron reported.
   */
  const isCronRunOk = (status: string | null): boolean => status === 'succeeded';
  const isCronRunInFlight = (status: string | null): boolean =>
    status != null && status !== 'succeeded' && status !== 'failed';

  /** Format a CAD amount for the AR balance tile. Two decimals, fr-CA
   * grouping when in French, en-CA otherwise — matches the open-orders
   * + catalogue tables' currency columns so the dashboard reads
   * uniformly. Falls back to "0,00 $" / "$0.00" on non-finite input
   * so a half-empty arStats never renders "$NaN". */
  const formatCad = (n: number): string => {
    const safe = Number.isFinite(n) ? n : 0;
    return safe.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  /** "Mise à jour il y a 2 min" caption beneath each AR tile. We
   * round to whole minutes (sub-minute → "à l'instant") because the
   * widget refreshes on demand, not every second — a "12s ago" tag
   * would only spook the operator. Reuses the same diff-now math as
   * `formatRelativeTime` but renders the localised "Updated …"
   * preamble inline. */
  const formatUpdatedAgo = (d: Date | null): string => {
    if (!d) return lang === 'en' ? 'Not loaded yet' : 'Pas encore chargé';
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) {
      return lang === 'en' ? 'Updated just now' : 'Mise à jour à l’instant';
    }
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) {
      return lang === 'en' ? 'Updated just now' : 'Mise à jour à l’instant';
    }
    if (minutes < 60) {
      return lang === 'en'
        ? `Updated ${minutes} min ago`
        : `Mise à jour il y a ${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return lang === 'en' ? `Updated ${hours}h ago` : `Mise à jour il y a ${hours}h`;
    }
    const days = Math.floor(hours / 24);
    return lang === 'en' ? `Updated ${days}d ago` : `Mise à jour il y a ${days}j`;
  };

  /** Format last_duration_s (a Postgres double precision) for display. */
  const formatCronDuration = (s: number | null | undefined): string => {
    if (s == null || !Number.isFinite(s)) return '—';
    if (s < 1) return `${Math.round(s * 1000)} ms`;
    if (s < 60) return `${s.toFixed(1)} s`;
    const minutes = Math.floor(s / 60);
    const seconds = Math.round(s - minutes * 60);
    return `${minutes} min ${seconds.toString().padStart(2, '0')} s`;
  };

  /**
   * Apply the AR-tile click filter to the SanMar `openOrders` payload.
   * The SanMar API call is unchanged (we don't want to re-hit the
   * gateway just because the operator clicked a tile); instead we
   * narrow / reorder client-side. 'all' = passthrough; 'open' drops
   * detail rows whose statusId >= 80; 'oldest' sorts every detail
   * row by `expectedShipDate` ascending so the longest-aged orders
   * float to the top of the table. Invariant: the array shape stays
   * `SanmarOrderStatus[]` so the existing flatMap render below works
   * unchanged. */
  const filteredOpenOrders = useMemo<SanmarOrderStatus[]>(() => {
    // Step 1: apply the phase filter (if any). Layered as the first
    // pass so the downstream 'open'/'oldest' transforms operate on
    // an already-narrowed set — keeps the table cheap and the chip
    // text accurate even if the operator stacks both dimensions.
    const phaseStatusIds = phaseFilter ? PHASE_STATUS_IDS[phaseFilter] : null;
    const afterPhase: SanmarOrderStatus[] = phaseStatusIds
      ? openOrders
          .map(o => ({
            ...o,
            orderStatusDetails: o.orderStatusDetails.filter(d =>
              phaseStatusIds.has(d.statusId),
            ),
          }))
          .filter(o => o.orderStatusDetails.length > 0)
      : openOrders;

    if (orderTableFilter === 'all') return afterPhase;
    if (orderTableFilter === 'open') {
      return afterPhase
        .map(o => ({
          ...o,
          orderStatusDetails: o.orderStatusDetails.filter(
            d => d.statusId < OPEN_STATUS_CUTOFF,
          ),
        }))
        // Drop orders that have no open detail rows so the table
        // doesn't show "(no detail rows)" placeholders for completed
        // POs the operator filtered away.
        .filter(o => o.orderStatusDetails.length > 0);
    }
    // 'oldest' — same set, just sorted by ship date ascending. Empty /
    // missing dates land at the end (Date NaN compares > anything).
    const allDetails = afterPhase
      .flatMap(o =>
        o.orderStatusDetails.map(d => ({ po: o.purchaseOrderNumber, d })),
      )
      .sort((a, b) => {
        const ta = new Date(a.d.expectedShipDate).getTime();
        const tb = new Date(b.d.expectedShipDate).getTime();
        const sa = Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER;
        const sb = Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER;
        return sa - sb;
      });
    // Re-group by PO number preserving the new sort order; first
    // occurrence wins so the parent PO row sits where its earliest
    // detail row lives.
    const groups = new Map<string, SanmarOrderStatus>();
    for (const { po, d } of allDetails) {
      const existing = groups.get(po);
      if (existing) {
        existing.orderStatusDetails.push(d);
      } else {
        groups.set(po, { purchaseOrderNumber: po, orderStatusDetails: [d] });
      }
    }
    return [...groups.values()];
  }, [openOrders, orderTableFilter, phaseFilter]);

  /** Toggle handler shared by every dot in every row. Clicking the same
   *  phase that's already active clears the filter; clicking a different
   *  phase replaces it. Wrapped in useCallback so the OrderStatusDots
   *  prop reference stays stable across re-renders. */
  const handlePhaseClick = useCallback((phase: SanmarStatusPhase) => {
    setPhaseFilter(prev => (prev === phase ? null : phase));
  }, []);

  /**
   * Export the visible open-orders snapshot to CSV for offline review.
   *
   * Mirrors {@link handleExportSyncLogCsv} in spirit (RFC 4180 quoting,
   * UTF-8 BOM, CRLF, formula-injection guard — all delegated to
   * {@link downloadCsv}) but the data source is dual: the SanMar API
   * payload in `filteredOpenOrders` gives us PO + status detail rows,
   * while a one-shot `sanmar_orders` lookup gives us the columns the
   * SanMar getOrderStatus call doesn't return — customer PO
   * (`va_order_id`), total CAD (`order_data.totalAmount`), and
   * submitted-at (`created_at`). We merge by `purchaseOrderNumber` so
   * the CSV emits one row per status detail row, exactly matching what
   * the operator sees on screen after any active filters.
   *
   * Filter respect: we read `filteredOpenOrders` (the same memo the
   * table renders), so if the operator filtered by phase or by the
   * AR-tile click ('open' / 'oldest'), only the narrowed set exports.
   * Empty-after-filter → toast.info, no file written.
   *
   * Columns (9): PO | Customer PO | Status ID | Status label | Phase |
   * Days open | Total CAD | Submitted at (ISO) | Expected ship date.
   *
   * The Supabase enrichment is best-effort — RLS blocks non-admins
   * from `sanmar_orders` already, so the export still works for the
   * president/admin caller. Missing rows fall back to empty cells so
   * the SanMar columns alone still surface in the CSV; only a hard
   * query failure aborts with a toast.
   */
  const handleExportOpenOrdersCsv = async () => {
    if (filteredOpenOrders.length === 0) {
      toast.info(
        lang === 'en'
          ? 'No open orders to export.'
          : 'Aucune commande ouverte à exporter.',
      );
      return;
    }
    setExportingOpenOrders(true);
    try {
      // Enrich with sanmar_orders rows so the CSV includes the columns
      // the SanMar API doesn't return. One IN-list query keyed on the
      // visible PO numbers — RLS still applies, missing rows fall back
      // to empty cells rather than blocking the export.
      const poNumbers = filteredOpenOrders.map(o => o.purchaseOrderNumber);
      type EnrichRow = {
        va_order_id: string | null;
        order_data: unknown;
        created_at: string | null;
      };
      const enrichByPo = new Map<
        string,
        { customerPo: string; totalCad: number | null; submittedAt: string | null }
      >();
      if (supabase && poNumbers.length > 0) {
        const { data, error } = await supabase
          .from('sanmar_orders')
          .select('va_order_id, order_data, created_at')
          .in('order_data->>purchaseOrderNumber', poNumbers);
        if (error) throw error;
        for (const row of (data ?? []) as EnrichRow[]) {
          const od =
            row.order_data && typeof row.order_data === 'object'
              ? (row.order_data as Record<string, unknown>)
              : {};
          const po = String(od.purchaseOrderNumber ?? '');
          if (!po) continue;
          const totalRaw = Number(
            (od as { totalAmount?: unknown }).totalAmount ?? NaN,
          );
          enrichByPo.set(po, {
            customerPo: row.va_order_id ?? '',
            totalCad: Number.isFinite(totalRaw) ? totalRaw : null,
            submittedAt: row.created_at,
          });
        }
      }

      const header = [
        lang === 'en' ? 'PO #' : 'No commande',
        lang === 'en' ? 'Customer PO' : 'PO client',
        lang === 'en' ? 'Status ID' : 'ID statut',
        lang === 'en' ? 'Status label' : 'Libellé statut',
        lang === 'en' ? 'Phase' : 'Phase',
        lang === 'en' ? 'Days open' : 'Jours ouverts',
        lang === 'en' ? 'Total CAD' : 'Total CAD',
        lang === 'en' ? 'Submitted at' : 'Soumise le',
        lang === 'en' ? 'Expected ship date' : 'Expédition prévue',
      ];
      const body: Array<Array<string | number | Date | null>> = [];
      for (const order of filteredOpenOrders) {
        const enrich = enrichByPo.get(order.purchaseOrderNumber);
        if (order.orderStatusDetails.length === 0) {
          // Edge case: the upstream sometimes returns a PO with no
          // detail rows (mid-sync race). Emit one row so the export
          // still shows the PO; status columns blank.
          body.push([
            order.purchaseOrderNumber,
            enrich?.customerPo ?? '',
            '',
            '',
            '',
            '',
            enrich?.totalCad ?? '',
            enrich?.submittedAt ? new Date(enrich.submittedAt) : '',
            '',
          ]);
          continue;
        }
        for (const d of order.orderStatusDetails) {
          const phase =
            SANMAR_STATUS_CHAIN.find(s => s.id === d.statusId)?.phase ?? '';
          const days = daysSince(d.validTimestamp);
          body.push([
            order.purchaseOrderNumber,
            enrich?.customerPo ?? '',
            d.statusId,
            d.statusName,
            phase,
            days ?? '',
            enrich?.totalCad ?? '',
            enrich?.submittedAt ? new Date(enrich.submittedAt) : '',
            d.expectedShipDate ?? '',
          ]);
        }
      }
      downloadCsv([header, ...body], csvFilename('sanmar-open-orders'));
      toast.success(
        lang === 'en'
          ? `Exported ${body.length} row${body.length === 1 ? '' : 's'}.`
          : `${body.length} ligne${body.length === 1 ? '' : 's'} exportée${body.length === 1 ? '' : 's'}.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        lang === 'en'
          ? `Export failed: ${msg}`
          : `Échec de l’export : ${msg}`,
      );
    } finally {
      setExportingOpenOrders(false);
    }
  };

  const envLabel = NEXT_GEN_ENABLED
    ? lang === 'en'
      ? 'PROD (next-gen edge functions enabled)'
      : 'PROD (fonctions edge nouvelle génération activées)'
    : lang === 'en'
      ? 'UAT (config-driven, gate disabled)'
      : 'UAT (piloté par config, gate désactivé)';

  // ── Webhook deliveries loader (Phase 19) ───────────────────────────────
  // Hidden when the cache layer isn't configured — operators not running
  // Python don't need a "no data" widget cluttering their dashboard.
  const cacheApiBaseUrl = (
    import.meta.env.VITE_SANMAR_CACHE_API_URL as string | undefined
  )?.trim();
  const webhookSectionEnabled = Boolean(cacheApiBaseUrl);

  const loadWebhookDeliveries = useCallback(async () => {
    if (!webhookSectionEnabled) return;
    setWebhookLoading(true);
    setWebhookError(null);
    try {
      const params: Record<string, string> = { limit: String(webhookLimit) };
      if (webhookOutcomeFilter !== 'all') params.outcome = webhookOutcomeFilter;
      if (webhookEventFilter !== 'all') params.event = webhookEventFilter;
      const search = new URLSearchParams(params).toString();
      const { data, error } = await supabase.functions.invoke(
        `sanmar-webhook-deliveries?${search}`,
        { method: 'GET' },
      );
      if (error) {
        setWebhookError({ message: error.message || 'edge_function_error' });
        return;
      }
      const payload = data as
        | {
            deliveries?: WebhookDeliveryRow[];
            total_count?: number;
            has_more?: boolean;
          }
        | null;
      setWebhookDeliveries(payload?.deliveries ?? []);
      setWebhookHasMore(Boolean(payload?.has_more));
      setWebhookTotalCount(
        typeof payload?.total_count === 'number' ? payload.total_count : null,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWebhookError({ message: msg });
    } finally {
      setWebhookLoading(false);
    }
  }, [webhookSectionEnabled, webhookLimit, webhookOutcomeFilter, webhookEventFilter]);

  // Initial load + reload on filter change. The dependency on
  // loadWebhookDeliveries (which closes over the filter state) is what
  // wires reactivity; eslint's exhaustive-deps gets it right here.
  useEffect(() => {
    if (!webhookSectionEnabled) return;
    void loadWebhookDeliveries();
  }, [webhookSectionEnabled, loadWebhookDeliveries]);

  const openTestFireDialog = () => {
    // Default PO carries a unix-ts so consecutive clicks don't collide.
    setTestFirePo(`TEST-${Math.floor(Date.now() / 1000)}`);
    setTestFireEvent('order.shipped');
    setTestFireOpen(true);
  };

  const submitTestFire = async () => {
    if (testFireSubmitting) return;
    setTestFireSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'sanmar-webhook-test',
        {
          body: {
            po_number: testFirePo.trim() || undefined,
            event: testFireEvent,
          },
        },
      );
      if (error) {
        const { title, action } = categorizeError(
          { message: error.message || '' },
          lang,
        );
        toast.error(
          lang === 'en' ? `Test fire failed: ${title}` : `Échec du test : ${title}`,
          { description: action },
        );
        return;
      }
      const payload = data as
        | {
            fired?: boolean;
            delivery?: WebhookDeliveryRow | null;
            is_test?: boolean;
          }
        | null;
      const delivery = payload?.delivery ?? null;
      if (delivery) {
        const status = delivery.status_code ?? '—';
        const ms = delivery.response_ms != null ? `${delivery.response_ms} ms` : '—';
        toast.success(
          lang === 'en'
            ? `Test fired: status ${status}, ${ms}`
            : `Test envoyé : statut ${status}, ${ms}`,
        );
      } else {
        toast.success(
          lang === 'en'
            ? 'Test fired (no delivery row persisted)'
            : 'Test envoyé (aucune livraison persistée)',
        );
      }
      setTestFireOpen(false);
      // Refresh the table so the new row shows up at the top.
      void loadWebhookDeliveries();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        lang === 'en' ? `Test fire failed: ${msg}` : `Échec du test : ${msg}`,
      );
    } finally {
      setTestFireSubmitting(false);
    }
  };

  /** Format a webhook signed_at into a relative + absolute string pair
   *  for the table cell. Mirrors the digest convention — relative for
   *  scannability, absolute on hover for forensic accuracy. */
  const formatWebhookTime = (iso: string | null): { rel: string; abs: string } => {
    if (!iso) return { rel: '—', abs: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { rel: '—', abs: iso };
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const rel =
      diffSec < 60
        ? lang === 'en' ? `${diffSec}s ago` : `il y a ${diffSec}s`
        : diffSec < 3600
          ? lang === 'en'
            ? `${Math.floor(diffSec / 60)}m ago`
            : `il y a ${Math.floor(diffSec / 60)} min`
          : diffSec < 86_400
            ? lang === 'en'
              ? `${Math.floor(diffSec / 3600)}h ago`
              : `il y a ${Math.floor(diffSec / 3600)} h`
            : lang === 'en'
              ? `${Math.floor(diffSec / 86_400)}d ago`
              : `il y a ${Math.floor(diffSec / 86_400)} j`;
    return {
      rel,
      abs: d.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA'),
    };
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-va-bg-1">
      {/* Header strip */}
      <header className="bg-va-bg-2 py-6 px-8 border-b border-va-line">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-black text-va-ink text-3xl tracking-tight">
              SanMar Canada
            </h1>
            <p className="text-va-muted text-sm mt-1">
              {lang === 'en' ? 'Environment' : 'Environnement'} : {envLabel}
            </p>
          </div>
          {/* Live realtime indicator. Only renders the chip when the
              Supabase Realtime channel is hot (SUBSCRIBED). On
              CHANNEL_ERROR / TIMED_OUT / CLOSED we keep the chip hidden
              rather than show a "disconnected" state — the page falls
              back silently to the existing manual-refresh / polling
              pattern, and surfacing a red dot would only worry the
              operator without giving them a useful action. */}
          {liveSubscribed ? (
            <div
              role="status"
              aria-live="polite"
              title={
                lang === 'en'
                  ? 'Realtime updates connected — sync runs and order status changes appear instantly.'
                  : 'Mises à jour en temps réel connectées — les synchros et changements de statut s’affichent instantanément.'
              }
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider"
            >
              {/* Pulsing green dot. Two layers: a ping halo (animated)
                  + a solid core. Tailwind's animate-ping is a stock
                  utility so no custom keyframes needed. */}
              <span className="relative inline-flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-600" />
              </span>
              {lang === 'en' ? 'Live' : 'En direct'}
            </div>
          ) : null}
        </div>
      </header>

      <div className="px-8 py-8 space-y-8">
        {/* Sync status */}
        <section
          aria-labelledby="sanmar-sync-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2
                id="sanmar-sync-title"
                className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
              >
                <Database size={20} aria-hidden="true" className="text-va-blue" />
                {lang === 'en' ? 'Catalogue sync' : 'Synchronisation du catalogue'}
              </h2>
              <p className="text-va-muted text-sm mt-1">
                {lang === 'en'
                  ? 'Last sync, style + part totals, manual refresh.'
                  : 'Dernière synchro, total des styles et parts, actualisation manuelle.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="bg-va-blue hover:bg-va-blue-hover text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 transition-colors"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={syncing ? 'animate-spin' : ''}
              />
              {syncing
                ? lang === 'en'
                  ? 'Synchronizing...'
                  : 'Synchronisation en cours...'
                : lang === 'en'
                  ? 'Sync now'
                  : 'Synchroniser maintenant'}
            </button>
          </div>
          {syncFetchError ? (
            <SanmarErrorPanel
              err={syncFetchError}
              lang={lang}
              className="mt-4"
            />
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-va-bg-2 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                  {lang === 'en' ? 'Last sync' : 'Dernière synchro'}
                </div>
                <CacheHealthBadge />
              </div>
              <div className="text-va-ink font-bold mt-1">
                {syncStatus.loading ? '…' : formatTimestamp(syncStatus.lastSync)}
              </div>
            </div>
            <div className="bg-va-bg-2 rounded-xl px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                {lang === 'en' ? 'Last sync type' : 'Dernier type de synchro'}
              </div>
              <div className="text-va-ink font-bold mt-1 text-base">
                {recentRunsLoading
                  ? '…'
                  : recentRuns[0]
                    ? formatSyncType(String(recentRuns[0].sync_type ?? ''))
                    : '—'}
              </div>
            </div>
            <div className="bg-va-bg-2 rounded-xl px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                {lang === 'en' ? 'Total parts (SKUs)' : 'Total parts (SKUs)'}
              </div>
              <div className="text-va-ink font-bold mt-1 text-2xl">
                {syncStatus.loading ? '…' : syncStatus.totalParts.toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        {/* Last sync runs — last 5 rows of public.sanmar_sync_log so the
            operator can see at a glance which sync ran (catalog /
            inventory / order_status), when, success/fail (derived from
            the JSONB `errors` column), and how long it took. The data
            comes from the same fetch as the headline cards above so we
            don't double-hit Supabase. Renders a soft empty state when
            the table is missing or hasn't logged anything yet. */}
        <section
          aria-labelledby="sanmar-recent-runs-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2
                id="sanmar-recent-runs-title"
                className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
              >
                <History size={20} aria-hidden="true" className="text-va-blue" />
                {lang === 'en' ? 'Recent sync runs' : 'Dernières synchros'}
              </h2>
              <p className="text-va-muted text-sm mt-1">
                {lang === 'en'
                  ? 'Last 5 entries from sanmar_sync_log — type, when, success / fail, duration, items processed.'
                  : 'Les 5 dernières entrées de sanmar_sync_log — type, quand, succès / échec, durée, items traités.'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportSyncLogCsv}
                disabled={exportingSyncLog}
                title={
                  lang === 'en'
                    ? `Download up to ${SYNC_LOG_EXPORT_LIMIT} most recent runs as CSV`
                    : `Télécharger jusqu’à ${SYNC_LOG_EXPORT_LIMIT} synchros récentes en CSV`
                }
                className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                <Download
                  size={14}
                  aria-hidden="true"
                  className={exportingSyncLog ? 'animate-pulse' : ''}
                />
                {exportingSyncLog
                  ? lang === 'en'
                    ? 'Exporting…'
                    : 'Export…'
                  : lang === 'en'
                    ? 'Download CSV'
                    : 'Télécharger CSV'}
              </button>
              <button
                type="button"
                onClick={() => loadRecentRuns()}
                disabled={recentRunsLoading}
                className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                  className={recentRunsLoading ? 'animate-spin' : ''}
                />
                {lang === 'en' ? 'Refresh' : 'Actualiser'}
              </button>
            </div>
          </div>
          {syncFetchError ? (
            <SanmarErrorPanel err={syncFetchError} lang={lang} />
          ) : recentRunsLoading && recentRuns.length === 0 ? (
            <p className="text-va-muted text-sm py-6 text-center">
              {lang === 'en' ? 'Loading…' : 'Chargement…'}
            </p>
          ) : recentRuns.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <p className="text-va-fg text-sm font-medium">
                {lang === 'en'
                  ? 'No sync runs logged yet.'
                  : 'Aucune synchro enregistrée pour le moment.'}
              </p>
              <p className="text-va-muted text-xs max-w-md mx-auto">
                {lang === 'en'
                  ? 'Use the Sync card above (Inventory or Orders) to trigger a run — entries appear here within seconds.'
                  : 'Utilise la carte Synchro ci-dessus (Inventaire ou Commandes) pour lancer une exécution — les entrées apparaissent ici en quelques secondes.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-va-muted border-b border-va-line">
                    <th className="py-2 pr-4">{lang === 'en' ? 'Type' : 'Type'}</th>
                    <th className="py-2 pr-4">{lang === 'en' ? 'When' : 'Quand'}</th>
                    <th className="py-2 pr-4">{lang === 'en' ? 'Status' : 'Statut'}</th>
                    <th className="py-2 pr-4 text-right">
                      {lang === 'en' ? 'Duration' : 'Durée'}
                    </th>
                    <th className="py-2 pr-4 text-right">
                      {lang === 'en' ? 'Processed' : 'Traités'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((row, i) => {
                    const ok = isSyncOk(row);
                    const errCount = Array.isArray(row.errors) ? row.errors.length : 0;
                    return (
                      <tr
                        key={row.id ?? `${row.created_at}-${i}`}
                        className="border-b border-va-line/50 hover:bg-va-bg-2/50"
                      >
                        <td className="py-2 pr-4 text-va-ink font-bold">
                          {formatSyncType(String(row.sync_type ?? ''))}
                        </td>
                        <td className="py-2 pr-4 text-va-dim text-xs">
                          {formatTimestamp(row.created_at)}
                        </td>
                        <td className="py-2 pr-4">
                          {ok ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                              <CheckCircle2 size={12} aria-hidden="true" />
                              {lang === 'en' ? 'Success' : 'Succès'}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-0.5"
                              title={
                                errCount > 0
                                  ? lang === 'en'
                                    ? `${errCount} error(s) — see sanmar_sync_log.errors`
                                    : `${errCount} erreur(s) — voir sanmar_sync_log.errors`
                                  : undefined
                              }
                            >
                              <XCircle size={12} aria-hidden="true" />
                              {lang === 'en'
                                ? errCount > 0
                                  ? `Fail (${errCount})`
                                  : 'Fail'
                                : errCount > 0
                                  ? `Échec (${errCount})`
                                  : 'Échec'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right text-va-dim">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} aria-hidden="true" className="text-va-muted" />
                            {formatDuration(row.duration_ms)}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right text-va-ink font-bold">
                          {(row.total_processed ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* pg_cron health — live state of the three sanmar-* scheduled
            jobs (catalog Sunday 03:00, inventory daily 05:15, order-status
            every 30min). Comes from the SECURITY DEFINER
            get_sanmar_cron_health() RPC which gates on is_admin().
            Renders soft-empty when the function isn't deployed yet or
            the operator isn't admin — same pattern as recent runs. */}
        <section
          aria-labelledby="sanmar-cron-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2
                id="sanmar-cron-title"
                className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
              >
                <CalendarClock size={20} aria-hidden="true" className="text-va-blue" />
                {lang === 'en' ? 'Scheduled tasks (pg_cron)' : 'Tâches planifiées (pg_cron)'}
              </h2>
              <p className="text-va-muted text-sm mt-1">
                {lang === 'en'
                  ? 'Live state of every sanmar-* cron job — schedule, last run, duration.'
                  : 'État en direct de chaque tâche cron sanmar-* — horaire, dernière exécution, durée.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadCronHealth()}
              disabled={cronHealthLoading}
              className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={cronHealthLoading ? 'animate-spin' : ''}
              />
              {lang === 'en' ? 'Refresh' : 'Actualiser'}
            </button>
          </div>
          {cronHealthError ? (
            <SanmarErrorPanel err={cronHealthError} lang={lang} />
          ) : cronHealthLoading && cronHealth.length === 0 ? (
            <p className="text-va-muted text-sm py-6 text-center">
              {lang === 'en' ? 'Loading…' : 'Chargement…'}
            </p>
          ) : cronHealth.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <p className="text-va-fg text-sm font-medium">
                {lang === 'en'
                  ? 'No sanmar-* cron jobs registered.'
                  : 'Aucune tâche cron sanmar-* enregistrée.'}
              </p>
              <p className="text-va-muted text-xs max-w-md mx-auto">
                {lang === 'en'
                  ? 'Either pg_cron jobs haven\'t been deployed yet, or this role lacks SELECT on cron.job. Check supabase/migrations/*sanmar*cron* and ensure the get_sanmar_cron_health() RPC is granted to authenticated.'
                  : 'Soit les tâches pg_cron ne sont pas encore déployées, soit ce rôle n\'a pas SELECT sur cron.job. Vérifie supabase/migrations/*sanmar*cron* et que la RPC get_sanmar_cron_health() est accordée à authenticated.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-va-muted border-b border-va-line">
                    <th className="py-2 pr-4">{lang === 'en' ? 'Job' : 'Tâche'}</th>
                    <th className="py-2 pr-4">{lang === 'en' ? 'Schedule' : 'Horaire'}</th>
                    <th className="py-2 pr-4">{lang === 'en' ? 'Active' : 'Active'}</th>
                    <th className="py-2 pr-4">{lang === 'en' ? 'Last run' : 'Dernière exécution'}</th>
                    <th className="py-2 pr-4">{lang === 'en' ? 'Status' : 'Statut'}</th>
                    <th className="py-2 pr-4 text-right">
                      {lang === 'en' ? 'Duration' : 'Durée'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cronHealth.map(row => {
                    const ok = isCronRunOk(row.last_status);
                    const inFlight = isCronRunInFlight(row.last_status);
                    return (
                      <tr
                        key={row.jobname}
                        className="border-b border-va-line/50 hover:bg-va-bg-2/50"
                      >
                        <td className="py-2 pr-4">
                          <div className="text-va-ink font-bold">
                            {formatJobName(row.jobname)}
                          </div>
                          <div className="text-va-muted text-[11px] font-mono">
                            {row.jobname}
                          </div>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-va-dim">
                          {row.schedule}
                        </td>
                        <td className="py-2 pr-4">
                          {row.active ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                              {lang === 'en' ? 'Active' : 'Active'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-va-muted bg-va-bg-2 border border-va-line rounded-md px-2 py-0.5">
                              {lang === 'en' ? 'Paused' : 'En pause'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-va-dim text-xs">
                          {row.last_run_at ? (
                            <span title={formatTimestamp(row.last_run_at)}>
                              {formatRelativeTime(row.last_run_at)}
                            </span>
                          ) : (
                            lang === 'en' ? 'never' : 'jamais'
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {row.last_status == null ? (
                            <span className="text-va-muted text-xs">—</span>
                          ) : ok ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5"
                              title={row.last_message ?? undefined}
                            >
                              <CheckCircle2 size={12} aria-hidden="true" />
                              {lang === 'en' ? 'Success' : 'Succès'}
                            </span>
                          ) : inFlight ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5"
                              title={row.last_status}
                            >
                              <Clock size={12} aria-hidden="true" />
                              {lang === 'en' ? 'Running' : 'En cours'}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-0.5"
                              title={row.last_message ?? row.last_status}
                            >
                              <XCircle size={12} aria-hidden="true" />
                              {lang === 'en' ? 'Fail' : 'Échec'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right text-va-dim">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} aria-hidden="true" className="text-va-muted" />
                            {formatCronDuration(row.last_duration_s)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* AR Summary — comptes recevables / open AR balance.
            Three click-to-filter tiles backed by one sanmar_orders
            query (see loadArStats). Mirrors the digest computation in
            supabase/functions/_shared/sanmar/digest.ts so the operator
            doesn't have to wait for the 08:00 ET Slack ping to know
            the open balance. Empty / UAT state: zeroes + "—" for the
            oldest tile, no crash. */}
        <section
          aria-labelledby="sanmar-ar-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2
                id="sanmar-ar-title"
                className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
              >
                <Wallet size={20} aria-hidden="true" className="text-va-blue" />
                {lang === 'en'
                  ? 'AR Summary / Comptes recevables'
                  : 'Comptes recevables / AR Summary'}
              </h2>
              <p className="text-va-muted text-sm mt-1">
                {lang === 'en'
                  ? 'Server-side aggregate via get_sanmar_ar_summary(). Open balance, count, oldest age — plus a 30-day closed/paid recap below. Click a tile to filter the orders table.'
                  : 'Agrégat côté serveur via get_sanmar_ar_summary(). Solde ouvert, nombre, plus ancienne — plus un récap 30 jours fermé/payé ci-dessous. Clique sur une tuile pour filtrer la table.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadArStats()}
              disabled={arLoading}
              className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={arLoading ? 'animate-spin' : ''}
              />
              {lang === 'en' ? 'Refresh' : 'Actualiser'}
            </button>
          </div>
          {arError ? (
            <SanmarErrorPanel err={arError} lang={lang} className="mb-4" />
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tile 1 — Open AR balance (CAD) */}
            <button
              type="button"
              onClick={() => setOrderTableFilter('open')}
              aria-pressed={orderTableFilter === 'open'}
              aria-label={
                lang === 'en'
                  ? 'Filter open orders table by open status'
                  : 'Filtrer la table des commandes par statut ouvert'
              }
              className={`text-left bg-va-bg-2 rounded-xl px-5 py-4 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 hover:bg-va-bg-1 ${
                orderTableFilter === 'open'
                  ? 'border-va-blue ring-1 ring-va-blue/30'
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-va-muted">
                <DollarSign size={12} aria-hidden="true" />
                {lang === 'en' ? 'Open AR balance (CAD)' : 'Solde ouvert (CAD)'}
              </div>
              <div className="text-va-ink font-black text-3xl mt-2 tabular-nums">
                {arLoading ? '…' : formatCad(arStats.openBalance)}
              </div>
              <div className="text-va-muted text-xs mt-1">
                {arError
                  ? lang === 'en'
                    ? '(query failed — see console)'
                    : '(échec de la requête — voir console)'
                  : formatUpdatedAgo(arUpdatedAt)}
              </div>
            </button>

            {/* Tile 2 — Open orders count */}
            <button
              type="button"
              onClick={() => setOrderTableFilter('open')}
              aria-pressed={orderTableFilter === 'open'}
              aria-label={
                lang === 'en'
                  ? 'Filter open orders table by open status'
                  : 'Filtrer la table des commandes par statut ouvert'
              }
              className={`text-left bg-va-bg-2 rounded-xl px-5 py-4 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 hover:bg-va-bg-1 ${
                orderTableFilter === 'open'
                  ? 'border-va-blue ring-1 ring-va-blue/30'
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-va-muted">
                <FileText size={12} aria-hidden="true" />
                {lang === 'en' ? 'Open orders' : 'Commandes ouvertes'}
              </div>
              <div className="text-va-ink font-black text-3xl mt-2 tabular-nums">
                {arLoading ? '…' : arStats.openCount.toLocaleString()}
              </div>
              <div className="text-va-muted text-xs mt-1">
                {arError
                  ? lang === 'en'
                    ? '(query failed)'
                    : '(échec de la requête)'
                  : formatUpdatedAgo(arUpdatedAt)}
              </div>
            </button>

            {/* Tile 3 — Oldest open order age. Warns past
                OLDEST_WARN_DAYS (14) — accounting SLA. Click sorts
                the orders table by ship date asc so the operator
                can drill into the laggards. */}
            <button
              type="button"
              onClick={() => setOrderTableFilter('oldest')}
              aria-pressed={orderTableFilter === 'oldest'}
              aria-label={
                lang === 'en'
                  ? 'Sort open orders table by oldest first'
                  : 'Trier la table des commandes par les plus anciennes'
              }
              className={`text-left bg-va-bg-2 rounded-xl px-5 py-4 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 hover:bg-va-bg-1 ${
                orderTableFilter === 'oldest'
                  ? 'border-va-blue ring-1 ring-va-blue/30'
                  : arStats.oldestDays != null && arStats.oldestDays > OLDEST_WARN_DAYS
                    ? 'border-amber-300 ring-1 ring-amber-200'
                    : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-va-muted">
                {arStats.oldestDays != null &&
                arStats.oldestDays > OLDEST_WARN_DAYS ? (
                  <AlertTriangle
                    size={12}
                    aria-hidden="true"
                    className="text-amber-700"
                  />
                ) : (
                  <Clock size={12} aria-hidden="true" />
                )}
                {lang === 'en' ? 'Oldest open order' : 'Plus ancienne commande'}
              </div>
              <div
                className={`font-black text-3xl mt-2 tabular-nums ${
                  arStats.oldestDays != null &&
                  arStats.oldestDays > OLDEST_WARN_DAYS
                    ? 'text-amber-700'
                    : 'text-va-ink'
                }`}
              >
                {arLoading
                  ? '…'
                  : arStats.oldestDays == null
                    ? '—'
                    : lang === 'en'
                      ? `${arStats.oldestDays}d`
                      : `${arStats.oldestDays} j`}
              </div>
              <div className="text-va-muted text-xs mt-1">
                {arError
                  ? lang === 'en'
                    ? '(query failed)'
                    : '(échec de la requête)'
                  : arStats.oldestDays != null &&
                      arStats.oldestDays > OLDEST_WARN_DAYS
                    ? lang === 'en'
                      ? `Past ${OLDEST_WARN_DAYS}d SLA — investigate`
                      : `Au-delà du SLA de ${OLDEST_WARN_DAYS} j — à investiguer`
                    : formatUpdatedAgo(arUpdatedAt)}
              </div>
            </button>
          </div>

          {/* 30-day recap subsection — closed orders count + paid balance.
              Smaller, secondary read because the operator's main job is
              still chasing open AR; these two tiles show "what
              actually closed lately" so accounting can sanity-check
              the digest and the president can see throughput at a
              glance without per-order PII. Both source from the
              get_sanmar_ar_summary() RPC; the legacy fallback path
              renders zeroes here (closed/paid history isn't part of
              the legacy "open rows only" query). */}
          <div className="mt-6 pt-6 border-t border-va-line">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-va-muted mb-3">
              {lang === 'en' ? 'Last 30 days' : '30 derniers jours'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tile 4 — Closed last 30d (count) */}
              <div className="bg-va-bg-2 rounded-xl px-5 py-4 border border-transparent">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-va-muted">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  {lang === 'en' ? 'Closed last 30d' : 'Fermées (30 j)'}
                </div>
                <div className="text-va-ink font-black text-2xl mt-2 tabular-nums">
                  {arLoading ? '…' : arStats.closedCount30d.toLocaleString()}
                </div>
                <div className="text-va-muted text-xs mt-1">
                  {lang === 'en'
                    ? 'Status 80 (paid) + 99 (cancelled)'
                    : 'Statut 80 (payée) + 99 (annulée)'}
                </div>
              </div>

              {/* Tile 5 — Paid balance, last 30d (CAD).
                  Status 80 only (cancelled orders excluded — they were
                  never invoiced). Useful for the daily/weekly throughput
                  sanity check against the digest. */}
              <div className="bg-va-bg-2 rounded-xl px-5 py-4 border border-transparent">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-va-muted">
                  <DollarSign size={12} aria-hidden="true" />
                  {lang === 'en' ? 'Paid 30d (CAD)' : 'Payé 30 j (CAD)'}
                </div>
                <div className="text-va-ink font-black text-2xl mt-2 tabular-nums">
                  {arLoading ? '…' : formatCad(arStats.paidBalance30d)}
                </div>
                <div className="text-va-muted text-xs mt-1">
                  {lang === 'en'
                    ? 'Sum of order_data.totalAmount where status_id = 80'
                    : 'Somme de order_data.totalAmount, statut_id = 80'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cache hit ratio (24h) — Phase 12 observability widget.
            Reads aggregated counters from sanmar_cache_metrics (router
            instrumentation in supabase/functions/_shared/sanmar/router.ts).
            Four stat tiles, one per cache-able operation: products,
            inventory, pricing, orders. Each tile shows hit ratio %, raw
            counts, and a horizontal progress bar drawn with plain CSS
            (recharts isn't in the bundle). Empty state when the table
            hasn't accumulated rows yet — neutral "—" + "no data yet"
            caption rather than 0% (which would imply a cache outage). */}
        <section
          aria-labelledby="sanmar-cache-ratio-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2
                id="sanmar-cache-ratio-title"
                className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
              >
                <Gauge size={20} aria-hidden="true" className="text-va-blue" />
                {lang === 'en'
                  ? 'Cache hit ratio (24h)'
                  : 'Taux de cache (24 h)'}
              </h2>
              <p className="text-va-muted text-sm mt-1">
                {lang === 'en'
                  ? 'Per-operation cache health from sanmar_cache_metrics. Higher is better — every hit is one less SOAP round-trip.'
                  : 'Santé du cache par opération depuis sanmar_cache_metrics. Plus c’est haut, mieux c’est — chaque hit évite un aller-retour SOAP.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadCacheRatio()}
              disabled={cacheRatioLoading}
              className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={cacheRatioLoading ? 'animate-spin' : ''}
              />
              {lang === 'en' ? 'Refresh' : 'Actualiser'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['products', 'inventory', 'pricing', 'orders'] as const).map(op => {
              const stats = cacheRatio[op];
              const hasData = stats.total > 0;
              const ratio = hasData ? stats.hit / stats.total : 0;
              const pct = Math.round(ratio * 100);
              // Three-tier health colour. ≥ 70% = green (the PromQL alert
              // threshold), 40–70% = amber, < 40% = rose. Empty buckets
              // render neutral grey so the operator doesn't read "danger"
              // into "no traffic yet".
              const tier = !hasData
                ? 'neutral'
                : ratio >= 0.7
                  ? 'good'
                  : ratio >= 0.4
                    ? 'warn'
                    : 'bad';
              const barClass =
                tier === 'good'
                  ? 'bg-emerald-500'
                  : tier === 'warn'
                    ? 'bg-amber-500'
                    : tier === 'bad'
                      ? 'bg-rose-500'
                      : 'bg-va-line';
              const labels: Record<typeof op, { en: string; fr: string }> = {
                products: { en: 'Products', fr: 'Produits' },
                inventory: { en: 'Inventory', fr: 'Inventaire' },
                pricing: { en: 'Pricing', fr: 'Tarification' },
                orders: { en: 'Orders', fr: 'Commandes' },
              };
              return (
                <div
                  key={op}
                  className="bg-va-bg-2 rounded-xl px-5 py-4 border border-transparent"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                    {lang === 'en' ? labels[op].en : labels[op].fr}
                  </div>
                  <div className="text-va-ink font-black text-3xl mt-2 tabular-nums">
                    {cacheRatioLoading
                      ? '…'
                      : hasData
                        ? `${pct}%`
                        : '—'}
                  </div>
                  <div
                    className="mt-3 h-2 w-full rounded-full bg-va-line/60 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={hasData ? pct : 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={
                      lang === 'en'
                        ? `${labels[op].en} cache hit ratio: ${hasData ? pct : 0}%`
                        : `Taux de hit ${labels[op].fr.toLowerCase()} : ${hasData ? pct : 0} %`
                    }
                  >
                    <div
                      className={`h-full rounded-full transition-all ${barClass}`}
                      style={{ width: hasData ? `${pct}%` : '0%' }}
                    />
                  </div>
                  <div className="text-va-muted text-xs mt-2 tabular-nums">
                    {hasData
                      ? lang === 'en'
                        ? `${stats.hit.toLocaleString()} / ${stats.total.toLocaleString()} req.`
                        : `${stats.hit.toLocaleString()} / ${stats.total.toLocaleString()} req.`
                      : lang === 'en'
                        ? 'No data yet'
                        : 'Aucune donnée'}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-va-muted text-xs mt-4">
            {cacheRatioUpdatedAt
              ? lang === 'en'
                ? `Updated ${formatUpdatedAgo(cacheRatioUpdatedAt)}`
                : `Mis à jour ${formatUpdatedAgo(cacheRatioUpdatedAt)}`
              : null}
          </div>
        </section>

        {/* Inventory table */}
        <section
          aria-labelledby="sanmar-catalog-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <h2
            id="sanmar-catalog-title"
            className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2 mb-4"
          >
            <Boxes size={20} aria-hidden="true" className="text-va-blue" />
            {lang === 'en' ? 'Inventory' : 'Inventaire'}
          </h2>
          {catalogError ? (
            <SanmarErrorPanel
              err={catalogError}
              lang={lang}
              className="mb-4"
            />
          ) : null}
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-va-muted border-b border-va-line">
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">{lang === 'en' ? 'Style' : 'Style'}</th>
                  <th className="py-2 pr-4">{lang === 'en' ? 'Color' : 'Couleur'}</th>
                  <th className="py-2 pr-4">{lang === 'en' ? 'Size' : 'Taille'}</th>
                  <th className="py-2 pr-4 text-right">
                    {lang === 'en' ? 'Price' : 'Prix'}
                  </th>
                  <th className="py-2 pr-4 text-right">
                    {lang === 'en' ? 'Total' : 'Total'}
                  </th>
                  <th className="py-2 pr-4 text-right">Vancouver</th>
                  <th className="py-2 pr-4 text-right">Mississauga</th>
                  <th className="py-2 pr-4 text-right">Calgary</th>
                  <th className="py-2 pr-4">
                    {lang === 'en' ? 'Last synced' : 'Dernière synchro'}
                  </th>
                  <th className="py-2 pr-4 text-right">
                    <span className="sr-only">
                      {lang === 'en' ? 'Refresh' : 'Actualiser'}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {catalogLoading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-va-muted">
                      {lang === 'en' ? 'Loading...' : 'Chargement...'}
                    </td>
                  </tr>
                ) : catalogRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <div className="space-y-1.5">
                        <p className="text-va-fg text-sm font-medium">
                          {lang === 'en'
                            ? 'Catalogue is empty.'
                            : 'Le catalogue est vide.'}
                        </p>
                        <p className="text-va-muted text-xs max-w-md mx-auto">
                          {lang === 'en'
                            ? 'Trigger an Inventory sync from the Sync card above. Once it completes, ~3k SKUs across 4 warehouses will populate this table.'
                            : 'Lance une synchro Inventaire depuis la carte ci-dessus. Une fois terminée, environ 3 000 SKU sur 4 entrepôts apparaîtront ici.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  catalogRows.map((row, i) => (
                    <tr
                      key={`${row.sku ?? row.style_id}-${i}`}
                      className="border-b border-va-line/50 hover:bg-va-bg-2/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-va-ink">
                        {row.sku ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-va-ink font-bold">
                        {row.style_id ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-va-dim">{row.color ?? '—'}</td>
                      <td className="py-2 pr-4 text-va-dim">{row.size ?? '—'}</td>
                      <td className="py-2 pr-4 text-right text-va-ink">
                        {row.price != null
                          ? row.price.toLocaleString(
                              lang === 'fr' ? 'fr-CA' : 'en-CA',
                              { style: 'currency', currency: 'CAD' },
                            )
                          : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-ink font-bold">
                        {row.total_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-dim">
                        {row.vancouver_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-dim">
                        {row.mississauga_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-dim">
                        {row.calgary_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-xs text-va-muted">
                        {formatTimestamp(row.last_synced_at)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {row.style_id ? (
                          <button
                            type="button"
                            onClick={() => handleForceRefreshStyle(row.style_id)}
                            disabled={refreshingStyles.has(row.style_id)}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-va-muted hover:text-va-ink hover:bg-va-bg-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label={
                              lang === 'en'
                                ? `Force resync style ${row.style_id}`
                                : `Forcer la resynchro du style ${row.style_id}`
                            }
                            title={
                              lang === 'en'
                                ? `Force resync style ${row.style_id}`
                                : `Forcer la resynchro du style ${row.style_id}`
                            }
                          >
                            <RefreshCw
                              size={14}
                              aria-hidden="true"
                              className={
                                refreshingStyles.has(row.style_id)
                                  ? 'animate-spin'
                                  : ''
                              }
                            />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {catalogTotal > 0 && (
            <div className="mt-4">
              <TablePagination
                page={catalogPage}
                pageSize={PAGE_SIZE}
                total={catalogTotal}
                onPageChange={setCatalogPage}
                itemLabel={lang === 'en' ? 'SKUs' : 'SKUs'}
              />
            </div>
          )}
        </section>

        {/* Open orders */}
        <section
          aria-labelledby="sanmar-orders-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2
                id="sanmar-orders-title"
                className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
              >
                <PackageSearch size={20} aria-hidden="true" className="text-va-blue" />
                {lang === 'en' ? 'Open orders' : 'Commandes ouvertes'}
              </h2>
              {orderTableFilter !== 'all' && (
                // Active-filter chip + clear button. Surfaces *why*
                // the operator might be staring at a smaller table than
                // expected after clicking an AR tile, and gives them a
                // one-click escape hatch back to the full list.
                <span className="inline-flex items-center gap-2 text-xs font-bold text-va-blue bg-va-blue/10 border border-va-blue/30 rounded-full px-3 py-1">
                  {orderTableFilter === 'open'
                    ? lang === 'en'
                      ? 'Filter: open only (status < 80)'
                      : 'Filtre : ouvertes seulement (statut < 80)'
                    : lang === 'en'
                      ? 'Filter: oldest first'
                      : 'Filtre : les plus anciennes d’abord'}
                  <button
                    type="button"
                    onClick={() => setOrderTableFilter('all')}
                    className="text-va-blue hover:text-va-blue-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 rounded"
                    aria-label={
                      lang === 'en' ? 'Clear filter' : 'Effacer le filtre'
                    }
                    title={lang === 'en' ? 'Clear filter' : 'Effacer le filtre'}
                  >
                    <XCircle size={14} aria-hidden="true" />
                  </button>
                </span>
              )}
              {phaseFilter && (
                // Phase filter chip — independent dimension from the
                // tile-driven 'open'/'oldest' filter above. Set when the
                // operator clicks one of the dots in OrderStatusDots
                // below; cleared via the X here or by clicking the same
                // dot a second time.
                <span className="inline-flex items-center gap-2 text-xs font-bold text-va-blue bg-va-blue/10 border border-va-blue/30 rounded-full px-3 py-1">
                  {lang === 'en'
                    ? `Filtered by phase: ${PHASE_LABEL[phaseFilter].en}`
                    : `Filtré par phase : ${PHASE_LABEL[phaseFilter].fr}`}
                  <button
                    type="button"
                    onClick={() => setPhaseFilter(null)}
                    className="text-va-blue hover:text-va-blue-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 rounded"
                    aria-label={
                      lang === 'en'
                        ? 'Clear phase filter'
                        : 'Effacer le filtre de phase'
                    }
                    title={
                      lang === 'en'
                        ? 'Clear phase filter'
                        : 'Effacer le filtre de phase'
                    }
                  >
                    <XCircle size={14} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportOpenOrdersCsv}
                disabled={exportingOpenOrders || filteredOpenOrders.length === 0}
                title={
                  lang === 'en'
                    ? 'Download the visible filtered open orders as CSV'
                    : 'Télécharger les commandes ouvertes visibles en CSV'
                }
                className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                <Download
                  size={14}
                  aria-hidden="true"
                  className={exportingOpenOrders ? 'animate-pulse' : ''}
                />
                {exportingOpenOrders
                  ? lang === 'en'
                    ? 'Exporting…'
                    : 'Export…'
                  : lang === 'en'
                    ? 'Download CSV'
                    : 'Télécharger CSV'}
              </button>
              <button
                type="button"
                onClick={fetchOpenOrders}
                disabled={openOrdersLoading}
                className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                  className={openOrdersLoading ? 'animate-spin' : ''}
                />
                {lang === 'en' ? 'Refresh' : 'Actualiser'}
              </button>
            </div>
          </div>
          {openOrdersError ? (
            <SanmarErrorPanel err={openOrdersError} lang={lang} />
          ) : openOrders.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              {openOrdersLastPoll ? (
                <>
                  <p className="text-va-fg text-sm font-medium">
                    {lang === 'en'
                      ? 'No open orders right now.'
                      : 'Aucune commande ouverte en ce moment.'}
                  </p>
                  <p className="text-va-muted text-xs max-w-md mx-auto">
                    {lang === 'en'
                      ? 'Every SanMar PO is closed (status 80) or cancelled (99). New POs will surface here within ~5 min of the next sync — or click Refresh to poll now.'
                      : 'Toutes les commandes SanMar sont fermées (statut 80) ou annulées (99). Les nouvelles apparaîtront ici environ 5 min après la prochaine synchro — ou clique sur Actualiser pour interroger maintenant.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-va-fg text-sm font-medium">
                    {lang === 'en'
                      ? 'Open orders not loaded yet.'
                      : 'Commandes ouvertes pas encore chargées.'}
                  </p>
                  <p className="text-va-muted text-xs max-w-md mx-auto">
                    {lang === 'en'
                      ? 'Click Refresh above to fetch the current SanMar PO snapshot. The table polls on demand to keep API calls cheap.'
                      : 'Clique sur Actualiser ci-dessus pour récupérer l\'instantané SanMar actuel. La table interroge sur demande pour économiser les appels API.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-va-muted border-b border-va-line">
                    <th className="py-2 pr-4">PO #</th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Sales order' : 'No commande SanMar'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Progress' : 'Progression'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Status' : 'Statut'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Expected ship' : 'Expédition prévue'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Last poll' : 'Dernier sondage'}
                    </th>
                    <th className="py-2 pr-4">
                      <span className="sr-only">
                        {lang === 'en' ? 'Internal note' : 'Note interne'}
                      </span>
                      <span aria-hidden="true">
                        {lang === 'en' ? 'Note' : 'Note'}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpenOrders.flatMap(o =>
                    o.orderStatusDetails.length === 0
                      ? [
                          <tr
                            key={`${o.purchaseOrderNumber}-empty`}
                            className="border-b border-va-line/50"
                          >
                            <td className="py-2 pr-4 font-mono text-xs">
                              {o.purchaseOrderNumber}
                            </td>
                            <td className="py-2 pr-4 text-va-muted" colSpan={5}>
                              {lang === 'en' ? '(no detail rows)' : '(aucune ligne)'}
                            </td>
                            <td className="py-2 pr-4">
                              <NoteButton
                                po={o.purchaseOrderNumber}
                                hasNote={Boolean(notesByPo[o.purchaseOrderNumber])}
                                lang={lang}
                                onOpen={openNoteEditor}
                              />
                            </td>
                          </tr>,
                        ]
                      : o.orderStatusDetails.map((d, i) => {
                          // Row-level highlight: when the operator hovers
                          // a dot in the visualizer, every row whose
                          // statusId belongs to the same phase gets a
                          // subtle ring so they can see at a glance which
                          // rows the click would filter to. CSS-only —
                          // no React state per row, just a derived class
                          // computed from hoveredPhase + this row's id.
                          const rowPhase = SANMAR_STATUS_CHAIN.find(
                            s => s.id === d.statusId,
                          )?.phase;
                          const isHovered =
                            hoveredPhase != null && rowPhase === hoveredPhase;
                          return (
                          <tr
                            key={`${o.purchaseOrderNumber}-${d.factoryOrderNumber}-${i}`}
                            className={`border-b border-va-line/50 hover:bg-va-bg-2/50 transition-colors ${
                              isHovered ? 'bg-va-blue/5 outline outline-1 outline-va-blue/40' : ''
                            }`}
                          >
                            <td className="py-2 pr-4 font-mono text-xs">
                              {o.purchaseOrderNumber}
                            </td>
                            <td className="py-2 pr-4 font-mono text-xs">
                              {d.factoryOrderNumber}
                            </td>
                            <td className="py-2 pr-4">
                              <OrderStatusDots
                                statusId={d.statusId}
                                validTimestamp={d.validTimestamp}
                                lang={lang}
                                activePhase={phaseFilter}
                                onPhaseClick={handlePhaseClick}
                                onPhaseHover={setHoveredPhase}
                              />
                            </td>
                            <td className="py-2 pr-4 text-va-ink font-bold">
                              {d.statusName}{' '}
                              <span className="text-va-muted font-normal">
                                ({d.statusId})
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-va-dim">
                              {formatTimestamp(d.expectedShipDate)}
                            </td>
                            <td className="py-2 pr-4 text-xs text-va-muted">
                              {openOrdersLastPoll
                                ? openOrdersLastPoll.toLocaleString(
                                    lang === 'fr' ? 'fr-CA' : 'en-CA',
                                  )
                                : '—'}
                            </td>
                            <td className="py-2 pr-4">
                              {/*
                                Notes are per-PO, but a single PO can
                                have multiple detail rows (one per
                                factory line item). Render the Note
                                button only on the first detail row to
                                avoid stuttering the same control N
                                times — visually it reads as "the note
                                belongs to this whole group". Subsequent
                                rows show an empty cell so the column
                                stays aligned without a redundant button.
                              */}
                              {i === 0 ? (
                                <NoteButton
                                  po={o.purchaseOrderNumber}
                                  hasNote={Boolean(
                                    notesByPo[o.purchaseOrderNumber],
                                  )}
                                  lang={lang}
                                  onOpen={openNoteEditor}
                                />
                              ) : null}
                            </td>
                          </tr>
                          );
                        }),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Test order submission (collapsible) */}
        <section
          aria-labelledby="sanmar-test-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <button
            type="button"
            onClick={() => setTestOrderOpen(o => !o)}
            aria-expanded={testOrderOpen}
            aria-controls="sanmar-test-form"
            className="w-full flex items-center justify-between gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 rounded-md"
          >
            <h2
              id="sanmar-test-title"
              className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
            >
              <Send size={20} aria-hidden="true" className="text-va-blue" />
              {lang === 'en'
                ? 'Test order submission (Sample type — never charges)'
                : 'Soumission test (type Sample — jamais facturée)'}
            </h2>
            {testOrderOpen ? (
              <ChevronUp size={18} aria-hidden="true" className="text-va-muted" />
            ) : (
              <ChevronDown size={18} aria-hidden="true" className="text-va-muted" />
            )}
          </button>
          {testOrderOpen && (
            <div id="sanmar-test-form" className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label={lang === 'en' ? 'Product ID' : 'Product ID'}
                value={testForm.productId}
                onChange={v => setTestForm(s => ({ ...s, productId: v }))}
                placeholder="ATC1000"
              />
              <Field
                label={lang === 'en' ? 'Part ID' : 'Part ID'}
                value={testForm.partId}
                onChange={v => setTestForm(s => ({ ...s, partId: v }))}
                placeholder="ATC1000-BLK-LG"
              />
              <Field
                label={lang === 'en' ? 'Quantity' : 'Quantité'}
                value={testForm.qty}
                onChange={v => setTestForm(s => ({ ...s, qty: v }))}
                placeholder="1"
                inputMode="numeric"
              />
              <Field
                label={lang === 'en' ? 'Unit price (CAD)' : 'Prix unitaire (CAD)'}
                value={testForm.unitPrice}
                onChange={v => setTestForm(s => ({ ...s, unitPrice: v }))}
                placeholder="0"
                inputMode="decimal"
              />
              <Field
                label={lang === 'en' ? 'Attention to' : 'À l’attention de'}
                value={testForm.attentionTo}
                onChange={v => setTestForm(s => ({ ...s, attentionTo: v }))}
                placeholder="Frederick Bouchard"
              />
              <Field
                label={lang === 'en' ? 'Email' : 'Courriel'}
                value={testForm.email}
                onChange={v => setTestForm(s => ({ ...s, email: v }))}
                placeholder="ops@visionaffichage.com"
                inputMode="email"
              />
              <Field
                label={lang === 'en' ? 'Company' : 'Entreprise'}
                value={testForm.companyName}
                onChange={v => setTestForm(s => ({ ...s, companyName: v }))}
              />
              <Field
                label={lang === 'en' ? 'Address' : 'Adresse'}
                value={testForm.address1}
                onChange={v => setTestForm(s => ({ ...s, address1: v }))}
                placeholder="123 rue de l'Église"
              />
              <Field
                label={lang === 'en' ? 'City' : 'Ville'}
                value={testForm.city}
                onChange={v => setTestForm(s => ({ ...s, city: v }))}
                placeholder="Montréal"
              />
              <Field
                label={lang === 'en' ? 'Region' : 'Province'}
                value={testForm.region}
                onChange={v => setTestForm(s => ({ ...s, region: v }))}
                placeholder="QC"
              />
              <Field
                label={lang === 'en' ? 'Postal code' : 'Code postal'}
                value={testForm.postalCode}
                onChange={v => setTestForm(s => ({ ...s, postalCode: v }))}
                placeholder="H2X 1Y4"
              />
              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestOrder}
                  disabled={testOrderSubmitting}
                  className="bg-va-blue hover:bg-va-blue-hover text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 transition-colors"
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {testOrderSubmitting
                    ? lang === 'en'
                      ? 'Submitting...'
                      : 'Soumission...'
                    : lang === 'en'
                      ? 'Submit test order'
                      : 'Soumettre la commande test'}
                </button>
                <p className="text-xs text-va-muted">
                  {lang === 'en'
                    ? 'orderType=Sample — verifies SOAP plumbing without creating a real order.'
                    : 'orderType=Sample — vérifie la plomberie SOAP sans créer de vraie commande.'}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Phase 19 — Webhook deliveries panel. Mirrors the Streamlit
            Phase-18 panel for storefront-only operators. Hidden when
            VITE_SANMAR_CACHE_API_URL is unset. */}
        {webhookSectionEnabled && (
          <section
            aria-labelledby="sanmar-webhooks-title"
            className="bg-va-white border border-va-line rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2
                  id="sanmar-webhooks-title"
                  className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
                >
                  <Send size={20} aria-hidden="true" className="text-va-blue" />
                  {lang === 'en' ? 'Webhook deliveries' : 'Livraisons de webhooks'}
                </h2>
                <p className="text-va-muted text-sm mt-1">
                  {lang === 'en'
                    ? 'Outbound customer-webhook attempts logged by the SanMar Python cache.'
                    : 'Tentatives de webhooks clients enregistrées par le cache Python SanMar.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadWebhookDeliveries()}
                  disabled={webhookLoading}
                  className="bg-va-bg-2 hover:bg-va-bg-3 text-va-ink px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 transition-colors border border-va-line"
                >
                  <RefreshCw
                    size={14}
                    aria-hidden="true"
                    className={webhookLoading ? 'animate-spin' : ''}
                  />
                  {lang === 'en' ? 'Refresh' : 'Actualiser'}
                </button>
                <button
                  type="button"
                  onClick={openTestFireDialog}
                  className="bg-va-blue hover:bg-va-blue-hover text-white px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 transition-colors"
                >
                  <Send size={14} aria-hidden="true" />
                  {lang === 'en' ? 'Fire test event' : 'Envoyer test'}
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-5 flex flex-wrap gap-3 items-end">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                  {lang === 'en' ? 'Outcome' : 'Résultat'}
                </span>
                <select
                  value={webhookOutcomeFilter}
                  onChange={e => {
                    setWebhookOutcomeFilter(e.target.value);
                    setWebhookLimit(50);
                  }}
                  className="mt-1 border border-va-line rounded-lg px-3 py-2 text-sm text-va-ink bg-va-white outline-none focus:border-va-blue focus-visible:ring-2 focus-visible:ring-va-blue/25"
                >
                  <option value="all">{lang === 'en' ? 'All' : 'Tous'}</option>
                  <option value="success">success</option>
                  <option value="retry">retry</option>
                  <option value="failed">failed</option>
                  <option value="skipped">skipped</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                  {lang === 'en' ? 'Event' : 'Événement'}
                </span>
                <select
                  value={webhookEventFilter}
                  onChange={e => {
                    setWebhookEventFilter(e.target.value);
                    setWebhookLimit(50);
                  }}
                  className="mt-1 border border-va-line rounded-lg px-3 py-2 text-sm text-va-ink bg-va-white outline-none focus:border-va-blue focus-visible:ring-2 focus-visible:ring-va-blue/25"
                >
                  <option value="all">{lang === 'en' ? 'All' : 'Tous'}</option>
                  {WEBHOOK_EVENT_OPTIONS.map(ev => (
                    <option key={ev} value={ev}>
                      {ev}
                    </option>
                  ))}
                </select>
              </label>
              {webhookTotalCount != null && (
                <p className="text-xs text-va-muted ml-auto pb-2">
                  {lang === 'en'
                    ? `Showing ${webhookDeliveries.length} of ${webhookTotalCount}`
                    : `Affichage de ${webhookDeliveries.length} sur ${webhookTotalCount}`}
                </p>
              )}
            </div>

            {webhookError ? (
              <SanmarErrorPanel
                err={webhookError}
                lang={lang}
                className="mt-4"
              />
            ) : null}

            {/* Empty state vs. table */}
            {!webhookLoading && webhookDeliveries.length === 0 && !webhookError ? (
              <div className="mt-5 rounded-xl border border-va-line bg-va-bg-2 p-6 text-center">
                <p className="text-sm text-va-ink font-bold">
                  {lang === 'en'
                    ? 'No deliveries recorded — no webhooks fired yet'
                    : 'Aucune livraison enregistrée — aucun webhook envoyé pour le moment'}
                </p>
                <p className="text-xs text-va-muted mt-2">
                  {lang === 'en'
                    ? 'Deliveries appear here once the SanMar reconciler fires a customer webhook. Reads from VITE_SANMAR_CACHE_API_URL.'
                    : "Les livraisons s’affichent ici dès qu’un webhook client est envoyé. Source : VITE_SANMAR_CACHE_API_URL."}
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-va-muted border-b border-va-line">
                      <th className="py-2 pr-4">
                        {lang === 'en' ? 'When' : 'Quand'}
                      </th>
                      <th className="py-2 pr-4">PO</th>
                      <th className="py-2 pr-4">
                        {lang === 'en' ? 'Event' : 'Événement'}
                      </th>
                      <th className="py-2 pr-4">
                        {lang === 'en' ? 'Status' : 'Statut'}
                      </th>
                      <th className="py-2 pr-4">
                        {lang === 'en' ? 'Attempts' : 'Tentatives'}
                      </th>
                      <th className="py-2 pr-4">ms</th>
                      <th className="py-2 pr-4">
                        {lang === 'en' ? 'Outcome' : 'Résultat'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookDeliveries.map(d => {
                      const t = formatWebhookTime(d.signed_at);
                      const badgeCls =
                        WEBHOOK_OUTCOME_BADGE[d.outcome] ??
                        WEBHOOK_OUTCOME_BADGE.failed;
                      return (
                        <tr
                          key={d.id}
                          className="border-b border-va-line/50 hover:bg-va-bg-2/50 transition-colors"
                        >
                          <td
                            className="py-2 pr-4 text-va-dim text-xs"
                            title={t.abs}
                          >
                            {t.rel}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {d.po_number}
                          </td>
                          <td className="py-2 pr-4 text-xs">{d.event}</td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {d.status_code ?? '—'}
                          </td>
                          <td className="py-2 pr-4 text-xs">
                            {d.attempt_count}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {d.response_ms ?? '—'}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${badgeCls}`}
                            >
                              {d.outcome}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {webhookHasMore && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setWebhookLimit(n => n + 50)}
                      disabled={webhookLoading}
                      className="text-xs font-bold text-va-blue hover:text-va-blue-hover disabled:opacity-60 px-4 py-2 rounded-lg border border-va-line hover:bg-va-bg-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
                    >
                      {lang === 'en' ? 'See more' : 'Voir plus'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Phase 19 — Fire test event dialog. Lightweight modal matching
          the existing note-editor pattern; no shadcn dependency for a
          two-input form. */}
      {testFireOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sanmar-test-fire-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={e => {
            if (e.target === e.currentTarget) setTestFireOpen(false);
          }}
        >
          <div className="bg-va-white rounded-2xl border border-va-line shadow-xl w-full max-w-md p-6">
            <h3
              id="sanmar-test-fire-title"
              className="font-display font-black text-va-ink text-lg tracking-tight"
            >
              {lang === 'en' ? 'Fire test webhook' : 'Envoyer un webhook test'}
            </h3>
            <p className="text-xs text-va-muted mt-1">
              {lang === 'en'
                ? 'Sends a synthetic order event with is_test:true so receivers can ignore in production logic.'
                : "Envoie un événement synthétique avec is_test:true — les récepteurs peuvent l’ignorer en production."}
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                  {lang === 'en' ? 'PO number' : 'Numéro PO'}
                </span>
                <input
                  type="text"
                  value={testFirePo}
                  onChange={e => setTestFirePo(e.target.value)}
                  className="mt-1 w-full border border-va-line rounded-lg px-3 py-2 text-sm text-va-ink bg-va-white outline-none focus:border-va-blue focus-visible:ring-2 focus-visible:ring-va-blue/25"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                  {lang === 'en' ? 'Event' : 'Événement'}
                </span>
                <select
                  value={testFireEvent}
                  onChange={e => setTestFireEvent(e.target.value)}
                  className="mt-1 w-full border border-va-line rounded-lg px-3 py-2 text-sm text-va-ink bg-va-white outline-none focus:border-va-blue focus-visible:ring-2 focus-visible:ring-va-blue/25"
                >
                  {WEBHOOK_EVENT_OPTIONS.map(ev => (
                    <option key={ev} value={ev}>
                      {ev}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTestFireOpen(false)}
                disabled={testFireSubmitting}
                className="px-4 py-2 text-xs font-bold text-va-fg border border-va-line rounded-lg hover:bg-va-bg-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Cancel' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={() => void submitTestFire()}
                disabled={testFireSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-va-blue rounded-lg hover:bg-va-blue-hover disabled:opacity-60 inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                {testFireSubmitting ? (
                  <RefreshCw size={12} aria-hidden="true" className="animate-spin" />
                ) : null}
                {lang === 'en' ? 'Submit' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
        Internal notes editor — rendered at the page root so the
        backdrop overlays the whole admin viewport cleanly. Mounted
        only when `noteEditor` is set so focus-trap activation maps 1:1
        to DOM presence (no stale traps after close).

        Accessibility: role="dialog" + aria-modal + labelled-by on the
        title + described-by on the help line, plus a tabindex=-1
        container pulled into the focus trap so screen readers know to
        scope navigation to the dialog and keyboard users can't Tab
        back out into the dimmed table behind it.

        Why a custom dialog vs. <details> or shadcn Popover: the design
        constraint requires dialog role + focus trap + return focus,
        which <details> can't deliver and shadcn would mean adding a
        new dependency. A ~70-line custom dialog matching the existing
        SizeGuide / LoginModal pattern is simpler and reuses the
        in-tree useFocusTrap/useEscapeKey hooks.
      */}
      {noteEditor && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          role="presentation"
          onClick={e => {
            // Click-on-backdrop closes — only when the click target is
            // the backdrop itself, not a bubbled click from inside the
            // dialog. Without this guard, clicking the textarea would
            // dismiss the editor and lose the in-flight draft.
            if (e.target === e.currentTarget) closeNoteEditor();
          }}
        >
          <div
            ref={noteTrapRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sanmar-note-title"
            aria-describedby="sanmar-note-help"
            className="bg-va-white rounded-2xl border border-va-line shadow-2xl max-w-md w-full focus:outline-none"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-va-line">
              <h3
                id="sanmar-note-title"
                className="text-sm font-black text-va-ink flex items-center gap-2"
              >
                <StickyNote
                  size={16}
                  aria-hidden="true"
                  className="text-va-blue"
                />
                {lang === 'en' ? 'Internal note' : 'Note interne'}
                <span className="font-mono font-normal text-va-muted text-xs">
                  · {noteEditor.po}
                </span>
              </h3>
              <button
                type="button"
                onClick={closeNoteEditor}
                aria-label={lang === 'en' ? 'Close' : 'Fermer'}
                className="w-7 h-7 rounded-full border border-va-line flex items-center justify-center text-va-muted hover:bg-va-bg-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p
                id="sanmar-note-help"
                className="text-xs text-va-muted"
              >
                {lang === 'en'
                  ? 'Operator-only. Never shown to customers. Ctrl+Enter to save, Esc to cancel.'
                  : 'Opérateurs seulement. Jamais visible aux clients. Ctrl+Entrée pour enregistrer, Échap pour annuler.'}
              </p>
              <textarea
                data-autofocus
                value={noteEditor.draft}
                onChange={e =>
                  setNoteEditor(prev =>
                    prev
                      ? {
                          ...prev,
                          // Hard-clamp to NOTE_MAX so paste of an
                          // oversized blob can't quietly defeat the
                          // counter — maxLength on textarea blocks
                          // keystrokes but pasted text in some
                          // browsers can briefly exceed before the
                          // browser truncates. Belt + suspenders.
                          draft: e.target.value.slice(0, NOTE_MAX),
                        }
                      : prev,
                  )
                }
                onKeyDown={e => {
                  // Ctrl+Enter (Cmd+Enter on macOS) saves; Enter alone
                  // inserts a newline as in any textarea so multi-line
                  // notes feel natural. Esc is handled by useEscapeKey
                  // at the dialog scope, not here.
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void saveNote();
                  }
                }}
                maxLength={NOTE_MAX}
                rows={5}
                disabled={noteEditor.saving}
                placeholder={
                  lang === 'en'
                    ? 'e.g. Customer called about timing — needs by Friday'
                    : 'ex. Client a appelé pour le délai — besoin pour vendredi'
                }
                className="w-full text-sm text-va-ink bg-va-white border border-va-line rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 resize-y disabled:opacity-60"
                aria-label={lang === 'en' ? 'Note text' : 'Texte de la note'}
              />
              <div
                className="flex items-center justify-between text-xs"
                aria-live="polite"
              >
                <span
                  className={
                    noteEditor.draft.length >= NOTE_MAX
                      ? 'text-va-err font-bold'
                      : 'text-va-muted'
                  }
                >
                  {noteEditor.draft.length}/{NOTE_MAX}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeNoteEditor}
                    disabled={noteEditor.saving}
                    className="px-3 py-1.5 text-xs font-bold text-va-fg border border-va-line rounded-lg hover:bg-va-bg-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
                  >
                    {lang === 'en' ? 'Cancel' : 'Annuler'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveNote()}
                    disabled={noteEditor.saving}
                    className="px-3 py-1.5 text-xs font-bold text-va-white bg-va-blue rounded-lg hover:bg-va-blue-hover disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 inline-flex items-center gap-1.5"
                  >
                    {noteEditor.saving ? (
                      <RefreshCw
                        size={12}
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    ) : null}
                    {lang === 'en' ? 'Save' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Per-row "Note" trigger button. Lives outside the main component so
 * the table render path doesn't churn it on unrelated state changes —
 * the props it actually depends on (po, hasNote, lang) are stable per
 * row across most renders. The dot indicator is a subtle 8px circle
 * pinned to the top-right of the icon; aria-label surfaces the
 * "view/edit" vs "add" distinction so screen-reader users get the
 * same signal sighted users get from the dot.
 */
function NoteButton({
  po,
  hasNote,
  lang,
  onOpen,
}: {
  po: string;
  hasNote: boolean;
  lang: 'fr' | 'en';
  onOpen: (po: string, opener: HTMLButtonElement | null) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const label = hasNote
    ? lang === 'en'
      ? `View / edit internal note for ${po}`
      : `Voir / modifier la note interne pour ${po}`
    : lang === 'en'
      ? `Add internal note for ${po}`
      : `Ajouter une note interne pour ${po}`;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(po, ref.current)}
      aria-label={label}
      title={label}
      className="relative inline-flex items-center justify-center w-7 h-7 rounded-md border border-va-line text-va-muted hover:text-va-blue hover:bg-va-bg-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 transition-colors"
    >
      <StickyNote size={14} aria-hidden="true" />
      {hasNote && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-va-blue ring-2 ring-va-white"
        />
      )}
    </button>
  );
}

/** Local labelled input — keeps the form markup readable without
 * pulling in shadcn primitives that the rest of the page doesn't need. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email';
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1 w-full border border-va-line rounded-lg px-3 py-2 text-sm text-va-ink outline-none focus:border-va-blue focus-visible:ring-2 focus-visible:ring-va-blue/25 transition-shadow bg-va-white"
      />
    </label>
  );
}

/**
 * Structured error panel rendered above (or in place of) any /admin/sanmar
 * widget that fails to load. Wraps {@link categorizeError} so each call
 * site only has to pass the raw error context + lang — the panel handles
 * title/action/severity/colour and the <details> disclosure for raw
 * diagnostics.
 *
 * Pattern follows the empty-state boxes from Wave 14: same border-radius,
 * same icon-left layout. The severity stripe (`border-l-4`) is the only
 * visual difference, picked by {@link severityClasses}.
 *
 * Use as the sole content of a section when the widget can't render at
 * all (cron health table couldn't fetch), or above the section's normal
 * content when a partial render is still useful (AR tiles still show
 * the last-known zeroes alongside the diagnostic).
 */
function SanmarErrorPanel({
  err,
  lang,
  className,
}: {
  err: SanmarErrorContext;
  lang: 'fr' | 'en';
  className?: string;
}) {
  const { title, action, severity } = categorizeError(err, lang);
  const cls = severityClasses(severity);
  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 flex items-start gap-3 ${cls.panel} ${className ?? ''}`}
    >
      <AlertCircle
        size={18}
        aria-hidden="true"
        className={`mt-0.5 flex-shrink-0 ${cls.iconColor}`}
      />
      <div className={`text-sm flex-1 min-w-0 ${cls.titleColor}`}>
        <div className="font-bold mb-1">{title}</div>
        <p className="text-xs opacity-90">{action}</p>
        <details className="mt-2 group">
          <summary className="text-xs font-semibold cursor-pointer opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue rounded">
            {lang === 'en' ? 'Technical details' : 'Détails techniques'}
          </summary>
          <pre className="mt-2 text-[11px] font-mono opacity-80 whitespace-pre-wrap break-words bg-white/60 rounded p-2 border border-va-line">
            {err.status != null ? `HTTP ${err.status}\n` : ''}
            {err.code ? `${err.code}\n` : ''}
            {err.message}
          </pre>
        </details>
      </div>
    </div>
  );
}
