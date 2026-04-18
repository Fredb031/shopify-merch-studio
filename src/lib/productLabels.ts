import type { Product } from '@/data/products';

type Category = Product['category'];

const FR: Record<Category, string> = {
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  crewneck: 'Crewneck',
  polo: 'Polo',
  longsleeve: 'Chandail manches longues',
  sport: 'Sport',
  cap: 'Casquette',
  toque: 'Tuque',
};

const EN: Record<Category, string> = {
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  crewneck: 'Crewneck',
  polo: 'Polo',
  longsleeve: 'Long sleeve',
  sport: 'Sport',
  cap: 'Cap',
  toque: 'Beanie',
};

export function categoryLabel(category: Category, lang: 'fr' | 'en' = 'fr'): string {
  return lang === 'en' ? EN[category] : FR[category];
}
