'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale, Product } from '@/lib/types';
import { QuickViewModal } from './QuickViewModal';

type Props = {
  product: Product;
  locale: Locale;
  className?: string;
};

export function QuickViewButton({ product, locale, className = '' }: Props) {
  const t = useTranslations('quickView');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Prevent the surrounding card link from navigating to PDP.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-pill bg-slate-700 px-3 text-body-sm font-medium text-canvas-000 shadow-sm transition-opacity duration-base ease-standard hover:bg-ink-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${className}`.trim()}
      >
        <Eye aria-hidden className="h-4 w-4" />
        <span>{t('button.label')}</span>
      </button>
      <QuickViewModal
        product={product}
        locale={locale}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
