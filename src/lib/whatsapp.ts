// Vision Affichage Volume II §09 — WhatsApp Business CTA helpers.
// Centralizes the phone number + canonical pre-filled message templates
// so every surface (floating button, PDP link, future quote/customizer
// banners) shares the same wording. If the operator ever swaps numbers
// or rewords the templates, this is the single source of truth — no
// grep-and-replace across components.
//
// We do NOT include the leading "+" or any spaces in WA_NUMBER: wa.me
// expects a bare E.164-style digits string (`https://wa.me/13673804808`).

export const WA_NUMBER = '13673804808';

export const WA_MESSAGES = {
  default: "Bonjour Vision Affichage! J'ai une question sur votre site.",
  product: (n: string) => `Bonjour! Je veux commander des ${n} avec mon logo.`,
  customizer: "Bonjour! J'ai besoin d'aide pour personnaliser un produit.",
  quote: "Bonjour! J'aimerais obtenir une soumission pour mon équipe.",
};

/**
 * Build a wa.me deep link with the given pre-filled message.
 * Always pair the returned URL with `target="_blank"` and
 * `rel="noopener noreferrer"` so we don't leak the merch site's
 * window.opener to WhatsApp Web (and so iOS/Android route to the
 * native app correctly).
 */
export function waLink(message: string): string {
  // Guard against undefined/empty: encodeURIComponent(undefined) yields the
  // literal "undefined", which would prefill the chat with garbage.
  const text = typeof message === 'string' && message.length > 0
    ? message
    : WA_MESSAGES.default;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}
