'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

import { FormField } from '@/components/checkout/FormField';
import {
  newsletterSchema,
  type NewsletterFormValues,
  type StoredNewsletterSubscription,
} from '@/lib/newsletterForm';
import type { Locale } from '@/lib/types';

type Variant = 'inline' | 'page';

type Props = {
  variant: Variant;
  locale: Locale;
  /** Optional default email pre-filled from query string on /infolettre. */
  defaultEmail?: string;
};

export function NewsletterSignup({ variant, locale, defaultEmail }: Props) {
  if (variant === 'inline') {
    return <InlineSignup locale={locale} />;
  }
  return <PageSignup locale={locale} defaultEmail={defaultEmail} />;
}

function InlineSignup({ locale }: { locale: Locale }) {
  const t = useTranslations('newsletter.inline');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const base = `/${locale}`;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    const target = trimmed
      ? `${base}/infolettre?email=${encodeURIComponent(trimmed)}`
      : `${base}/infolettre`;
    router.push(target);
  };

  return (
    <div className="space-y-2">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
        aria-label={t('ariaLabel')}
      >
        <label htmlFor="newsletter-inline-email" className="sr-only">
          {t('placeholder')}
        </label>
        <input
          id="newsletter-inline-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t('placeholder')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full flex-1 rounded-md border border-ink-800 bg-ink-900 px-3 text-body-md text-canvas-000 placeholder:text-sand-300 focus:border-canvas-000 focus:outline-none focus:ring-2 focus:ring-canvas-000/40"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-canvas-000 px-5 text-body-sm font-medium text-ink-950 transition-colors duration-base hover:bg-sand-100"
        >
          {t('submit')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      </form>
      <p className="text-body-sm text-sand-300">
        {t('helper')}{' '}
        <Link
          href={`${base}/infolettre`}
          className="underline underline-offset-2 hover:text-canvas-000"
        >
          {t('fullForm')}
        </Link>
      </p>
    </div>
  );
}

function PageSignup({
  locale,
  defaultEmail,
}: {
  locale: Locale;
  defaultEmail?: string;
}) {
  const t = useTranslations('newsletter.page');
  const tErrors = useTranslations('newsletter.page.form.errors');
  const [submitted, setSubmitted] = useState<StoredNewsletterSubscription | null>(
    null,
  );

  const form = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
    mode: 'onTouched',
    defaultValues: {
      email: defaultEmail ?? '',
      firstName: '',
      language: locale === 'fr-ca' ? 'fr' : 'en',
      // CASL §6: opt-in must be UNCHECKED by default.
      caslConsent: false as unknown as true,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit: SubmitHandler<NewsletterFormValues> = (values) => {
    const ref = `N-${Date.now().toString(36).toUpperCase()}`;
    const stored: StoredNewsletterSubscription = {
      ref,
      createdAt: new Date().toISOString(),
      email: values.email,
      firstName: values.firstName?.trim() ? values.firstName.trim() : undefined,
      language: values.language,
      caslConsent: true,
    };
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          'va-last-newsletter',
          JSON.stringify(stored),
        );
      } catch {
        // ignore storage quota / private mode
      }
    }
    setSubmitted(stored);
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-meta-xs uppercase tracking-wider text-stone-600">
          {t('hero.eyebrow')}
        </p>
        <h1 className="text-display-md font-semibold text-ink-950">
          {t('hero.headline')}
        </h1>
        <p className="max-w-2xl text-body-md text-stone-600">
          {t('hero.subhead')}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {submitted ? (
            <SuccessView refValue={submitted.ref} />
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-6 rounded-lg border border-sand-300 bg-canvas-050 p-6 md:p-8"
              aria-label={t('hero.headline')}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="newsletter-email"
                  label={t('form.email')}
                  required
                  error={resolveError(errors.email?.message, tErrors)}
                  className="sm:col-span-2"
                >
                  <input
                    id="newsletter-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    {...register('email')}
                    className={inputClass}
                  />
                </FormField>
                <FormField
                  id="newsletter-firstName"
                  label={t('form.firstName')}
                  error={resolveError(errors.firstName?.message, tErrors)}
                  className="sm:col-span-2"
                >
                  <input
                    id="newsletter-firstName"
                    type="text"
                    autoComplete="given-name"
                    {...register('firstName')}
                    className={inputClass}
                  />
                </FormField>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-body-sm font-medium text-ink-950">
                  {t('form.language')}
                </legend>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
                    <input
                      type="radio"
                      value="fr"
                      {...register('language')}
                      className="h-4 w-4 accent-ink-950"
                    />
                    {t('form.languageFr')}
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
                    <input
                      type="radio"
                      value="en"
                      {...register('language')}
                      className="h-4 w-4 accent-ink-950"
                    />
                    {t('form.languageEn')}
                  </label>
                </div>
              </fieldset>

              <div className="space-y-1">
                <label
                  htmlFor="newsletter-casl"
                  className="flex items-start gap-3 rounded-md bg-canvas-000 p-4 text-body-sm text-ink-950"
                >
                  <input
                    id="newsletter-casl"
                    type="checkbox"
                    {...register('caslConsent')}
                    className="mt-0.5 h-4 w-4 accent-ink-950"
                    aria-describedby={
                      errors.caslConsent?.message
                        ? 'newsletter-casl-error'
                        : undefined
                    }
                  />
                  <span>{t('form.casl.label')}</span>
                </label>
                {errors.caslConsent?.message ? (
                  <p
                    id="newsletter-casl-error"
                    role="alert"
                    className="text-meta-xs font-medium text-error-700"
                  >
                    {resolveError(errors.caslConsent.message, tErrors)}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end border-t border-sand-300 pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800 disabled:opacity-60"
                >
                  {t('form.submit')}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>

        <aside aria-label={t('trust.heading')}>
          <h2 className="mb-4 text-title-md font-semibold text-ink-950">
            {t('trust.heading')}
          </h2>
          <ul className="space-y-3">
            {(['1', '2', '3'] as const).map((key) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-md border border-sand-300 bg-canvas-000 p-3 text-body-sm text-ink-950"
              >
                <ShieldCheck
                  aria-hidden
                  className="mt-0.5 h-5 w-5 flex-none text-ink-950"
                />
                <span>{t(`trust.items.${key}`)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function SuccessView({ refValue }: { refValue: string }) {
  const t = useTranslations('newsletter.page.form.success');
  return (
    <div className="space-y-6 rounded-lg border border-success-700/40 bg-canvas-050 p-6 md:p-8">
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden
          className="mt-0.5 h-6 w-6 flex-none text-success-700"
        />
        <div className="space-y-2">
          <h2 className="text-title-lg font-semibold text-ink-950">
            {t('heading')}
          </h2>
          <p className="text-body-md text-stone-600">{t('body')}</p>
          <p className="text-body-sm text-stone-600">
            {t('ref', { ref: refValue })}
          </p>
        </div>
      </div>
    </div>
  );
}

function resolveError(
  raw: string | undefined,
  tErrors: ReturnType<typeof useTranslations>,
): string | undefined {
  if (!raw) return undefined;
  if (raw === 'email') return tErrors('email');
  if (raw === 'caslRequired') return tErrors('caslRequired');
  if (/email/i.test(raw)) return tErrors('email');
  return raw;
}

const inputClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';
