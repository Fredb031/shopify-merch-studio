'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useForm,
  type FieldErrors,
  type SubmitHandler,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  Truck,
} from 'lucide-react';

import { FormField } from '@/components/checkout/FormField';
import { QC_PROVINCES } from '@/lib/orderForm';
import { kitOrderSchema, type KitOrderValues, type StoredKitOrder } from '@/lib/kitForm';
import { KIT_TYPES, getKit, type KitType } from '@/lib/kitTypes';
import { formatCAD } from '@/lib/format';
import type { Locale } from '@/lib/types';
import { KitSubmittedClient } from './KitSubmittedClient';

type Props = {
  locale: Locale;
};

const CHECKLIST_KEYS = ['1', '2', '3', '4'] as const;
const TIMELINE_KEYS = ['1', '2', '3'] as const;

export function KitClient({ locale }: Props) {
  const t = useTranslations('kit');
  const [selectedKitId, setSelectedKitId] = useState<KitType['id'] | null>(null);
  const [submitted, setSubmitted] = useState<StoredKitOrder | null>(null);

  const form = useForm<KitOrderValues>({
    resolver: zodResolver(kitOrderSchema),
    mode: 'onTouched',
    defaultValues: {
      kitId: 'starter',
      name: '',
      email: '',
      phone: '',
      company: '',
      addressLine1: '',
      city: '',
      province: 'QC',
      postalCode: '',
      country: 'CA',
      language: locale === 'fr-ca' ? 'fr' : 'en',
      marketingConsent: false,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const selectedKit = useMemo(
    () => (selectedKitId ? getKit(selectedKitId) : null),
    [selectedKitId],
  );

  const handleSelectKit = (id: KitType['id']) => {
    setSelectedKitId(id);
    setValue('kitId', id, { shouldValidate: true });
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.getElementById('kit-form');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const handleChangeKit = () => {
    setSelectedKitId(null);
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.getElementById('kit-cards');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const onSubmit: SubmitHandler<KitOrderValues> = (values) => {
    const kit = getKit(values.kitId);
    if (!kit) return;
    const orderNumber = `K-${Date.now().toString(36).toUpperCase()}`;
    const stored: StoredKitOrder = {
      orderNumber,
      createdAt: new Date().toISOString(),
      kitId: values.kitId,
      priceCents: kit.priceCents,
      contact: {
        name: values.name,
        email: values.email,
        phone: values.phone,
        company: values.company,
        language: values.language,
        marketingConsent: values.marketingConsent,
      },
      shipping: {
        addressLine1: values.addressLine1,
        city: values.city,
        province: values.province,
        postalCode: values.postalCode.toUpperCase(),
        country: 'CA',
      },
    };
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          'va-last-kit-order',
          JSON.stringify(stored),
        );
      } catch {
        // ignore
      }
    }
    setSubmitted(stored);
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  if (submitted) {
    return <KitSubmittedClient locale={locale} order={submitted} />;
  }

  return (
    <div className="space-y-16">
      {/* Kit selection */}
      <section id="kit-cards" aria-labelledby="kit-cards-heading" className="space-y-6">
        <header className="space-y-2">
          <h2
            id="kit-cards-heading"
            className="text-display-md font-semibold text-ink-950"
          >
            {t('kits.heading')}
          </h2>
          <p className="max-w-2xl text-body-md text-stone-600">
            {t('kits.subhead')}
          </p>
        </header>
        <ul className="grid gap-6 md:grid-cols-3">
          {KIT_TYPES.map((kit) => (
            <li key={kit.id}>
              <KitCard
                kit={kit}
                locale={locale}
                isSelected={selectedKitId === kit.id}
                onSelect={() => handleSelectKit(kit.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Order form */}
      {selectedKit ? (
        <section
          id="kit-form"
          aria-labelledby="kit-form-heading"
          className="space-y-8 rounded-lg border border-sand-300 bg-canvas-050 p-6 md:p-8"
        >
          <header className="flex flex-col gap-4 border-b border-sand-300 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-meta-xs uppercase tracking-wider text-stone-600">
                {t('kits.selected')}
              </p>
              <h2
                id="kit-form-heading"
                className="text-title-lg font-semibold text-ink-950"
              >
                {selectedKit.name[locale]}
              </h2>
              <p className="text-body-sm text-stone-600">
                {selectedKit.bestFor[locale]} ·{' '}
                <span className="font-medium text-ink-950">
                  {formatCAD(selectedKit.priceCents, locale)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleChangeKit}
              className="self-start text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
            >
              {t('form.changeKit')}
            </button>
          </header>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-8"
          >
            <input type="hidden" {...register('kitId')} />

            <ContactSection
              register={register}
              errors={errors}
              locale={locale}
            />

            <ShippingSection
              register={register}
              errors={errors}
              setValue={setValue}
              locale={locale}
            />

            <label className="flex items-start gap-3 rounded-md bg-canvas-000 p-4 text-body-sm text-ink-950">
              <input
                id="marketingConsent"
                type="checkbox"
                {...register('marketingConsent')}
                className="mt-0.5 h-4 w-4 accent-ink-950"
              />
              <span>{t('form.marketing.optIn')}</span>
            </label>

            <ChecklistBlock />

            <TimelineBlock />

            <div className="flex flex-col-reverse items-stretch gap-3 border-t border-sand-300 pt-6 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={handleChangeKit}
                className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-body-sm font-medium text-ink-950 hover:bg-sand-100"
              >
                {t('form.cta.back')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800 disabled:opacity-60"
              >
                {t('form.cta.submit')}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

type KitCardProps = {
  kit: KitType;
  locale: Locale;
  isSelected: boolean;
  onSelect: () => void;
};

function KitCard({ kit, locale, isSelected, onSelect }: KitCardProps) {
  const t = useTranslations('kit');
  const tItems = useTranslations(`kit.kitItems.${kit.id}`);
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-lg border bg-canvas-000 transition-colors duration-base ${
        isSelected
          ? 'border-ink-950 ring-2 ring-ink-950/30'
          : 'border-sand-300 hover:border-ink-950/50'
      }`}
    >
      <KitPlaceholderSvg id={kit.id} locale={locale} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <header className="space-y-1">
          <h3 className="text-title-lg font-semibold text-ink-950">
            {kit.name[locale]}
          </h3>
          <p className="text-body-sm text-stone-600">
            <span className="text-meta-xs uppercase tracking-wider text-stone-600">
              {t('kits.bestFor')}:
            </span>{' '}
            {kit.bestFor[locale]}
          </p>
        </header>

        <div className="space-y-2">
          <p className="text-meta-xs uppercase tracking-wider text-stone-600">
            {t('kits.includes')}
          </p>
          <ul className="space-y-1.5 text-body-sm text-ink-950">
            {kit.contents.map((_, idx) => (
              <li key={idx} className="flex gap-2">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 flex-none text-success-700"
                />
                <span>{tItems(`contents.${idx + 1}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-sand-300 pt-4">
          <p className="text-body-md font-semibold text-ink-950 tabular-nums">
            {formatCAD(kit.priceCents, locale)}
          </p>
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={isSelected}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-body-sm font-medium transition-colors duration-base ${
              isSelected
                ? 'bg-ink-950 text-canvas-000'
                : 'border border-ink-950 bg-canvas-000 text-ink-950 hover:bg-sand-100'
            }`}
          >
            {isSelected ? t('kits.selected') : t('kits.select')}
          </button>
        </div>
      </div>
    </article>
  );
}

function KitPlaceholderSvg({
  id,
  locale,
}: {
  id: KitType['id'];
  locale: Locale;
}) {
  const labels: Record<KitType['id'], { 'fr-ca': string; 'en-ca': string }> = {
    starter: { 'fr-ca': 'KIT STARTER', 'en-ca': 'STARTER KIT' },
    workwear: { 'fr-ca': 'KIT WORKWEAR', 'en-ca': 'WORKWEAR KIT' },
    corporate: { 'fr-ca': 'KIT CORPORATIF', 'en-ca': 'CORPORATE KIT' },
  };
  const label = labels[id][locale];
  return (
    <div className="aspect-[3/2] w-full bg-sand-100">
      <svg
        viewBox="0 0 600 400"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={label}
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="600" height="400" fill="#0B0F14" />
        <rect x="40" y="40" width="520" height="320" fill="none" stroke="#E8DCC4" strokeWidth="2" />
        <g fill="#E8DCC4" opacity="0.18">
          <circle cx="120" cy="320" r="60" />
          <rect x="220" y="240" width="160" height="120" rx="8" />
          <circle cx="480" cy="320" r="60" />
        </g>
        <text
          x="300"
          y="200"
          fill="#FFF7E5"
          fontFamily="ui-sans-serif, system-ui, -apple-system"
          fontWeight="700"
          fontSize="48"
          textAnchor="middle"
          letterSpacing="3"
        >
          {label}
        </text>
        <text
          x="300"
          y="240"
          fill="#E8DCC4"
          fontFamily="ui-sans-serif, system-ui, -apple-system"
          fontSize="18"
          textAnchor="middle"
          letterSpacing="6"
        >
          VISION AFFICHAGE
        </text>
      </svg>
    </div>
  );
}

type ContactSectionProps = {
  register: UseFormRegister<KitOrderValues>;
  errors: FieldErrors<KitOrderValues>;
  locale: Locale;
};

function ContactSection({ register, errors, locale }: ContactSectionProps) {
  const t = useTranslations('kit');
  const tErrors = useTranslations('kit.form.errors');
  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-title-md font-semibold text-ink-950">
          {t('form.contact.heading')}
        </h3>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="name"
          label={t('form.contact.name')}
          required
          error={resolveError(errors.name?.message, tErrors)}
          className="sm:col-span-2"
        >
          <input
            id="name"
            type="text"
            autoComplete="name"
            {...register('name')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="email"
          label={t('form.contact.email')}
          required
          error={resolveError(errors.email?.message, tErrors)}
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            {...register('email')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="phone"
          label={t('form.contact.phone')}
          required
          error={resolveError(errors.phone?.message, tErrors)}
        >
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            {...register('phone')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="company"
          label={t('form.contact.company')}
          required
          error={resolveError(errors.company?.message, tErrors)}
          className="sm:col-span-2"
        >
          <input
            id="company"
            type="text"
            autoComplete="organization"
            {...register('company')}
            className={inputClass}
          />
        </FormField>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-body-sm font-medium text-ink-950">
          {t('form.contact.language')}
        </legend>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
            <input
              type="radio"
              value="fr"
              {...register('language')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('form.contact.languageFr')}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
            <input
              type="radio"
              value="en"
              {...register('language')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('form.contact.languageEn')}
          </label>
        </div>
      </fieldset>
      <span className="sr-only">{locale}</span>
    </section>
  );
}

type ShippingSectionProps = {
  register: UseFormRegister<KitOrderValues>;
  errors: FieldErrors<KitOrderValues>;
  setValue: UseFormSetValue<KitOrderValues>;
  locale: Locale;
};

function ShippingSection({
  register,
  errors,
  setValue,
  locale,
}: ShippingSectionProps) {
  const t = useTranslations('kit');
  const tErrors = useTranslations('kit.form.errors');
  return (
    <section className="space-y-4">
      <header>
        <h3 className="flex items-center gap-2 text-title-md font-semibold text-ink-950">
          <MapPin aria-hidden className="h-5 w-5" />
          {t('form.shipping.heading')}
        </h3>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="addressLine1"
          label={t('form.shipping.addressLine1')}
          required
          error={resolveError(errors.addressLine1?.message, tErrors)}
          className="sm:col-span-2"
        >
          <input
            id="addressLine1"
            type="text"
            autoComplete="address-line1"
            {...register('addressLine1')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="city"
          label={t('form.shipping.city')}
          required
          error={resolveError(errors.city?.message, tErrors)}
        >
          <input
            id="city"
            type="text"
            autoComplete="address-level2"
            {...register('city')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="province"
          label={t('form.shipping.province')}
          required
          error={resolveError(errors.province?.message, tErrors)}
        >
          <select
            id="province"
            autoComplete="address-level1"
            {...register('province')}
            className={selectClass}
          >
            {QC_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="postalCode"
          label={t('form.shipping.postalCode')}
          required
          error={resolveError(errors.postalCode?.message, tErrors)}
        >
          <input
            id="postalCode"
            type="text"
            autoComplete="postal-code"
            {...register('postalCode', {
              onChange: (e) => {
                setValue('postalCode', e.target.value.toUpperCase(), {
                  shouldValidate: false,
                });
              },
            })}
            className={`${inputClass} uppercase`}
          />
        </FormField>
        <FormField id="country" label={t('form.shipping.country')} required>
          <input
            id="country"
            type="text"
            value={locale === 'fr-ca' ? 'Canada' : 'Canada'}
            readOnly
            aria-readonly
            className={`${inputClass} cursor-not-allowed bg-canvas-050`}
          />
          <input type="hidden" {...register('country')} value="CA" />
        </FormField>
      </div>
    </section>
  );
}

function ChecklistBlock() {
  const t = useTranslations('kit');
  return (
    <section
      aria-labelledby="kit-checklist-heading"
      className="rounded-md border border-sand-300 bg-canvas-000 p-5"
    >
      <h3
        id="kit-checklist-heading"
        className="flex items-center gap-2 text-title-md font-semibold text-ink-950"
      >
        <ClipboardCheck aria-hidden className="h-5 w-5" />
        {t('checklist.heading')}
      </h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {CHECKLIST_KEYS.map((key) => (
          <li key={key} className="flex gap-2 text-body-sm text-ink-950">
            <CheckCircle2
              aria-hidden
              className="mt-0.5 h-4 w-4 flex-none text-success-700"
            />
            <span>{t(`checklist.items.${key}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TimelineBlock() {
  const t = useTranslations('kit');
  return (
    <section
      aria-labelledby="kit-timeline-heading"
      className="rounded-md border border-sand-300 bg-canvas-000 p-5"
    >
      <h3
        id="kit-timeline-heading"
        className="flex items-center gap-2 text-title-md font-semibold text-ink-950"
      >
        <Truck aria-hidden className="h-5 w-5" />
        {t('timeline.heading')}
      </h3>
      <ol className="mt-3 grid gap-4 sm:grid-cols-3">
        {TIMELINE_KEYS.map((key, idx) => (
          <li key={key} className="flex gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-ink-950 text-meta-xs font-semibold text-canvas-000"
            >
              {idx + 1}
            </span>
            <div>
              <p className="text-body-sm font-semibold text-ink-950">
                {t(`timeline.items.${key}.title`)}
              </p>
              <p className="mt-1 text-body-sm text-stone-600">
                {t(`timeline.items.${key}.desc`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function resolveError(
  raw: string | undefined,
  tErrors: ReturnType<typeof useTranslations<'kit.form.errors'>>,
): string | undefined {
  if (!raw) return undefined;
  if (/email/i.test(raw)) return tErrors('email');
  if (/postal|regex/i.test(raw) && /[A-Z]\\d/i.test(raw)) {
    return tErrors('postalCode');
  }
  if (/phone|10/i.test(raw)) return tErrors('phone');
  if (/^Required$|min|String must contain at least/.test(raw)) {
    return tErrors('required');
  }
  return raw;
}

const inputClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const selectClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';
