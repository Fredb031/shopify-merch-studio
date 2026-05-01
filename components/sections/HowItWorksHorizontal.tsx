import Image from 'next/image';
import { Container } from '../Container';

export type HowItWorksStep = {
  id: string;
  illustration: string;
  alt: string;
  title: string;
  description: string;
  duration: string;
};

type Props = {
  heading: string;
  subhead: string;
  steps: HowItWorksStep[];
};

export function HowItWorksHorizontal({ heading, subhead, steps }: Props) {
  return (
    <section className="bg-canvas-050 py-20 md:py-28">
      <Container size="2xl">
        <div className="max-w-2xl">
          <h2 className="text-display-lg text-ink-950">{heading}</h2>
          <p className="mt-4 text-body-lg text-stone-500">{subhead}</p>
        </div>

        <ol className="mt-14 grid gap-6 md:gap-8 lg:grid-cols-4 lg:gap-4">
          {steps.map((step, idx) => (
            <li key={step.id} className="relative flex flex-col">
              <div className="flex h-full flex-col rounded-lg border border-sand-300 bg-canvas-000 p-6 md:p-7">
                <span className="text-meta-xs font-semibold uppercase tracking-wider text-slate-700">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="mt-4 h-[80px] w-[80px]">
                  <Image
                    src={step.illustration}
                    alt={step.alt}
                    width={80}
                    height={80}
                    className="h-full w-full object-contain"
                  />
                </div>
                <h3 className="mt-5 text-title-md font-semibold text-ink-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-body-sm text-stone-500">
                  {step.description}
                </p>
                <span className="mt-5 inline-flex w-fit items-center rounded-pill bg-sand-100 px-3 py-1 text-meta-xs font-semibold uppercase tracking-wider text-ink-950">
                  {step.duration}
                </span>
              </div>

              {/* Arrow connector — desktop only, between cards */}
              {idx < steps.length - 1 && (
                <span
                  aria-hidden
                  className="hidden lg:flex absolute top-1/2 -right-3 z-10 h-6 w-6 -translate-y-1/2 items-center justify-center"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6 text-slate-700/40"
                    fill="none"
                  >
                    <line
                      x1="2"
                      y1="12"
                      x2="20"
                      y2="12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 6 L20 12 L14 18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
