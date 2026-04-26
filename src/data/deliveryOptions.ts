// Section 5.1 — delivery-speed tiers exposed in the cart's order summary.
// Surcharge is a multiplier of the cart subtotal (Standard 0%, Express 25%,
// Urgent 50%). UI-only ship for now; the operator follow-up is to wire the
// selected tier to a Shopify cart attribute / line-item surcharge so the
// upcharge actually flows through checkout. Until then this is purely a
// front-end commitment that we surface in the receipt + email.
export interface DeliveryOption {
  id: 'standard' | 'rush' | 'urgent';
  label: string;
  days: number;
  surcharge: number;
  description: string;
  badge: string | null;
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: 'standard', label: 'Livraison Standard', days: 5, surcharge: 0, description: 'Garanti en 5 jours ouvrables', badge: null },
  { id: 'rush', label: 'Livraison Express', days: 3, surcharge: 0.25, description: 'Reçu en 3 jours ouvrables', badge: 'POPULAIRE POUR LES CHANTIERS' },
  { id: 'urgent', label: 'Livraison Urgente', days: 2, surcharge: 0.50, description: 'Reçu en 2 jours ouvrables', badge: 'DISPONIBLE LUNDI-VENDREDI AVANT 10H' },
];
