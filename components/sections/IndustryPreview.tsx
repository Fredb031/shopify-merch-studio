import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '../Container';
import { getProductByStyleCode } from '@/lib/products';
import { formatCAD } from '@/lib/format';
import type { Locale } from '@/lib/types';

export type IndustryPreviewCard = {
  slug: string;
  industryName: string;
  industryHero: string;
  alt: string;
  hookLine: string;
  productSampleHeading: string;
  productStyleCodes: [string, string, string];
  caseQuote: string;
  caseAttribution: string;
  cta: string;
  href: string;
  priceFromLabel: (formatted: string) => string;
};

type Props = {
  heading: string;
  subhead: string;
  cards: IndustryPreviewCard[];
  locale: Locale;
};

export function IndustryPreview({ heading, subhead, cards, locale }: Props) {
  return (
    <section className="bg-canvas-000 py-20 md:py-28">
      <Container size="2xl">
        <div className="max-w-2xl">
          <h2 className="text-display-lg text-ink-950">{heading}</h2>
          <p className="mt-4 text-body-lg text-stone-500">{subhead}</p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {cards.map((card) => (
            <IndustryPreviewCardView
              key={card.slug}
              card={card}
              locale={locale}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

function IndustryPreviewCardView({
  card,
  locale,
}: {
  card: IndustryPreviewCard;
  locale: Locale;
}) {
  const products = card.productStyleCodes
    .map((code) => getProductByStyleCode(code))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-sand-300 bg-canvas-050">
      {/* Hero image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-canvas-000">
        <Image
          src={card.industryHero}
          alt={card.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-6 md:p-8">
        <h3 className="text-title-xl font-bold text-ink-950">
          {card.industryName}
        </h3>
        <p className="mt-2 text-body-md text-stone-500">{card.hookLine}</p>

        {/* Product mini carousel */}
        <p className="mt-6 text-meta-xs font-semibold uppercase tracking-wider text-stone-500">
          {card.productSampleHeading}
        </p>
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {products.map((p) => (
            <li
              key={p.styleCode}
              className="flex flex-col rounded-md border border-sand-300 bg-canvas-000 p-3"
            >
              <div className="relative aspect-square w-full overflow-hidden">
                <Image
                  src={`/placeholders/products/${p.slug}.svg`}
                  alt={p.title[locale]}
                  fill
                  sizes="(min-width: 1024px) 12vw, 30vw"
                  className="object-contain"
                />
              </div>
              <span className="mt-2 truncate text-body-sm font-medium text-ink-950">
                {p.styleCode}
              </span>
              <span className="text-meta-xs text-stone-500">
                {card.priceFromLabel(formatCAD(p.priceFromCents, locale))}
              </span>
            </li>
          ))}
        </ul>

        {/* Quote */}
        <blockquote className="mt-6 border-l-2 border-sand-300 pl-4">
          <p className="text-body-sm italic text-stone-600">
            {card.caseQuote}
          </p>
          <footer className="mt-2 text-meta-xs text-stone-500">
            {card.caseAttribution}
          </footer>
        </blockquote>

        {/* CTA */}
        <div className="mt-auto pt-6">
          <Link
            href={card.href}
            className="inline-flex items-center gap-1 text-body-md font-medium text-ink-950 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            {card.cta}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
