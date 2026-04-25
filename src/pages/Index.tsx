// Section 02 — Homepage rebuild (Freud × Bernays redesign).
// Replaces the legacy hero/featured/testimonial/FAQ layout with the
// loss-aversion-first structure spelled out in the Master Prompt
// Section 02 brief: full-bleed black hero, industry logos marquee,
// 3-column stats grid, "How It Works" steps, Google Reviews carousel,
// and a closing loss-aversion CTA section before the footer.
//
// The page deliberately keeps the same default export name and
// signature so src/App.tsx's `<Route path="/" element={<Index />} />`
// keeps working without router edits.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Zap, Package, Star } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { LoginModal } from '@/components/LoginModal';
import { SiteFooter } from '@/components/SiteFooter';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLang } from '@/lib/langContext';
import { REVIEWS } from '@/data/reviews';

// Industry logos shown in the marquee strip directly under the hero.
// Names are deliberately ASCII-friendly placeholders — the real logo
// SVGs land in /public/logos/* via a later asset PR. Until then the
// marquee renders the brand names in monospace so the section still
// looks intentional rather than empty.
const INDUSTRY_LOGOS: { name: string; src?: string }[] = [
  { name: 'Construction Pro' },
  { name: 'Sports Experts' },
  { name: 'E-Turgeon Sport' },
  { name: 'Lacasse' },
  { name: 'CFP' },
  { name: 'Université Laval' },
  { name: 'Parc du Massif' },
  { name: 'Muni Saint-Anselme' },
  { name: 'Extreme Fab' },
];

/** Render a 5-star rating row using lucide Star icons. */
function StarRow({ count = 5, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-label={`${count} étoiles sur 5`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-brand-blue text-brand-blue" />
      ))}
    </div>
  );
}

