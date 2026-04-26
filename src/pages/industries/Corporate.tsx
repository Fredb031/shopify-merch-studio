import { IndustryPageShell } from '@/components/industries/IndustryPageShell';

/**
 * Mega Blueprint §08.3 — Corporate landing page. Targets
 * "vêtements corporate personnalisés", "polos entreprise brodés",
 * "événement corporatif uniformes". Pushes polos + premium tees +
 * crewnecks for the office/conference crowd, not workwear basics.
 */
export default function Corporate() {
  return (
    <IndustryPageShell
      title="Vêtements corporate personnalisés pour entreprises | Québec"
      metaDescription="Polos brodés, t-shirts premium et hoodies à votre identité corporative. Cadeaux d'employés, événements d'entreprise, kits d'embauche — production locale au Québec."
      eyebrow="Corporate · Québec"
      heroLede="Vision Affichage produit des vêtements corporatifs élégants pour les entreprises québécoises — polos brodés pour les équipes de vente, t-shirts premium pour les événements, hoodies pour les kits de bienvenue. Une identité visuelle cohérente, du conseil-soumission à la livraison emballée par taille."
      heroBullets={[
        'Polos professionnels pour équipes de vente, service-conseil et ressources humaines',
        'T-shirts premium WERK250 pour événements corporatifs et lancements de marque',
        'Kits d\u2019embauche complets (hoodie + t-shirt + casquette + tuque)',
        'Broderie haute densité pour un rendu impeccable sur les couleurs sombres',
        'Livraison emballée par taille / par employé — prêt à distribuer',
      ]}
      ctaLabel="Obtenir une soumission pour mon équipe corporate"
      productsHeading="Vêtements recommandés pour le corporate"
      productsSubcopy="Notre sélection pour les entreprises — coupes ajustées, tissus haut de gamme, finition broderie qui projette le bon niveau d'image de marque."
      productSkus={['S445', 'WERK250', 'ATCF2500', 'L445']}
      faqHeading="Questions fréquentes — Corporate"
      faq={[
        {
          q: "Pouvez-vous gérer un kit d'embauche pour chaque nouvel employé ?",
          a: "Oui. Nous montons des kits standardisés (par exemple : 1 polo + 1 hoodie + 1 t-shirt + 1 tuque, tous brodés au logo) que nous emballons individuellement par employé avec leur nom et taille. Vous nous transmettez la liste mise à jour chaque mois ou trimestre, nous gérons le ré-approvisionnement et la livraison à votre bureau ou directement à l'employé en télétravail.",
        },
        {
          q: "Pouvez-vous matcher exactement notre code couleur Pantone corporatif ?",
          a: "Oui. Pour les commandes en sérigraphie ou broderie, nous matchons votre code Pantone (PMS) exact à partir d'un échantillon ou d'une charte graphique. Un petit frais de mise en couleur peut s'appliquer sur les très petites séries (moins de 12 pièces). Pour des couleurs spécifiques au tissu, nous travaillons avec nos fournisseurs SanMar/ATC qui offrent une large gamme de teintes corporate sans surcoût.",
        },
        {
          q: "Avez-vous un compte corporatif ou de la facturation à 30 jours ?",
          a: "Pour les commandes récurrentes ou un volume annuel garanti, nous offrons des comptes corporatifs avec termes de paiement Net 30 (sur approbation de crédit). Cela simplifie la gestion comptable des renouvellements d'uniformes ou des commandes événementielles à plusieurs reprises dans l'année. Demandez le formulaire à votre conseiller lors de la première soumission.",
        },
        {
          q: "Délais pour un événement corporatif (gala, lancement, salon) ?",
          a: "Notre délai standard est de 5 jours ouvrables après approbation de la preuve. Pour un événement avec date fixe, nous recommandons d'envoyer la soumission au moins 3 semaines à l'avance — cela laisse une marge confortable pour les ajustements (changement de design, ajout de tailles). Pour les urgences, nous pouvons livrer en 48-72h selon la disponibilité du stock SanMar.",
        },
      ]}
      serviceType="Vêtements corporate personnalisés pour entreprises"
      faqLdMarker="data-faq-corporate-ld"
      serviceLdMarker="data-service-corporate-ld"
    />
  );
}
