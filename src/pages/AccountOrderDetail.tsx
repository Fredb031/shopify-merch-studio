import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileText,
  Package,
  RotateCcw,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { useLang } from '@/lib/langContext';
import { useAuthStore, ensureAuthHydrated } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCartStore } from '@/stores/localCartStore';
import { findProductByHandle } from '@/data/products';
import {
  getOrderByNumber,
  type CustomerOrderRecord,
  type CustomerOrderStatus,
} from '@/data/customerOrders';
import { computeTax, gstLabel, pstLabel, hstLabel } from '@/lib/tax';
import { fmtMoney } from '@/lib/format';

/**
 * Per-order detail view (Wave 20).
 *
 * Reachable from /account/orders/:orderNumber. Each row in the /account
 * order history links here. The page surfaces the order header (number,
 * date, total, status pill), every line item with its product image +
 * variant breakdown + per-size quantities + line total, the
 * subtotal/GST/QST(or HST/PST)/shipping/total summary, and three actions:
 *
 *   - "Récommander cette sélection"   (mirrors the Account page reorder)
 *   - "Voir le suivi"                  (link to /suivi/:orderNumber, only
 *                                       active once the order has shipped)
 *   - "Télécharger la facture (PDF)"  (Phase 2 stub — disabled with a
 *                                       "Bientôt disponible" tooltip until
 *                                       the Supabase invoice generator
 *                                       lands)
 *
 * Authenticated-only: the page renders the same "Sign in" branch as
 * Account.tsx when there's no session. When the URL :orderNumber doesn't
 * match a row in the signed-in user's CUSTOMER_ORDERS ledger we render an
 * "Order not found" empty state with a link back to /account so the
 * buyer can pick a different order or return to the index.
 */
