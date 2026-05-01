import type { Locale } from '@/lib/types';

export type WhyUsItemId = 'production' | 'delivery' | 'language';

export type WhyUsItem = {
  id: WhyUsItemId;
  illustration: string;
  alt: Record<Locale, string>;
  title: Record<Locale, string>;
  body: Record<Locale, string>;
};

export const whyUsItems: readonly WhyUsItem[] = [
  {
    id: 'production',
    illustration: '/placeholders/why-us/atelier.svg',
    alt: {
      'fr-ca':
        "Atelier de fabrication à Blainville — bâtiment industriel québécois aux fenêtres chaleureuses",
      'en-ca':
        'Manufacturing workshop in Blainville — Quebec industrial building with warm-lit windows',
    },
    title: {
      'fr-ca': 'Tout est fabriqué chez nous, à Blainville.',
      'en-ca': 'Everything is made in-house, in Blainville.',
    },
    body: {
      'fr-ca':
        "Pas de sous-traitance internationale. Tu connais qui touche tes vêtements et qui contrôle la qualité avant l'expédition.",
      'en-ca':
        'No international subcontracting. You know who touches your apparel and who runs the quality control before it ships.',
    },
  },
  {
    id: 'delivery',
    illustration: '/placeholders/why-us/calendar.svg',
    alt: {
      'fr-ca':
        "Calendrier de production — cinq jours ouvrables marqués jusqu'à l'expédition",
      'en-ca':
        'Production calendar — five business days marked until shipment',
    },
    title: {
      'fr-ca': '5 jours ouvrables après approbation.',
      'en-ca': '5 business days after approval.',
    },
    body: {
      'fr-ca':
        "Une fois ton logo approuvé, on lance la production immédiatement. Si on rate le délai, on assume.",
      'en-ca':
        "Once your logo is approved, production starts immediately. If we miss the deadline, we own it.",
    },
  },
  {
    id: 'language',
    illustration: '/placeholders/why-us/speech.svg',
    alt: {
      'fr-ca':
        "Bulles de dialogue empilées — service client en français au Québec",
      'en-ca':
        'Stacked speech bubbles — French-speaking customer service in Québec',
    },
    title: {
      'fr-ca': 'Toute notre équipe parle français.',
      'en-ca': 'Our whole team speaks French.',
    },
    body: {
      'fr-ca':
        "Pas besoin de négocier en anglais avec un agent commercial. Tu communiques avec quelqu'un qui comprend ton industrie québécoise.",
      'en-ca':
        'No need to negotiate in English with a sales rep. You talk to someone who understands your Quebec trade.',
    },
  },
];
