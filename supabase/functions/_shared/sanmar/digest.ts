/**
 * Daily "all is well" digest payload builder for the SanMar TS layer.
 *
 * The existing `notify.ts` helper alerts ops on failures (with 30-min
 * dedup) and on failure→success recoveries. That gives strong signal on
 * the "something broke" axis but leaves a silence-as-success problem:
 * if the recovery alert is missed, or if a sync simply hasn't run today,
 * operators have no positive confirmation the system is healthy.
 *
 * This helper aggregates the last 24 h of activity into a single
 * Slack-compatible "good" colour message with four sections:
 *
 *   1. Header                — banner line ("🟢 SanMar daily digest …")
 *   2. Sync stats            — successes / failures broken down per
 *                              sync_type, plus aggregate counters
 *                              (products synced, inventory snapshots).
 *   3. Open orders           — grouped count by status_name.
 *   4. AR balance            — sum of `total_amount_cad` across orders
 *                              with `status_id < 80` (open AR).
 *
 * Design rules — same as notify.ts so behaviour matches operator
 * expectations:
 *   - Pure data builder. The HTTP POST + audit-row write live in the
 *     edge function (`supabase/functions/sanmar-daily-digest/index.ts`)
 *     so this module is trivially unit-testable with stub clients.
 *   - Empty / quiet days still render. "No syncs in last 24h" is a
 *     valid (and informative) digest body — operators are expected to
 *     receive a digest every morning.
 *   - Best-effort aggregation. A query failure on one section does NOT
 *     short-circuit the others; instead the failing section reports
 *     "(query failed: …)" so the rest of the digest is still useful.
 *   - Slack envelope is identical to notify.ts (`text` + `attachments`
 *     with `color`, `fields`) so a Zapier "Catch Hook" → Slack
 *     forwarder works for both alerts and digests with no config split.
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { SyncType } from './sync.ts';

/** Lookback window for the digest. 24 h captures one nightly catalog
 * sync plus 48 inventory polls plus ~48 reconcile-orders runs. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Threshold below which an order is considered "open" (i.e. accruing
 * AR). Mirrors the reconcile-orders convention: status_id 80 = complete,
 * 99 = cancelled. Anything strictly less than 80 is in flight. */
const OPEN_STATUS_CUTOFF = 80;

export interface DigestSyncRow {
  sync_type: SyncType;
  total_processed: number | null;
  errors: unknown;
  created_at: string;
}

export interface DigestOrderRow {
  status_id: number | null;
  status_name: string | null;
  total_amount_cad: number | null;
}

export interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

export interface SlackAttachment {
  color: string;
  title?: string;
  fields: SlackField[];
}

export interface DigestPayload {
  text: string;
  attachments: SlackAttachment[];
}

/** Format a number with a thousands separator (en-CA). Falls back to
 * `0` for null/NaN so the digest never shows "null products synced". */
function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return Math.trunc(n).toLocaleString('en-CA');
}

/** Format a CAD amount for the AR section. Two decimals, en-CA, no
 * leading "$" — the field title already says "(CAD)". */
