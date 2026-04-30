export type Locale = 'fr-ca' | 'en-ca';

export type Bilingual = {
  'fr-ca': string;
  'en-ca': string;
};

export type ProductCategory =
  | 'polo'
  | 'tshirt'
  | 'longsleeve'
  | 'hoodie'
  | 'jacket'
  | 'youth';

export type Product = {
  styleCode: string;
  slug: string;
  category: ProductCategory;
  title: Bilingual;
  identityHook: Bilingual;
  description: Bilingual;
  bestFor: Bilingual;
  badges: Bilingual[];
  colors: { name: Bilingual; hex: string }[];
  sizes: string[];
  brand: string;
  decorationDefault: 'embroidery' | 'print';
};

export type Industry = {
  slug: string;
  name: Bilingual;
  shortDescription: Bilingual;
  pitch: Bilingual;
  keyProducts: string[];
};

export type Review = {
  id: string;
  author: string;
  role: Bilingual;
  company: string;
  industry: string;
  quote: Bilingual;
  rating: 4 | 5;
};

export type ClientLogo = {
  id: string;
  name: string;
  industry: string;
};
