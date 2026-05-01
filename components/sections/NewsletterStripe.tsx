'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Container } from '../Container';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
  heading: string;
  subhead: string;
  placeholder: string;
  submit: string;
  fullLink: string;
};

/**
 * Compact CASL-aware teaser stripe. Routes through to /infolettre for the
 * full double-opt-in flow. No data is collected here — email is forwarded
 * via query string and the full form requires explicit CASL consent.
 */
export function NewsletterStripe({
  locale,
  heading,
  subhead,
  placeholder,
  submit,
  fullLink,
}: Props) {
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
    <section className="bg-sand-100 py-12 md:py-16">
      <Container size="2xl">
        <div className="grid gap-6 md:grid-cols-2 md:items-center md:gap-10">
          <div>
            <h2 className="text-title-xl text-ink-950">{heading}</h2>
            <p className="mt-2 text-body-md text-stone-500">{subhead}</p>
          </div>
          <div className="space-y-2">
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
              aria-label={heading}
            >
              <label htmlFor="newsletter-stripe-email" className="sr-only">
                {placeholder}
              </label>
              <input
                id="newsletter-stripe-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={placeholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full flex-1 rounded-md border border-sand-300 bg-canvas-000 px-3 text-body-md text-ink-950 placeholder:text-stone-500 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/30"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink-950 px-5 text-body-sm font-medium text-canvas-000 transition-colors duration-base hover:bg-ink-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              >
                {submit}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
            </form>
            <p className="text-body-sm text-stone-500">
              <Link
                href={`${base}/infolettre`}
                className="underline underline-offset-2 hover:text-ink-950"
              >
                {fullLink}
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
