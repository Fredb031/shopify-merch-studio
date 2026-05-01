import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '../Container';
import type { CaseStudy } from '@/lib/caseStudies';
import type { Locale } from '@/lib/types';

type Props = {
  caseStudy: CaseStudy;
  locale: Locale;
};

export function CaseStudyFeature({ caseStudy, locale }: Props) {
  const stats = caseStudy.stats;
  return (
    <section
      aria-label={caseStudy.client}
      className="relative overflow-hidden bg-ink-950 py-24 text-canvas-000 md:py-32"
    >
      {/* Subtle bg-noise overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")",
        }}
      />
      <Container size="2xl">
        <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* LEFT — hero image */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-canvas-050/10 lg:aspect-auto lg:h-[480px]">
            <Image
              src={caseStudy.heroImage}
              alt={caseStudy.alt[locale]}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>

          {/* RIGHT — content */}
          <div className="flex flex-col">
            <span className="text-meta-xs font-semibold uppercase tracking-[0.25em] text-sand-300">
              {caseStudy.eyebrow[locale]}
            </span>
            <span className="mt-3 text-body-lg font-bold tracking-wide text-canvas-000">
              {caseStudy.client}
            </span>
            <h2 className="mt-5 text-display-lg leading-tight text-canvas-000">
              {caseStudy.headline[locale]}
            </h2>
            <blockquote className="mt-8 border-l-2 border-sand-300/40 pl-5">
              <p className="text-body-lg italic text-canvas-050/90">
                {caseStudy.quote[locale]}
              </p>
              <footer className="mt-3 text-body-sm text-canvas-050/60">
                {caseStudy.attribution[locale]}
              </footer>
            </blockquote>

            <ul className="mt-8 grid grid-cols-3 gap-4 border-t border-canvas-050/10 pt-6">
              {stats.map((stat, idx) => (
                <li key={idx} className="flex flex-col">
                  <span className="text-title-xl font-semibold text-canvas-000 tabular-nums">
                    {stat.value[locale]}
                  </span>
                  <span className="mt-1 text-meta-xs uppercase tracking-wider text-sand-300">
                    {stat.label[locale]}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <Link
                href={caseStudy.industryHref[locale]}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-canvas-050/30 bg-transparent px-6 text-body-md font-medium text-canvas-000 transition-colors duration-base hover:bg-canvas-050/10 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-000"
              >
                {caseStudy.cta[locale]}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
