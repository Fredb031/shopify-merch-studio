import { IndustryPageShell } from '@/components/industries/IndustryPageShell';

/**
 * Mega Blueprint §08.3 — Paysagement (landscaping) landing page.
 * Targets "vêtements paysagement Québec", "uniformes équipe paysagiste",
 * "t-shirt entreprise paysagement". Recommended garments lean on
 * breathable t-shirts (sport ou coton), polos pour le service client,
 * casquettes pour la protection solaire.
 */
export default function Paysagement() {
  return (
    <IndustryPageShell
      title="Vêtements d'entreprise pour compagnies de paysagement | Québec"
      metaDescription="Uniformes brodés et t-shirts personnalisés pour compagnies de paysagement, entretien paysager et architectes-paysagistes au Québec. Production locale, livraison sous 5 jours."
      eyebrow="Paysagement · Québec"
      heroLede="Vision Affichage produit des uniformes au logo pour les compagnies de paysagement québécoises. T-shirts respirants pour les longues journées au soleil, polos professionnels pour les rencontres clients, casquettes brodées — tout en couleurs vives qui restent vives lavage après lavage."
      heroBullets={[
        'Tissus respirants (sport, polyester technique) pour les journées chaudes',
        'Polos pour rencontres clients et soumissions sur place',
        'Casquettes brodées contre le soleil — protège l\u2019équipe et affiche la marque',
        'Saison printemps-été couverte avec couleurs vives résistantes aux UV',
        'Renouvellement annuel facile — historique de commande sauvegardé',
      ]}
      ctaLabel="Personnaliser pour mon équipe paysagement"
      productsHeading="Vêtements recommandés pour le paysagement"
      productsSubcopy="Notre sélection pour les paysagistes — léger, respirant, et conçu pour résister aux taches de gazon et de terre."
      productSkus={['S350', 'ATC1000', 'S445', 'ATC6606']}
      faqHeading="Questions fréquentes — Paysagement"
      faq={[
        {
          q: "Quels tissus recommandez-vous pour les journées chaudes en paysagement ?",
          a: "Nos t-shirts sport (S350, L350) en polyester technique évacuent rapidement la transpiration et sèchent plus vite que le coton — idéal pour les longues journées de tonte ou de plantation. Pour un look plus professionnel lors des rencontres clients, le polo S445 en polycoton offre le bon compromis entre confort et apparence soignée.",
        },
        {
          q: "Mon logo restera-t-il visible après plusieurs lavages ?",
          a: "Oui. Pour les vêtements de paysagement, nous recommandons la broderie ou l'impression DTF haute durabilité — les deux résistent à plus de 50 lavages industriels sans craqueler ni se décolorer. Les couleurs vives (vert, jaune, orange sécurité) que les paysagistes privilégient sont disponibles dans nos encres pigmentées garanties UV-stables.",
        },
        {
          q: "Pouvez-vous habiller toute mon équipe avec différentes tailles et coupes ?",
          a: "Bien sûr. Une même commande peut mélanger tailles (S à 4XL), coupes hommes/femmes/enfants, et même différents modèles (t-shirt + polo + casquette) tout en gardant le même tarif unitaire global. Vous indiquez la répartition au moment de la soumission, nous adaptons la production.",
        },
        {
          q: "Offrez-vous une couleur sécurité haute visibilité pour le travail près de la route ?",
          a: "Pour les zones de travail près des routes, nous suggérons nos t-shirts en orange vif ou jaune sécurité (couleurs disponibles sur la plupart des modèles ATC). Si vous avez besoin de vêtements certifiés CSA Z96 (rétroréfléchissants), contactez-nous — nous pouvons les approvisionner via nos partenaires et y appliquer votre logo.",
        },
      ]}
      serviceType="Vêtements personnalisés pour compagnies de paysagement"
      faqLdMarker="data-faq-paysagement-ld"
      serviceLdMarker="data-service-paysagement-ld"
    />
  );
}
