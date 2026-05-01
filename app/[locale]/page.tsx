import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Container } from '@/components/Container';
import { Section } from '@/components/Section';
import { HeroSplit } from '@/components/sections/HeroSplit';
import { StatStrip } from '@/components/sections/StatStrip';
import { IndustryPills } from '@/components/sections/IndustryPills';
import { IndustryRouteCards } from '@/components/sections/IndustryRouteCards';
import { WhyUs } from '@/components/sections/WhyUs';
import { BestCategories } from '@/components/sections/BestCategories';
import { HowItWorksHorizontal } from '@/components/sections/HowItWorksHorizontal';
import { CaseStudyFeature } from '@/components/sections/CaseStudyFeature';
import { IndustryPreview } from '@/components/sections/IndustryPreview';
import { ClientLogoMarquee } from '@/components/sections/ClientLogoMarquee';
import { ReviewGrid } from '@/components/sections/ReviewGrid';
import { DiscoveryKitTeaser } from '@/components/sections/DiscoveryKitTeaser';
import { FaqAccordion } from '@/components/sections/FaqAccordion';
import { NewsletterStripe } from '@/components/sections/NewsletterStripe';
import { HeroBlock } from '@/components/sections/HeroBlock';
import { FaqJsonLd } from '@/components/seo/FaqJsonLd';

import { industries } from '@/lib/industries';
import { homeCategories } from '@/lib/categories';
import { reviews, getOverallAverage } from '@/lib/reviews';
import { clientLogos } from '@/lib/clients';
import { featuredCaseStudy } from '@/lib/caseStudies';
import { getAlternates, getOgImageUrl } from '@/lib/seo';
import { siteConfig } from '@/lib/site';
import type { Locale } from '@/i18n/routing';
import type { TrustBulletItem } from '@/components/sections/TrustBullets';
import type { HeroSplitCollagePanel } from '@/components/sections/HeroSplit';
import type { StatItem } from '@/components/sections/StatStrip';
import type { HowItWorksStep } from '@/components/sections/HowItWorksHorizontal';
import type { IndustryPreviewCard } from '@/components/sections/IndustryPreview';

function isLocale(value: string): value is Locale {
  return value === 'fr-ca' || value === 'en-ca';
}

type Props = {
  params: Promise<{ locale: string }>;
};

const FAQ_KEYS = ['1', '2', '3', '4', '5'] as const;
const HERO_TRUST_KEYS = ['1', '2', '3', '4'] as const;
const HERO_COLLAGE_IDS = ['1', '2', '3', '4'] as const;
const STAT_KEYS = ['1', '2', '3', '4'] as const;
const PROCESS_KEYS = ['1', '2', '3', '4'] as const;

const HERO_TRUST_ICONS: Record<
  (typeof HERO_TRUST_KEYS)[number],
  TrustBulletItem['icon']
> = {
  '1': 'Clock',
  '2': 'ShieldCheck',
  '3': 'MessageCircle',
  '4': 'Star',
};

const HERO_COLLAGE_ROTATIONS: Record<
  (typeof HERO_COLLAGE_IDS)[number],
  number
> = {
  '1': -3,
  '2': 5,
  '3': 2,
  '4': -4,
};

// Stat numeric targets for the count-up animation. Values are paired with
// translation strings — the formatted final value comes from the locale file
// while the numeric target drives the animated count-up.
const STAT_TARGETS: Record<
  (typeof STAT_KEYS)[number],
  Pick<StatItem, 'numericTarget' | 'formatter' | 'suffix' | 'prefix'>
> = {
  '1': { numericTarget: 33000, formatter: 'thousands', suffix: '+' },
  '2': { numericTarget: 500, formatter: 'integer', suffix: '+' },
  '3': { numericTarget: 5, formatter: 'integer' },
  '4': { numericTarget: 5, formatter: 'integer' },
};

const PROCESS_ILLUSTRATIONS: Record<
  (typeof PROCESS_KEYS)[number],
  string
> = {
  '1': '/placeholders/process/choose.svg',
  '2': '/placeholders/process/upload.svg',
  '3': '/placeholders/process/approve.svg',
  '4': '/placeholders/process/delivery.svg',
};

