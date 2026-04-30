'use client';

import { useTranslations } from 'next-intl';

export function SkipLink() {
  const t = useTranslations('nav');
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-canvas-000 focus:outline-2 focus:outline-offset-2 focus:outline-slate-700"
    >
      {t('skipToContent')}
    </a>
  );
}
