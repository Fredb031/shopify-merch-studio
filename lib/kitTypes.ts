import type { Bilingual } from './types';

export type KitContentEntry = {
  category: string;
  description: Bilingual;
};

export type KitType = {
  id: 'starter' | 'workwear' | 'corporate';
  name: Bilingual;
  bestFor: Bilingual;
  contents: ReadonlyArray<KitContentEntry>;
  priceCents: number;
  imageSlug: string;
};

export const KIT_TYPES: ReadonlyArray<KitType> = Object.freeze([
  {
    id: 'starter',
    name: { 'fr-ca': 'Kit Starter', 'en-ca': 'Starter Kit' },
    bestFor: {
      'fr-ca': 'Bureau, équipes mixtes, première commande',
      'en-ca': 'Office, mixed teams, first order',
    },
    contents: [
      {
        category: 'tshirt',
        description: {
          'fr-ca': 'T-shirt 6.1 oz (M, Noir)',
          'en-ca': 'T-shirt 6.1 oz (M, Black)',
        },
      },
      {
        category: 'polo',
        description: {
          'fr-ca': 'Polo classique (M, Marine)',
          'en-ca': 'Classic polo (M, Navy)',
        },
      },
      {
        category: 'hoodie',
        description: {
          'fr-ca': 'Hoodie 13 oz (M, Charbon)',
          'en-ca': 'Hoodie 13 oz (M, Charcoal)',
        },
      },
    ],
    priceCents: 4995,
    imageSlug: 'starter',
  },
  {
    id: 'workwear',
    name: { 'fr-ca': 'Kit Workwear', 'en-ca': 'Workwear Kit' },
    bestFor: {
      'fr-ca': 'Construction, paysagement, métiers extérieurs',
      'en-ca': 'Construction, landscaping, outdoor trades',
    },
    contents: [
      {
        category: 'tshirt',
        description: {
          'fr-ca': 'T-shirt manches longues (L, Vert forêt)',
          'en-ca': 'Long-sleeve T-shirt (L, Forest Green)',
        },
      },
      {
        category: 'workwear',
        description: {
          'fr-ca': 'Veste de travail (L, Charbon)',
          'en-ca': 'Work jacket (L, Charcoal)',
        },
      },
      {
        category: 'cap',
        description: {
          'fr-ca': 'Casquette trucker (Noir)',
          'en-ca': 'Trucker cap (Black)',
        },
      },
    ],
    priceCents: 7995,
    imageSlug: 'workwear',
  },
  {
    id: 'corporate',
    name: { 'fr-ca': 'Kit Corporatif', 'en-ca': 'Corporate Kit' },
    bestFor: {
      'fr-ca': 'Bureau, équipes client-facing, événements',
      'en-ca': 'Office, client-facing teams, events',
    },
    contents: [
      {
        category: 'polo',
        description: {
          'fr-ca': 'Polo coupe femme (M, Blanc)',
          'en-ca': 'Women polo (M, White)',
        },
      },
      {
        category: 'polo',
        description: {
          'fr-ca': 'Polo manches longues (M, Marine)',
          'en-ca': 'Long-sleeve polo (M, Navy)',
        },
      },
      {
        category: 'tshirt',
        description: {
          'fr-ca': 'T-shirt jeunesse (S, Rouge)',
          'en-ca': 'Youth T-shirt (S, Red)',
        },
      },
    ],
    priceCents: 5995,
    imageSlug: 'corporate',
  },
]);

export function getKit(id: KitType['id']): KitType | undefined {
  return KIT_TYPES.find((kit) => kit.id === id);
}
