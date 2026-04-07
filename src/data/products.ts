/**
 * products.ts — Catalogue complet Vision Affichage
 * Source: visionaffichage.com (catalogue vérifié 2026)
 *
 * Les couleurs sont chargées en temps réel via Shopify Storefront API
 * (useProductColors hook). Ces couleurs sont le fallback local.
 *
 * CDN: https://visionaffichage.com/cdn/shop/files/
 */

export type PrintZone = {
  id: string; label: string;
  x: number; y: number; width: number; height: number;
};

export type ProductColor = {
  id: string; name: string; hex: string;
  imageDevant?: string; imageDos?: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  shortName: string;
  category: 'tshirt' | 'hoodie' | 'crewneck' | 'polo' | 'longsleeve' | 'sport' | 'cap' | 'toque' | 'manteau';
  gender: 'unisex' | 'homme' | 'femme' | 'enfant';
  basePrice: number;
  imageDevant: string;
  imageDos: string;
  colors: ProductColor[];
  sizes: string[];
  printZones: PrintZone[];
  description: string;
  shopifyHandle: string;
  features: string[];
};

const CDN = 'https://visionaffichage.com/cdn/shop/files';

// ── Zones d'impression par catégorie ─────────────────────────────────────────
const SHIRT_ZONES: PrintZone[] = [
  { id: 'poitrine-centre', label: 'Centre poitrine',           x:32, y:24, width:36, height:26 },
  { id: 'coeur-gauche',    label: 'Cœur gauche (petit logo)',  x:16, y:25, width:18, height:14 },
  { id: 'dos-complet',     label: 'Dos complet (grand format)',x:20, y:16, width:60, height:48 },
  { id: 'dos-haut',        label: 'Haut du dos',               x:26, y:14, width:48, height:22 },
  { id: 'manche-gauche',   label: 'Manche gauche',             x: 3, y:29, width:13, height:16 },
  { id: 'manche-droite',   label: 'Manche droite',             x:84, y:29, width:13, height:16 },
];

const HOODIE_ZONES: PrintZone[] = [
  { id: 'poitrine-centre', label: 'Centre poitrine',           x:33, y:26, width:34, height:24 },
  { id: 'coeur-gauche',    label: 'Cœur gauche (petit logo)',  x:16, y:27, width:18, height:14 },
  { id: 'dos-complet',     label: 'Dos complet (grand format)',x:22, y:18, width:56, height:44 },
  { id: 'dos-haut',        label: 'Haut du dos',               x:28, y:16, width:44, height:20 },
  { id: 'manche-gauche',   label: 'Manche gauche',             x: 4, y:34, width:13, height:17 },
  { id: 'manche-droite',   label: 'Manche droite',             x:83, y:34, width:13, height:17 },
];

const CAP_ZONES: PrintZone[] = [
  { id: 'panneau-avant', label: 'Panneau avant (recommandé)', x:26, y:20, width:48, height:40 },
  { id: 'cote-gauche',   label: 'Côté gauche',                x: 6, y:26, width:20, height:30 },
];

const BEANIE_ZONES: PrintZone[] = [
  { id: 'face-avant', label: 'Face avant (recommandé)', x:26, y:22, width:48, height:38 },
];

// ── Palettes couleurs réelles (SanMar ATC) ───────────────────────────────────
const HOODIE_COLORS: ProductColor[] = [
  { id: 'black',         name: 'Black',          hex: '#1a1a1a' },
  { id: 'white',         name: 'White',          hex: '#f5f5f0' },
  { id: 'navy',          name: 'Navy',           hex: '#1B3A6B' },
  { id: 'steel-grey',    name: 'Steel Grey',     hex: '#717171' },
  { id: 'dark-heather',  name: 'Dark Heather',   hex: '#4a4a4a' },
  { id: 'red',           name: 'Red',            hex: '#b91c1c' },
  { id: 'true-royal',    name: 'True Royal',     hex: '#1d4ed8' },
  { id: 'forest-green',  name: 'Forest Green',   hex: '#14532d' },
  { id: 'burgundy',      name: 'Burgundy',       hex: '#7f1d1d' },
  { id: 'purple',        name: 'Purple',         hex: '#4c1d95' },
  { id: 'gold',          name: 'Gold',           hex: '#b45309' },
  { id: 'athletic-heather', name: 'Athletic Heather', hex: '#9ca3af' },
  { id: 'charcoal',      name: 'Charcoal',       hex: '#374151' },
  { id: 'military-green',name: 'Military Green', hex: '#3f4f2a' },
];

