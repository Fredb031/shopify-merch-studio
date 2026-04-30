'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Heart,
  Mail,
  Package,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/Button';
import { formatCAD } from '@/lib/format';
import { getKit } from '@/lib/kitTypes';
import { useWishlist } from '@/lib/wishlist';
import type { StoredContactMessage } from '@/lib/contactForm';
import type { StoredKitOrder } from '@/lib/kitForm';
import type { StoredOrder } from '@/lib/orderForm';
import type { StoredQuote } from '@/lib/quoteForm';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
};

type StoredState = {
  quote: StoredQuote | null;
  kit: StoredKitOrder | null;
  order: StoredOrder | null;
  contact: StoredContactMessage | null;
};

const EMPTY_STATE: StoredState = {
  quote: null,
  kit: null,
  order: null,
  contact: null,
};

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatDate(iso: string, locale: Locale): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(
      locale === 'fr-ca' ? 'fr-CA' : 'en-CA',
      { dateStyle: 'long', timeStyle: 'short' },
    ).format(d);
  } catch {
    return iso;
  }
}

export function AccountClient({ locale }: Props) {
  const t = useTranslations('account');
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<StoredState>(EMPTY_STATE);
  const wishlistIds = useWishlist((s) => s.productIds);

  useEffect(() => {
    setMounted(true);
    setData({
      quote: readJson<StoredQuote>('va-last-quote'),
      kit: readJson<StoredKitOrder>('va-last-kit-order'),
      order: readJson<StoredOrder>('va-last-order'),
      contact: readJson<StoredContactMessage>('va-last-contact'),
    });
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 animate-pulse rounded bg-sand-100" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-sand-100" />
          <div className="h-48 animate-pulse rounded-lg bg-sand-100" />
          <div className="h-48 animate-pulse rounded-lg bg-sand-100" />
          <div className="h-48 animate-pulse rounded-lg bg-sand-100" />
        </div>
      </div>
    );
  }

  const { quote, kit, order, contact } = data;
  const wishlistCount = wishlistIds.length;
  const allEmpty = !quote && !kit && !order && !contact && wishlistCount === 0;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-display-md font-semibold text-ink-950">
          {t('heading')}
        </h1>
        <p className="max-w-2xl text-body-md text-stone-600">{t('subhead')}</p>
      </header>

      {allEmpty ? (
        <EmptyStateCard locale={locale} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quote ? <QuoteCard locale={locale} entry={quote} /> : null}
          {kit ? <KitCard locale={locale} entry={kit} /> : null}
          {order ? <OrderCard locale={locale} entry={order} /> : null}
          {contact ? <ContactCard locale={locale} entry={contact} /> : null}
          {wishlistCount > 0 ? (
            <WishlistCard locale={locale} count={wishlistCount} />
          ) : null}
        </div>
      )}

      <footer className="rounded-md border border-dashed border-sand-300 bg-canvas-050 p-4 text-body-sm text-stone-600">
        {t('disclaimer')}
      </footer>
    </div>
  );
}

function CardShell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-sand-300 bg-canvas-000 p-5 md:p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-sand-100 text-ink-950">
          {icon}
        </div>
        <h2 className="text-title-md font-semibold text-ink-950">{title}</h2>
      </header>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-body-sm text-stone-600">
      <span className="text-meta-xs uppercase tracking-wider text-stone-600">
        {label}:{' '}
      </span>
      <span className="text-ink-950">{value}</span>
    </p>
  );
}

