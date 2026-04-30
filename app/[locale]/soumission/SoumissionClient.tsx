'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  useForm,
  type FieldErrors,
  type Path,
  type SubmitHandler,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Send,
  Upload,
  Users,
} from 'lucide-react';

import { FormField } from '@/components/checkout/FormField';
import { products } from '@/lib/products';
import { formatCAD } from '@/lib/format';
import {
  CONTACT_FIELDS,
  LOGO_FIELDS,
  PRODUCT_FIELDS,
  QC_PROVINCES,
  QUOTE_INDUSTRY_SLUGS,
  SCOPE_FIELDS,
  SHIPPING_FIELDS,
  contactSchema,
  formatDateInputValue,
  getMinNeededByDate,
  logoSchema,
  productSelectionSchema,
  quoteFormSchema,
  scopeSchema,
  shippingSchema,
  type QuoteFormValues,
  type StoredQuote,
  LOGO_FILE_ACCEPT,
} from '@/lib/quoteForm';
import { QuoteSubmittedClient } from './QuoteSubmittedClient';
import type { Locale } from '@/lib/types';

type StepKey =
  | 'scope'
  | 'products'
  | 'logo'
  | 'shipping'
  | 'contact'
  | 'review';

const STEPS: StepKey[] = [
  'scope',
  'products',
  'logo',
  'shipping',
  'contact',
  'review',
];

type Props = {
  locale: Locale;
};

