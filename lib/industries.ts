import type { Industry } from './types';

export const industries: Industry[] = [
  {
    slug: 'construction',
    name: { 'fr-ca': 'Construction', 'en-ca': 'Construction' },
    shortDescription: {
      'fr-ca': "Vêtements résistants brodés à l'avant et au dos.",
      'en-ca': 'Tough apparel embroidered front and back.',
    },
    pitch: {
      'fr-ca':
        "Sur les chantiers québécois, votre logo doit tenir cinq ans, pas cinq lavages. Nous brodons sur des tissus pensés pour le froid, la poussière et la sueur.",
      'en-ca':
        'On Quebec job sites, your logo has to last five years, not five washes. We embroider on fabrics built for cold, dust, and sweat.',
    },
    hookLine: {
      'fr-ca': 'Logo qui tient cinq hivers.',
      'en-ca': 'Logos that survive five winters.',
    },
    keyProducts: ['ATC1015', 'ATCF2400', 'ATC1000', 'ATC6606'],
    hookHeroLine: {
      'fr-ca':
        "Des uniformes qui tiennent le coup sur les chantiers québécois",
      'en-ca':
        'Uniforms that hold up on Quebec construction sites',
    },
    painPoint: {
      'fr-ca':
        "Tu connais le drill : 6 mois sur le chantier, et un t-shirt cheap est usé. On utilise du 6,1 oz minimum, du 13 oz pour les hoodies. Tissu costaud, broderie qui tient au lavage industriel.",
      'en-ca':
        "You know the drill: 6 months on a job site, and a cheap t-shirt is shot. We use 6.1 oz minimum, 13 oz for hoodies. Heavy fabric, embroidery that holds up to industrial wash.",
    },
    productJustifications: {
      ATC1015: {
        'fr-ca': "Manches longues pour la protection bras + soleil.",
        'en-ca': 'Long sleeves for arm protection plus sun coverage.',
      },
      ATCF2400: {
        'fr-ca':
          "Chaud sans le poids du hoodie, parfait sous la veste haute-vis.",
        'en-ca':
          'Warm without the bulk of a hoodie — perfect under a hi-vis jacket.',
      },
      ATC1000: {
        'fr-ca': "Le t-shirt de base 9,1 oz, pas le 4,5 oz qu'on voit ailleurs.",
        'en-ca': "The 9.1 oz base tee — not the 4.5 oz one you see elsewhere.",
      },
      ATC6606: {
        'fr-ca': "Casquette structurée — résiste à 200+ lavages.",
        'en-ca': 'Structured cap — survives 200+ washes.',
      },
    },
    caseStudy: {
      client: 'Construction Rivard',
      result: {
        'fr-ca':
          "300 t-shirts brodés livrés en 4 jours pour le démarrage du projet Saint-Eustache. Aucun retour qualité depuis 18 mois.",
        'en-ca':
          '300 embroidered t-shirts delivered in 4 days for the Saint-Eustache project kickoff. Zero quality returns in 18 months.',
      },
    },
    proofPoint: {
      'fr-ca': '200+ équipes de construction habillées au Québec',
      'en-ca': '200+ Quebec construction crews outfitted',
    },
    industryFaq: [
      {
        question: {
          'fr-ca': 'Quel poids de tissu recommandez-vous pour le chantier ?',
          'en-ca': 'What fabric weight do you recommend for job sites?',
        },
        answer: {
          'fr-ca':
            "On part à 6,1 oz minimum pour les t-shirts (vs 4,5 oz cheap), 9,1 oz pour les heavy duty, et 13 oz pour les hoodies. Le tissu encaisse les outils, les clous et la sueur sans se déchirer après un mois.",
          'en-ca':
            'We start at 6.1 oz minimum for t-shirts (vs 4.5 oz cheap stuff), 9.1 oz for heavy duty, and 13 oz for hoodies. The fabric handles tools, nails, and sweat without tearing in a month.',
        },
      },
      {
        question: {
          'fr-ca': 'Combien de temps tient la broderie en milieu chantier ?',
          'en-ca': 'How long does embroidery last on a job site?',
        },
        answer: {
          'fr-ca':
            "Notre broderie tient cinq hivers en moyenne sur tissu robuste, même avec lavage industriel. La sérigraphie cheap craque au 20e cycle ; on évite.",
          'en-ca':
            'Our embroidery averages five winters on heavy fabric, even with industrial wash. Cheap screen printing cracks by the 20th cycle — we avoid it.',
        },
      },
      {
        question: {
          'fr-ca': 'Comment commander pour 50 employés ou plus ?',
          'en-ca': 'How do I order for 50+ employees?',
        },
        answer: {
          'fr-ca':
            "Demande une soumission avec ton fichier logo + le décompte par taille. On te retourne un devis en 24 h ouvrables, production en 5 jours après approbation de la maquette.",
          'en-ca':
            'Request a quote with your logo file plus a size breakdown. We come back in 24 business hours, production in 5 days after artwork approval.',
        },
      },
    ],
  },
  {
    slug: 'paysagement',
    name: { 'fr-ca': 'Paysagement', 'en-ca': 'Landscaping' },
    shortDescription: {
      'fr-ca': "T-shirts d'été, ouates de printemps et automne.",
      'en-ca': 'Summer tees, spring and fall hoodies.',
    },
    pitch: {
      'fr-ca':
        "Vos équipes de paysagement passent de 5°C à 28°C dans la même journée. On vous bâtit un système d'uniforme par couches qui suit la saison.",
      'en-ca':
        'Your landscaping crews go from 5°C to 28°C in a single day. We build a layered uniform system that follows the season.',
    },
    hookLine: {
      'fr-ca': "Système d'uniforme par couches.",
      'en-ca': 'Layered uniform system.',
    },
    keyProducts: ['ATC1000', 'ATC6606', 'C105', 'L445'],
    hookHeroLine: {
      'fr-ca':
        "Vêtements respirants pour les longues journées d'été — visibles de loin",
      'en-ca':
        'Breathable apparel for long summer days — visible from a distance',
    },
    painPoint: {
      'fr-ca':
        "Sous le soleil 8 h par jour, ton équipe a besoin de tissus respirants ET de visibilité. On a les options haute-visibilité + tissus performance pour que tes gars ne crèvent pas de chaleur.",
      'en-ca':
        "Under the sun 8 hours a day, your crew needs breathable fabrics AND visibility. We have hi-vis options and performance fabrics so your team doesn't melt.",
    },
    productJustifications: {
      ATC1000: {
        'fr-ca': "T-shirt léger 4,3 oz performance — respire sous le soleil.",
        'en-ca': 'Light 4.3 oz performance tee — breathes in the sun.',
      },
      ATC6606: {
        'fr-ca': "Casquette pour bloquer le soleil sans étouffer.",
        'en-ca': 'Cap that blocks the sun without trapping heat.',
      },
      C105: {
        'fr-ca': "Tuque pour les matins frais d'avril et octobre.",
        'en-ca': 'Beanie for cool April and October mornings.',
      },
      L445: {
        'fr-ca': "Polo pour les rendez-vous client — image pro instantanée.",
        'en-ca': 'Polo for client meetings — instant pro image.',
      },
    },
    caseStudy: {
      client: 'Paysagement Verdure QC',
      result: {
        'fr-ca':
          '180 polos + casquettes brodés. Délai 5 jours sans heures supplémentaires.',
        'en-ca':
          '180 embroidered polos plus caps. 5-day turnaround with no overtime needed.',
      },
    },
    proofPoint: {
      'fr-ca': 'Spécialistes des uniformes haute-visibilité au Québec',
      'en-ca': 'Quebec specialists in hi-vis uniforms',
    },
    industryFaq: [
      {
        question: {
          'fr-ca': 'Avez-vous des options haute-visibilité ?',
          'en-ca': 'Do you offer hi-vis options?',
        },
        answer: {
          'fr-ca':
            "Oui — t-shirts et polos haute-vis jaune ou orange, conformes ANSI. On peut broder ou sérigraphier ton logo sans perdre la classe de visibilité.",
          'en-ca':
            'Yes — hi-vis tees and polos in yellow or orange, ANSI-compliant. We can embroider or screen-print your logo without losing the visibility rating.',
        },
      },
      {
        question: {
          'fr-ca': 'Quel tissu pour la chaleur estivale ?',
          'en-ca': 'Which fabric for summer heat?',
        },
        answer: {
          'fr-ca':
            "Polyester performance 4,3 oz qui évacue la sueur. On évite le coton 100 % qui devient lourd et reste mouillé toute la journée.",
          'en-ca':
            'Performance polyester at 4.3 oz that wicks sweat. We skip 100% cotton — it gets heavy and stays wet all day.',
        },
      },
      {
        question: {
          'fr-ca': 'Pouvez-vous bâtir un kit saisonnier complet ?',
          'en-ca': 'Can you build a complete seasonal kit?',
        },
        answer: {
          'fr-ca':
            "Oui : t-shirt léger pour juillet, polo client, ouate intermédiaire pour septembre, tuque pour les matins frais. Un seul fournisseur, un look cohérent du printemps à l'automne.",
          'en-ca':
            'Yes: light tee for July, client polo, mid-weight hoodie for September, beanie for cool mornings. One supplier, one consistent look from spring to fall.',
        },
      },
    ],
  },
  {
    slug: 'restauration',
    name: { 'fr-ca': 'Restauration', 'en-ca': 'Restaurants' },
    shortDescription: {
      'fr-ca': 'Service en salle reconnaissable, cuisine pratique.',
      'en-ca': 'Recognizable front-of-house, practical kitchen.',
    },
    pitch: {
      'fr-ca':
        "Polo brodé pour la salle, t-shirt sérigraphié pour la cuisine, tablier pour les barristas. On orchestre un look cohérent du bar à la terrasse.",
      'en-ca':
        'Embroidered polo for service, screen-printed tee for the kitchen, apron for the bar. A coherent look from counter to patio.',
    },
    hookLine: {
      'fr-ca': 'Du bar à la terrasse.',
      'en-ca': 'From counter to patio.',
    },
    keyProducts: ['L445', 'S445LS', 'ATC6606'],
    hookHeroLine: {
      'fr-ca': 'Polos et chemises qui supportent service après service',
      'en-ca': 'Polos and shirts that hold up shift after shift',
    },
    painPoint: {
      'fr-ca':
        "Un uniforme de salle subit 5 lavages/semaine. La broderie tient ; la sérigraphie cheap part au 20e cycle. On le sait — et on choisit la décoration en conséquence.",
      'en-ca':
        "A front-of-house uniform takes 5 washes a week. Embroidery holds; cheap screen printing peels by the 20th cycle. We know — and we pick decoration accordingly.",
    },
    productJustifications: {
      L445: {
        'fr-ca': "Polo coupe femme — tombe bien sans rentrer dans les pourboires.",
        'en-ca': "Women's-cut polo — flatters without getting in the way of tips.",
      },
      S445LS: {
        'fr-ca': "Polo manches longues — pour les saisons fraîches en salle.",
        'en-ca': 'Long-sleeve polo — for cooler seasons on the floor.',
      },
      ATC6606: {
        'fr-ca': "Casquette pour la cuisine — cheveux contenus, look propre.",
        'en-ca': 'Cap for the kitchen — hair contained, clean look.',
      },
    },
    caseStudy: {
      client: 'Café Bonté',
      result: {
        'fr-ca': '85 polos brodés pour 4 emplacements, livrés en 5 jours.',
        'en-ca': '85 embroidered polos across 4 locations, delivered in 5 days.',
      },
    },
    proofPoint: {
      'fr-ca':
        'Cafés, restaurants, traiteurs — broderie résistante au lavage industriel',
      'en-ca':
        'Cafés, restaurants, caterers — embroidery built for industrial wash',
    },
    industryFaq: [
      {
        question: {
          'fr-ca': 'La broderie résiste-t-elle au lavage commercial ?',
          'en-ca': 'Does embroidery hold up to commercial wash?',
        },
        answer: {
          'fr-ca':
            "Oui, sur tissu de qualité. On utilise des fils polyester haute densité qui passent 200+ cycles sans s'effilocher. La sérigraphie cheap, elle, craque au 20e lavage — on ne l'utilise pas pour la salle.",
          'en-ca':
            'Yes, on quality fabric. We use high-density polyester threads that survive 200+ cycles without fraying. Cheap screen printing cracks by wash 20 — we never use it for front-of-house.',
        },
      },
      {
        question: {
          'fr-ca': 'Avez-vous des coupes femme ?',
          'en-ca': 'Do you offer women\'s cuts?',
        },
        answer: {
          'fr-ca':
            "Oui — polos en coupe femme L445 + manches longues. Tailles XS à 4XL, pour que toute l'équipe ait un uniforme qui tombe bien.",
          'en-ca':
            "Yes — L445 women's-cut polos plus long-sleeve options. Sizes XS to 4XL so the whole team has a uniform that fits.",
        },
      },
      {
        question: {
          'fr-ca': 'Pouvez-vous gérer plusieurs emplacements ?',
          'en-ca': 'Can you handle multiple locations?',
        },
        answer: {
          'fr-ca':
            "Oui. On segmente la commande par emplacement, taille, et nom d'employé si tu veux. Une livraison ou plusieurs — comme tu préfères.",
          'en-ca':
            'Yes. We segment orders by location, size, and employee name if you want. One delivery or several — your call.',
        },
      },
    ],
  },
  {
    slug: 'demenagement',
    name: { 'fr-ca': 'Déménagement', 'en-ca': 'Moving services' },
    shortDescription: {
      'fr-ca': 'Visibilité dans la rue, confort dans le camion.',
      'en-ca': 'Street visibility, comfort in the cab.',
    },
    pitch: {
      'fr-ca':
        "Vos déménageurs sont vos panneaux publicitaires mobiles. Logo dorsal grand format, polo identifiant le chef d'équipe, casquette pour terminer.",
      'en-ca':
        'Your movers are your rolling billboards. Large back logos, polo for the lead, cap to finish the look.',
    },
    hookLine: {
      'fr-ca': 'Panneaux publicitaires mobiles.',
      'en-ca': 'Rolling billboards.',
    },
    keyProducts: ['ATC1000', 'ATCF2500', 'WERK250', 'ATC6606'],
    hookHeroLine: {
      'fr-ca':
        'Uniformes robustes pour équipes mobiles, identification claire',
      'en-ca':
        'Tough uniforms for mobile crews, clear identification',
    },
    painPoint: {
      'fr-ca':
        "Quand ton équipe arrive chez le client, l'uniforme parle avant la poignée de main. Robuste = essentiel : meubles lourds, escaliers serrés, frottements constants.",
      'en-ca':
        "When your crew shows up at the customer's door, the uniform speaks before the handshake. Tough is essential: heavy furniture, tight stairs, constant rub.",
    },
    productJustifications: {
      ATC1000: {
        'fr-ca': "T-shirt costaud 9,1 oz — survit aux frottements de meubles.",
        'en-ca': 'Heavy 9.1 oz tee — survives the rub of moving furniture.',
      },
      ATCF2500: {
        'fr-ca':
          "Hoodie chaud pour les déménagements hivernaux — capuchon utile.",
        'en-ca': 'Warm hoodie for winter moves — the hood actually earns its keep.',
      },
      WERK250: {
        'fr-ca':
          "Veste de travail — chaud, identifiable, prend les coups sans broncher.",
        'en-ca':
          'Work jacket — warm, identifiable, shrugs off the knocks.',
      },
      ATC6606: {
        'fr-ca':
          "Casquette pour compléter l'uniforme — équipe reconnaissable de loin.",
        'en-ca':
          'Cap to round out the uniform — crew recognizable from down the block.',
      },
    },
    caseStudy: {
      client: 'Déménagement Express MTL',
      result: {
        'fr-ca':
          '55 t-shirts + hoodies brodés. Reorder 2x/an depuis 2022.',
        'en-ca':
          '55 embroidered tees and hoodies. Reorders twice a year since 2022.',
      },
    },
    proofPoint: {
      'fr-ca':
        'Déménageurs, transporteurs, livraisons — uniformes haute durabilité',
      'en-ca':
        'Movers, transporters, delivery crews — high-durability uniforms',
    },
    industryFaq: [
      {
        question: {
          'fr-ca': 'Le logo dorsal grand format est-il possible ?',
          'en-ca': 'Can you do large back logos?',
        },
        answer: {
          'fr-ca':
            "Oui — broderie ou sérigraphie jusqu'à 12 x 14 pouces dans le dos. Visible de l'autre côté de la rue, c'est ce qu'on vise pour les équipes mobiles.",
          'en-ca':
            'Yes — embroidery or screen printing up to 12 x 14 inches on the back. Visible from across the street, which is the point for mobile crews.',
        },
      },
      {
        question: {
          'fr-ca': 'Avez-vous des uniformes pour le froid hivernal ?',
          'en-ca': 'Do you have uniforms for winter cold?',
        },
        answer: {
          'fr-ca':
            "Oui — hoodies 13 oz, vestes de travail isolées, tuques. Couches qui restent propres après une journée de déménagement.",
          'en-ca':
            'Yes — 13 oz hoodies, insulated work jackets, beanies. Layers that stay clean after a day of moves.',
        },
      },
      {
        question: {
          'fr-ca': 'Délai pour reorder rapide ?',
          'en-ca': 'Turnaround for a fast reorder?',
        },
        answer: {
          'fr-ca':
            "Si on a déjà ton fichier broderie en banque, 5 jours ouvrables après confirmation. Pas besoin de re-monter la maquette.",
          'en-ca':
            "If we already have your embroidery file on record, 5 business days after confirmation. No need to remake the artwork.",
        },
      },
    ],
  },
  {
    slug: 'metiers',
    name: { 'fr-ca': 'Métiers spécialisés', 'en-ca': 'Skilled trades' },
    shortDescription: {
      'fr-ca': 'Plombiers, électriciens, mécaniciens.',
      'en-ca': 'Plumbers, electricians, mechanics.',
    },
    pitch: {
      'fr-ca':
        "Le client vous voit sortir de la camionnette. Une chemise de travail brodée et propre dit « professionnel sérieux » avant que vous parliez.",
      'en-ca':
        'Customers see you step out of the truck. A clean embroidered workshirt says "serious professional" before you speak.',
    },
    hookLine: {
      'fr-ca': "Pro avant d'avoir parlé.",
      'en-ca': 'Pro before you speak.',
    },
    keyProducts: ['ATC1015', 'ATCF2400', 'L445', 'ATC6606'],
    hookHeroLine: {
      'fr-ca':
        'Plombiers, électriciens, mécaniciens : uniformes professionnels qui en disent long',
      'en-ca':
        'Plumbers, electricians, mechanics: pro uniforms that speak first',
    },
    painPoint: {
      'fr-ca':
        "Tu fais du service à domicile. L'uniforme rassure. Le bon tissu + le bon logo = +30 % de rappel client (notre stat interne, basée sur nos clients).",
      'en-ca':
        "You do home service. The uniform reassures. The right fabric plus the right logo equals +30% customer recall (our internal stat, based on our customers).",
    },
    productJustifications: {
      ATC1015: {
        'fr-ca':
          "Manches longues — protection bras et image plus pro qu'un t-shirt.",
        'en-ca':
          'Long sleeves — arm protection plus a more polished look than a tee.',
      },
      ATCF2400: {
        'fr-ca':
          "Crewneck pour les matins frais — pas trop décontracté, parfait pour le service.",
        'en-ca':
          'Crewneck for cool mornings — not too casual, just right for service work.',
      },
      L445: {
        'fr-ca':
          "Polo pour les rencontres bureau ou estimés — niveau d'image au-dessus.",
        'en-ca':
          'Polo for office visits or estimates — bumps the image up a notch.',
      },
      ATC6606: {
        'fr-ca':
          "Casquette brodée — touche finale qui identifie l'entreprise.",
        'en-ca':
          'Embroidered cap — the finishing touch that names the company.',
      },
    },
    caseStudy: {
      client: 'Plomberie & Électricité Tremblay',
      result: {
        'fr-ca':
          '40 polos + hoodies brodés pour 3 succursales. Confiance client mesurable.',
        'en-ca':
          '40 embroidered polos and hoodies across 3 branches. Measurable lift in customer confidence.',
      },
    },
    proofPoint: {
      'fr-ca':
        'Métiers techniques — broderie, sérigraphie, livraison rapide',
      'en-ca':
        'Skilled trades — embroidery, screen printing, fast delivery',
    },
    industryFaq: [
      {
        question: {
          'fr-ca': 'Pouvez-vous broder le nom de chaque employé ?',
          'en-ca': 'Can you embroider each employee\'s name?',
        },
        answer: {
          'fr-ca':
            "Oui — nom + titre brodés au-dessus du cœur, en plus du logo entreprise. Une seule commande, plusieurs noms, livraison étiquetée par employé si tu veux.",
          'en-ca':
            "Yes — name plus title embroidered above the chest, alongside the company logo. One order, multiple names, delivery tagged per employee if you'd like.",
        },
      },
      {
        question: {
          'fr-ca': "Quel tissu résiste à l'huile et aux taches techniques ?",
          'en-ca': 'Which fabric handles grease and technical stains?',
        },
        answer: {
          'fr-ca':
            "Polyester ou mélanges techniques foncés — bleu marine, charcoal, noir. Les couleurs cachent les taches d'huile, le polyester se nettoie mieux que le coton 100 %.",
          'en-ca':
            'Polyester or technical blends in dark colors — navy, charcoal, black. The colors hide grease, and polyester cleans up better than 100% cotton.',
        },
      },
      {
        question: {
          'fr-ca': 'Délai pour un seul employé qui démarre ?',
          'en-ca': 'Turnaround for a single new hire?',
        },
        answer: {
          'fr-ca':
            "5 jours ouvrables même pour 3-5 pièces, si on a déjà ton fichier. Pour un démarrage isolé, on s'arrange.",
          'en-ca':
            '5 business days even for 3-5 pieces if we already have your file. For a one-off new hire, we work it out.',
        },
      },
    ],
  },
  {
    slug: 'bureau',
    name: { 'fr-ca': 'Bureau et corporatif', 'en-ca': 'Office and corporate' },
    shortDescription: {
      'fr-ca': 'Réception, ventes, équipes événementielles.',
      'en-ca': 'Front desk, sales, event teams.',
    },
    pitch: {
      'fr-ca':
        "Polo et chemise brodés, ton sobre, qualité durable. L'image cohérente d'une PME qui se prend au sérieux.",
      'en-ca':
        'Embroidered polos and shirts, restrained tones, durable quality. The consistent look of an SMB that takes itself seriously.',
    },
    hookLine: {
      'fr-ca': 'Une PME qui se prend au sérieux.',
      'en-ca': 'An SMB that means business.',
    },
    keyProducts: ['L445', 'S445LS', 'ATCF2500', 'ATC1000Y'],
    hookHeroLine: {
      'fr-ca':
        "Vêtements corporatifs polyvalents : du bureau à l'événement client",
      'en-ca':
        'Versatile corporate apparel: from the office to the client event',
    },
    painPoint: {
      'fr-ca':
        "Pour les équipes mixtes au bureau, le polo broderie reste la référence. Mais il faut respecter les coupes femme + les tailles 2XL+. On a les deux.",
      'en-ca':
        "For mixed office teams, the embroidered polo is still the reference. But you need women's cuts plus 2XL+ sizes. We have both.",
    },
    productJustifications: {
      L445: {
        'fr-ca':
          "Polo coupe femme — tombe bien, image pro pour la réception et le client.",
        'en-ca':
          "Women's-cut polo — flatters and reads pro for reception and clients.",
      },
      S445LS: {
        'fr-ca':
          "Polo manches longues unisexe — option plus sobre pour les rencontres formelles.",
        'en-ca':
          'Unisex long-sleeve polo — a more restrained option for formal meetings.',
      },
      ATCF2500: {
        'fr-ca':
          "Hoodie pour les Fridays casual — confort sans casser l'identité de marque.",
        'en-ca':
          "Hoodie for casual Fridays — comfort without breaking the brand identity.",
      },
      ATC1000Y: {
        'fr-ca':
          "Jeunesse pour les enfants des employés ou les événements famille.",
        'en-ca':
          'Youth size for employees\' kids or family events.',
      },
    },
    caseStudy: {
      client: 'Cabinet Lafleur Conseil',
      result: {
        'fr-ca':
          '60 polos + 12 hoodies brodés pour le team building annuel + uniforme accueil client.',
        'en-ca':
          '60 embroidered polos and 12 hoodies for the annual team-building event plus client-facing uniform.',
      },
    },
    proofPoint: {
      'fr-ca':
        "Bureau, conseil, services pro — uniformes qui scalent avec ton équipe",
      'en-ca':
        'Office, consulting, professional services — uniforms that scale with your team',
    },
    industryFaq: [
      {
        question: {
          'fr-ca': 'Avez-vous des coupes femme et des tailles plus ?',
          'en-ca': 'Do you offer women\'s cuts and plus sizes?',
        },
        answer: {
          'fr-ca':
            "Oui — coupes femme dédiées et tailles XS à 4XL sur la majorité des polos et hoodies. Une seule commande pour toute l'équipe, peu importe la morphologie.",
          'en-ca':
            "Yes — dedicated women's cuts and sizes XS to 4XL across most polos and hoodies. One order for the whole team, regardless of build.",
        },
      },
      {
        question: {
          'fr-ca': 'Pouvez-vous livrer en plusieurs vagues pour un grand bureau ?',
          'en-ca': 'Can you deliver in waves for a larger office?',
        },
        answer: {
          'fr-ca':
            "Oui — production en lot, livraisons fractionnées par étage, équipe ou événement. Frais de livraison ajustés.",
          'en-ca':
            'Yes — batch production with phased deliveries by floor, team, or event. Shipping adjusted accordingly.',
        },
      },
      {
        question: {
          'fr-ca': "Avez-vous une option pour les événements clients ponctuels ?",
          'en-ca': 'Do you have an option for one-off client events?',
        },
        answer: {
          'fr-ca':
            "Oui — petits volumes (10-30 pièces) avec broderie ou sérigraphie selon le délai. On a déjà fait des kits événements en 5 jours.",
          'en-ca':
            "Yes — small runs (10-30 pieces) with embroidery or screen printing depending on the deadline. We've turned around event kits in 5 days.",
        },
      },
    ],
  },
];
