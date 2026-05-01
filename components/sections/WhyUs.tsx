import Image from 'next/image';
import { Container } from '../Container';
import { whyUsItems, type WhyUsItem } from '@/lib/whyUs';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
  heading: string;
  subhead: string;
};

export function WhyUs({ locale, heading, subhead }: Props) {
  return (
    <section className="bg-canvas-000 py-20 md:py-28">
      <Container size="2xl">
        <div className="max-w-2xl">
          <h2 className="text-display-lg text-ink-950">{heading}</h2>
          <p className="mt-4 text-body-lg text-stone-500">{subhead}</p>
        </div>
        <ul className="mt-14 grid gap-6 md:gap-8 lg:grid-cols-3">
          {whyUsItems.map((item) => (
            <WhyUsCard key={item.id} item={item} locale={locale} />
          ))}
        </ul>
      </Container>
    </section>
  );
}

function WhyUsCard({ item, locale }: { item: WhyUsItem; locale: Locale }) {
  return (
    <li className="flex flex-col rounded-lg border border-sand-300 bg-canvas-000 p-8 transition-colors duration-base ease-standard hover:border-slate-700/30">
      <div className="relative h-[140px] w-[140px] overflow-hidden">
        <Image
          src={item.illustration}
          alt={item.alt[locale]}
          width={140}
          height={140}
          className="h-full w-full object-contain"
        />
      </div>
      <h3 className="mt-8 text-title-md font-semibold text-ink-950">
        {item.title[locale]}
      </h3>
      <p className="mt-3 max-w-xs text-body-md text-stone-500">
        {item.body[locale]}
      </p>
    </li>
  );
}