function QuoteCard({
  locale,
  entry,
}: {
  locale: Locale;
  entry: StoredQuote;
}) {
  const t = useTranslations('account.sections.quote');
  const [open, setOpen] = useState(false);
  const productCount = entry.products.productIds.length;
  const productsLabel =
    locale === 'fr-ca'
      ? `${productCount} produit${productCount > 1 ? 's' : ''} sélectionné${productCount > 1 ? 's' : ''}`
      : `${productCount} product${productCount > 1 ? 's' : ''} selected`;

  return (
    <CardShell
      icon={<FileText aria-hidden className="h-5 w-5" />}
      title={t('title')}
    >
      <div className="space-y-1.5">
        <MetaRow label={t('ref')} value={entry.quoteId} />
        <MetaRow label={t('date')} value={formatDate(entry.createdAt, locale)} />
        <MetaRow label={t('items')} value={productsLabel} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-sand-300 pt-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-sand-300 bg-canvas-000 px-3 text-body-sm font-medium text-ink-950 hover:bg-sand-100"
          aria-expanded={open}
        >
          {t('viewDetails')}
          {open ? (
            <ChevronUp aria-hidden className="h-4 w-4" />
          ) : (
            <ChevronDown aria-hidden className="h-4 w-4" />
          )}
        </button>
        <Link
          href={`/${locale}/soumission`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:bg-sand-100"
        >
          {t('retry')}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>

      {open ? (
        <dl className="space-y-2 rounded-md border border-sand-300 bg-canvas-050 p-4 text-body-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-stone-600">{t('detail.employees')}</dt>
            <dd className="text-ink-950">{entry.scope.employeeCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-600">{t('detail.neededBy')}</dt>
            <dd className="text-ink-950">{entry.scope.neededBy}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-600">{t('detail.industry')}</dt>
            <dd className="text-ink-950">{entry.scope.industry}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-600">{t('detail.shippingMode')}</dt>
            <dd className="text-ink-950">{entry.shipping.shippingMode}</dd>
          </div>
        </dl>
      ) : null}
    </CardShell>
  );
}

function KitCard({
  locale,
  entry,
}: {
  locale: Locale;
  entry: StoredKitOrder;
}) {
  const t = useTranslations('account.sections.kit');
  const kit = getKit(entry.kitId);
  const kitName = kit ? kit.name[locale] : entry.kitId;

  return (
    <CardShell
      icon={<Sparkles aria-hidden className="h-5 w-5" />}
      title={t('title')}
    >
      <div className="space-y-1.5">
        <MetaRow label={t('ref')} value={entry.orderNumber} />
        <MetaRow label={t('date')} value={formatDate(entry.createdAt, locale)} />
        <MetaRow label={t('kitName')} value={kitName} />
        <MetaRow
          label={t('price')}
          value={formatCAD(entry.priceCents, locale)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-sand-300 pt-4">
        <Link
          href={`/${locale}/produits?kit=${entry.kitId}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:bg-sand-100"
        >
          {t('reorder')}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
        <Link
          href={`/${locale}/kit`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:bg-sand-100"
        >
          {t('orderAgain')}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
    </CardShell>
  );
}

function OrderCard({
  locale,
  entry,
}: {
  locale: Locale;
  entry: StoredOrder;
}) {
  const t = useTranslations('account.sections.order');
  const itemCount = entry.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CardShell
      icon={<Package aria-hidden className="h-5 w-5" />}
      title={t('title')}
    >
      <div className="space-y-1.5">
        <MetaRow label={t('ref')} value={entry.orderNumber} />
        <MetaRow label={t('date')} value={formatDate(entry.createdAt, locale)} />
        <MetaRow
          label={t('items')}
          value={String(itemCount)}
        />
        <MetaRow
          label={t('total')}
          value={formatCAD(entry.totals.totalCents, locale)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-sand-300 pt-4">
        <Link
          href={`/${locale}/suivi/${entry.orderNumber}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:bg-sand-100"
        >
          {t('track')}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
        <Link
          href={`/${locale}/panier`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:bg-sand-100"
        >
          {t('reorder')}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
    </CardShell>
  );
}

function ContactCard({
  locale,
  entry,
}: {
  locale: Locale;
  entry: StoredContactMessage;
}) {
  const t = useTranslations('account.sections.contact');
  const subjectLabel = t(`subjects.${entry.subject}`);

  return (
    <CardShell
      icon={<Mail aria-hidden className="h-5 w-5" />}
      title={t('title')}
    >
      <div className="space-y-1.5">
        <MetaRow label={t('ref')} value={entry.ticketId} />
        <MetaRow label={t('subject')} value={subjectLabel} />
        <MetaRow label={t('date')} value={formatDate(entry.createdAt, locale)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-sand-300 pt-4">
        <Link
          href={`/${locale}/contact`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:bg-sand-100"
        >
          {t('sendAnother')}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
    </CardShell>
  );
}

function WishlistCard({
  locale,
  count,
}: {
  locale: Locale;
  count: number;
}) {
  const t = useTranslations('wishlist');
  return (
    <CardShell
      icon={<Heart aria-hidden className="h-5 w-5" />}
      title={t('account.cardTitle', { count })}
    >
      <p className="text-body-sm text-stone-600">
        {t('badge.count', { count })}
      </p>
      <div className="flex flex-wrap items-center gap-2 border-t border-sand-300 pt-4">
        <Link
          href={`/${locale}/wishlist`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:bg-sand-100"
        >
          {t('page.heading')}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
    </CardShell>
  );
}

function EmptyStateCard({ locale }: { locale: Locale }) {
  const t = useTranslations('account.empty');
  return (
    <div className="rounded-lg border border-dashed border-sand-300 bg-canvas-050 p-8 text-center md:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-ink-950">
        <ShoppingBag aria-hidden className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-title-lg font-semibold text-ink-950">
        {t('title')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-body-md text-stone-600">
        {t('body')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button href={`/${locale}/produits`} variant="primary" size="md">
          {t('cta.shop')}
        </Button>
        <Button href={`/${locale}/soumission`} variant="secondary" size="md">
          {t('cta.quote')}
        </Button>
      </div>
    </div>
  );
}