export function SoumissionClient({ locale }: Props) {
  const t = useTranslations('quote');
  const tErrors = useTranslations('quote.errors');

  const [stepIdx, setStepIdx] = useState(0);
  const [submitted, setSubmitted] = useState<StoredQuote | null>(null);

  const minNeededBy = useMemo(() => {
    return formatDateInputValue(getMinNeededByDate());
  }, []);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    mode: 'onTouched',
    defaultValues: {
      employeeCount: 12,
      neededBy: '',
      industry: 'construction',
      productIds: [],
      logoMode: 'ready',
      logoDescription: '',
      shippingMode: 'single',
      addressLine1: '',
      city: '',
      province: 'QC',
      postalCode: '',
      country: 'CA',
      locations: '',
      name: '',
      email: '',
      phone: '',
      company: '',
      language: locale === 'fr-ca' ? 'fr' : 'en',
      notes: '',
      transactionalConsent: true,
      marketingConsent: false,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  const currentStep: StepKey = STEPS[stepIdx] ?? 'scope';

  const goToStep = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(STEPS.length - 1, idx));
    setStepIdx(safeIdx);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  async function validateStep(step: StepKey): Promise<boolean> {
    if (step === 'scope') {
      const ok = await trigger(
        [...SCOPE_FIELDS] as Path<QuoteFormValues>[],
      );
      if (!ok) return false;
      return scopeSchema.safeParse(pluck(getValues(), SCOPE_FIELDS)).success;
    }
    if (step === 'products') {
      const ok = await trigger(
        [...PRODUCT_FIELDS] as Path<QuoteFormValues>[],
      );
      if (!ok) return false;
      return productSelectionSchema.safeParse(
        pluck(getValues(), PRODUCT_FIELDS),
      ).success;
    }
    if (step === 'logo') {
      const ok = await trigger(
        [...LOGO_FIELDS] as Path<QuoteFormValues>[],
      );
      if (!ok) return false;
      return logoSchema.safeParse(pluck(getValues(), LOGO_FIELDS)).success;
    }
    if (step === 'shipping') {
      const ok = await trigger(
        [...SHIPPING_FIELDS] as Path<QuoteFormValues>[],
      );
      if (!ok) return false;
      return shippingSchema.safeParse(
        pluck(getValues(), SHIPPING_FIELDS),
      ).success;
    }
    if (step === 'contact') {
      const ok = await trigger(
        [...CONTACT_FIELDS] as Path<QuoteFormValues>[],
      );
      if (!ok) return false;
      return contactSchema.safeParse(pluck(getValues(), CONTACT_FIELDS))
        .success;
    }
    return true;
  }

  const handleNext = async () => {
    const ok = await validateStep(currentStep);
    if (ok) goToStep(stepIdx + 1);
  };

  const handlePrev = () => goToStep(stepIdx - 1);

  const onSubmit: SubmitHandler<QuoteFormValues> = (values) => {
    const quoteId = `Q-${Date.now().toString(36).toUpperCase()}`;
    const stored: StoredQuote = {
      quoteId,
      createdAt: new Date().toISOString(),
      scope: {
        employeeCount: values.employeeCount,
        neededBy: values.neededBy,
        industry: values.industry,
      },
      products: { productIds: values.productIds },
      logo: {
        logoMode: values.logoMode,
        ...(values.logoFileMeta ? { logoFileMeta: values.logoFileMeta } : {}),
        ...(values.logoDescription
          ? { logoDescription: values.logoDescription }
          : {}),
      },
      shipping: {
        shippingMode: values.shippingMode,
        ...(values.shippingMode === 'single'
          ? {
              addressLine1: values.addressLine1,
              city: values.city,
              province: values.province,
              postalCode: (values.postalCode || '').toUpperCase(),
              country: 'CA',
            }
          : { locations: values.locations }),
      },
      contact: {
        name: values.name,
        email: values.email,
        phone: values.phone,
        company: values.company,
        language: values.language,
        ...(values.notes ? { notes: values.notes } : {}),
        transactionalConsent: values.transactionalConsent,
        marketingConsent: values.marketingConsent,
      },
    };

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          'va-last-quote',
          JSON.stringify(stored),
        );
      } catch {
        // sessionStorage unavailable; ignore
      }
    }

    setSubmitted(stored);
  };

  const handleFinalSubmit = async () => {
    const ok = await trigger();
    if (ok) {
      await handleSubmit(onSubmit)();
    }
  };

  if (submitted) {
    return <QuoteSubmittedClient locale={locale} quote={submitted} />;
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      noValidate
      className="space-y-8"
    >
      <header className="space-y-4">
        <p className="text-meta-xs uppercase tracking-wider text-stone-600">
          {t('breadcrumb')}
        </p>
        <h1 className="text-display-md font-semibold text-ink-950 sm:text-display-lg">
          {t('heading')}
        </h1>
        <p className="max-w-2xl text-body-md text-stone-600">
          {t('subhead')}
        </p>
        <ol
          aria-label={t('stepsLabel')}
          className="flex flex-wrap gap-2 pt-2"
        >
          {STEPS.map((s, i) => {
            const state =
              i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'idle';
            return (
              <li
                key={s}
                className={[
                  'inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-meta-xs uppercase tracking-wider',
                  state === 'active'
                    ? 'border-ink-950 bg-ink-950 text-canvas-000'
                    : state === 'done'
                      ? 'border-success-200 bg-success-50 text-success-700'
                      : 'border-sand-300 bg-canvas-050 text-stone-600',
                ].join(' ')}
              >
                <span aria-hidden className="font-semibold">
                  {state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {t(`steps.${i + 1}.label`)}
              </li>
            );
          })}
        </ol>
      </header>

      <div className="space-y-8">
        {currentStep === 'scope' && (
          <ScopeStep
            register={register}
            errors={errors}
            tErrors={tErrors}
            minNeededBy={minNeededBy}
          />
        )}
        {currentStep === 'products' && (
          <ProductStep
            watch={watch}
            setValue={setValue}
            errors={errors}
            tErrors={tErrors}
            locale={locale}
          />
        )}
        {currentStep === 'logo' && (
          <LogoStep
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            tErrors={tErrors}
          />
        )}
        {currentStep === 'shipping' && (
          <ShippingStep
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            tErrors={tErrors}
          />
        )}
        {currentStep === 'contact' && (
          <ContactStep
            register={register}
            errors={errors}
            tErrors={tErrors}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep
            values={watch()}
            locale={locale}
            onEdit={goToStep}
          />
        )}

        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-sand-300 pt-6 sm:flex-row sm:justify-between">
          {stepIdx > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-body-sm font-medium text-ink-950 hover:bg-sand-100"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              {t('cta.previous')}
            </button>
          ) : (
            <span />
          )}

          {currentStep === 'review' ? (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800 disabled:opacity-60"
            >
              <Send aria-hidden className="h-4 w-4" />
              {t('cta.submit')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-950 px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800"
            >
              {t('cta.continue')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function pluck<T extends object, K extends keyof T>(
  values: T,
  fields: readonly K[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const f of fields) {
    out[f] = values[f];
  }
  return out;
}

type TErrors = ReturnType<typeof useTranslations<'quote.errors'>>;

function resolveError(
  raw: string | undefined,
  tErrors: TErrors,
): string | undefined {
  if (!raw) return undefined;
  const known = [
    'required',
    'email',
    'phone',
    'postalCode',
    'neededByTooSoon',
    'neededByInvalid',
    'productsRequired',
    'logoFileRequired',
    'logoDescriptionRequired',
    'locationsRequired',
  ] as const;
  if ((known as readonly string[]).includes(raw)) {
    return tErrors(raw as (typeof known)[number]);
  }
  if (/email/i.test(raw)) return tErrors('email');
  if (/^Required$|min|String must contain at least|invalid_type/i.test(raw)) {
    return tErrors('required');
  }
  return raw;
}

const inputClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const selectClass =
  'h-11 w-full rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

const textareaClass =
  'min-h-[120px] w-full rounded-md border border-sand-300 bg-canvas-000 px-3 py-2 text-body-md text-ink-950 placeholder:text-stone-600 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30';

type ScopeStepProps = {
  register: UseFormRegister<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  tErrors: TErrors;
  minNeededBy: string;
};

function ScopeStep({
  register,
  errors,
  tErrors,
  minNeededBy,
}: ScopeStepProps) {
  const t = useTranslations('quote');
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-title-lg font-semibold text-ink-950">
          <Users aria-hidden className="mr-2 inline-block h-5 w-5" />
          {t('scope.heading')}
        </h2>
        <p className="text-body-sm text-stone-600">{t('scope.subhead')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="employeeCount"
          label={t('scope.employeeCount')}
          required
          error={resolveError(errors.employeeCount?.message, tErrors)}
        >
          <input
            id="employeeCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            {...register('employeeCount', { valueAsNumber: true })}
            className={inputClass}
          />
        </FormField>

        <FormField
          id="neededBy"
          label={t('scope.neededBy')}
          required
          error={resolveError(errors.neededBy?.message, tErrors)}
          helper={t('scope.neededByHelper')}
        >
          <input
            id="neededBy"
            type="date"
            min={minNeededBy}
            {...register('neededBy')}
            className={inputClass}
          />
        </FormField>

        <FormField
          id="industry"
          label={t('scope.industry')}
          required
          error={resolveError(errors.industry?.message, tErrors)}
          className="sm:col-span-2"
        >
          <select
            id="industry"
            {...register('industry')}
            className={selectClass}
          >
            {QUOTE_INDUSTRY_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {t(`scope.industryOptions.${slug}`)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </section>
  );
}

type ProductStepProps = {
  watch: UseFormWatch<QuoteFormValues>;
  setValue: UseFormSetValue<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  tErrors: TErrors;
  locale: Locale;
};

function ProductStep({
  watch,
  setValue,
  errors,
  tErrors,
  locale,
}: ProductStepProps) {
  const t = useTranslations('quote');
  const selected = watch('productIds') ?? [];
  const selectedSet = new Set(selected);
  const errorMsg = resolveError(errors.productIds?.message, tErrors);

  const toggle = (id: string) => {
    const next = selectedSet.has(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    setValue('productIds', next, { shouldValidate: true, shouldTouch: true });
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('products.heading')}
        </h2>
        <p className="text-body-sm text-stone-600">{t('products.helper')}</p>
      </header>

      {errorMsg ? (
        <p
          role="alert"
          className="rounded-md border border-error-200 bg-error-50 px-3 py-2 text-body-sm font-medium text-error-700"
        >
          {errorMsg}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const checked = selectedSet.has(p.styleCode);
          return (
            <li key={p.styleCode}>
              <label
                className={[
                  'flex h-full cursor-pointer flex-col gap-3 rounded-lg border bg-canvas-000 p-3 transition-colors duration-base',
                  checked
                    ? 'border-ink-950 ring-2 ring-ink-950/20'
                    : 'border-sand-300 hover:border-ink-950/40',
                ].join(' ')}
              >
                <span className="relative aspect-square w-full overflow-hidden rounded-md bg-canvas-050">
                  <Image
                    src={`/placeholders/products/${p.slug}.svg`}
                    alt={p.title[locale]}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain p-3"
                  />
                  <span
                    aria-hidden
                    className={[
                      'absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-pill border',
                      checked
                        ? 'border-ink-950 bg-ink-950 text-canvas-000'
                        : 'border-sand-300 bg-canvas-000 text-canvas-000',
                    ].join(' ')}
                  >
                    {checked ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-meta-xs uppercase tracking-wider text-stone-600">
                    {p.styleCode}
                  </span>
                  <span className="text-body-md font-medium text-ink-950">
                    {p.title[locale]}
                  </span>
                  <span className="mt-auto text-body-sm text-stone-600">
                    {t('products.priceFrom', {
                      price: formatCAD(p.priceFromCents, locale),
                    })}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggle(p.styleCode)}
                  aria-label={p.title[locale]}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type LogoStepProps = {
  register: UseFormRegister<QuoteFormValues>;
  watch: UseFormWatch<QuoteFormValues>;
  setValue: UseFormSetValue<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  tErrors: TErrors;
};

function LogoStep({
  register,
  watch,
  setValue,
  errors,
  tErrors,
}: LogoStepProps) {
  const t = useTranslations('quote');
  const mode = watch('logoMode');
  const fileMeta = watch('logoFileMeta');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setValue('logoFileMeta', undefined, { shouldValidate: true });
      return;
    }
    setValue(
      'logoFileMeta',
      { name: file.name, size: file.size, type: file.type || 'application/octet-stream' },
      { shouldValidate: true, shouldTouch: true },
    );
  };

  const clearFile = () => {
    setValue('logoFileMeta', undefined, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('logo.heading')}
        </h2>
        <p className="text-body-sm text-stone-600">{t('logo.helper')}</p>
      </header>

      <fieldset className="space-y-3">
        <legend className="sr-only">{t('logo.modeLegend')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={[
              'flex cursor-pointer flex-col gap-1 rounded-md border bg-canvas-000 px-4 py-3 text-body-sm text-ink-950',
              mode === 'ready'
                ? 'border-ink-950 ring-2 ring-ink-950/20'
                : 'border-sand-300 hover:border-ink-950/40',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <input
                type="radio"
                value="ready"
                {...register('logoMode')}
                className="h-4 w-4 accent-ink-950"
              />
              {t('logo.ready')}
            </span>
            <span className="text-meta-xs text-stone-600">
              {t('logo.readyHelper')}
            </span>
          </label>

          <label
            className={[
              'flex cursor-pointer flex-col gap-1 rounded-md border bg-canvas-000 px-4 py-3 text-body-sm text-ink-950',
              mode === 'pending'
                ? 'border-ink-950 ring-2 ring-ink-950/20'
                : 'border-sand-300 hover:border-ink-950/40',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <input
                type="radio"
                value="pending"
                {...register('logoMode')}
                className="h-4 w-4 accent-ink-950"
              />
              {t('logo.pending')}
            </span>
            <span className="text-meta-xs text-stone-600">
              {t('logo.pendingHelper')}
            </span>
          </label>
        </div>
      </fieldset>

      {mode === 'ready' ? (
        <FormField
          id="logoFile"
          label={t('logo.fileLabel')}
          required
          error={resolveError(errors.logoFileMeta?.message as string | undefined, tErrors)}
          helper={t('logo.fileHelper')}
        >
          <div className="flex flex-col gap-3 rounded-md border border-dashed border-sand-300 bg-canvas-050 p-4">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-sand-300 bg-canvas-000 px-3 py-2 text-body-sm font-medium text-ink-950 hover:border-ink-950">
              <Upload aria-hidden className="h-4 w-4" />
              {t('logo.fileChoose')}
              <input
                ref={fileInputRef}
                id="logoFile"
                type="file"
                accept={LOGO_FILE_ACCEPT}
                onChange={onFileChange}
                className="sr-only"
              />
            </label>
            {fileMeta ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-sand-300 bg-canvas-000 px-3 py-2 text-body-sm text-ink-950">
                <span className="truncate">
                  {fileMeta.name}
                  <span className="ml-2 text-meta-xs uppercase tracking-wider text-stone-600">
                    {Math.max(1, Math.round(fileMeta.size / 1024))} KB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-body-sm font-medium text-ink-950 underline underline-offset-2"
                >
                  {t('logo.fileClear')}
                </button>
              </div>
            ) : (
              <p className="text-meta-xs text-stone-600">
                {t('logo.fileEmpty')}
              </p>
            )}
          </div>
        </FormField>
      ) : (
        <FormField
          id="logoDescription"
          label={t('logo.descriptionLabel')}
          required
          error={resolveError(errors.logoDescription?.message, tErrors)}
        >
          <textarea
            id="logoDescription"
            placeholder={t('logo.descriptionPlaceholder')}
            maxLength={1000}
            {...register('logoDescription')}
            className={textareaClass}
          />
        </FormField>
      )}
    </section>
  );
}

type ShippingStepProps = {
  register: UseFormRegister<QuoteFormValues>;
  watch: UseFormWatch<QuoteFormValues>;
  setValue: UseFormSetValue<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  tErrors: TErrors;
};

function ShippingStep({
  register,
  watch,
  setValue,
  errors,
  tErrors,
}: ShippingStepProps) {
  const t = useTranslations('quote');
  const mode = watch('shippingMode');

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('shipping.heading')}
        </h2>
        <p className="text-body-sm text-stone-600">{t('shipping.helper')}</p>
      </header>

      <fieldset className="space-y-3">
        <legend className="sr-only">{t('shipping.modeLegend')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={[
              'flex cursor-pointer items-center gap-2 rounded-md border bg-canvas-000 px-4 py-3 text-body-sm font-medium text-ink-950',
              mode === 'single'
                ? 'border-ink-950 ring-2 ring-ink-950/20'
                : 'border-sand-300 hover:border-ink-950/40',
            ].join(' ')}
          >
            <input
              type="radio"
              value="single"
              {...register('shippingMode')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('shipping.single')}
          </label>
          <label
            className={[
              'flex cursor-pointer items-center gap-2 rounded-md border bg-canvas-000 px-4 py-3 text-body-sm font-medium text-ink-950',
              mode === 'multiple'
                ? 'border-ink-950 ring-2 ring-ink-950/20'
                : 'border-sand-300 hover:border-ink-950/40',
            ].join(' ')}
          >
            <input
              type="radio"
              value="multiple"
              {...register('shippingMode')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('shipping.multiple')}
          </label>
        </div>
      </fieldset>

      {mode === 'single' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="addressLine1"
            label={t('shipping.addressLine1')}
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
            label={t('shipping.city')}
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
            label={t('shipping.province')}
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
            label={t('shipping.postalCode')}
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
          <FormField id="country" label={t('shipping.country')} required>
            <input
              id="country"
              type="text"
              value="Canada"
              readOnly
              aria-readonly
              className={`${inputClass} cursor-not-allowed bg-canvas-050`}
            />
            <input type="hidden" {...register('country')} value="CA" />
          </FormField>
        </div>
      ) : (
        <FormField
          id="locations"
          label={t('shipping.locationsLabel')}
          required
          error={resolveError(errors.locations?.message, tErrors)}
          helper={t('shipping.multipleHelper')}
        >
          <textarea
            id="locations"
            placeholder={t('shipping.locationsPlaceholder')}
            maxLength={4000}
            {...register('locations')}
            className={`${textareaClass} min-h-[160px]`}
          />
        </FormField>
      )}
    </section>
  );
}

type ContactStepProps = {
  register: UseFormRegister<QuoteFormValues>;
  errors: FieldErrors<QuoteFormValues>;
  tErrors: TErrors;
};

function ContactStep({ register, errors, tErrors }: ContactStepProps) {
  const t = useTranslations('quote');
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('contact.heading')}
        </h2>
        <p className="text-body-sm text-stone-600">{t('contact.helper')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="name"
          label={t('contact.name')}
          required
          error={resolveError(errors.name?.message, tErrors)}
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
          id="company"
          label={t('contact.company')}
          required
          error={resolveError(errors.company?.message, tErrors)}
        >
          <input
            id="company"
            type="text"
            autoComplete="organization"
            {...register('company')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="email"
          label={t('contact.email')}
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
          label={t('contact.phone')}
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
      </div>

      <fieldset className="space-y-2">
        <legend className="text-body-sm font-medium text-ink-950">
          {t('contact.language')}
        </legend>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
            <input
              type="radio"
              value="fr"
              {...register('language')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('contact.languageFr')}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sand-300 px-3 py-2 text-body-sm text-ink-950 has-[:checked]:border-ink-950 has-[:checked]:bg-sand-100">
            <input
              type="radio"
              value="en"
              {...register('language')}
              className="h-4 w-4 accent-ink-950"
            />
            {t('contact.languageEn')}
          </label>
        </div>
      </fieldset>

      <FormField
        id="notes"
        label={t('contact.notes')}
        helper={t('contact.notesHelper')}
        error={resolveError(errors.notes?.message, tErrors)}
      >
        <textarea
          id="notes"
          maxLength={1000}
          {...register('notes')}
          className={textareaClass}
          placeholder={t('contact.notesPlaceholder')}
        />
      </FormField>

      <div className="space-y-3">
        <label className="flex items-start gap-3 rounded-md bg-canvas-050 p-4 text-body-sm text-ink-950">
          <input
            id="transactionalConsent"
            type="checkbox"
            {...register('transactionalConsent')}
            className="mt-0.5 h-4 w-4 accent-ink-950"
          />
          <span>{t('contact.transactionalOptIn')}</span>
        </label>
        <label className="flex items-start gap-3 rounded-md bg-canvas-050 p-4 text-body-sm text-ink-950">
          <input
            id="marketingConsent"
            type="checkbox"
            {...register('marketingConsent')}
            className="mt-0.5 h-4 w-4 accent-ink-950"
          />
          <span>{t('contact.marketingOptIn')}</span>
        </label>
      </div>
    </section>
  );
}

function ReviewStep({
  values,
  locale,
  onEdit,
}: {
  values: QuoteFormValues;
  locale: Locale;
  onEdit: (idx: number) => void;
}) {
  const t = useTranslations('quote');
  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      map.set(p.styleCode, p.title[locale]);
    }
    return map;
  }, [locale]);

  const selectedTitles = (values.productIds ?? [])
    .map((id) => productMap.get(id) || id)
    .join(', ');

  const provinceLabel =
    QC_PROVINCES.find((p) => p.code === values.province)?.label ||
    values.province ||
    '';

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-title-lg font-semibold text-ink-950">
          {t('review.heading')}
        </h2>
      </header>

      <ReviewBlock
        title={t('steps.1.label')}
        editLabel={t('review.edit')}
        onEdit={() => onEdit(0)}
      >
        <p className="text-body-sm text-ink-950">
          {t('scope.employeeCount')}: {values.employeeCount}
        </p>
        <p className="text-body-sm text-ink-950">
          {t('scope.neededBy')}: {values.neededBy}
        </p>
        <p className="text-body-sm text-ink-950">
          {t('scope.industry')}:{' '}
          {t(`scope.industryOptions.${values.industry}`)}
        </p>
      </ReviewBlock>

      <ReviewBlock
        title={t('steps.2.label')}
        editLabel={t('review.edit')}
        onEdit={() => onEdit(1)}
      >
        <p className="text-body-sm text-ink-950">
          {selectedTitles || t('products.empty')}
        </p>
      </ReviewBlock>

      <ReviewBlock
        title={t('steps.3.label')}
        editLabel={t('review.edit')}
        onEdit={() => onEdit(2)}
      >
        {values.logoMode === 'ready' ? (
          <p className="text-body-sm text-ink-950">
            {t('logo.ready')}
            {values.logoFileMeta ? ` — ${values.logoFileMeta.name}` : ''}
          </p>
        ) : (
          <>
            <p className="text-body-sm text-ink-950">{t('logo.pending')}</p>
            {values.logoDescription ? (
              <p className="text-body-sm text-stone-600">
                {values.logoDescription}
              </p>
            ) : null}
          </>
        )}
      </ReviewBlock>

      <ReviewBlock
        title={t('steps.4.label')}
        editLabel={t('review.edit')}
        onEdit={() => onEdit(3)}
      >
        {values.shippingMode === 'single' ? (
          <>
            <p className="text-body-sm text-ink-950">{values.addressLine1}</p>
            <p className="text-body-sm text-stone-600">
              {values.city}, {provinceLabel} {values.postalCode}
            </p>
          </>
        ) : (
          <p className="whitespace-pre-line text-body-sm text-ink-950">
            {values.locations}
          </p>
        )}
      </ReviewBlock>

      <ReviewBlock
        title={t('steps.5.label')}
        editLabel={t('review.edit')}
        onEdit={() => onEdit(4)}
      >
        <p className="text-body-sm text-ink-950">
          {values.name} · {values.company}
        </p>
        <p className="text-body-sm text-stone-600">
          {values.email} · {values.phone}
        </p>
        {values.notes ? (
          <p className="mt-1 whitespace-pre-line text-body-sm text-stone-600">
            {values.notes}
          </p>
        ) : null}
      </ReviewBlock>
    </section>
  );
}

function ReviewBlock({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-sand-300 bg-canvas-000 p-4 sm:p-5">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-title-md text-ink-950">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-body-sm font-medium text-ink-950 underline underline-offset-2 hover:text-ink-800"
        >
          {editLabel}
        </button>
      </header>
      <div className="space-y-1">{children}</div>
    </article>
  );
}
