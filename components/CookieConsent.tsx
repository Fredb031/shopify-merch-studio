'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import {
  type ConsentCategory,
  type ConsentState,
  getConsent,
  setConsent as persistConsent,
} from '@/lib/cookieConsent';

type NonEssentialCategory = Exclude<ConsentCategory, 'essentials'>;

const NON_ESSENTIAL_CATEGORIES: readonly NonEssentialCategory[] = [
  'preferences',
  'analytics',
  'marketing',
] as const;

type Selections = Record<NonEssentialCategory, boolean>;

const ALL_OFF: Selections = {
  preferences: false,
  analytics: false,
  marketing: false,
};

const ALL_ON: Selections = {
  preferences: true,
  analytics: true,
  marketing: true,
};

function focusableSelector(): string {
  return [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
}

export function CookieConsent() {
  const t = useTranslations('consent');
  const locale = useLocale();

  const [mounted, setMounted] = useState(false);
  const [decided, setDecided] = useState(true); // assume decided until we read cookie (avoids flash)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selections, setSelections] = useState<Selections>(ALL_OFF);

  const headingId = useId();
  const dialogHeadingId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Mount + initial cookie read (client-only; avoids SSR/hydration mismatch).
  useEffect(() => {
    setMounted(true);
    const existing = getConsent();
    setDecided(existing !== null);
    if (existing) {
      setSelections({
        preferences: existing.preferences,
        analytics: existing.analytics,
        marketing: existing.marketing,
      });
    }
  }, []);

  const writeAndDismiss = useCallback((next: Partial<ConsentState>) => {
    persistConsent(next);
    setDecided(true);
    setSettingsOpen(false);
  }, []);

  const handleAcceptAll = useCallback(() => {
    setSelections(ALL_ON);
    writeAndDismiss({ ...ALL_ON });
  }, [writeAndDismiss]);

  const handleDeclineAll = useCallback(() => {
    setSelections(ALL_OFF);
    writeAndDismiss({ ...ALL_OFF });
  }, [writeAndDismiss]);

  const handleSaveCustom = useCallback(() => {
    writeAndDismiss({ ...selections });
  }, [writeAndDismiss, selections]);

  const openSettings = useCallback(() => {
    previouslyFocusedRef.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    // Return focus to the previously focused trigger when possible.
    queueMicrotask(() => {
      previouslyFocusedRef.current?.focus?.();
    });
  }, []);

  // Focus trap + ESC handling for the settings modal.
  useEffect(() => {
    if (!settingsOpen) return;
    const node: HTMLDivElement | null = dialogRef.current;
    if (!node) return;
    const dialogNode: HTMLDivElement = node;

    const focusables = () =>
      Array.from(
        dialogNode.querySelectorAll<HTMLElement>(focusableSelector()),
      ).filter((el) => !el.hasAttribute('data-focus-trap-skip'));

    // Initial focus on first focusable.
    const first = focusables()[0];
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (!firstEl || !lastEl) return;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === firstEl || (active && !dialogNode.contains(active))) {
          event.preventDefault();
          lastEl.focus();
        }
      } else {
        if (active === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen, closeSettings]);

  const privacyHref = `/${locale}/legal/confidentialite`;
  const cookiesHref = `/${locale}/legal/cookies`;

  const showBanner = useMemo(() => mounted && !decided, [mounted, decided]);

  // Render nothing until we've checked the cookie on the client.
  if (!mounted) return null;

  if (!showBanner && !settingsOpen) return null;

  return (
    <>
      {showBanner && !settingsOpen && (
        <aside
          role="region"
          aria-label={t('ariaLabel')}
          aria-labelledby={headingId}
          className="fixed inset-x-0 bottom-0 z-50 bg-ink-950 text-canvas-000 shadow-lg motion-safe:animate-[va-consent-slide-up_180ms_ease-out_both]"
        >
          <div className="mx-auto w-full max-w-container-xl px-6 py-5 md:px-8 md:py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
              <div className="flex-1">
                <h2
                  id={headingId}
                  className="text-title-md font-semibold text-canvas-000"
                >
                  {t('heading')}
                </h2>
                <p className="mt-2 text-body-sm text-canvas-000/85 md:text-body-md">
                  {t('body')}{' '}
                  <Link
                    href={privacyHref}
                    className="underline underline-offset-2 hover:text-canvas-000"
                  >
                    {t('links.privacy')}
                  </Link>{' '}
                  ·{' '}
                  <Link
                    href={cookiesHref}
                    className="underline underline-offset-2 hover:text-canvas-000"
                  >
                    {t('links.cookies')}
                  </Link>
                </p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md bg-canvas-000 px-5 text-body-md font-medium text-ink-950 transition-colors hover:bg-sand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-000"
                >
                  {t('buttons.acceptAll')}
                </button>
                <button
                  type="button"
                  onClick={handleDeclineAll}
                  className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md border border-canvas-000/40 bg-transparent px-5 text-body-md font-medium text-canvas-000 transition-colors hover:bg-canvas-000/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-000"
                >
                  {t('buttons.declineAll')}
                </button>
                <button
                  type="button"
                  onClick={openSettings}
                  className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md bg-transparent px-3 text-body-md font-medium text-canvas-000 underline underline-offset-2 hover:text-canvas-000/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-000"
                >
                  {t('buttons.customize')}
                </button>
              </div>
            </div>
          </div>
          <style jsx>{`
            @keyframes va-consent-slide-up {
              from {
                transform: translateY(100%);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
          `}</style>
        </aside>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSettings();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogHeadingId}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-lg bg-canvas-000 text-ink-950 shadow-xl sm:rounded-lg"
          >
            <div className="px-6 py-6 md:px-8 md:py-8">
              <h2
                id={dialogHeadingId}
                className="text-title-lg font-semibold text-ink-950"
              >
                {t('settings.heading')}
              </h2>
              <p className="mt-2 text-body-sm text-stone-600">{t('body')}</p>

              <ul className="mt-6 space-y-4">
                <CategoryRow
                  title={t('settings.categories.essentials.title')}
                  description={t('settings.categories.essentials.description')}
                  lockedNote={t('settings.categories.essentials.lockedNote')}
                  checked
                  locked
                />
                {NON_ESSENTIAL_CATEGORIES.map((cat) => (
                  <CategoryRow
                    key={cat}
                    title={t(`settings.categories.${cat}.title`)}
                    description={t(`settings.categories.${cat}.description`)}
                    checked={selections[cat]}
                    onChange={(next) =>
                      setSelections((prev) => ({ ...prev, [cat]: next }))
                    }
                  />
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={closeSettings}
                  className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md border border-ink-950 bg-canvas-000 px-5 text-body-md font-medium text-ink-950 transition-colors hover:bg-sand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md bg-ink-950 px-5 text-body-md font-medium text-canvas-000 transition-colors hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                >
                  {t('settings.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type CategoryRowProps = {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  lockedNote?: string;
  onChange?: (next: boolean) => void;
};

function CategoryRow({
  title,
  description,
  checked,
  locked = false,
  lockedNote,
  onChange,
}: CategoryRowProps) {
  return (
    <li className="rounded-md border border-sand-300 bg-canvas-050 p-4">
      <label className="flex items-start gap-4">
        <span className="flex-1">
          <span className="block text-body-md font-semibold text-ink-950">
            {title}
          </span>
          <span className="mt-1 block text-body-sm text-stone-600">
            {description}
          </span>
          {locked && lockedNote && (
            <span className="mt-1 block text-meta-xs uppercase tracking-wider text-stone-500">
              {lockedNote}
            </span>
          )}
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={locked}
          onChange={(e) => onChange?.(e.currentTarget.checked)}
          className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-sand-300 transition-colors checked:bg-ink-950 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-canvas-000 before:transition-transform checked:before:translate-x-4"
        />
      </label>
    </li>
  );
}
