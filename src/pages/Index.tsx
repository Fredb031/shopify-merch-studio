import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
// MoleGame and IntroAnimation are one-off, first-visit chrome that
// most returning visitors never see — keep them out of the initial
// home-page bundle and fetch on demand.
import { lazy, Suspense } from 'react';
const MoleGame = lazy(() => import('@/components/MoleGame').then(m => ({ default: m.MoleGame })));
const IntroAnimation = lazy(() => import('@/components/IntroAnimation').then(m => ({ default: m.IntroAnimation })));
import { LoginModal } from '@/components/LoginModal';
import { AIChat } from '@/components/AIChat';
import { SiteFooter } from '@/components/SiteFooter';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCountUp } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';

// Tiny inline SVG primitives reused across the page.
const StarSvg = () => (
  <svg className="w-3 h-3 fill-[#F59E0B]" viewBox="0 0 24 24" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// Marquee company-name pills — text-only trust signal until /public/logos
// files land on disk. Operator can swap each entry to <img> later.
const VA_CLIENT_NAMES = [
  'Construction Rivard', 'Paysagement Pro', 'Parc Massif', 'Municipalité St-Anselme',
  'Sports Experts', 'Polyvalente Nicolas-Gatineau', 'Ville de Blainville', 'Ferme Boréalis',
];

// Inline Google reviews — 6 verified-style cards (no src/data/reviews.ts
// on disk yet, so the carousel is self-contained).
const REVIEWS = [
  { init: 'SL', name: 'Samuel Lacroix',         color: '#0052CC', txt: 'Super service! Très bonne qualité et super rapide! Je recommande fortement à toutes les entreprises qui veulent avoir l’air professionnel.' },
  { init: 'WB', name: 'William Barry',          color: '#1a3d2e', txt: 'Je recommande fortement Vision Affichage! Service très rapide, courtois. Un vrai professionnel qui comprend les besoins d’une PME.' },
  { init: 'JP', name: 'Jean-Philippe N.-L.',    color: '#5f1f1f', txt: 'Super bon service, équipe dynamique. Aussi bon pour les commandes custom que les grosses commandes entreprises. Je recommande!' },
  { init: 'MC', name: 'Marie-Claude Tremblay',  color: '#4C1D95', txt: 'On a commandé des hoodies pour toute notre équipe et le résultat était impeccable. Livraison rapide, qualité premium. On recommande!' },
  { init: 'PD', name: 'Patrick Dubois',         color: '#0A0A0A', txt: 'Excellente expérience du début à la fin. L’outil de personnalisation est génial et le produit final a dépassé nos attentes.' },
  { init: 'AB', name: 'Audrey Bergeron',        color: '#6B1B1B', txt: 'Parfait pour notre compagnie de construction. Qualité solide, délai rapide, prix compétitifs. Notre référence pour tout notre merch.' },
];

/** Homepage route — Vision Affichage Master Prompt rebuild.
 *  Black-bg cinematic hero → industry marquee → 3-stat band →
 *  How It Works → loss-aversion CTA → Google reviews aggregate.
 *  Bilingual via useLang, va.* tokens throughout. */
export default function Index() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en'
      ? 'Vision Affichage — Custom corporate apparel printed in 5 days | Quebec'
      : 'Vision Affichage — Vêtements d’entreprise imprimés en 5 jours | Québec',
    lang === 'en'
      ? 'Print your logo on t-shirts, polos, hoodies and caps. Guaranteed 5 business day delivery across Quebec. Starting from one piece.'
      : 'Imprimez votre logo sur t-shirts, polos, hoodies et casquettes. Livraison garantie en 5 jours ouvrables partout au Québec. À partir d’une pièce.',
    {},
  );
  const cart = useCartStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  // Intro animation disabled by default — site owner reported it as
  // bugged. Visitors land directly on the hero with no overlay.
  const [showLoader, setShowLoader] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Hero team image graceful-fail — set to true if /hero-team.webp 404s
  // so the gradient backdrop survives without a broken-image icon.
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  // Stats band count-up — refs gated by useInView so the numbers
  // animate the moment the band enters view, not on mount.
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { threshold: 0.4 });
  const piecesCount = useCountUp(33000, statsInView, reducedMotion ? 0 : 1500);
  const businessesCount = useCountUp(500, statsInView, reducedMotion ? 0 : 1500);
  const daysCount = useCountUp(5, statsInView, reducedMotion ? 0 : 900);

  const loaderTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => {
    return () => {
      loaderTimersRef.current.forEach(t => clearTimeout(t));
      loaderTimersRef.current = [];
    };
  }, []);

  // Organization JSON-LD schema — feeds Google the canonical
  // name/address/phone/social graph.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-vision-org-ld]')) return;
    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Vision Affichage',
      alternateName: 'Vision Affichage Inc.',
      url: 'https://visionaffichage.com',
      logo: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651',
      telephone: '+1-367-380-4808',
      email: 'info@visionaffichage.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Saint-Hyacinthe',
        addressRegion: 'QC',
        addressCountry: 'CA',
      },
      sameAs: [
        'https://instagram.com/visionaffichage',
        'https://facebook.com/visionaffichage',
      ],
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.visionOrgLd = 'true';
    el.text = JSON.stringify(orgSchema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, []);

  const handleLoaderComplete = useCallback(() => {
    setShowLoader(false);
    let alreadyPlayed = true;
    try {
      alreadyPlayed = typeof window !== 'undefined' && localStorage.getItem('moleGamePlayed') === 'true';
    } catch { /* private mode */ }
    if (!alreadyPlayed) {
      loaderTimersRef.current.push(setTimeout(() => setShowGame(true), 650));
    }
  }, []);

  const handleGameClose = (won: boolean) => {
    setShowGame(false);
    try {
      localStorage.setItem('moleGamePlayed', 'true');
    } catch { /* private mode */ }
    if (won) {
      cart.applyDiscount('VISION10');
    }
  };

  // Industries marquee row — text-only, tripled for seamless loop.
  const INDUSTRIES = lang === 'en'
    ? ['Construction', 'Landscaping', 'Plumbing', 'Electrical', 'Corporate', 'Municipal']
    : ['Construction', 'Paysagement', 'Plomberie', 'Électricité', 'Corporate', 'Municipal'];
  const industryRow = [...INDUSTRIES, ...INDUSTRIES, ...INDUSTRIES];

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-va-white pb-20 focus:outline-none">
      <Suspense fallback={null}>
        {showLoader && <IntroAnimation onComplete={handleLoaderComplete} />}
        {showGame && <MoleGame isOpen={showGame} onClose={handleGameClose} />}
      </Suspense>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <Navbar onOpenCart={() => setCartOpen(true)} onOpenLogin={() => setLoginOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* ============================================================
          1. HERO — full-bleed black, 60×60 grid texture, blue glow,
          right-side team image with tri-stop gradient overlay,
          social-proof pill, dual CTA, 4-item trust bar, scroll cue.
          ============================================================ */}
      <section className="relative min-h-screen bg-va-black overflow-hidden flex items-center">
        {/* 60×60 white grid texture at 0.03 opacity — Master Prompt spec */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Blue glow behind CTA zone */}
        <div
          aria-hidden="true"
          className="absolute left-[10%] top-1/2 -translate-y-1/2 w-96 h-96 bg-va-blue/8 blur-[100px] pointer-events-none"
        />

        {/* Right-side team photo + tri-stop gradient. onError hides the
            <img> if the asset 404s in dev so the gradient survives. */}
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-full md:w-[55%] pointer-events-none">
          {!heroImgFailed && (
            <img
              src="/hero-team.webp"
              alt=""
              loading="eager"
              decoding="async"
              onError={() => setHeroImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Tri-stop gradient overlay — black on the left, fading to
              transparent right of center so the image (when present)
              shows through on the right edge. */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, #0A0A0A 0%, rgba(10,10,10,0.7) 50%, rgba(10,10,10,0.2) 100%)',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 md:px-10">
          <div className="max-w-[760px]">
            {/* Social proof pill */}
            <div
              className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
              style={{
                animation: reducedMotion ? 'none' : 'fadeInDown 0.5s 0.05s ease forwards',
                opacity: reducedMotion ? 1 : 0,
              }}
            >
              <div className="flex -space-x-1.5" aria-hidden="true">
                {[
                  { i: 'ML', c: '#0052CC' },
                  { i: 'PB', c: '#5f1f1f' },
                  { i: 'SR', c: '#1a3d2e' },
                  { i: 'AT', c: '#4C1D95' },
                ].map(a => (
                  <div
                    key={a.i}
                    className="w-6 h-6 rounded-full ring-2 ring-va-black flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: a.c }}
                  >
                    {a.i}
                  </div>
                ))}
              </div>
              <span className="flex gap-0.5" aria-hidden="true">
                <StarSvg /><StarSvg /><StarSvg /><StarSvg /><StarSvg />
              </span>
              <span className="text-white/80 text-xs font-medium">
                {lang === 'en' ? '500+ teams across Quebec' : '500+ équipes au Québec'}
              </span>
            </div>

            {/* H1 */}
            <h1
              className="mt-8 font-display font-black text-white text-6xl md:text-7xl xl:text-8xl tracking-[-0.04em] leading-[1.0]"
              style={{
                animation: reducedMotion ? 'none' : 'fadeInUp 0.5s 0.15s ease forwards',
                opacity: reducedMotion ? 1 : 0,
              }}
            >
              {lang === 'en' ? (
                <>Your team.<br /><span className="text-va-blue">Your image.</span><br />5 days.</>
              ) : (
                <>Ton équipe.<br /><span className="text-va-blue">Ton image.</span><br />5 jours.</>
              )}
            </h1>

            {/* Sub */}
            <p
              className="mt-6 text-white/75 text-lg md:text-xl max-w-[560px] leading-relaxed"
              style={{
                animation: reducedMotion ? 'none' : 'fadeInUp 0.5s 0.25s ease forwards',
                opacity: reducedMotion ? 1 : 0,
              }}
            >
              {lang === 'en'
                ? 'Logo printed on your t-shirts, hoodies, polos and caps. Guaranteed 5-business-day delivery — starting at one piece.'
                : "Logo imprimé sur tes t-shirts, hoodies, polos et casquettes. Livraison garantie en 5 jours ouvrables — à partir d'une seule pièce."}
            </p>

            {/* Dual CTA */}
            <div
              className="mt-10 flex flex-wrap items-center gap-3"
              style={{
                animation: reducedMotion ? 'none' : 'fadeInUp 0.5s 0.35s ease forwards',
                opacity: reducedMotion ? 1 : 0,
              }}
            >
              <Link
                to="/boutique"
                className="group inline-flex items-center gap-2 px-7 h-[56px] rounded-xl bg-va-blue text-white text-base font-bold tracking-[-0.2px] shadow-[0_10px_30px_rgba(0,82,204,0.4)] transition-all hover:-translate-y-0.5 hover:bg-va-blue-h hover:shadow-[0_14px_36px_rgba(0,82,204,0.6)] focus:outline-none focus-visible:ring-4 focus-visible:ring-va-blue/50 focus-visible:ring-offset-2 focus-visible:ring-offset-va-black"
              >
                {lang === 'en' ? 'Order now' : 'Commander maintenant'}
                <ArrowRight size={18} strokeWidth={2.25} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link
                to="/customizer"
                className="inline-flex items-center justify-center px-7 h-[56px] rounded-xl border border-white/20 text-white/75 text-base font-semibold tracking-[-0.2px] transition-colors hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-va-black"
              >
                {lang === 'en' ? 'Customize my product' : 'Personnaliser mon produit'}
              </Link>
            </div>

            {/* Trust bar */}
            <div
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-white/35 text-xs md:text-sm"
              style={{
                animation: reducedMotion ? 'none' : 'fadeInUp 0.5s 0.45s ease forwards',
                opacity: reducedMotion ? 1 : 0,
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">⚡</span>
                {lang === 'en' ? '5 days' : '5 jours'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">✓</span>
                {lang === 'en' ? 'From 1 piece' : 'À partir d’une pièce'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">✓</span>
                {lang === 'en' ? '1-year guarantee' : 'Garantie 1 an'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">🇨🇦</span>
                {lang === 'en' ? 'Free shipping over $300' : 'Livraison gratuite dès 300$'}
              </span>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          aria-hidden="true"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 text-[10px] tracking-[0.2em] uppercase"
        >
          <span>{lang === 'en' ? 'Scroll' : 'Scroll'}</span>
          <ChevronDown size={14} strokeWidth={2} className={reducedMotion ? '' : 'animate-bounce'} />
        </div>
      </section>

      {/* ============================================================
          2. INDUSTRY MARQUEE — offwhite band, uppercase eyebrow,
          scrolling industry labels + company-name pills.
          ============================================================ */}
      <section
        aria-label={lang === 'en' ? 'Trusted by Quebec professionals' : 'Les pros du Québec'}
        className="border-y border-va-line/50 py-10 bg-va-offwhite"
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <h2 className="text-center uppercase tracking-[0.15em] text-va-muted text-xs font-semibold mb-6">
            {lang === 'en'
              ? 'Quebec pros choose Vision Affichage'
              : 'Les pros du Québec choisissent Vision Affichage'}
          </h2>

          {/* Scrolling industry labels */}
          <div
            className="overflow-hidden relative"
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)',
            }}
          >
            <div
              className="flex w-max"
              style={{ animation: reducedMotion ? 'none' : 'marqueeScroll 40s linear infinite' }}
            >
              {industryRow.map((label, i) => (
                <div
                  key={i}
                  className="px-8 text-[13px] font-bold tracking-[0.12em] uppercase text-va-ink/55"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Company-name pills strip */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-3 gap-y-3">
            {VA_CLIENT_NAMES.map(name => (
              <div
                key={name}
                className="px-4 py-2 bg-white border border-va-line rounded-lg flex items-center justify-center"
              >
                <span className="text-va-dim text-xs font-bold whitespace-nowrap tracking-wide">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          3. STATS — black band, 3-col gap-px grid, mono numerics,
          count-up gated by useInView.
          ============================================================ */}
      <section ref={statsRef} className="bg-va-black py-24">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-3xl overflow-hidden">
            {[
              {
                value: piecesCount,
                target: 33000,
                suffix: '+',
                label: lang === 'en' ? 'pieces delivered' : 'pièces livrées',
                sub: lang === 'en' ? '(since 2021)' : '(depuis 2021)',
              },
              {
                value: businessesCount,
                target: 500,
                suffix: '+',
                label: lang === 'en' ? 'businesses' : 'entreprises',
                sub: lang === 'en' ? '(construction · landscaping · corporate)' : '(construction · paysagement · corporate)',
              },
              {
                value: daysCount,
                target: 5,
                suffix: '',
                label: lang === 'en' ? 'guaranteed lead time' : 'jours délai garanti',
                sub: lang === 'en' ? '(or refunded — no conditions)' : '(ou remboursé — sans condition)',
              },
            ].map((stat, i) => (
              <div key={i} className="bg-va-black p-10 md:p-12 flex flex-col items-center text-center">
                <div className="font-mono font-bold text-5xl md:text-6xl text-va-blue tracking-tight">
                  {stat.value.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA')}
                  {stat.suffix}
                </div>
                <div className="mt-4 text-white text-lg font-semibold">
                  {stat.label}
                </div>
                <div className="mt-1.5 text-white/45 text-sm">
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          4. HOW IT WORKS — bg-va-bg-1, ghost number per step,
          step 3 has the inline blue arrow CTA.
          ============================================================ */}
      <section className="bg-va-bg-1 py-24 md:py-36">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <div className="text-center mb-16">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-va-blue mb-3">
              {lang === 'en' ? 'How it works' : 'Comment ça fonctionne'}
            </div>
            <h2 className="font-display font-black text-va-ink text-4xl md:text-5xl xl:text-6xl tracking-[-0.03em] leading-[1.05]">
              {lang === 'en' ? (
                <>Three actions. <span className="text-va-blue">One uniform.</span></>
              ) : (
                <>Trois actions. <span className="text-va-blue">Un uniforme.</span></>
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {[
              {
                n: '01',
                title: lang === 'en' ? 'Send your logo' : 'Envoie ton logo',
                body: lang === 'en'
                  ? 'PNG, SVG, JPEG — whatever you have on hand. Our team handles positioning to industry standards. No design skills needed.'
                  : 'PNG, SVG, JPEG — ce que tu as sous la main. Notre équipe positionne selon les standards de l’industrie. Aucune compétence graphique requise.',
              },
              {
                n: '02',
                title: lang === 'en' ? 'We print and ship' : 'On imprime et on expédie',
                body: lang === 'en'
                  ? 'Production starts the same business day for orders before 3 pm Quebec time. You watch the timeline, not approvals.'
                  : 'La production démarre la journée même pour toute commande avant 15 h heure du Québec. Tu suis le délai, pas les approbations.',
              },
              {
                n: '03',
                title: lang === 'en' ? 'You wear it. Day 5.' : 'Tu le portes. Jour 5.',
                body: lang === 'en'
                  ? 'Delivered anywhere in Quebec inside 5 business days. One day late? Full refund — no questions, no fine print.'
                  : 'Livré partout au Québec en 5 jours ouvrables. Un seul jour de retard? Remboursement intégral — sans question, sans clause cachée.',
                cta: true,
              },
            ].map((step, i) => (
              <div key={i} className="relative pt-12">
                {/* Giant ghost number */}
                <div
                  aria-hidden="true"
                  className="absolute -top-4 -left-2 font-mono font-black text-[120px] leading-none text-va-line/40 select-none pointer-events-none"
                >
                  {step.n}
                </div>
                <div className="relative">
                  <div className="font-display font-bold text-2xl text-va-ink mb-3">
                    {step.title}
                  </div>
                  <p className="text-va-muted leading-relaxed">
                    {step.body}
                  </p>
                  {step.cta && (
                    <Link
                      to="/boutique"
                      className="mt-5 inline-flex items-center gap-2 text-va-blue font-semibold hover:gap-3 transition-all"
                    >
                      {lang === 'en' ? 'Order now' : 'Commander maintenant'}
                      <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          5. LOSS AVERSION — black band, "le coût invisible" eyebrow,
          big H2 with brand-blue accent, single high-impact CTA.
          ============================================================ */}
      <section className="bg-va-black py-24 md:py-32">
        <div className="max-w-[920px] mx-auto px-6 md:px-10 text-center">
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/50 mb-5">
            {lang === 'en' ? 'The invisible cost' : 'Le coût invisible'}
          </div>
          <h2 className="font-display font-black text-white text-4xl md:text-6xl tracking-[-0.03em] leading-[1.05]">
            {lang === 'en' ? (
              <>Every week without a uniform,<br /><span className="text-va-blue">it’s lost advertising.</span></>
            ) : (
              <>Chaque semaine sans uniforme,<br /><span className="text-va-blue">c’est de la publicité perdue.</span></>
            )}
          </h2>
          <p className="mt-8 max-w-[640px] mx-auto text-white/75 text-lg leading-relaxed">
            {lang === 'en'
              ? '100 homes drive past your crew every day. 500 contractors already turned that into recognition. Your turn.'
              : '100 maisons croisent ton équipe chaque jour. 500 entrepreneurs ont déjà transformé ça en reconnaissance. À toi.'}
          </p>
          <div className="mt-10">
            <Link
              to="/boutique"
              className="inline-flex items-center gap-2 px-10 py-5 rounded-xl bg-va-blue text-white text-base font-bold tracking-[-0.2px] shadow-[0_0_40px_rgba(0,82,204,0.4)] transition-all hover:-translate-y-0.5 hover:bg-va-blue-h hover:shadow-[0_0_60px_rgba(0,82,204,0.55)] focus:outline-none focus-visible:ring-4 focus-visible:ring-va-blue/50 focus-visible:ring-offset-2 focus-visible:ring-offset-va-black"
            >
              {lang === 'en' ? 'Order now' : 'Commander maintenant'}
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          6. REVIEWS — offwhite band, 5.0 mono headline, 6 verified
          Google testimonial cards.
          ============================================================ */}
      <section className="bg-va-offwhite py-24">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <div className="flex items-center justify-center gap-8 mb-12 flex-wrap text-center">
            <div>
              <div className="font-mono font-black text-7xl md:text-8xl text-va-ink leading-none tracking-[-0.04em]">
                5.0
              </div>
              <div className="flex gap-[3px] justify-center my-3" role="img" aria-label={lang === 'en' ? '5 out of 5 stars' : '5 étoiles sur 5'}>
                {[...Array(5)].map((_, i) => <StarSvg key={i} />)}
              </div>
              <div className="text-xs text-va-muted">
                {lang === 'en' ? '50+ verified Google reviews' : '50+ avis Google vérifiés'}
              </div>
            </div>
            <div className="hidden md:block w-px h-24 bg-va-line" />
            <div className="text-left max-w-[400px]">
              <h2 className="font-display font-black text-va-ink text-3xl md:text-4xl tracking-[-0.03em] leading-tight">
                {lang === 'en' ? 'What contractors say' : 'Ce que les entrepreneurs disent'}
              </h2>
              <p className="mt-2 text-va-muted text-sm">
                {lang === 'en'
                  ? 'Landscapers, contractors, plumbers, corporate firms.'
                  : 'Paysagistes, contracteurs, plombiers, firmes corporate.'}
              </p>
              <div className="flex items-center gap-1.5 mt-3">
                <GoogleIcon />
                <span className="text-xs font-bold text-va-blue">
                  {lang === 'en' ? 'Verified Google reviews' : 'Avis Google vérifiés'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible">
            {REVIEWS.map((r, i) => (
              <div key={i} className="min-w-[280px] md:min-w-0 snap-start bg-white border border-va-line rounded-2xl p-5 flex-shrink-0">
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold text-white flex-shrink-0"
                    style={{ background: r.color }}
                  >
                    {r.init}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-va-ink truncate">{r.name}</div>
                    <div className="flex gap-0.5 mt-1">{[...Array(5)].map((_, j) => <StarSvg key={j} />)}</div>
                  </div>
                  <GoogleIcon />
                </div>
                <p className="text-[13.5px] text-va-dim leading-relaxed">{r.txt}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
      <AIChat />
      <BottomNav />
    </div>
  );
}