export default function AccountOrderDetail() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const [hydrated, setHydrated] = useState(false);

  // Lazy auth hydration mirrors Account.tsx — the supabase chunk isn't
  // in the eager landing-page graph; visiting any /account route is the
  // trigger to pull it.
  useEffect(() => { void ensureAuthHydrated(); }, []);
  useEffect(() => {
    if (!loading) setHydrated(true);
  }, [loading]);

  const order = useMemo<CustomerOrderRecord | null>(
    () => getOrderByNumber(user?.email, orderNumber),
    [user?.email, orderNumber],
  );

  // Cart helpers for the reorder button. Pulled as stable refs so the
  // page doesn't re-render every time anything else changes the cart.
  const cartClear = useCartStore(s => s.clear);
  const cartAddItem = useCartStore(s => s.addItem);
  const [reordering, setReordering] = useState(false);

  useDocumentTitle(
    order
      ? lang === 'en'
        ? `Order ${order.name} · Vision Affichage`
        : `Commande ${order.name} · Vision Affichage`
      : lang === 'en'
        ? 'Order detail · Vision Affichage'
        : 'Détail de commande · Vision Affichage',
  );

  // ── Auth gate (matches Account.tsx) ─────────────────────────────
  if (hydrated && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-20 pt-24">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
              <Package size={32} className="text-muted-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground mb-2">
              {lang === 'en' ? 'Sign in to view this order' : 'Connecte-toi pour voir cette commande'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {lang === 'en'
                ? 'Order details are only available to signed-in customers.'
                : 'Les détails de commande sont réservés aux clients connectés.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/admin/login"
                state={{ from: `/account/orders/${orderNumber ?? ''}` }}
                className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-3 rounded-full shadow-navy focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Sign in' : 'Se connecter'}
              </Link>
              <Link
                to="/account"
                className="inline-flex items-center gap-2 text-sm font-extrabold border border-border bg-background px-6 py-3 rounded-full hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Back to account' : 'Retour au compte'}
              </Link>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">{lang === 'en' ? 'Loading order…' : 'Chargement de la commande…'}</span>
      </div>
    );
  }

  // ── Order-not-found branch ──────────────────────────────────────
  if (!order) {
    return (
      <div id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-secondary/30 to-background pb-20 focus:outline-none">
        <Navbar />
        <main className="max-w-[920px] mx-auto px-4 md:px-8 pt-20 pb-16">
          <Link
            to="/account"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {lang === 'en' ? 'Back to my account' : 'Retour à mon compte'}
          </Link>
          <div className="bg-white border border-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Package size={28} className="text-muted-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground mb-2">
              {lang === 'en' ? 'Order not found' : 'Commande introuvable'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {lang === 'en'
                ? `We couldn't find an order matching “${orderNumber ?? ''}” for your account. It may have been placed on a different account.`
                : `Nous n'avons pas trouvé de commande correspondant à « ${orderNumber ?? ''} » sur votre compte. Elle a peut-être été passée avec un autre compte.`}
            </p>
            <Link
              to="/account"
              className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-5 py-2.5 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Back to my account' : 'Retour à mon compte'}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────
  const orderDate = new Date(order.createdAt).toLocaleDateString(
    lang === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
  const status: CustomerOrderStatus = order.status ?? 'processing';
  const trackingEnabled = status === 'shipped' || status === 'delivered';

  // Resolve every line item against the live product fixture once so
  // the JSX below stays straight-forward. Lines whose product has
  // since been retired still render — we just fall back to the stored
  // label and the placeholder image.
  const resolvedLines = order.lineItems.map((line, idx) => {
    const product = findProductByHandle(line.productId);
    const color = product?.colors.find(c => c.id === line.colorId);
    const colorImage = color?.imageDevant;
    const image = colorImage ?? product?.imageDevant ?? '/placeholder.svg';
    const colorLabel = color
      ? lang === 'en' ? color.nameEn : color.name
      : '';
    const productTitle = product?.name ?? line.label;
    const totalQty = line.sizeQuantities.reduce((s, sq) => s + sq.quantity, 0);
    const lineTotal = parseFloat((line.unitPrice * totalQty).toFixed(2));
    return {
      key: `${order.name}-line-${idx}`,
      line,
      product,
      image,
      colorLabel,
      productTitle,
      totalQty,
      lineTotal,
    };
  });

  // Totals — when the fixture row carries explicit subtotal/tax/shipping
  // we use those (matches what Shopify charged); otherwise we derive
  // them from the line totals + computeTax for legacy fixture rows.
  const derivedSubtotal = resolvedLines.reduce((s, l) => s + l.lineTotal, 0);
  const subtotal = order.subtotal ?? derivedSubtotal;
  const province = order.province ?? 'QC';
  const taxBreakdown = computeTax(subtotal, province);
  const taxTotal = order.tax ?? taxBreakdown.total;
  // When a fixture row provides an aggregate `tax` but no per-component
  // split, scale the computed component ratios to that total so the
  // GST + QST lines still add up to what the buyer was charged.
  const taxScale =
    order.tax !== undefined && taxBreakdown.total > 0
      ? order.tax / taxBreakdown.total
      : 1;
  const gstAmount = taxBreakdown.gst * taxScale;
  const pstAmount = taxBreakdown.pst * taxScale;
  const hstAmount = taxBreakdown.hst * taxScale;
  const shipping = order.shipping ?? 0;
  const grandTotal = order.total ?? subtotal + taxTotal + shipping;

  const handleReorder = () => {
    if (reordering) return;
    setReordering(true);
    try {
      const resolved: Array<{
        line: CustomerOrderRecord['lineItems'][number];
        productName: string;
        previewSnapshot: string;
      }> = [];
      let skipped = 0;
      for (const line of order.lineItems) {
        const product = findProductByHandle(line.productId);
        if (!product) {
          skipped += 1;
          continue;
        }
        const color = product.colors.find(c => c.id === line.colorId);
        const colorLabel = color
          ? lang === 'en' ? color.nameEn : color.name
          : '';
        const productName = colorLabel
          ? `${product.name} — ${colorLabel}`
          : product.name;
        resolved.push({
          line,
          productName,
          previewSnapshot: product.imageDevant,
        });
      }
      if (resolved.length === 0) {
        toast.error(
          lang === 'en'
            ? 'None of the items from this order are available anymore.'
            : "Aucun des articles de cette commande n'est encore disponible.",
        );
        return;
      }
      cartClear();
      for (const { line, productName, previewSnapshot } of resolved) {
        const totalQuantity = line.sizeQuantities.reduce((s, sq) => s + sq.quantity, 0);
        cartAddItem({
          productId: line.productId,
          colorId: line.colorId,
          logoPlacement: null,
          logoPlacementBack: null,
          placementSides: 'none',
          textAssets: [],
          sizeQuantities: line.sizeQuantities.map(sq => ({ size: sq.size, quantity: sq.quantity })),
          activeView: 'front',
          step: 3,
          productName,
          previewSnapshot,
          unitPrice: line.unitPrice,
          totalQuantity,
          totalPrice: parseFloat((line.unitPrice * totalQuantity).toFixed(2)),
        });
      }
      toast.success(
        lang === 'en' ? 'Selection added to cart' : 'Sélection ajoutée au panier',
      );
      if (skipped > 0) {
        toast.warning(
          lang === 'en'
            ? `${skipped} unavailable product${skipped > 1 ? 's were' : ' was'} skipped`
            : `${skipped} produit${skipped > 1 ? 's' : ''} non disponible${skipped > 1 ? 's ont' : ' a'} été ignoré${skipped > 1 ? 's' : ''}`,
        );
      }
      navigate('/panier');
    } finally {
      setTimeout(() => setReordering(false), 600);
    }
  };

  // Status pill — same colour language as the AdminOrders fulfillment
  // badges so the customer-facing surface and the operator surface stay
  // visually consistent.
  const statusLabels: Readonly<Record<CustomerOrderStatus, { fr: string; en: string; cls: string }>> = {
    processing:    { fr: 'En traitement', en: 'Processing',     cls: 'bg-amber-50 text-amber-700' },
    in_production: { fr: 'En production', en: 'In production',  cls: 'bg-sky-50 text-sky-700' },
    shipped:       { fr: 'Expédiée',      en: 'Shipped',        cls: 'bg-emerald-50 text-emerald-700' },
    delivered:     { fr: 'Livrée',        en: 'Delivered',      cls: 'bg-emerald-100 text-emerald-800' },
    cancelled:     { fr: 'Annulée',       en: 'Cancelled',      cls: 'bg-zinc-100 text-zinc-600' },
  };
  const statusMeta = statusLabels[status];

  // Tax row labels — QC splits into GST + QST, HST provinces show a
  // single HST line, GST-only provinces hide the PST row entirely.
  const showHst = taxBreakdown.rates.hst > 0;
  const showPst = taxBreakdown.rates.pst > 0;

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-secondary/30 to-background pb-20 focus:outline-none">
      <Navbar />

      <main className="max-w-[920px] mx-auto px-4 md:px-8 pt-20 pb-16">
        {/* Breadcrumbs — Accueil / Mon compte / Commande {orderNumber} */}
        <nav
          aria-label={lang === 'en' ? 'Breadcrumb' : "Fil d'Ariane"}
          className="mb-4"
        >
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <li>
              <Link
                to="/"
                className="hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
              >
                {lang === 'en' ? 'Home' : 'Accueil'}
              </Link>
            </li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li>
              <Link
                to="/account"
                className="hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
              >
                {lang === 'en' ? 'My account' : 'Mon compte'}
              </Link>
            </li>
            <li aria-hidden="true"><ChevronRight size={12} /></li>
            <li className="font-bold text-foreground" aria-current="page">
              {lang === 'en' ? `Order ${order.name}` : `Commande ${order.name}`}
            </li>
          </ol>
        </nav>

        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {lang === 'en' ? 'Back to my account' : 'Retour à mon compte'}
        </Link>

        {/* Order header */}
        <header className="bg-white border border-border rounded-2xl p-5 md:p-6 mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-extrabold truncate">
                  {lang === 'en' ? `Order ${order.name}` : `Commande ${order.name}`}
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${statusMeta.cls}`}
                >
                  {lang === 'en' ? statusMeta.en : statusMeta.fr}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {lang === 'en' ? 'Placed on ' : 'Passée le '}{orderDate}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === 'en' ? 'Total' : 'Total'}
              </div>
              <div className="text-2xl font-extrabold text-primary tabular-nums">
                {fmtMoney(grandTotal, lang)}
              </div>
            </div>
          </div>
          {trackingEnabled && (
            <Link
              to={`/suivi/${encodeURIComponent(order.name.replace(/^#/, ''))}`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
            >
              <Truck size={13} aria-hidden="true" />
              {lang === 'en' ? 'View tracking →' : 'Voir le suivi →'}
            </Link>
          )}
        </header>

        {/* Line items */}
        <section
          aria-labelledby="line-items-heading"
          className="bg-white border border-border rounded-2xl overflow-hidden mb-5"
        >
          <div className="px-5 py-3 border-b border-border">
            <h2 id="line-items-heading" className="font-bold flex items-center gap-2">
              <Package size={16} className="text-primary" aria-hidden="true" />
              {lang === 'en' ? 'Items' : 'Articles'}
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {resolvedLines.map(rl => (
              <li key={rl.key} className="p-4 md:p-5 flex gap-4 items-start">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl border border-border bg-secondary/30 flex-shrink-0 overflow-hidden">
                  <img
                    src={rl.image}
                    alt={rl.productTitle}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm md:text-base text-foreground truncate">
                        {rl.product
                          ? (
                              <Link
                                to={`/product/${rl.product.shopifyHandle}`}
                                className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
                              >
                                {rl.productTitle}
                              </Link>
                            )
                          : rl.productTitle}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {rl.colorLabel && (
                          <>
                            {lang === 'en' ? 'Color: ' : 'Couleur : '}
                            <span className="font-bold text-foreground">{rl.colorLabel}</span>
                            {' · '}
                          </>
                        )}
                        {rl.line.sizeQuantities
                          .map(sq => `${sq.size}×${sq.quantity}`)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-xs text-muted-foreground">
                        {fmtMoney(rl.line.unitPrice, lang)}
                        {' × '}
                        {rl.totalQty}
                      </div>
                      <div className="font-extrabold text-sm">
                        {fmtMoney(rl.lineTotal, lang)}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Order summary */}
        <section
          aria-labelledby="summary-heading"
          className="bg-white border border-border rounded-2xl p-5 md:p-6 mb-5"
        >
          <h2 id="summary-heading" className="font-bold mb-4">
            {lang === 'en' ? 'Order summary' : 'Sommaire de la commande'}
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {lang === 'en' ? 'Subtotal' : 'Sous-total'}
              </dt>
              <dd className="tabular-nums font-medium">{fmtMoney(subtotal, lang)}</dd>
            </div>
            {showHst ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {hstLabel(lang)}
                </dt>
                <dd className="tabular-nums font-medium">{fmtMoney(hstAmount, lang)}</dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {gstLabel(lang)}
                  </dt>
                  <dd className="tabular-nums font-medium">{fmtMoney(gstAmount, lang)}</dd>
                </div>
                {showPst && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {pstLabel(taxBreakdown.province, lang)}
                    </dt>
                    <dd className="tabular-nums font-medium">{fmtMoney(pstAmount, lang)}</dd>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {lang === 'en' ? 'Shipping' : 'Livraison'}
              </dt>
              <dd className="tabular-nums font-medium">
                {shipping > 0
                  ? fmtMoney(shipping, lang)
                  : (lang === 'en' ? 'Free' : 'Gratuite')}
              </dd>
            </div>
            <div className="border-t border-border pt-3 flex justify-between text-base">
              <dt className="font-extrabold">
                {lang === 'en' ? 'Total' : 'Total'}
              </dt>
              <dd className="tabular-nums font-extrabold text-primary">
                {fmtMoney(grandTotal, lang)}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            {lang === 'en'
              ? 'Logo used: '
              : 'Logo utilisé : '}
            <span className="font-mono">
              {order.logoFilename ?? (lang === 'en' ? 'to come' : 'à venir')}
            </span>
          </p>
        </section>

        {/* Actions */}
        <section
          aria-labelledby="actions-heading"
          className="bg-white border border-border rounded-2xl p-5 md:p-6"
        >
          <h2 id="actions-heading" className="font-bold mb-4">
            {lang === 'en' ? 'Actions' : 'Actions'}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleReorder}
              disabled={reordering}
              aria-busy={reordering || undefined}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-primary-foreground gradient-navy hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <RotateCcw size={14} aria-hidden="true" />
              {lang === 'en' ? 'Reorder this selection' : 'Récommander cette sélection'}
            </button>

            {trackingEnabled ? (
              <Link
                to={`/suivi/${encodeURIComponent(order.name.replace(/^#/, ''))}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-border bg-background hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Truck size={14} aria-hidden="true" />
                {lang === 'en' ? 'View tracking' : 'Voir le suivi'}
              </Link>
            ) : (
              <span
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-border bg-secondary/40 text-muted-foreground cursor-not-allowed"
                title={
                  lang === 'en'
                    ? 'Tracking is available once the order ships.'
                    : 'Le suivi est disponible dès que la commande est expédiée.'
                }
              >
                <Truck size={14} aria-hidden="true" />
                {lang === 'en' ? 'View tracking' : 'Voir le suivi'}
              </span>
            )}

            {/* Phase 2 stub — Supabase invoice generator hasn't shipped
                yet, so we render a disabled button with a tooltip so
                customers know it's coming. Wire this to the
                /invoices/:orderId edge function once that lands. */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={lang === 'en' ? 'Coming soon' : 'Bientôt disponible'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-border bg-secondary/40 text-muted-foreground cursor-not-allowed"
            >
              <FileText size={14} aria-hidden="true" />
              {lang === 'en' ? 'Download invoice (PDF)' : 'Télécharger la facture (PDF)'}
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 ml-1">
                <Download size={10} aria-hidden="true" className="inline" />
              </span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            {lang === 'en'
              ? 'PDF invoice generation is coming soon. For now, contact info@visionaffichage.com if you need a copy.'
              : 'La génération PDF de la facture arrive bientôt. Pour l’instant, écris à info@visionaffichage.com si tu en as besoin.'}
          </p>
        </section>
      </main>

      <AIChat />
      <BottomNav />
    </div>
  );
}