const TSHIRT_COLORS: ProductColor[] = [
  { id: 'black',         name: 'Black',          hex: '#1a1a1a' },
  { id: 'white',         name: 'White',          hex: '#f5f5f0' },
  { id: 'navy',          name: 'Navy',           hex: '#1B3A6B' },
  { id: 'steel-grey',    name: 'Steel Grey',     hex: '#717171' },
  { id: 'athletic-heather', name: 'Athletic Heather', hex: '#9ca3af' },
  { id: 'red',           name: 'Red',            hex: '#b91c1c' },
  { id: 'true-royal',    name: 'True Royal',     hex: '#1d4ed8' },
  { id: 'forest-green',  name: 'Forest Green',   hex: '#14532d' },
  { id: 'cardinal',      name: 'Cardinal',       hex: '#7f1d1d' },
  { id: 'gold',          name: 'Gold',           hex: '#b45309' },
  { id: 'charcoal',      name: 'Charcoal',       hex: '#374151' },
  { id: 'purple',        name: 'Purple',         hex: '#4c1d95' },
  { id: 'orange',        name: 'Orange',         hex: '#c2410c' },
];

const POLO_COLORS: ProductColor[] = [
  { id: 'black',        name: 'Black',       hex: '#1a1a1a' },
  { id: 'white',        name: 'White',       hex: '#f5f5f0' },
  { id: 'navy',         name: 'Navy',        hex: '#1B3A6B' },
  { id: 'steel-grey',   name: 'Steel Grey',  hex: '#717171' },
  { id: 'red',          name: 'Red',         hex: '#b91c1c' },
  { id: 'true-royal',   name: 'True Royal',  hex: '#1d4ed8' },
  { id: 'forest-green', name: 'Forest Green',hex: '#14532d' },
  { id: 'gold',         name: 'Gold',        hex: '#b45309' },
];

const CAP_COLORS: ProductColor[] = [
  { id: 'black',        name: 'Black',       hex: '#1a1a1a' },
  { id: 'white',        name: 'White',       hex: '#f5f5f0' },
  { id: 'navy',         name: 'Navy',        hex: '#1B3A6B' },
  { id: 'steel-grey',   name: 'Steel Grey',  hex: '#717171' },
  { id: 'red',          name: 'Red',         hex: '#b91c1c' },
  { id: 'true-royal',   name: 'True Royal',  hex: '#1d4ed8' },
  { id: 'forest-green', name: 'Forest Green',hex: '#14532d' },
  { id: 'khaki',        name: 'Khaki',       hex: '#78716c' },
];

const BEANIE_COLORS: ProductColor[] = [
  { id: 'black',        name: 'Black',       hex: '#1a1a1a' },
  { id: 'white',        name: 'White',       hex: '#f5f5f0' },
  { id: 'navy',         name: 'Navy',        hex: '#1B3A6B' },
  { id: 'steel-grey',   name: 'Steel Grey',  hex: '#717171' },
  { id: 'red',          name: 'Red',         hex: '#b91c1c' },
  { id: 'forest-green', name: 'Forest Green',hex: '#14532d' },
  { id: 'maroon',       name: 'Maroon',      hex: '#7f1d1d' },
];