function fmtCad(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SyncStats {
  /** Total runs across all sync_types in the window. */
  totalRuns: number;
  /** Runs whose `errors` JSONB column is null (= clean). */
  totalSuccesses: number;
  /** Runs whose `errors` JSONB column is non-null. */
  totalFailures: number;
  /** Sum of `total_processed` across catalog runs (≈ products synced). */
  productsSynced: number;
  /** Sum of `total_processed` across inventory runs (≈ snapshot count). */
  inventorySnapshots: number;
  /** Per-sync_type breakdown: successes vs failures. Stable insertion
   * order so the digest reads catalog→inventory→order_status. */
  perType: Map<string, { ok: number; fail: number }>;
  /** Set when the sync_log query itself failed. */
  queryError: string | null;
}

function summariseSyncRows(rows: DigestSyncRow[] | null, queryError: string | null): SyncStats {
  const stats: SyncStats = {
    totalRuns: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    productsSynced: 0,
    inventorySnapshots: 0,
    perType: new Map(),
    queryError,
  };
  if (queryError || !rows) return stats;
  for (const row of rows) {
    stats.totalRuns += 1;
    const failed = row.errors != null && (Array.isArray(row.errors) ? row.errors.length > 0 : true);
    if (failed) stats.totalFailures += 1;
    else stats.totalSuccesses += 1;

    if (row.sync_type === 'catalog' && !failed) {
      stats.productsSynced += row.total_processed ?? 0;
    }
    if (row.sync_type === 'inventory' && !failed) {
      stats.inventorySnapshots += row.total_processed ?? 0;
    }

    const bucket = stats.perType.get(row.sync_type) ?? { ok: 0, fail: 0 };
    if (failed) bucket.fail += 1;
    else bucket.ok += 1;
    stats.perType.set(row.sync_type, bucket);
  }
  return stats;
}

/** Render the per-sync_type breakdown as a single multi-line string
 * suitable for a Slack field value. Mrkdwn-friendly (newlines render
 * inline, no triple-backticks needed). */
function renderPerTypeBreakdown(perType: Map<string, { ok: number; fail: number }>): string {
  if (perType.size === 0) return 'No syncs in last 24h';
  const lines: string[] = [];
  // Stable, semantically meaningful order — catalog first because it's
  // the most operator-visible, order_status last because it's high
  // frequency / low signal.
  const order: string[] = ['catalog', 'inventory', 'order_status'];
  const seen = new Set<string>();
  for (const t of order) {
    const v = perType.get(t);
    if (!v) continue;
    seen.add(t);
    lines.push(`${t}: ${v.ok} ok, ${v.fail} fail`);
  }
  // Defensively render any unknown sync_types we haven't ordered above
  // (forward-compat: if a new sync type lands and predates this code,
  // it should still show up rather than silently disappear).
  for (const [t, v] of perType.entries()) {
    if (seen.has(t)) continue;
    lines.push(`${t}: ${v.ok} ok, ${v.fail} fail`);
  }
  return lines.join('\n');
}

interface OpenOrdersStats {
  /** Total open orders (status_id IS NULL OR < 80). */
  totalOpen: number;
  /** Per-status breakdown for the digest body. */
  perStatus: Map<string, number>;
  queryError: string | null;
}

function summariseOpenOrders(
  rows: DigestOrderRow[] | null,
  queryError: string | null,
): OpenOrdersStats {
  const stats: OpenOrdersStats = {
    totalOpen: 0,
    perStatus: new Map(),
    queryError,
  };
  if (queryError || !rows) return stats;
  for (const row of rows) {
    stats.totalOpen += 1;
    const label =
      row.status_name?.trim() ||
      (row.status_id == null ? 'unsubmitted' : `status ${row.status_id}`);
    stats.perStatus.set(label, (stats.perStatus.get(label) ?? 0) + 1);
  }
  return stats;
}

function renderOpenOrders(stats: OpenOrdersStats): string {
  if (stats.queryError) return `(query failed: ${stats.queryError})`;
  if (stats.totalOpen === 0) return 'No open orders';
  const lines: string[] = [];
  // Sort largest bucket first so the operator sees the biggest backlog
  // immediately rather than scanning a list.
  const sorted = [...stats.perStatus.entries()].sort((a, b) => b[1] - a[1]);
  for (const [label, count] of sorted) {
    lines.push(`${label}: ${count}`);
  }
  return lines.join('\n');
}

interface ARBalance {
  totalCad: number;
  openCount: number;
  queryError: string | null;
}

function summariseAR(
  rows: DigestOrderRow[] | null,
  queryError: string | null,
): ARBalance {
  if (queryError || !rows) {
    return { totalCad: 0, openCount: 0, queryError };
  }
  let totalCad = 0;
  let openCount = 0;
  for (const row of rows) {
    // status_id < 80 = open AR. NULL is also open (unsubmitted to SanMar
    // but already invoiceable) — match the reconcile-orders convention.
    const isOpen = row.status_id == null || row.status_id < OPEN_STATUS_CUTOFF;
    if (!isOpen) continue;
    openCount += 1;
    if (row.total_amount_cad != null && Number.isFinite(row.total_amount_cad)) {
      totalCad += row.total_amount_cad;
    }
  }
  return { totalCad, openCount, queryError: null };
}

/**
 * Pull the three sources (sync_log, open orders, AR balance) and
 * assemble a Slack-format digest payload. Never throws — query
 * failures are isolated to the affected section and reported in-line
 * so operators always get *some* digest, even if Postgres is having
 * a moment.
 *
 * @param supabase_admin service-role client (RLS bypass for sync_log
 *   + sanmar_orders reads).
 * @param now Optional clock injection for unit tests. Defaults to
 *   `new Date()`.
 */
export async function buildDigestPayload(
  supabase_admin: SupabaseClient,
  now: Date = new Date(),
): Promise<DigestPayload> {
  const cutoff = new Date(now.getTime() - WINDOW_MS).toISOString();

  // ── 1. sync_log aggregation ────────────────────────────────────────
  let syncRows: DigestSyncRow[] | null = null;
  let syncErr: string | null = null;
  try {
    const { data, error } = await supabase_admin
      .from('sanmar_sync_log')
      .select('sync_type, total_processed, errors, created_at')
      .gte('created_at', cutoff);
    if (error) syncErr = error.message;
    else syncRows = (data ?? []) as DigestSyncRow[];
  } catch (e) {
    syncErr = e instanceof Error ? e.message : String(e);
  }
  const syncStats = summariseSyncRows(syncRows, syncErr);

  // ── 2 + 3. open orders + AR balance share one query ───────────────
  // Both sections want the same row shape (status_id, status_name,
  // total_amount_cad) over the same predicate (status_id IS NULL OR <
  // 80). One round trip serves both.
  let orderRows: DigestOrderRow[] | null = null;
  let orderErr: string | null = null;
  try {
    const { data, error } = await supabase_admin
      .from('sanmar_orders')
      .select('status_id, status_name, total_amount_cad')
      .or(`status_id.is.null,status_id.lt.${OPEN_STATUS_CUTOFF}`);
    if (error) orderErr = error.message;
    else orderRows = (data ?? []) as DigestOrderRow[];
  } catch (e) {
    orderErr = e instanceof Error ? e.message : String(e);
  }
  const openOrders = summariseOpenOrders(orderRows, orderErr);
  const ar = summariseAR(orderRows, orderErr);

  // ── 4. assemble Slack payload ──────────────────────────────────────
  const dateLabel = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const text = `🟢 SanMar daily digest — ${dateLabel}`;

  const syncFieldValue = syncStats.queryError
    ? `(query failed: ${syncStats.queryError})`
    : renderPerTypeBreakdown(syncStats.perType);

  const fields: SlackField[] = [
    { title: 'Window', value: 'last 24h', short: true },
    {
      title: 'Total runs',
      value: syncStats.queryError ? '?' : `${fmtCount(syncStats.totalRuns)} (${fmtCount(
        syncStats.totalSuccesses,
      )} ok, ${fmtCount(syncStats.totalFailures)} fail)`,
      short: true,
    },
    { title: 'By sync type', value: syncFieldValue, short: false },
    {
      title: 'Products synced',
      value: syncStats.queryError ? '?' : fmtCount(syncStats.productsSynced),
      short: true,
    },
    {
      title: 'Inventory snapshots',
      value: syncStats.queryError ? '?' : fmtCount(syncStats.inventorySnapshots),
      short: true,
    },
    {
      title: 'Open orders',
      value: renderOpenOrders(openOrders),
      short: false,
    },
    {
      title: 'Open AR balance (CAD)',
      value: ar.queryError
        ? `(query failed: ${ar.queryError})`
        : `$${fmtCad(ar.totalCad)} across ${fmtCount(ar.openCount)} order${ar.openCount === 1 ? '' : 's'}`,
      short: false,
    },
  ];

  return {
    text,
    attachments: [
      {
        color: 'good',
        title: 'Daily health summary',
        fields,
      },
    ],
  };
}
