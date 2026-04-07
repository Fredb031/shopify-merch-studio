import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Banner */}
      <div className="pt-[60px]">
        <div className="gradient-navy-dark px-6 md:px-10 pt-9">
          <div className="max-w-[1200px] mx-auto">
            <h1 className="text-[38px] font-extrabold tracking-[-1px] text-primary-foreground mb-1">Boutique</h1>
            <p className="text-sm text-primary-foreground/50 mb-5">Personnalise ton merch d'entreprise</p>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 pb-32">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">Aucun produit trouvé</p>
            <p className="text-sm text-muted-foreground mt-2">Dites-nous quel produit vous souhaitez créer!</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-3 mb-5">
              <h2 className="text-xl font-extrabold text-foreground">Tous les produits</h2>
              <span className="text-[13px] text-muted-foreground">{products.length} articles</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {products.map((product) => (
                <ProductCard key={product.node.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
