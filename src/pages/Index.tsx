import { Navbar } from '@/components/Navbar';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Index() {
  const { data: products, isLoading } = useProducts();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <div className="container mx-auto px-4 py-24 md:py-32 text-center relative z-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4 animate-fade-in-up">
            Personnalise ton style
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 animate-fade-in-up">
            VISION AFFICHAGE
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 text-primary-foreground/70 animate-fade-in-up">
            Stickers, décals et wraps personnalisés pour tous tes projets. Qualité professionnelle, livraison rapide.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up">
            <Link to="/products">
              <Button size="lg" variant="secondary" className="font-bold text-base px-8">
                Voir les produits <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--accent)/0.1),transparent_50%)]" />
      </section>

      {/* Marquee */}
      <div className="bg-accent text-accent-foreground py-3 overflow-hidden">
        <div className="animate-marquee flex whitespace-nowrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="mx-8 text-sm font-bold uppercase tracking-wider">
              ✦ 500+ clients satisfaits ✦ Prête en 48h ✦ Livraison gratuite 300$+
            </span>
          ))}
        </div>
      </div>

      {/* Products */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Nos produits</h2>
            <p className="text-muted-foreground mt-1">Découvre notre sélection</p>
          </div>
          <Link to="/products">
            <Button variant="outline" size="sm">
              Tout voir <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.slice(0, 8).map((product) => (
              <ProductCard key={product.node.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/50 py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="font-black text-lg mb-2">VISION AFFICHAGE</p>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Vision Affichage. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
