import type { Product } from './products';

type Category = Product['category'];

interface Description {
  tagline: { fr: string; en: string };
  paragraphs: { fr: string[]; en: string[] };
  features: { fr: string[]; en: string[] };
  useCase: { fr: string; en: string };
}

export const CATEGORY_DESCRIPTIONS: Record<Category, Description> = {
  tshirt: {
    tagline: {
      fr: "Le classique qui porte ta marque sans la cacher.",
      en: "The classic that carries your brand without hiding it.",
    },
    paragraphs: {
      fr: [
        "Un t-shirt pensé pour durer : coupe unisexe équilibrée, tissu doux qui tombe bien dès la première mise, couture solide pour résister aux lavages en entreprise.",
        "On l'imprime localement au Québec en 5 jours ouvrables — ton logo net, tes couleurs justes, zéro surprise à la livraison.",
      ],
      en: [
        "A t-shirt built to last: balanced unisex cut, soft fabric that sits right from day one, solid seams that survive corporate laundry cycles.",
        "Printed locally in Québec in 5 business days — your logo sharp, your colors true, zero surprises at delivery.",
      ],
    },
    features: {
      fr: [
        "Coupe unisexe, confort prêt-à-porter",
        "Impression haute résolution DTG ou sérigraphie",
        "Compatible cols ronds ou en V selon modèle",
        "Ourlet renforcé, résistant au lavage",
      ],
      en: [
        "Unisex cut, ready-to-wear comfort",
        "High-resolution DTG or screen-print",
        "Crew or V-neck depending on model",
        "Reinforced hem, wash-resistant",
      ],
    },
    useCase: {
      fr: "Parfait pour événements corporatifs, uniformes d'équipe, merch d'entreprise ou cadeaux clients.",
      en: "Perfect for corporate events, team uniforms, company merch or client gifts.",
    },
  },

  hoodie: {
    tagline: {
      fr: "Le hoodie qu'on garde pour les bonnes raisons.",
      en: "The hoodie people actually keep.",
    },
    paragraphs: {
      fr: [
        "Molleton épais, doublure brossée, capuche généreuse avec cordons ajustables et poche kangourou renforcée. Une coupe unisexe qui se porte aussi bien au bureau qu'en semaine off.",
        "Impression premium de ton logo — devant, dos, manche, l'endroit que tu veux. Fabriqué au Québec et livré en 5 jours ouvrables.",
      ],
      en: [
        "Thick fleece, brushed lining, generous hood with adjustable drawstrings and reinforced kangaroo pocket. Unisex fit that works at the office or on weekends.",
        "Premium print of your logo — front, back, sleeve, wherever you want. Made in Québec, delivered in 5 business days.",
      ],
    },
    features: {
      fr: [
        "Molleton 300+ g/m² pour un confort longue durée",
        "Capuche doublée, cordons métalliques",
        "Poche kangourou avec ourlet caché",
        "Poignets et taille côtelés qui tiennent",
      ],
      en: [
        "300+ g/m² fleece for long-lasting comfort",
        "Lined hood, metal drawstrings",
        "Kangaroo pocket with hidden hem",
        "Ribbed cuffs and waistband that hold shape",
      ],
    },
    useCase: {
      fr: "Idéal pour équipes en télétravail, événements d'hiver, programmes de fidélité client ou kits d'accueil employés.",
      en: "Ideal for remote teams, winter events, client loyalty programs or employee onboarding kits.",
    },
  },

  crewneck: {
    tagline: {
      fr: "Le sweat intemporel, coupe nette, logo qui brille.",
      en: "The timeless sweat, clean cut, logo that stands out.",
    },
    paragraphs: {
      fr: [
        "Col rond bien dessiné, coupe droite, molleton bouclé qui garde sa forme. Un vêtement qu'on enfile par-dessus une chemise ou sous une veste — il fait le travail dans les deux cas.",
        "Imprimé dans nos ateliers au Québec en 5 jours ouvrables. Ton logo reste net même après 50 lavages.",
      ],
      en: [
        "Well-cut crew neck, straight fit, looped fleece that keeps its shape. A piece you throw over a dress shirt or under a jacket — works both ways.",
        "Printed in our Québec workshop in 5 business days. Your logo stays sharp even after 50 washes.",
      ],
    },
    features: {
      fr: [
        "Col côtelé stable, pas de déformation",
        "Molleton intérieur bouclé, respirant",
        "Coupe unisexe, entre ajustée et relax",
        "Idéal pour sérigraphie grand format",
      ],
      en: [
        "Stable ribbed collar, no stretching",
        "Looped interior fleece, breathable",
        "Unisex fit, between tailored and relaxed",
        "Ideal for large-format screen print",
      ],
    },
    useCase: {
      fr: "Pour les équipes qui veulent du merch porté toute l'année, pas juste au party de Noël.",
      en: "For teams that want merch worn year-round, not just at the holiday party.",
    },
  },

  polo: {
    tagline: {
      fr: "Le polo sobre qui fait bien paraître ta marque.",
      en: "The understated polo that makes your brand look sharp.",
    },
    paragraphs: {
      fr: [
        "Col structuré, boutons nacrés, piqué qui résiste au service après-service. C'est le vêtement qu'on donne à l'équipe terrain, aux vendeurs, aux chefs de projet — là où l'uniforme doit être pro sans être rigide.",
        "Ton logo brodé ou imprimé, fabriqué au Québec, livré en 5 jours ouvrables.",
      ],
      en: [
        "Structured collar, pearl buttons, piqué that survives shift after shift. The garment you give to field teams, sales reps, project managers — wherever the uniform needs to be pro without being stiff.",
        "Your logo embroidered or printed, made in Québec, delivered in 5 business days.",
      ],
    },
    features: {
      fr: [
        "Tissu piqué respirant",
        "Patte 3 boutons, nacrée",
        "Col tissé qui garde sa forme",
        "Broderie ou impression selon la commande",
      ],
      en: [
        "Breathable piqué fabric",
        "3-button pearl placket",
        "Woven collar that holds shape",
        "Embroidery or print depending on order",
      ],
    },
    useCase: {
      fr: "Uniformes de service, événements corporatifs, tournois de golf, équipes de direction.",
      en: "Service uniforms, corporate events, golf tournaments, leadership teams.",
    },
  },

  longsleeve: {
    tagline: {
      fr: "Manches longues, logo affiché, couverture 3 saisons.",
      en: "Long sleeves, logo on display, 3-season coverage.",
    },
    paragraphs: {
      fr: [
        "La polyvalence d'un t-shirt avec la couverture d'une couche intermédiaire. Les manches longues donnent de l'espace pour faire passer ton branding sans surcharger le devant.",
        "Fabriqué au Québec, imprimé en 5 jours ouvrables, porté du printemps à l'automne.",
      ],
      en: [
        "The versatility of a t-shirt with the coverage of a mid-layer. Long sleeves give room to spread your branding without crowding the front.",
        "Made in Québec, printed in 5 business days, worn spring through fall.",
      ],
    },
    features: {
      fr: [
        "Coton-mélange qui respire",
        "Manchettes côtelées anti-remontée",
        "Impression manche possible (prix avantageux)",
        "Coupe unisexe balancée",
      ],
      en: [
        "Cotton-blend that breathes",
        "Ribbed cuffs, no ride-up",
        "Sleeve print option (favorable pricing)",
        "Balanced unisex fit",
      ],
    },
    useCase: {
      fr: "Équipes extérieures, événements en demi-saison, uniformes légers, couche de base polyvalente.",
      en: "Outdoor teams, shoulder-season events, light uniforms, versatile base layer.",
    },
  },

  sport: {
    tagline: {
      fr: "Performance-grade. Fait pour bouger avec ta marque.",
      en: "Performance-grade. Made to move with your brand.",
    },
    paragraphs: {
      fr: [
        "Tissu technique qui évacue l'humidité, coupe athlétique, coutures plates pour zéro irritation. C'est le vêtement pour les événements sportifs, les équipes actives, les courses de charité.",
        "Ton logo imprimé en transfert sublimation — la couleur devient partie du tissu, ne craque jamais.",
      ],
      en: [
        "Technical fabric that wicks moisture, athletic cut, flat-lock seams for zero chafing. The garment for sports events, active teams, charity runs.",
        "Your logo printed by sublimation transfer — the color becomes part of the fabric, never cracks.",
      ],
    },
    features: {
      fr: [
        "Polyester recyclé technique, anti-humidité",
        "Coutures plates, confort haute intensité",
        "Sublimation couleur pleine",
        "Coupe athlétique ajustée",
      ],
      en: [
        "Technical recycled polyester, moisture-wicking",
        "Flat-lock seams, high-intensity comfort",
        "Full-color sublimation",
        "Athletic fitted cut",
      ],
    },
    useCase: {
      fr: "Courses, tournois, équipes sportives corporatives, événements actifs.",
      en: "Races, tournaments, corporate sports teams, active events.",
    },
  },

  cap: {
    tagline: {
      fr: "La casquette qui devient le geste de ton équipe.",
      en: "The cap that becomes your team's signature.",
    },
    paragraphs: {
      fr: [
        "Structure devant, visière pré-formée, ajustement snapback ou sangle. Un accessoire qu'on voit à distance — ton logo devient un repère.",
        "Brodé ou imprimé, fabriqué au Québec, 5 jours ouvrables.",
      ],
      en: [
        "Structured front, pre-curved visor, snapback or strap closure. An accessory visible from distance — your logo becomes a landmark.",
        "Embroidered or printed, made in Québec, 5 business days.",
      ],
    },
    features: {
      fr: [
        "Structure avant mousse, tient sa forme",
        "Ajustement snapback ou bande Velcro",
        "Broderie 3D ou plate",
        "Choix 6 panneaux ou 5 panneaux trucker",
      ],
      en: [
        "Foam-structured front, holds shape",
        "Snapback or Velcro adjustment",
        "3D or flat embroidery",
        "6-panel or 5-panel trucker styles",
      ],
    },
    useCase: {
      fr: "Événements plein air, équipes terrain, cadeaux clients, goodies de conférence.",
      en: "Outdoor events, field teams, client gifts, conference goodies.",
    },
  },

  toque: {
    tagline: {
      fr: "La tuque qui vit bien au Québec — et fait voyager ta marque.",
      en: "The beanie that handles Québec winters — and carries your brand anywhere.",
    },
    paragraphs: {
      fr: [
        "Maille côtelée serrée, rebord doublé, coupe ajustée qui reste en place. Avec ou sans pompon.",
        "Ton logo brodé sur le rebord — le placement qu'on voit le plus longtemps en hiver. Fabriqué au Québec, 5 jours ouvrables.",
      ],
      en: [
        "Tight ribbed knit, double-folded cuff, snug fit that stays put. With or without pom.",
        "Your logo embroidered on the cuff — the placement seen most in winter. Made in Québec, 5 business days.",
      ],
    },
    features: {
      fr: [
        "Acrylique doux, non-irritant",
        "Doublure rebord pour confort front",
        "Broderie plate ou patch cousu",
        "Taille unique ajustable",
      ],
      en: [
        "Soft acrylic, non-itch",
        "Folded cuff lining for forehead comfort",
        "Flat embroidery or sewn patch",
        "One-size fit",
      ],
    },
    useCase: {
      fr: "Événements hivernaux, staff extérieur, cadeaux clients pour le temps des fêtes.",
      en: "Winter events, outdoor staff, holiday client gifts.",
    },
  },
};

export function getDescription(category: Category, lang: 'fr' | 'en' = 'fr') {
  const d = CATEGORY_DESCRIPTIONS[category];
  return {
    tagline: d.tagline[lang],
    paragraphs: d.paragraphs[lang],
    features: d.features[lang],
    useCase: d.useCase[lang],
  };
}
