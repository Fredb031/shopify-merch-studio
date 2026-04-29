import { IndustryPageShell, type IndustryStat } from '@/components/industries/IndustryPageShell';
import { useLang } from '@/lib/langContext';

/**
 * Mega Blueprint §08.3 — Construction industry SEO landing page.
 * Master Prompt "Audi precision" copy: short, declarative, proof-loaded
 * (200+ entrepreneurs, 5-day turnaround, broderie). FR primary, EN
 * secondary — gated on useLang so the language toggle in Navbar swaps
 * the entire surface without a remount.
 */
// Hoisted to module scope so the array reference is stable across
// re-renders. The shell memoizes resolved products on `productSkus`
// (d57851d / 8ec2d10); passing an inline literal would mint a new array
// each render and defeat that memo.
const CONSTRUCTION_PRODUCT_SKUS: string[] = ['ATC1000', 'ATCF2500', 'ATCF2400', 'ATC6606'];

// Vol II §04 spec — three industry-specific numbers. Frozen tuple so the
// array identity is stable across renders (defeats CountUp re-trigger).
const CONSTRUCTION_STATS_FR: readonly [IndustryStat, IndustryStat, IndustryStat] = [
  { value: 200, suffix: '+', label: 'équipes de construction au Québec' },
  { value: 50000, suffix: '+', label: 'pièces livrées sur les chantiers' },
  { value: 0, display: '5 jours', label: 'délai standard' },
] as const;
const CONSTRUCTION_STATS_EN: readonly [IndustryStat, IndustryStat, IndustryStat] = [
  { value: 200, suffix: '+', label: 'Quebec construction crews' },
  { value: 50000, suffix: '+', label: 'pieces shipped to sites' },
  { value: 0, display: '5 days', label: 'standard turnaround' },
] as const;

export default function Construction() {
  const { lang } = useLang();
  const isEn = lang === 'en';

  return (
    <IndustryPageShell
      title={
        isEn
          ? 'The uniform of Quebec construction sites.'
          : "L'uniforme des chantiers du Québec."
      }
      metaDescription={
        isEn
          ? '200+ Quebec contractors order their gear here. Embroidered logo, 5-day turnaround, single-piece minimum.'
          : "200+ entrepreneurs en construction commandent ici. Logo brodé, livré en 5 jours, à partir d'une pièce."
      }
      eyebrow={isEn ? 'Construction · Quebec' : 'Construction · Québec'}
      heroImage="/industries/construction.webp"
      industrySlug="construction"
      stats={isEn ? CONSTRUCTION_STATS_EN : CONSTRUCTION_STATS_FR}
      heroLede={
        isEn
          ? '200+ Quebec contractors order their gear here. Embroidered logo, 5-day turnaround, single-piece minimum. Built in Saint-Hyacinthe, shipped Quebec-wide.'
          : "200+ entrepreneurs en construction commandent ici. Logo brodé, livré en 5 jours, à partir d'une pièce. Production locale à Saint-Hyacinthe, livraison partout au Québec."
      }
      heroBullets={
        isEn
          ? [
              'Site-grade fabrics: heavyweight cotton, reinforced polycotton.',
              'High-density embroidery and screen print that survive the wash.',
              'No minimum. From a single sample to 500-piece team kits.',
              'Sizes S to 4XL on most styles.',
              'Volume pricing kicks in at 24 units.',
            ]
          : [
              'Tissus de chantier : coton épais, polycoton renforcé.',
              "Broderie haute densité et sérigraphie qui tiennent au lavage.",
              'Aucun minimum. De la pièce unique au kit 500 pièces.',
              'Tailles S à 4XL sur la plupart des modèles.',
              'Rabais volume dès 24 unités.',
            ]
      }
      ctaLabel={isEn ? 'Browse products' : 'Voir les produits'}
      ctaHref="/boutique"
      ctaClassName="bg-va-blue hover:bg-va-blue-hover text-white"
      productsHeading={
        isEn ? 'Built for the site.' : 'Conçus pour le chantier.'
      }
      productsSubcopy={
        isEn
          ? 'The four pieces Quebec contractors reorder most. Easy to embroider in volume, ready for the wash.'
          : "Les quatre pièces que les entrepreneurs québécois rachètent. Faciles à broder en volume, prêtes pour le lavage."
      }
      productSkus={CONSTRUCTION_PRODUCT_SKUS}
      faqHeading={
        isEn ? 'Construction — straight answers.' : 'Construction — réponses directes.'
      }
      faq={
        isEn
          ? [
              {
                q: 'Can you embroider my company logo on workwear?',
                a: 'Yes. Embroidery is our default for site gear — it outlasts industrial wash cycles and abrasion better than print. Up to 12 thread colours per logo on tees, hoodies, polos, caps. Send the vector, we digitise free from 24 pieces.',
              },
              {
                q: 'Lead time for a team order?',
                a: '5 business days after proof approval. 7-10 days for 100+ pieces. Need it for a Monday? Tell us — 48-hour rushes are possible against stock.',
              },
              {
                q: 'Hi-vis or CSA Z96 garments?',
                a: 'Our catalogue runs on branded gear (tees, hoodies, polos, caps), not certified PPE. For CSA Z96 vests we source through partners and apply your logo. Browse the catalogue and ask for a combined quote on checkout.',
              },
              {
                q: 'Volume discount?',
                a: '10% off automatically at 24 identical pieces. Recurring buyers get corporate accounts with preferred pricing — flag your annual volume on the first order.',
              },
            ]
          : [
              {
                q: 'Peux-tu broder mon logo sur des vêtements de travail ?',
                a: "Oui. La broderie est notre méthode par défaut pour le chantier — elle tient mieux que l'impression aux lavages industriels et aux frottements. Jusqu'à 12 couleurs de fil par logo, sur t-shirts, hoodies, polos, casquettes. Envoie ton vectoriel, on numérise sans frais à partir de 24 pièces.",
              },
              {
                q: "C'est quoi le délai pour ma commande d'équipe ?",
                a: "5 jours ouvrables après approbation de ta preuve. 7 à 10 jours pour 100 pièces et plus. Besoin pour lundi ? Dis-le — on accommode des urgences 48h selon le stock disponible.",
              },
              {
                q: 'Vêtements haute visibilité ou CSA Z96 ?',
                a: "Notre catalogue tourne autour du vêtement de marque (t-shirts, hoodies, polos, casquettes), pas l'EPI certifié. Pour les dossards CSA Z96, on les approvisionne via nos partenaires et on appose ton logo. Commande maintenant le reste de ta tenue, on combine au paiement.",
              },
              {
                q: "Quel rabais pour le volume ?",
                a: "10 % de rabais automatique dès 24 pièces identiques. Les clients récurrents passent en compte corporatif avec tarifs préférentiels — indique ton volume annuel à la première commande.",
              },
            ]
      }
      serviceType={
        isEn
          ? 'Custom uniforms for construction companies'
          : 'Uniformes personnalisés pour entreprises de construction'
      }
      faqLdMarker="data-faq-construction-ld"
      serviceLdMarker="data-service-construction-ld"
      finalHeading={isEn ? 'Outfit your crew this week.' : 'Habille ton équipe cette semaine.'}
      finalSubcopy={
        isEn
          ? 'Browse the catalogue, pick the pieces, get a digital proof inside 24 hours.'
          : 'Parcours le catalogue, choisis les pièces, reçois une preuve numérique en moins de 24h.'
      }
    />
  );
}
