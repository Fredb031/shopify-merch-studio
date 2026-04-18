import { Search, Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PRODUCTS } from '@/data/products';

export default function AdminProducts() {
  const [query, setQuery] = useState('');

  const products = useMemo(() => {
    if (!query.trim()) return PRODUCTS;
    const q = query.toLowerCase();
    return PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Produits</h1>
          <p className="text-sm text-zinc-500 mt-1">{PRODUCTS.length} produits actifs · synchronisés avec Shopify</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white">
            <RefreshCw size={15} />
            Resynchroniser
          </button>
          <button className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90">
            <Plus size={15} />
            Nouveau produit
          </button>
        </div>
      </header>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100">
          <div className="flex items-center gap-2 flex-1 border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un produit, un SKU"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {products.map(p => (
            <div
              key={p.sku}
              className="border border-zinc-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white"
            >
              <div className="aspect-square bg-zinc-100 relative">
                {p.imageDevant && (
                  <img src={p.imageDevant} alt="" className="w-full h-full object-cover" />
                )}
                <span className="absolute top-2 right-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                  Actif
                </span>
              </div>
              <div className="p-3">
                <div className="text-xs font-mono text-zinc-400 mb-0.5">{p.sku}</div>
                <div className="text-sm font-bold leading-tight line-clamp-2 min-h-[2.2em]">{p.name}</div>
                <div className="text-[13px] font-extrabold text-[#0052CC] mt-1.5">
                  {p.basePrice?.toLocaleString('fr-CA')} $
                </div>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="p-12 text-center text-zinc-400 text-sm">Aucun produit trouvé</div>
        )}
      </div>
    </div>
  );
}