const PROCESS_IDS: Record<(typeof PROCESS_KEYS)[number], string> = {
  '1': 'choose',
  '2': 'upload',
  '3': 'approve',
  '4': 'delivery',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const isFr = locale === 'fr-ca';
  const title = isFr
    ? "Vision Affichage · Vêtements d'entreprise au Québec"
    : 'Vision Affichage · Company apparel in Québec';
  const description = isFr
    ? "Broderie et sérigraphie pour t-shirts, polos, ouates et casquettes. Production en 5 jours ouvrables. Service en français au Québec."
    : 'Embroidery and screen printing for tees, polos, hoodies, and caps. 5-business-day production. French service across Québec.';

  const ogTitle = isFr
    ? "Vêtements d'entreprise au Québec"
    : 'Company apparel in Québec';
  const ogSubtitle = isFr
    ? 'Broderie + sérigraphie · 5 jours ouvrables · 500+ équipes québécoises'
    : 'Embroidery + screen print · 5 business days · 500+ Québec teams';
  const ogImage = getOgImageUrl(ogTitle, ogSubtitle);

  return {
    title,
    description,
    alternates: getAlternates('/', locale),
    openGraph: {
      type: 'website',
      locale: isFr ? 'fr_CA' : 'en_CA',
      title,
      description,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/${locale}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'home' });

  const base = `/${locale}`;
  const featuredReviews = reviews.slice(0, 3);
  const overall = getOverallAverage();
  const overallAvgFormatted =
    locale === 'fr-ca'
      ? overall.average.toString().replace('.', ',')
      : overall.average.toString();

  const faqItems = FAQ_KEYS.map((key) => ({
    q: t(`faq.items.${key}.q`),
    a: t(`faq.items.${key}.a`),
  }));

  const faqJsonLdItems = faqItems.map((item) => ({
    question: item.q,
    answer: item.a,
  }));

  const heroTrustItems: TrustBulletItem[] = HERO_TRUST_KEYS.map((key) => ({
    icon: HERO_TRUST_ICONS[key],
    label: t(`hero.trust.items.${key}`),
  }));

  const heroCollage: HeroSplitCollagePanel[] = HERO_COLLAGE_IDS.map((id) => ({
    id,
    imageSrc: `/placeholders/hero/${id}.svg`,
    alt: t(`hero.collage.alt.${id}`),
    rotation: HERO_COLLAGE_ROTATIONS[id],
  }));

  const statItems: StatItem[] = STAT_KEYS.map((key) => ({
    value: t(`stats.${key}.value`),
    label: t(`stats.${key}.label`),
    ...STAT_TARGETS[key],
  }));

  const processSteps: HowItWorksStep[] = PROCESS_KEYS.map((key) => ({
    id: PROCESS_IDS[key],
    illustration: PROCESS_ILLUSTRATIONS[key],
    alt: t(`process.steps.${key}.alt`),
    title: t(`process.steps.${key}.title`),
    description: t(`process.steps.${key}.description`),
    duration: t(`process.steps.${key}.duration`),
  }));

  const priceFromLabel = (formatted: string): string =>
    t('categories.priceFromLabel', { price: formatted });

  // Industry preview: pick construction + bureau
  const industryByslug = (slug: string) =>
    industries.find((i) => i.slug === slug);
  const construction = industryByslug('construction');
  const bureau = industryByslug('bureau');

  const previewCards: IndustryPreviewCard[] = [];
  if (construction) {
    previewCards.push({
      slug: construction.slug,
      industryName: construction.name[locale],
      industryHero: `/placeholders/industries/${construction.slug}.svg`,
      alt: construction.name[locale],
      hookLine: t('industryPreview.cards.construction.hookLine'),
      productSampleHeading: t('industryPreview.productSampleHeading'),
      productStyleCodes: ['ATC1015', 'ATCF2400', 'ATC6606'],
      caseQuote: t('industryPreview.cards.construction.caseQuote'),
      caseAttribution: t('industryPreview.cards.construction.caseAttribution'),
      cta: t('industryPreview.cards.construction.cta'),
      href: `${base}/industries/${construction.slug}`,
      priceFromLabel,
    });
  }
  if (bureau) {
    previewCards.push({
      slug: bureau.slug,
      industryName: bureau.name[locale],
      industryHero: `/placeholders/industries/${bureau.slug}.svg`,
      alt: bureau.name[locale],
      hookLine: t('industryPreview.cards.bureau.hookLine'),
      productSampleHeading: t('industryPreview.productSampleHeading'),
      productStyleCodes: ['L445', 'S445LS', 'ATCF2500'],
      caseQuote: t('industryPreview.cards.bureau.caseQuote'),
      caseAttribution: t('industryPreview.cards.bureau.caseAttribution'),
      cta: t('industryPreview.cards.bureau.cta'),
      href: `${base}/industries/${bureau.slug}`,
      priceFromLabel,
    });
  }

  return (
    <>
      <FaqJsonLd items={faqJsonLdItems} />

      {/* 1. Hero split (ink) */}
      <HeroSplit
        eyebrow={t('hero.eyebrow')}
        headline={t('hero.headline')}
        headlineAccent={
          locale === 'fr-ca' ? 'premier regard' : 'day one'
        }
        subhead={t('hero.subhead')}
        primaryCta={{
          label: t('hero.ctaPrimary'),
          href: `${base}/produits`,
        }}
        secondaryCta={{
          label: t('hero.ctaSecondary'),
          href: `${base}/soumission`,
        }}
        trustItems={heroTrustItems}
        collagePanels={heroCollage}
      />

      {/* 2. Stat strip (canvas-050) — NEW */}
      <StatStrip items={statItems} />

      {/* 3. Industry pills (canvas-050) */}
      <IndustryPills
        industries={industries}
        locale={locale}
        heading={t('industries.pillsHeading')}
        eyebrow={t('industries.pillsEyebrow')}
        caption={t('industries.pillsCaption')}
      />

      {/* 4. 3 strategic CTA route cards (sand-100) */}
      <IndustryRouteCards locale={locale} />

      {/* 5. Why us (canvas-000) — NEW */}
      <WhyUs
        locale={locale}
        heading={t('whyUs.heading')}
        subhead={t('whyUs.subhead')}
      />

      {/* 6. Best categories (canvas-000) */}
      <BestCategories
        categories={homeCategories}
        locale={locale}
        heading={t('categories.heading')}
        subhead={t('categories.subhead')}
        viewLabel={t('categories.viewLabel')}
        viewAllLabel={t('categories.viewAllLabel')}
        priceFromLabel={priceFromLabel}
      />

      {/* 7. How it works horizontal (canvas-050) — NEW (replaces vertical) */}
      <HowItWorksHorizontal
        heading={t('process.heading')}
        subhead={t('process.subhead')}
        steps={processSteps}
      />

      {/* 8. Case study feature (ink-950 full-bleed) — NEW */}
      <CaseStudyFeature caseStudy={featuredCaseStudy} locale={locale} />

      {/* 9. Industry preview (canvas-000) — NEW */}
      <IndustryPreview
        heading={t('industryPreview.heading')}
        subhead={t('industryPreview.subhead')}
        cards={previewCards}
        locale={locale}
      />

      {/* 10. Client logo marquee (default) */}
      <Section tone="default">
        <Container size="2xl">
          <h2 className="text-center text-title-lg text-ink-950">
            {t('clients.heading')}
          </h2>
          <ClientLogoMarquee
            logos={clientLogos}
            locale={locale}
            className="mt-10"
          />
        </Container>
      </Section>

      {/* 11. Reviews (warm) */}
      <Section tone="warm">
        <Container size="2xl">
          <div className="md:max-w-2xl">
            <h2 className="text-title-xl text-ink-950">
              {t('reviews.heading')}
            </h2>
            <p className="mt-3 text-body-lg text-stone-600">
              {t('reviews.subhead', {
                avg: overallAvgFormatted,
                count: overall.count,
              })}
            </p>
          </div>
          <ReviewGrid
            reviews={featuredReviews}
            locale={locale}
            className="mt-10"
          />
          <div className="mt-10 flex justify-end">
            <Link
              href={`${base}/avis`}
              className="inline-flex items-center gap-1 text-body-md font-medium text-ink-950 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            >
              {t('reviews.viewAll')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </Section>

      {/* 12. Discovery kit teaser (sand-100) */}
      <DiscoveryKitTeaser locale={locale} />

      {/* 13. FAQ (default) — 5 items */}
      <Section tone="default">
        <Container size="xl">
          <h2 className="text-title-xl text-ink-950">{t('faq.heading')}</h2>
          <FaqAccordion items={faqItems} locale={locale} className="mt-8" />
        </Container>
      </Section>

      {/* 14. Newsletter stripe (sand-100 narrow) — NEW */}
      <NewsletterStripe
        locale={locale}
        heading={t('newsletter.stripe.heading')}
        subhead={t('newsletter.stripe.subhead')}
        placeholder={t('newsletter.stripe.placeholder')}
        submit={t('newsletter.stripe.submit')}
        fullLink={t('newsletter.stripe.fullLink')}
      />

      {/* 15. Final CTA (ink) */}
      <HeroBlock
        tone="ink"
        headline={t('finalCta.heading')}
        subhead={t('finalCta.subhead')}
        primaryCta={{
          label: t('finalCta.ctaPrimary'),
          href: `${base}/produits`,
        }}
        secondaryCta={{
          label: t('finalCta.ctaSecondary'),
          href: `${base}/soumission`,
        }}
      />
    </>
  );
}
