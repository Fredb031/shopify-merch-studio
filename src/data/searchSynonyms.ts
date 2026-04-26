/**
 * searchSynonyms.ts — query-expansion table for the smart search bar.
 *
 * Volume II §2.2. The brief calls for a table that maps the words shoppers
 * actually type ("chandail", "hodie", "black") to the canonical tokens our
 * product index stores ("t-shirt", "hoodie", "noir"). search() resolves
 * each query word through this map BEFORE scoring — so a user looking for
 * a "chandail rouge" still hits the t-shirt rouge SKUs even though no
 * product has the literal word "chandail" in its name or tags.
 *
 * Keys are normalised lowercase tokens; values are arrays of equivalent
 * canonical tokens that should also be matched. A key MUST be included in
 * its own value list when the original token still has indexing relevance
 * (so "noir" still matches "noir"); otherwise we'd drop the original term
 * during expansion. Common typos ("hodie", "tshrit") are first-class
 * entries — typo tolerance via Levenshtein is a backstop, but explicit
 * synonyms are 100x cheaper and catch the long tail predictably.
 *
 * Add new entries lowercase, accents stripped (we normalise both sides).
 */
export const SYNONYMS: Record<string, string[]> = {
  // ── Garment types — FR ↔ EN ↔ slang ↔ typo ────────────────────────────────
  'chandail':   ['t-shirt', 'tshirt', 'chandail'],
  'tshirt':     ['t-shirt', 'tshirt'],
  't-shirt':    ['t-shirt', 'tshirt'],
  'tshrit':     ['t-shirt', 'tshirt'],          // typo
  'tee':        ['t-shirt', 'tshirt'],
  'gilet':      ['hoodie', 'crewneck'],
  'kangourou':  ['hoodie'],
  'capuche':    ['hoodie'],
  'hoodie':     ['hoodie'],
  'hodie':      ['hoodie'],                     // typo
  'hoody':      ['hoodie'],
  'sweat':      ['hoodie', 'crewneck'],
  'sweater':    ['crewneck', 'hoodie'],
  'crewneck':   ['crewneck'],
  'crew':       ['crewneck'],
  'polo':       ['polo'],
  'longsleeve': ['longsleeve', 'manches longues'],
  'manches':    ['longsleeve'],
  'sport':      ['sport'],
  'casquette':  ['cap', 'casquette'],
  'cap':        ['cap', 'casquette'],
  'tuque':      ['toque', 'tuque', 'beanie'],
  'toque':      ['toque', 'tuque', 'beanie'],
  'beanie':     ['toque', 'tuque', 'beanie'],

  // ── Colors — EN → FR (we index FR + EN names, but normalise queries) ──────
  'black':      ['noir', 'black'],
  'noir':       ['noir', 'black'],
  'white':      ['blanc', 'white'],
  'blanc':      ['blanc', 'white'],
  'navy':       ['marine', 'navy'],
  'marine':     ['marine', 'navy'],
  'red':        ['rouge', 'red'],
  'rouge':      ['rouge', 'red'],
  'royal':      ['royal', 'bleu royal'],
  'blue':       ['bleu', 'royal', 'navy', 'marine'],
  'bleu':       ['bleu', 'royal', 'marine'],
  'green':      ['vert', 'forest', 'green'],
  'vert':       ['vert', 'forest', 'green'],
  'grey':       ['gris', 'grey', 'gray', 'charcoal', 'charbon'],
  'gray':       ['gris', 'grey', 'gray'],
  'gris':       ['gris', 'grey', 'gray'],
  'charcoal':   ['charbon', 'charcoal'],
  'charbon':    ['charbon', 'charcoal'],
  'gold':       ['or', 'gold'],
  'or':         ['or', 'gold'],
  'purple':     ['mauve', 'purple', 'violet'],
  'mauve':      ['mauve', 'purple'],
  'burgundy':   ['bourgogne', 'burgundy', 'maroon', 'bordeaux'],
  'bourgogne':  ['bourgogne', 'burgundy', 'maroon'],
  'maroon':     ['bordeaux', 'maroon', 'bourgogne'],
  'bordeaux':   ['bordeaux', 'maroon'],
  'pink':       ['rose', 'pink'],
  'rose':       ['rose', 'pink'],
  'orange':     ['orange'],
  'yellow':     ['jaune', 'yellow'],
  'jaune':      ['jaune', 'yellow'],

  // ── Audience / fit ────────────────────────────────────────────────────────
  'femme':      ['femme', 'women', 'ladies'],
  'women':      ['femme', 'women', 'ladies'],
  'ladies':     ['femme', 'ladies'],
  'homme':      ['homme', 'men', 'unisex'],
  'men':        ['homme', 'men'],
  'enfant':     ['enfant', 'youth', 'kids', 'jeunesse'],
  'kids':       ['enfant', 'kids', 'youth'],
  'youth':      ['enfant', 'youth'],
  'jeunesse':   ['enfant', 'jeunesse', 'youth'],
};
