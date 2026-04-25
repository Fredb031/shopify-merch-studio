// Section 02 — Google Reviews shown in the homepage carousel.
// Six entries match the Master Prompt brief; structure is intentionally
// flat so the carousel section can map() over it without further
// transformation. Names are deliberately first-name + last-initial to
// mirror the public-facing privacy convention used on Google Business.
export type Review = {
  id: string;
  name: string;
  company: string;
  rating: number; // 0-5
  text: string;
  date: string; // ISO yyyy-mm-dd
};

export const REVIEWS: Review[] = [
  {
    id: 'samuel-l',
    name: 'Samuel L.',
    company: 'Construction Pro',
    rating: 5,
    text:
      'Commande de 80 t-shirts livrée en 4 jours. Mes gars ont enfin l\u2019air d\u2019une vraie équipe sur les chantiers. Service impeccable du début à la fin.',
    date: '2025-09-12',
  },
  {
    id: 'william-b',
    name: 'William B.',
    company: 'Sports Experts',
    rating: 5,
    text:
      'On commande chez Vision Affichage depuis 3 ans. Jamais une commande en retard, qualité constante. Mes employés portent leurs polos avec fierté.',
    date: '2025-08-30',
  },
  {
    id: 'marie-eve-t',
    name: 'Marie-Ève T.',
    company: 'Boutique Lacasse',
    rating: 5,
    text:
      'Soumission claire, épreuve envoyée en 24 h, livraison en 5 jours comme promis. Aucun stress, aucun mauvais surprise. Je recommande sans hésiter.',
    date: '2025-10-04',
  },
  {
    id: 'jean-philippe-r',
    name: 'Jean-Philippe R.',
    company: 'Parc du Massif',
    rating: 5,
    text:
      'Petite commande de 12 polos pour notre équipe d\u2019accueil. Traités comme un gros client. La broderie est nette, les couleurs parfaites.',
    date: '2025-07-22',
  },
  {
    id: 'alexandre-d',
    name: 'Alexandre D.',
    company: 'Extreme Fab',
    rating: 5,
    text:
      'Commande urgente pour un événement corporatif — ils ont livré en 3 jours sans charger de surplus. C\u2019est le genre de service qui fait gagner des contrats.',
    date: '2025-06-15',
  },
  {
    id: 'maxime-l',
    name: 'Maxime L.',
    company: 'Muni Saint-Anselme',
    rating: 5,
    text:
      'Premier essai avec Vision Affichage après des années chez un fournisseur ontarien. La différence est jour et nuit — local, rapide, sans tracas.',
    date: '2025-11-02',
  },
];