/** Homepage route — Section 02 Freud × Bernays rebuild. */
export default function Index() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en' ? 'Vision Affichage — Custom merch' : 'Vision Affichage — Merch d\u2019entreprise personnalisé',
    lang === 'en'
      ? 'Vision Affichage — Custom merch for Québec businesses. Free quote, 5-day turnaround, 100% local.'
      : 'Vision Affichage — Merch personnalisée pour entreprises du Québec. Soumission gratuite, 5 jours ouvrables, 100 % local.',
    {},
  );

  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-white text-brand-dark font-sans">
      <Navbar onOpenCart={() => setCartOpen(true)} onOpenLogin={() => setLoginOpen(true)} />

      {/* ──────────────────────────────────────────────────────────
          2.2 — HERO
          Full-bleed bg-brand-black with a subtle background image at
          /hero-team.jpg (opacity-20 + black gradient overlay). Until
          that asset ships via Higgsfield we render a flat black
          backdrop placeholder so the hero composition still reads
          correctly. Loss-framed headline ("Ton équipe a l'air
          d'amateurs.") with `d'amateurs.` in brand-blue, a 5-day
          subhead, primary CTA in brand-blue, ghost text-link, and a
          trust bar above the fold.
          ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-black text-brand-white">
        {/* Background layer — placeholder solid black until hero-team.jpg lands. */}
        <div className="absolute inset-0 bg-brand-black" aria-hidden="true" />
        {/* Once /public/hero-team.jpg exists this <img> will fade in
            visually behind the gradient. Kept as a regular <img> with
            object-cover so it can be swapped without code changes. */}
        <img
          src="/hero-team.jpg"
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-brand-black/70 via-brand-black/60 to-brand-black"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col items-center justify-center px-6 py-24 text-center">
          <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Ton équipe a l&apos;air<br />
            <span className="text-brand-blue">d&apos;amateurs.</span><br />
            Les clients le remarquent.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-brand-white/80 sm:text-xl">
            500+ entreprises au Québec ont réglé ça.<br />
            Livré en 5 jours ouvrables — à partir d&apos;une pièce.
          </p>

          <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-md bg-brand-blue px-8 py-4 text-base font-bold text-brand-white shadow-lg transition-colors hover:bg-brand-blue-hover focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:ring-offset-brand-black"
            >
              Obtenir une soumission gratuite
            </Link>
            <Link
              to="#how-it-works"
              className="text-base font-medium text-brand-white/90 underline-offset-4 transition hover:text-brand-blue hover:underline"
            >
              Voir comment ça fonctionne →
            </Link>
          </div>

          {/* Trust bar — stars + Google rating + 500+ + 33 000+ + free shipping */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-brand-white/80">
            <span className="inline-flex items-center gap-2">
              <StarRow />
              <span className="font-semibold text-brand-white">5/5</span>
              <span>Google</span>
            </span>
            <span className="hidden h-4 w-px bg-brand-white/20 sm:inline-block" aria-hidden="true" />
            <span><span className="font-semibold text-brand-white">500+</span> entreprises</span>
            <span className="hidden h-4 w-px bg-brand-white/20 sm:inline-block" aria-hidden="true" />
            <span><span className="font-semibold text-brand-white">33 000+</span> pièces livrées</span>
            <span className="hidden h-4 w-px bg-brand-white/20 sm:inline-block" aria-hidden="true" />
            <span>Livraison gratuite &gt; 300 $</span>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
          2.3 — INDUSTRY LOGOS MARQUEE
          Horizontal infinite marquee of client logos. Uses the
          existing `marquee-scroll` keyframe from tailwind.config.ts so
          the animation is consistent with the rest of the site.
          ────────────────────────────────────────────────────────── */}
      <section className="border-y border-brand-grey-border bg-brand-grey-light py-10">
        <p className="mb-6 text-center font-mono text-xs uppercase tracking-[0.2em] text-brand-grey">
          Ils nous font confiance depuis 2015
        </p>
        <div className="relative overflow-hidden">
          <div className="flex w-max animate-marquee-scroll items-center gap-16 px-8">
            {[...INDUSTRY_LOGOS, ...INDUSTRY_LOGOS].map((logo, i) => (
              <div
                key={`${logo.name}-${i}`}
                className="flex h-10 shrink-0 items-center justify-center font-display text-base font-bold uppercase tracking-wider text-brand-grey opacity-70 transition-opacity hover:opacity-100"
              >
                {logo.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
          2.4 — STATS GRID
          Three-column proof grid with brand-blue numbers in the
          oversized display weight. Numbers act as the herd-validation
          beacon (Bernays): real volume, real clients, real delay.
          ────────────────────────────────────────────────────────── */}
      <section className="bg-brand-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 text-center md:grid-cols-3 md:gap-8">
          <div>
            <div className="font-display font-black text-5xl text-brand-blue sm:text-6xl">33 000+</div>
            <div className="mt-3 text-base font-medium text-brand-dark">Pièces livrées</div>
          </div>
          <div>
            <div className="font-display font-black text-5xl text-brand-blue sm:text-6xl">500+</div>
            <div className="mt-3 text-base font-medium text-brand-dark">Entreprises</div>
          </div>
          <div>
            <div className="font-display font-black text-5xl text-brand-blue sm:text-6xl">5 jours</div>
            <div className="mt-3 text-base font-medium text-brand-dark">Délai garanti</div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
          2.5 — HOW IT WORKS
          Three transformation-language steps with lucide icons (Upload
          → Zap → Package) and oversized ghost numbers behind each
          card. Ghost number class is taken verbatim from the brief:
          font-mono text-9xl text-brand-grey-border absolute select-none
          ────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-brand-grey-light py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-brand-blue">
              Comment ça marche
            </p>
            <h2 className="font-display text-3xl font-black text-brand-dark sm:text-4xl md:text-5xl">
              D&apos;une idée à des équipes habillées en 5 jours.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {[
              {
                Icon: Upload,
                num: '01',
                title: 'Envoie ton logo',
                body: 'Téléverse un PNG, SVG ou PDF. On confirme la lisibilité sous 24 h ouvrables et on retourne une épreuve numérique.',
              },
              {
                Icon: Zap,
                num: '02',
                title: 'Approuve l\u2019épreuve',
                body: 'Tu valides les couleurs, la position, la taille. Aucune surprise — ce que tu vois est exactement ce qui sera produit.',
              },
              {
                Icon: Package,
                num: '03',
                title: 'Reçois en 5 jours',
                body: 'Production locale au Québec, livraison gratuite au-delà de 300 $. Tes équipes sont prêtes la semaine d\u2019après.',
              },
            ].map((step) => (
              <div key={step.num} className="relative overflow-hidden">
                <span
                  className="font-mono text-9xl text-brand-grey-border absolute select-none -top-4 -left-2 leading-none pointer-events-none"
                  aria-hidden="true"
                >
                  {step.num}
                </span>
                <div className="relative pt-12 pl-2">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-md bg-brand-blue text-brand-white">
                    <step.Icon className="h-7 w-7" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-brand-dark sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-brand-grey">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
          2.6 — GOOGLE REVIEWS
          Aggregate "5.0" hero number on the left, horizontally
          scrollable carousel of review cards on the right. The
          carousel uses native `overflow-x-auto` + `snap-x` so it
          works on mobile without a JS lib.
          ────────────────────────────────────────────────────────── */}
      <section className="bg-brand-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 grid grid-cols-1 items-end gap-8 md:grid-cols-3">
            <div className="md:col-span-1">
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-brand-blue">
                Avis vérifiés Google
              </p>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-7xl font-black text-brand-dark leading-none">5.0</span>
                <StarRow />
              </div>
              <p className="mt-3 text-sm text-brand-grey">
                Basé sur plus de 200 avis clients sur Google.
              </p>
            </div>
            <div className="md:col-span-2 md:text-right">
              <h2 className="font-display text-3xl font-black text-brand-dark sm:text-4xl">
                Les clients en parlent mieux que nous.
              </h2>
            </div>
          </div>

          <div className="-mx-6 overflow-x-auto pb-4 [scrollbar-width:thin]">
            <div className="flex snap-x snap-mandatory gap-6 px-6">
              {REVIEWS.map((review) => (
                <article
                  key={review.id}
                  className="flex w-[320px] shrink-0 snap-start flex-col rounded-lg border border-brand-grey-border bg-brand-white p-6 shadow-sm sm:w-[360px]"
                >
                  <StarRow count={review.rating} className="mb-4" />
                  <p className="flex-1 text-base leading-relaxed text-brand-dark">
                    {review.text}
                  </p>
                  <div className="mt-6 border-t border-brand-grey-border pt-4">
                    <div className="font-display text-sm font-bold text-brand-dark">
                      {review.name}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-wider text-brand-grey">
                      {review.company}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
          2.7 — LOSS-AVERSION CTA
          Final black-section gut-punch before the footer. The second
          line ("tes équipes sont dehors sans ton logo") gets the
          brand-blue accent treatment — colour does the emotional work
          while the line break paces the read.
          ────────────────────────────────────────────────────────── */}
      <section className="bg-brand-black py-24 text-brand-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
            Pendant que tu lis ça,<br />
            <span className="text-brand-blue">tes équipes sont dehors sans ton logo.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-brand-white/80">
            Chaque jour sans uniforme = des prospects qui choisissent un compétiteur.
            La bonne nouvelle&nbsp;: 5 jours, c&apos;est tout ce qu&apos;il te faut pour régler ça.
          </p>
          <div className="mt-10">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-md bg-brand-blue px-8 py-4 text-base font-bold text-brand-white shadow-lg transition-colors hover:bg-brand-blue-hover focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:ring-offset-brand-black"
            >
              Commander maintenant — livraison garantie en 5 jours
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
      <BottomNav />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
