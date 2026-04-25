import { useEffect, useRef, useState } from 'react';
import { Palette, Printer, Truck, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';

/**
 * StepsTimeline — the "From idea to doorstep in 5 business days" banner.
 *
 * The bar, the progress colours around each ring, and the ring borders
 * are all animated AMBIENTLY — they move on their own without needing
 * a hover. Nothing pops, nothing scales on mouseover. The colours just
 * drift through the new flat brand-blue accent system.
 */
export function StepsTimeline() {
  const { lang } = useLang();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries, observer) => entries.forEach(e => {
        if (!e.isIntersecting) return;
        setVisible(true);
        // One-shot reveal — stop observing so the CSS transitions
        // aren't re-kicked on every scroll past. Saves a callback
        // + a render on each scroll frame the timeline crosses.
        observer.unobserve(e.target);
      }),
      { threshold: 0.3 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  // Freud × Bernays redesign: the new B2B brand language uses ONE
  // accent (brand-blue / #0052CC). The previous gold + emerald per-step
  // accents collapse onto that single colour so the timeline reads as
  // one disciplined flow instead of three competing rainbow stops.
  const BRAND_BLUE = '#0052CC';

  const steps = [
    {
      icon: Palette,
      day: lang === 'en' ? 'Day 1-2' : 'Jour 1-2',
      title: lang === 'en' ? 'Design & proofing' : 'Conception & épreuve',
      desc: lang === 'en' ? 'We validate your artwork and send a digital proof' : 'On valide ton logo et t\'envoie une épreuve numérique',
      accent: BRAND_BLUE,
    },
    {
      icon: Printer,
      day: lang === 'en' ? 'Day 3-4' : 'Jour 3-4',
      title: lang === 'en' ? 'Local production' : 'Production locale',
      desc: lang === 'en' ? 'Printed in Québec, inspected for quality' : 'Imprimé au Québec, inspection qualité',
      accent: BRAND_BLUE,
    },
    {
      icon: Truck,
      day: lang === 'en' ? 'Day 5' : 'Jour 5',
      title: lang === 'en' ? 'Delivered to your door' : 'Livré chez toi',
      desc: lang === 'en' ? 'Tracked shipping anywhere in Canada' : 'Livraison suivie partout au Canada',
      accent: BRAND_BLUE,
    },
  ];

  return (
    <section
      ref={ref}
      className="py-20 px-6 md:px-10 bg-gradient-to-b from-background to-secondary/40"
      aria-label={lang === 'en' ? 'Delivery timeline' : 'Calendrier de livraison'}
    >
      {/* Keyframes — scoped to this component so the homepage CSS doesn't grow. */}
      <style>{`
        @keyframes va-bar-shift { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes va-ring-rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes va-halo-breath { 0%,100% { opacity: .08; transform: scale(1.05); } 50% { opacity: .22; transform: scale(1.18); } }
        @media (prefers-reduced-motion: reduce) {
          .va-animate-bar, .va-animate-ring, .va-animate-halo { animation: none !important; }
        }
      `}</style>

      <div className="max-w-[1060px] mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[2px] uppercase text-brand-blue mb-3">
            <Sparkles size={14} aria-hidden="true" />
            {lang === 'en' ? 'How it works' : 'Comment ça marche'}
          </div>
          <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-1px] text-brand-black leading-tight">
            {lang === 'en' ? (
              <>
                From idea to doorstep<br />
                <span className="text-brand-blue">in just 5 business days.</span>
              </>
            ) : (
              <>
                De l'idée à la livraison<br />
                <span className="text-brand-blue">en 5 jours ouvrables.</span>
              </>
            )}
          </h2>
        </div>

        <div className="relative">
          {/* Dashed connector — desktop horizontal, mobile vertical.
              Sits behind the circles (z-0) and gives the steps a real
              through-line so they read as a flow, not an unordered list.
              Aligned to the circle center (80px circle → center at 40px). */}
          <svg
            className="hidden md:block absolute top-10 left-0 right-0 w-full h-[2px] -translate-y-1/2 z-0 pointer-events-none"
            aria-hidden="true"
            preserveAspectRatio="none"
            viewBox="0 0 100 2"
          >
            <line
              x1="0" y1="1" x2="100" y2="1"
              stroke={BRAND_BLUE}
              strokeOpacity="0.3"
              strokeWidth="2"
              strokeDasharray="1.2 1.8"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div
            className="md:hidden absolute top-10 bottom-10 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed z-0 pointer-events-none"
            style={{ borderColor: 'rgba(0, 82, 204, 0.3)' }}
            aria-hidden="true"
          />

          {/* Base progress rail — draws in on scroll-into-view. The new
              brand language is flatter (single accent), so the rail is a
              solid brand-blue fill instead of the old tri-colour gradient.
              The ambient shift keyframe is preserved for continuity. */}
          <div
            className="absolute top-10 left-0 right-0 h-[2px] bg-border overflow-hidden z-0"
            aria-hidden="true"
          >
            <div
              className="va-animate-bar h-full origin-left transition-transform duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)] bg-brand-blue"
              style={{
                transform: `scaleX(${visible ? 1 : 0})`,
                backgroundSize: '200% 100%',
                animation: visible ? 'va-bar-shift 12s linear infinite' : undefined,
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const accent = step.accent;
              return (
                <div
                  key={i}
                  className={`text-center transition-all duration-700 ease-out ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{ transitionDelay: visible ? `${i * 180}ms` : '0ms' }}
                >
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    {/* Breathing halo — subtle ambient pulse (no hover trigger) */}
                    <div
                      className="va-animate-halo absolute inset-0 rounded-full blur-xl"
                      style={{
                        background: accent,
                        animation: `va-halo-breath 6s ease-in-out ${i * 1.5}s infinite`,
                      }}
                      aria-hidden="true"
                    />
                    {/* Conic ring — slowly rotates around each circle so the
                        timeline still feels alive. Gradient stops collapsed to
                        a single brand-blue per the flatter B2B brand. */}
                    <div
                      className="va-animate-ring absolute -inset-[3px] rounded-full"
                      style={{
                        background: `conic-gradient(from 0deg, ${BRAND_BLUE}, ${BRAND_BLUE})`,
                        animation: `va-ring-rotate ${14 + i * 2}s linear infinite`,
                        filter: 'blur(0.5px)',
                      }}
                      aria-hidden="true"
                    />
                    <div
                      className="relative w-20 h-20 rounded-full bg-brand-white border-2 flex items-center justify-center"
                      style={{
                        borderColor: accent,
                        boxShadow: `0 8px 24px ${accent}26`,
                      }}
                    >
                      <Icon size={30} strokeWidth={1.75} aria-hidden="true" style={{ color: accent }} />
                    </div>
                    <div
                      className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-md bg-brand-blue text-brand-white"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </div>
                  </div>
                  <div
                    className="text-[10px] font-bold tracking-[2px] uppercase mb-1.5"
                    style={{ color: accent }}
                  >
                    {step.day}
                  </div>
                  <h3 className="text-lg font-extrabold text-brand-black mb-1.5">{step.title}</h3>
                  <p className="text-[13px] text-brand-grey leading-relaxed max-w-[260px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
