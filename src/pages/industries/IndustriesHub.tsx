import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, HardHat, Trees, Wrench, Briefcase, Building2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLang } from '@/lib/langContext';

/**
 * Mega Blueprint §08.3 — /industries hub. A directory of the five
 * industry-specific landing pages, useful for internal linking and as
 * a target for a future footer/nav link. Lazy-loaded alongside the
 * five children. Visual rhythm mirrors About.tsx (eyebrow + H1 +
 * card grid).
 */

const industries = [
  {
    href: '/industries/construction',
    icon: HardHat,
    titleFr: 'Construction',
    titleEn: 'Construction',
    bodyFr:
      "Vêtements robustes pour les chantiers : t-shirts coton épais, hoodies brodés, casquettes.",
    bodyEn:
      'Durable workwear for construction sites: heavy cotton tees, embroidered hoodies, caps.',
  },
  {
    href: '/industries/paysagement',
    icon: Trees,
    titleFr: 'Paysagement',
    titleEn: 'Landscaping',
    bodyFr:
      'Tissus respirants pour les longues journées au soleil, couleurs vives résistantes aux UV.',
    bodyEn:
      'Breathable fabrics for long sunny days, UV-stable bright colours.',
  },
  {
    href: '/industries/plomberie-electricite',
    icon: Wrench,
    titleFr: 'Plomberie & Électricité',
    titleEn: 'Plumbing & Electrical',
    bodyFr:
      "Polos professionnels pour visites résidentielles, broderie de licence RBQ disponible.",
    bodyEn:
      'Professional polos for residential visits, RBQ licence embroidery available.',
  },
  {
    href: '/industries/corporate',
    icon: Briefcase,
    titleFr: 'Corporate',
    titleEn: 'Corporate',
    bodyFr:
      "Polos brodés, t-shirts premium, kits d'embauche emballés par employé.",
    bodyEn:
      'Embroidered polos, premium tees, onboarding kits packed per-employee.',
  },
  {
    href: '/industries/municipalites',
    icon: Building2,
    titleFr: 'Municipalités',
    titleEn: 'Municipalities',
    bodyFr:
      "Travaux publics, loisirs, accueil citoyen — conforme aux appels d'offres SEAO.",
    bodyEn:
      'Public works, recreation, civic reception — compliant with SEAO public tenders.',
  },
] as const;

export default function IndustriesHub() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en'
      ? 'Industries we outfit · Vision Affichage'
      : 'Industries que nous habillons · Vision Affichage',
    lang === 'en'
      ? 'Custom apparel for Quebec construction, landscaping, plumbing, corporate and municipal teams. Local production in Saint-Hyacinthe.'
      : "Vêtements personnalisés pour équipes de construction, paysagement, plomberie-électricité, corporate et municipalités au Québec. Production locale à Saint-Hyacinthe.",
    {},
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main
        id="main-content"
        className="flex-1 max-w-[1100px] w-full mx-auto px-6 md:px-10 py-12 md:py-16"
      >
        <section className="mb-10 md:mb-12">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-3">
            <MapPin size={12} aria-hidden="true" className="-mt-px" />
            <span>{lang === 'en' ? 'Industries · Quebec' : 'Industries · Québec'}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#0F2341] tracking-[-0.8px] mb-4 max-w-[820px]">
            {lang === 'en'
              ? 'Industries we outfit across Quebec'
              : 'Industries que nous habillons au Québec'}
          </h1>
          <p className="text-base md:text-lg text-zinc-700 max-w-[720px] leading-relaxed">
            {lang === 'en'
              ? 'Five industry-specific surfaces, each with garments and FAQs tuned to that line of work. Pick yours below or request a quote directly.'
              : "Cinq surfaces dédiées par industrie, chacune avec vêtements et FAQ adaptés. Choisissez la vôtre ci-dessous ou personnalisez directement votre commande."}
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map(ind => {
            const Icon = ind.icon;
            const indTitle = lang === 'en' ? ind.titleEn : ind.titleFr;
            // a11y: card-shaped <Link> wraps a heading + body + repeated
            // "Explore"/"Découvrir" affordance. Without an explicit
            // accessible name, screen-reader rotor users see five
            // identical "Explore" entries in the link list. The
            // aria-label disambiguates each tile by its industry +
            // destination intent.
            const cardLabel =
              lang === 'en'
                ? `Explore ${indTitle} apparel`
                : `Découvrir les vêtements ${indTitle}`;
            return (
              <Link
                key={ind.href}
                to={ind.href}
                aria-label={cardLabel}
                className="group bg-white border border-border rounded-2xl p-6 transition-all duration-300 hover:border-[#0F2341]/30 hover:shadow-[0_16px_40px_rgba(27,58,107,0.14)] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2341] focus-visible:ring-offset-2"
              >
                <span
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#E8A838]/15 text-[#E8A838] mb-4"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </span>
                <h2 className="text-lg font-extrabold text-[#0F2341] tracking-[-0.3px] mb-2">
                  {indTitle}
                </h2>
                <p className="text-sm text-zinc-700 leading-relaxed mb-4">
                  {lang === 'en' ? ind.bodyEn : ind.bodyFr}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F2341] group-hover:text-[#1B3A6B]">
                  {lang === 'en' ? 'Explore' : 'Découvrir'}
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
