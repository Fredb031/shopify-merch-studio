import type { Locale } from '@/lib/types';

export type CaseStudyStat = {
  value: Record<Locale, string>;
  label: Record<Locale, string>;
};

export type CaseStudy = {
  id: string;
  client: string;
  industrySlug: string;
  industryHref: Record<Locale, string>;
  heroImage: string;
  alt: Record<Locale, string>;
  eyebrow: Record<Locale, string>;
  headline: Record<Locale, string>;
  quote: Record<Locale, string>;
  attribution: Record<Locale, string>;
  stats: readonly [CaseStudyStat, CaseStudyStat, CaseStudyStat];
  cta: Record<Locale, string>;
};

export const featuredCaseStudy: CaseStudy = {
  id: 'construction-rivard',
  client: 'CONSTRUCTION RIVARD',
  industrySlug: 'construction',
  industryHref: {
    'fr-ca': '/fr-ca/industries/construction',
    'en-ca': '/en-ca/industries/construction',
  },
  heroImage: '/placeholders/case-studies/construction-rivard.svg',
  alt: {
    'fr-ca':
      "Scène de chantier — quatre travailleurs portant des polos brodés Construction Rivard, sur fond ink avec échafaudages",
    'en-ca':
      'Construction site scene — four workers in embroidered Construction Rivard polos on an ink background with scaffolding',
  },
  eyebrow: {
    'fr-ca': 'ÉTUDE DE CAS',
    'en-ca': 'CASE STUDY',
  },
  headline: {
    'fr-ca':
      '300 employés uniformisés en 5 jours pour le démarrage du projet Saint-Eustache.',
    'en-ca':
      '300 employees outfitted in 5 days for the Saint-Eustache project kickoff.',
  },
  quote: {
    'fr-ca':
      "« Aucun retour qualité depuis 18 mois. Le polo qu'on commandait avant chez le distributeur américain ne tenait pas un été. Vision Affichage, c'est un autre standard. »",
    'en-ca':
      '"Zero quality returns in 18 months. The polo we used to order from the American distributor wouldn\'t survive a summer. Vision Affichage is a different standard."',
  },
  attribution: {
    'fr-ca': '— Marc Tremblay, directeur de chantier',
    'en-ca': '— Marc Tremblay, site manager',
  },
  stats: [
    {
      value: {
        'fr-ca': '300',
        'en-ca': '300',
      },
      label: {
        'fr-ca': 'vêtements',
        'en-ca': 'garments',
      },
    },
    {
      value: {
        'fr-ca': '5 jours',
        'en-ca': '5 days',
      },
      label: {
        'fr-ca': 'production',
        'en-ca': 'production',
      },
    },
    {
      value: {
        'fr-ca': '0',
        'en-ca': '0',
      },
      label: {
        'fr-ca': 'retours qualité (18 mois)',
        'en-ca': 'quality returns (18 months)',
      },
    },
  ],
  cta: {
    'fr-ca': "Voir l'industrie construction",
    'en-ca': 'See the construction industry',
  },
};

export const caseStudies: readonly CaseStudy[] = [featuredCaseStudy];