// ── Catalogue complet Vision Affichage ────────────────────────────────────────
export const PRODUCTS: Product[] = [

  // ── SWEATS À CAPUCHE ────────────────────────────────────────────────────────
  {
    id: 'atcf2500', sku: 'ATCF2500',
    name: 'Hoodie à capuche unisexe — ATC F2500',
    shortName: 'Hoodie',
    category: 'hoodie', gender: 'unisex', basePrice: 27.54,
    imageDevant: `${CDN}/ATCF2500-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATCF2500-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 'atcf2500',
    colors: HOODIE_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
    printZones: HOODIE_ZONES,
    description: 'Hoodie unisexe French Terry 13 oz. Molleton 3 épaisseurs, capuchon doublé avec cordon, poche kangourou, poignets côtelés. Certification OEKO-TEX® Standard 100. Le choix #1 pour les équipes et la promotion de marque.',
    features: ['13 oz French Terry','Molleton 3 épaisseurs','Capuchon doublé avec cordon','Œillets en métal argenté','Poche kangourou','Anti-boulochage','OEKO-TEX® Standard 100'],
  },
  {
    id: 'atcy2500', sku: 'ATCY2500',
    name: 'Hoodie à capuche enfant — ATC FY2500',
    shortName: 'Hoodie enfant',
    category: 'hoodie', gender: 'enfant', basePrice: 21.39,
    imageDevant: `${CDN}/ATCFY2500-Devant.jpg?v=1770866961&width=800`,
    imageDos:    `${CDN}/ATCFY2500-Dos.jpg?v=1770866961&width=800`,
    shopifyHandle: 'atcy2500-1',
    colors: HOODIE_COLORS.slice(0, 8),
    sizes: ['XS','S','M','L','XL'],
    printZones: HOODIE_ZONES,
    description: 'Version enfant du hoodie ATC F2500. Même qualité French Terry, capuchon doublé avec cordon et poche kangourou. Parfait pour habiller les équipes jeunesse.',
    features: ['French Terry','Capuchon doublé','Poche kangourou','Anti-boulochage'],
  },
  {
    id: 'atcf2600', sku: 'ATCF2600',
    name: 'Hoodie avec fermeture éclair — ATC F2600',
    shortName: 'Hoodie Zip',
    category: 'hoodie', gender: 'unisex', basePrice: 32.49,
    imageDevant: `${CDN}/ATCF2600-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATCF2600-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 'atcf2600-1',
    colors: HOODIE_COLORS.slice(0, 8),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: [
      { id: 'coeur-gauche', label: 'Cœur gauche (logo)', x:14, y:27, width:20, height:16 },
      { id: 'dos-complet',  label: 'Dos complet',        x:22, y:18, width:56, height:44 },
      { id: 'manche-gauche',label: 'Manche gauche',      x: 3, y:34, width:13, height:17 },
    ],
    description: 'Veste à capuche fermeture éclair pleine longueur YKK. French Terry 3 épaisseurs, deux poches latérales. Look professionnel pour les représentants, techniciens et équipes terrain.',
    features: ['Fermeture éclair YKK pleine longueur','French Terry 3 épaisseurs','Deux poches latérales','Capuchon doublé'],
  },
  {
    id: 'atcf2400', sku: 'ATCF2400',
    name: 'Crewneck épais — ATC F2400',
    shortName: 'Crewneck',
    category: 'crewneck', gender: 'unisex', basePrice: 16.81,
    imageDevant: `${CDN}/ATCF2400-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATCF2400-Dos.jpg?v=1770867121&width=800`,
    shopifyHandle: 'atcf2400-1',
    colors: HOODIE_COLORS.slice(0, 8),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'Crewneck épais unisexe, tissu French Terry 3 épaisseurs. Col rond côtelé, poignets et taille en côte. Alternative sans capuche au hoodie classique pour un look plus simple et élégant.',
    features: ['French Terry 3 épaisseurs','Col rond côtelé','Poignets et taille en côte'],
  },

  // ── T-SHIRTS ─────────────────────────────────────────────────────────────────
  {
    id: 'atc1000', sku: 'ATC1000',
    name: 'T-Shirt — ATC 1000',
    shortName: 'T-Shirt',
    category: 'tshirt', gender: 'unisex', basePrice: 4.15,
    imageDevant: `${CDN}/ATC1000-Devant.jpg?v=1770866927&width=800`,
    imageDos:    `${CDN}/ATC1000-Dos.jpg?v=1770866927&width=800`,
    shopifyHandle: 'atc1000',
    colors: TSHIRT_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt 100% coton ringspun 9,1 oz, col côtelé 1×1, coutures double aiguille aux manches et ourlet. Étiquette détachable pour marque privée. Certification OEKO-TEX®. Le t-shirt de base par excellence pour toute commande d\'équipe.',
    features: ['100% coton ringspun 9,1 oz','Col côtelé 1×1','Coutures double aiguille','Étiquette détachable','OEKO-TEX® Standard 100','Coupe classique unisexe'],
  },
  {
    id: 'atc1000l', sku: 'ATC1000L',
    name: 'T-Shirt femme — ATC 1000L',
    shortName: 'T-Shirt femme',
    category: 'tshirt', gender: 'femme', basePrice: 6.65,
    imageDevant: `${CDN}/ATC1000L-Devant.jpg?v=1770867419&width=800`,
    imageDos:    `${CDN}/ATC1000L-Dos.jpg?v=1770867419&width=800`,
    shopifyHandle: 'atc1000l',
    colors: TSHIRT_COLORS,
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: SHIRT_ZONES,
    description: 'Version ajustée du ATC 1000 pour femmes. Coton ringspun 9,1 oz, coupe cintrée mettant en valeur la silhouette. Col côtelé, coutures double aiguille. Parfait pour uniformes mixtes.',
    features: ['100% coton ringspun 9,1 oz','Coupe ajustée femme','Col côtelé','Coutures double aiguille','OEKO-TEX®'],
  },
  {
    id: 'atc1000y', sku: 'ATC1000Y',
    name: 'T-Shirt enfant — ATC 1000Y',
    shortName: 'T-Shirt enfant',
    category: 'tshirt', gender: 'enfant', basePrice: 4.76,
    imageDevant: `${CDN}/ATCY1000-Devant.jpg?v=1770867607&width=800`,
    imageDos:    `${CDN}/ATCY1000-Dos.jpg?v=1770867606&width=800`,
    shopifyHandle: 'atc1000y-1',
    colors: TSHIRT_COLORS.slice(0, 8),
    sizes: ['XS','S','M','L','XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt enfant 100% coton ringspun. Même qualité que le ATC 1000 adulte, adapté aux tailles enfant. Pour les équipes sportives jeunesse et événements scolaires.',
    features: ['100% coton ringspun','Coupe enfant','Col côtelé','OEKO-TEX®'],
  },
  {
    id: 'werk250', sku: 'WERK250',
    name: 'T-Shirt Premium — WERK250',
    shortName: 'T-Shirt Premium',
    category: 'tshirt', gender: 'unisex', basePrice: 16.09,
    imageDevant: `${CDN}/Werk250-Devant.jpg?v=1770867038&width=800`,
    imageDos:    `${CDN}/Werk250-Dos.jpg?v=1770867038&width=800`,
    shopifyHandle: 'werk250-1',
    colors: TSHIRT_COLORS.slice(0, 6),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt premium 250 g/m² pour les exigences supérieures. Tissu épais et résistant, idéal pour les environnements de travail intensifs. Surface d\'impression optimale pour un rendu professionnel.',
    features: ['250 g/m² qualité supérieure','Surface d\'impression optimale','Coupe confortable','Usage professionnel'],
  },
  {
    id: 'atc1015', sku: 'ATC1015',
    name: 'T-Shirt manches longues — ATC 1015',
    shortName: 'T-Shirt ML',
    category: 'longsleeve', gender: 'unisex', basePrice: 27.54,
    imageDevant: `${CDN}/ATC1015-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/ATC1015-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 'atc1015',
    colors: TSHIRT_COLORS.slice(0, 8),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt manches longues unisexe, même qualité coton ringspun que le ATC 1000. Protection supplémentaire contre les éléments, parfait pour les saisons intermédiaires et les environnements de travail.',
    features: ['100% coton ringspun','Manches longues','Col côtelé 1×1','OEKO-TEX®'],
  },

  // ── POLOS ───────────────────────────────────────────────────────────────────
  {
    id: 's445', sku: 'S445',
    name: 'Polo homme à manches courtes — S445',
    shortName: 'Polo',
    category: 'polo', gender: 'homme', basePrice: 27.99,
    imageDevant: `${CDN}/S445-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/S445-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 's445-1',
    colors: POLO_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL'],
    printZones: [
      { id: 'poitrine-gauche', label: 'Poitrine gauche (logo)',   x:16, y:25, width:20, height:16 },
      { id: 'poitrine-centre', label: 'Centre poitrine',          x:32, y:26, width:34, height:24 },
      { id: 'dos-complet',     label: 'Dos complet',              x:20, y:16, width:60, height:48 },
      { id: 'manche-gauche',   label: 'Manche gauche',            x: 3, y:29, width:13, height:16 },
    ],
    description: 'Polo homme professionnel à manches courtes. Col polo classique avec placket 3 boutons, coupe droite. Parfait pour les uniformes d\'entreprise, réceptions clients et représentants sur le terrain.',
    features: ['Col polo classique','Placket 3 boutons','Coupe droite professionnelle','Lavable en machine'],
  },
  {
    id: 'l445', sku: 'L445',
    name: 'Polo femme à manches courtes — L445',
    shortName: 'Polo femme',
    category: 'polo', gender: 'femme', basePrice: 27.99,
    imageDevant: `${CDN}/L445-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/L445-Dos.jpg?v=1770866895&width=800`,
    shopifyHandle: 'l445-1',
    colors: POLO_COLORS,
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: [
      { id: 'poitrine-gauche', label: 'Poitrine gauche',  x:16, y:25, width:20, height:16 },
      { id: 'dos-complet',     label: 'Dos complet',      x:20, y:16, width:60, height:48 },
    ],
    description: 'Version femme du polo S445. Coupe ajustée valorisant la silhouette, col polo et placket 3 boutons. Idéal pour les équipes mixtes souhaitant un look cohérent et professionnel.',
    features: ['Coupe ajustée femme','Col polo classique','Placket 3 boutons'],
  },
  {
    id: 's445ls', sku: 'S445LS',
    name: 'Polo manches longues homme — S445LS',
    shortName: 'Polo ML',
    category: 'polo', gender: 'homme', basePrice: 33.59,
    imageDevant: `${CDN}/S445LS-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/S445LS-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 's445ls-1',
    colors: POLO_COLORS.slice(0, 6),
    sizes: ['XS','S','M','L','XL','2XL','3XL'],
    printZones: [
      { id: 'poitrine-gauche', label: 'Poitrine gauche',   x:16, y:25, width:20, height:16 },
      { id: 'dos-complet',     label: 'Dos complet',       x:20, y:16, width:60, height:48 },
      { id: 'manche-gauche',   label: 'Manche gauche',     x: 3, y:29, width:13, height:16 },
    ],
    description: 'Polo manches longues pour les saisons froides. Même qualité professionnelle que le S445, protection supérieure contre les éléments tout en maintenant l\'apparence soignée d\'un polo.',
    features: ['Manches longues','Col polo classique','Placket 3 boutons','Usage 4 saisons'],
  },

  // ── T-SHIRTS SPORT ──────────────────────────────────────────────────────────
  {
    id: 's350', sku: 'S350',
    name: 'T-Shirt sport homme — S350',
    shortName: 'T-Shirt Sport',
    category: 'sport', gender: 'homme', basePrice: 13.99,
    imageDevant: `${CDN}/S350-Devant.jpg?v=1770866896&width=800`,
    imageDos:    `${CDN}/S350-Dos.jpg?v=1770866896&width=800`,
    shopifyHandle: 's350-1',
    colors: POLO_COLORS,
    sizes: ['XS','S','M','L','XL','2XL','3XL','4XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport haute performance pour hommes. Tissu technique respirant à évacuation d\'humidité, séchage rapide. Parfait pour les équipes sportives, événements et promotions actives.',
    features: ['Tissu technique respirant','Évacuation d\'humidité','Séchage rapide','Usage sportif et promotion'],
  },
  {
    id: 'l350', sku: 'L350',
    name: 'T-Shirt sport femme — L350',
    shortName: 'T-Shirt Sport F',
    category: 'sport', gender: 'femme', basePrice: 13.99,
    imageDevant: `${CDN}/L350-Devant.jpg?v=1770867170&width=800`,
    imageDos:    `${CDN}/L350-Dos.jpg?v=1770867170&width=800`,
    shopifyHandle: 'l350-1',
    colors: POLO_COLORS,
    sizes: ['XS','S','M','L','XL','2XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport performance pour femmes, coupe ajustée. Tissu technique respirant, séchage rapide. Idéal pour les équipes sportives féminines et la promotion active.',
    features: ['Coupe ajustée femme','Tissu respirant','Séchage rapide','Évacuation d\'humidité'],
  },
  {
    id: 'y350', sku: 'Y350',
    name: 'T-Shirt sport enfant — Y350',
    shortName: 'T-Shirt Sport E',
    category: 'sport', gender: 'enfant', basePrice: 13.99,
    imageDevant: `${CDN}/Y350-Devant.jpg?v=1770867079&width=800`,
    imageDos:    `${CDN}/Y350-Dos.jpg?v=1770867079&width=800`,
    shopifyHandle: 'y350-1',
    colors: POLO_COLORS.slice(0, 6),
    sizes: ['XS','S','M','L','XL'],
    printZones: SHIRT_ZONES,
    description: 'T-shirt sport performance pour enfants. Même technologie de tissu respirant que les adultes, adapté aux tailles jeunesse. Pour les équipes sportives scolaires et ligues jeunesse.',
    features: ['Tissu respirant','Coupe enfant','Séchage rapide'],
  },

  // ── CASQUETTES ──────────────────────────────────────────────────────────────
  {
    id: 'atc6606', sku: 'ATC6606',
    name: 'Casquette Trucker — Yupoong 6606',
    shortName: 'Casquette Trucker',
    category: 'cap', gender: 'unisex', basePrice: 15.39,
    imageDevant: `${CDN}/yupoong-6606-noir-2_cb488769-745e-41f0-91fd-f317d9787cae.jpg?v=1763598460&width=800`,
    imageDos:    `${CDN}/6sgh1j.png?v=1774840440&width=800`,
    shopifyHandle: 'atc6606',
    colors: CAP_COLORS,
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette trucker Yupoong 6606, panneau avant structuré en coton, 5 panneaux maille filet respirante à l\'arrière. Fermeture snapback réglable. Broderie ou sérigraphie sur panneau avant.',
    features: ['Panneau avant structuré coton','5 panneaux maille filet','Snapback réglable','Zone de broderie en relief'],
  },
  {
    id: '6245cm', sku: '6245CM',
    name: 'Casquette Baseball Unisexe — 6245CM',
    shortName: 'Casquette Baseball',
    category: 'cap', gender: 'unisex', basePrice: 15.39,
    imageDevant: `${CDN}/c7d01dfb7dac4c79bd82abffc68e043c_l_21bd6f74-2540-48fe-bdd9-6d337329a5b5.jpg?v=1763598101&width=800`,
    imageDos:    `${CDN}/c7d01dfb7dac4c79bd82abffc68e043c_l_21bd6f74-2540-48fe-bdd9-6d337329a5b5.jpg?v=1763598101&width=800`,
    shopifyHandle: '6245cm',
    colors: CAP_COLORS.slice(0, 5),
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette baseball unisexe classique 6 panneaux, entièrement structurée. Fermeture Velcro réglable pour un ajustement parfait. Broderie logo disponible sur le panneau avant.',
    features: ['6 panneaux structurés','Fermeture Velcro','Visière courbée classique','Zone de broderie avant'],
  },
  {
    id: 'atc6277', sku: 'ATC6277',
    name: 'Casquette Baseball Classique — ATC 6277',
    shortName: 'Casquette Classique',
    category: 'cap', gender: 'unisex', basePrice: 20.99,
    imageDevant: `${CDN}/atc6277_modl_white_studio-1_2021_cil-_1.jpg?v=1763598029&width=800`,
    imageDos:    `${CDN}/atc6277_modl_white_studio-1_2021_cil-_1.jpg?v=1763598029&width=800`,
    shopifyHandle: 'atc6277-1',
    colors: CAP_COLORS,
    sizes: ['Taille unique'],
    printZones: CAP_ZONES,
    description: 'Casquette ATC 6277, modèle classique premium. Panneau avant structuré 100% coton, 6 panneaux. Fermeture à sangle avec boucle de réglage. Qualité supérieure pour une représentation professionnelle.',
    features: ['100% coton panneau avant','6 panneaux premium','Fermeture sangle ajustable','Construction supérieure'],
  },

  // ── TUQUES ──────────────────────────────────────────────────────────────────
  {
    id: 'c100', sku: 'C100',
    name: 'Tuque à rebord — C100',
    shortName: 'Tuque Rebord',
    category: 'toque', gender: 'unisex', basePrice: 4.50,
    imageDevant: `${CDN}/c100-2_ea555bdf-f334-432d-a61e-5ba0cb06692e.jpg?v=1763598117&width=800`,
    imageDos:    `${CDN}/c100-2_ea555bdf-f334-432d-a61e-5ba0cb06692e.jpg?v=1763598117&width=800`,
    shopifyHandle: 'c100-1',
    colors: BEANIE_COLORS,
    sizes: ['Taille unique'],
    printZones: BEANIE_ZONES,
    description: 'Tuque à rebord 100% acrylique, construction double épaisseur. Le rebord retroussé permet l\'affichage du logo en broderie. Taille universelle s\'adaptant à toutes les têtes.',
    features: ['100% acrylique','Double épaisseur','Rebord retroussé','Zone broderie sur rebord','Taille universelle'],
  },
  {
    id: 'c105', sku: 'C105',
    name: 'Tuque sans rebords — C105',
    shortName: 'Tuque',
    category: 'toque', gender: 'unisex', basePrice: 7.13,
    imageDevant: `${CDN}/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800`,
    imageDos:    `${CDN}/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172&width=800`,
    shopifyHandle: 'c105-1',
    colors: BEANIE_COLORS,
    sizes: ['Taille unique'],
    printZones: BEANIE_ZONES,
    description: 'Tuque tricotée sans rebords, double épaisseur 100% acrylique. Garde la chaleur en hiver tout en restant légère. Broderie sur la face avant. Taille universelle.',
    features: ['100% acrylique','Double épaisseur','Sans rebord','Broderie face avant','Taille universelle'],
  },
];

// ── Constants ────────────────────────────────────────────────────────────────
export const PRINT_PRICE            = 3.50;
export const BULK_DISCOUNT_THRESHOLD = 12;
export const BULK_DISCOUNT_RATE     = 0.15;

// ── Helper: find product by Shopify handle ───────────────────────────────────
export function findProductByHandle(handle: string): Product | undefined {
  return PRODUCTS.find(p =>
    p.shopifyHandle === handle ||
    p.id === handle ||
    handle.includes(p.sku.toLowerCase())
  );
}

// ── Helper: match Shopify product title to local product ──────────────────────
export function matchProductByTitle(title: string): Product | undefined {
  const lower = title.toLowerCase();
  return PRODUCTS.find(p =>
    lower.includes(p.sku.toLowerCase()) ||
    lower.includes(p.id.toLowerCase())
  );
}
