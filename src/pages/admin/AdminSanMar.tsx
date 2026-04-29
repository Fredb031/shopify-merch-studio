import { useEffect, useMemo, useState } from 'react';
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
  History,
  XCircle,
  Clock,
  CalendarClock,
} from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/lib/supabase';
import { sanmarClient } from '@/lib/sanmar/client';
import type { SanmarOrderStatus, SanmarOrderInput } from '@/lib/sanmar/types';
import { TablePagination } from '@/components/admin/TablePagination';

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

const PAGE_SIZE = 50;

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
  const [syncing, setSyncing] = useState(false);

  // ── pg_cron health ─────────────────────────────────────────────────────
  // Live state of the three sanmar-* scheduled jobs (catalog Sunday 03:00,
  // inventory daily 05:15, order-status every 30min). Comes from the
  // SECURITY DEFINER `get_sanmar_cron_health()` function which gates on
  // is_admin(); rendered as a soft empty state if the function isn't
  // present yet (early-deploy environments) or the operator lacks rights.
  const [cronHealth, setCronHealth] = useState<SanmarCronHealthRow[]>([]);
  const [cronHealthLoading, setCronHealthLoading] = useState(true);

  // ── Catalogue table ────────────────────────────────────────────────────
  const [catalogRows, setCatalogRows] = useState<SanmarCatalogRow[]>([]);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // ── Open orders ────────────────────────────────────────────────────────
  const [openOrders, setOpenOrders] = useState<SanmarOrderStatus[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [openOrdersLastPoll, setOpenOrdersLastPoll] = useState<Date | null>(null);
  const [openOrdersError, setOpenOrdersError] = useState<string | null>(null);

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
      try {
        const [logRes, countRes] = await Promise.all([
          supabase
            .from('sanmar_sync_log')
            .select('id,sync_type,total_processed,errors,duration_ms,created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('sanmar_catalog').select('*', { count: 'exact', head: true }),
        ]);
        const rows = ((logRes.data ?? []) as SanmarSyncLogRow[]) ?? [];
        const latest = rows[0] ?? null;
        setRecentRuns(rows);
        setSyncStatus({
          lastSync: latest?.created_at ?? null,
          totalParts: countRes.count ?? 0,
          loading: false,
        });
      } catch {
        setRecentRuns([]);
        setSyncStatus(s => ({ ...s, loading: false }));
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
      try {
        const { data, error } = await supabase.rpc('get_sanmar_cron_health');
        if (error) {
          setCronHealth([]);
        } else {
          setCronHealth((data ?? []) as SanmarCronHealthRow[]);
        }
      } catch {
        setCronHealth([]);
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
   * Page through `sanmar_catalog` 50 rows at a time. The query order
   * (style_id, color, size) keeps a deterministic pagination window
   * even as new rows arrive; without an explicit order Supabase can
   * shuffle on each request and the operator sees the same SKU twice.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      if (!supabase) {
        if (!cancelled) setCatalogLoading(false);
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
        if (cancelled) return;
        if (error) {
          // Table missing in early-deploy environments — soft empty state.
          setCatalogRows([]);
          setCatalogTotal(0);
        } else {
          setCatalogRows((data ?? []) as SanmarCatalogRow[]);
          setCatalogTotal(count ?? 0);
        }
      } catch {
        if (!cancelled) {
          setCatalogRows([]);
          setCatalogTotal(0);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogPage]);

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
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setOpenOrdersError(msg);
      } finally {
        setOpenOrdersLoading(false);
      }
    },
    [],
  );

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

  /** Format last_duration_s (a Postgres double precision) for display. */
  const formatCronDuration = (s: number | null | undefined): string => {
    if (s == null || !Number.isFinite(s)) return '—';
    if (s < 1) return `${Math.round(s * 1000)} ms`;
    if (s < 60) return `${s.toFixed(1)} s`;
    const minutes = Math.floor(s / 60);
    const seconds = Math.round(s - minutes * 60);
    return `${minutes} min ${seconds.toString().padStart(2, '0')} s`;
  };

  const envLabel = NEXT_GEN_ENABLED
    ? lang === 'en'
      ? 'PROD (next-gen edge functions enabled)'
      : 'PROD (fonctions edge nouvelle génération activées)'
    : lang === 'en'
      ? 'UAT (config-driven, gate disabled)'
      : 'UAT (piloté par config, gate désactivé)';

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-va-bg-1">
      {/* Header strip */}
      <header className="bg-va-bg-2 py-6 px-8 border-b border-va-line">
        <h1 className="font-display font-black text-va-ink text-3xl tracking-tight">
          SanMar Canada
        </h1>
        <p className="text-va-muted text-sm mt-1">
          {lang === 'en' ? 'Environment' : 'Environnement'} : {envLabel}
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-va-bg-2 rounded-xl px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                {lang === 'en' ? 'Last sync' : 'Dernière synchro'}
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
          {recentRunsLoading && recentRuns.length === 0 ? (
            <p className="text-va-muted text-sm py-6 text-center">
              {lang === 'en' ? 'Loading…' : 'Chargement…'}
            </p>
          ) : recentRuns.length === 0 ? (
            <p className="text-va-muted text-sm py-6 text-center">
              {lang === 'en'
                ? 'No sync runs yet. Trigger one above to populate the log.'
                : 'Aucune synchro enregistrée. Lance-en une ci-dessus pour remplir le journal.'}
            </p>
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
          {cronHealthLoading && cronHealth.length === 0 ? (
            <p className="text-va-muted text-sm py-6 text-center">
              {lang === 'en' ? 'Loading…' : 'Chargement…'}
            </p>
          ) : cronHealth.length === 0 ? (
            <p className="text-va-muted text-sm py-6 text-center">
              {lang === 'en'
                ? 'No sanmar-* cron jobs registered (or insufficient privileges).'
                : 'Aucune tâche cron sanmar-* enregistrée (ou privilèges insuffisants).'}
            </p>
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
                </tr>
              </thead>
              <tbody>
                {catalogLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-va-muted">
                      {lang === 'en' ? 'Loading...' : 'Chargement...'}
                    </td>
                  </tr>
                ) : catalogRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-va-muted">
                      {lang === 'en'
                        ? 'No catalogue rows yet. Trigger a sync above.'
                        : 'Aucune ligne dans le catalogue. Lance une synchro ci-dessus.'}
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
            <h2
              id="sanmar-orders-title"
              className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
            >
              <PackageSearch size={20} aria-hidden="true" className="text-va-blue" />
              {lang === 'en' ? 'Open orders' : 'Commandes ouvertes'}
            </h2>
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
          {openOrdersError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle
                size={18}
                aria-hidden="true"
                className="text-va-warn mt-0.5 flex-shrink-0"
              />
              <div className="text-sm text-amber-900">
                <div className="font-bold mb-1">
                  {lang === 'en' ? 'Could not load open orders' : 'Impossible de charger les commandes ouvertes'}
                </div>
                <div className="text-xs">{openOrdersError}</div>
              </div>
            </div>
          ) : openOrders.length === 0 ? (
            <p className="text-va-muted text-sm py-6">
              {openOrdersLastPoll
                ? lang === 'en'
                  ? 'No open orders.'
                  : 'Aucune commande ouverte.'
                : lang === 'en'
                  ? 'Click Refresh to load open orders.'
                  : 'Clique sur Actualiser pour charger les commandes ouvertes.'}
            </p>
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
                      {lang === 'en' ? 'Status' : 'Statut'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Expected ship' : 'Expédition prévue'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Last poll' : 'Dernier sondage'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.flatMap(o =>
                    o.orderStatusDetails.length === 0
                      ? [
                          <tr
                            key={`${o.purchaseOrderNumber}-empty`}
                            className="border-b border-va-line/50"
                          >
                            <td className="py-2 pr-4 font-mono text-xs">
                              {o.purchaseOrderNumber}
                            </td>
                            <td className="py-2 pr-4 text-va-muted" colSpan={4}>
                              {lang === 'en' ? '(no detail rows)' : '(aucune ligne)'}
                            </td>
                          </tr>,
                        ]
                      : o.orderStatusDetails.map((d, i) => (
                          <tr
                            key={`${o.purchaseOrderNumber}-${d.factoryOrderNumber}-${i}`}
                            className="border-b border-va-line/50 hover:bg-va-bg-2/50"
                          >
                            <td className="py-2 pr-4 font-mono text-xs">
                              {o.purchaseOrderNumber}
                            </td>
                            <td className="py-2 pr-4 font-mono text-xs">
                              {d.factoryOrderNumber}
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
                          </tr>
                        )),
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
      </div>
    </div>
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
