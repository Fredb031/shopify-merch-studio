import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { MoleGame } from '@/components/MoleGame';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

const avatarColors = ['#1B3A6B', '#C8860A', '#16A34A', '#8B4513'];
const avatarInitials = ['SL', 'WB', 'JP', 'AO'];

export default function Index() {
  const { data: products, isLoading } = useProducts();
  const [cartOpen, setCartOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem('moleGamePlayed');
    const timer = setTimeout(() => {
      setShowLoader(false);
      if (!hasPlayed) setShowGame(true);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  const handleGameClose = (won: boolean) => {
    setShowGame(false);
    sessionStorage.setItem('moleGamePlayed', 'true');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Loader */}
      {showLoader && (
        <div className={`fixed inset-0 gradient-navy-dark z-[9999] flex flex-col items-center justify-center gap-8 transition-opacity duration-700 ${!showLoader ? 'opacity-0 pointer-events-none' : ''}`}>
          <div className="opacity-0 scale-[0.85] animate-[lIn_0.8s_0.3s_cubic-bezier(.34,1.56,.64,1)_forwards]">
            <div className="text-2xl font-extrabold text-primary-foreground tracking-tight">VISION</div>
            <div className="text-[13px] font-medium tracking-[3px] uppercase text-primary-foreground/35 mt-2">Merch d'entreprise</div>
          </div>
          <div className="w-[200px] h-0.5 bg-primary-foreground/10 rounded overflow-hidden opacity-0 animate-[fadeIn_0.5s_0.6s_forwards]">
            <div className="h-full rounded" style={{ background: 'linear-gradient(90deg, hsl(var(--gold)), hsl(var(--gold2)))', animation: 'lFill 1.4s 0.7s cubic-bezier(.4,0,.2,1) forwards', width: 0 }} />
          </div>
        </div>
      )}

      {/* Mole Game */}
      <MoleGame isOpen={showGame} onClose={handleGameClose} />

      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 md:px-10 pt-24 pb-16 max-w-[1100px] mx-auto">
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[2px] uppercase text-primary bg-primary/7 border border-primary/15 px-4 py-[7px] rounded-full mb-7">
            <span className="w-1.5 h-1.5 bg-green rounded-full" />
            +500 entreprises habillées · 5★ sur Google
          </div>
        </div>

        <h1 className="text-[clamp(44px,6.5vw,82px)] font-extrabold leading-[0.98] tracking-[-2.5px] text-foreground mb-2.5 animate-fade-in-up">
          Tes clients te jugent<br />avant que tu parles.
          <span className="block text-primary italic">Habille ton équipe<br />à la hauteur.</span>
        </h1>

        <p className="text-[17px] text-muted-foreground leading-[1.75] max-w-[520px] mt-4 mb-10 animate-fade-in-up">
          Ton logo sur tes vêtements, en <strong className="text-foreground font-bold">5 jours ouvrables</strong>. Aucun minimum, aucune prise de tête. Les équipes qui ont l'air pro closent plus — c'est aussi simple que ça.
        </p>

        <Link
          to="/products"
          className="text-[17px] font-extrabold text-primary-foreground gradient-navy border-none px-12 py-[18px] rounded-full cursor-pointer transition-all shadow-navy hover:-translate-y-0.5 hover:shadow-navy-lg tracking-[-0.2px] mb-5 inline-block animate-fade-in-up"
        >
          Voir les produits →
        </Link>

        <div className="flex items-center justify-center gap-3.5 mt-1 animate-fade-in-up">
          <div className="flex">
            {avatarInitials.map((init, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-[2.5px] border-background flex items-center justify-center text-[11px] font-extrabold text-primary-foreground"
                style={{ marginLeft: i > 0 ? '-9px' : 0, backgroundColor: avatarColors[i] }}
              >
                {init}
              </div>
            ))}
          </div>
          <div className="text-left">
            <div className="text-accent text-sm tracking-wider">★★★★★</div>
            <div className="text-[12px] text-muted-foreground">+500 entrepreneurs satisfaits · Noté 5/5 sur 41 avis</div>
          </div>
        </div>
      </section>

      {/* Steps Strip */}
      <section className="gradient-navy-dark py-16 px-6 md:px-10">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="text-[11px] font-bold tracking-[3px] text-primary-foreground/35 uppercase mb-3.5">Processus</div>
          <h2 className="text-[clamp(26px,4vw,42px)] font-extrabold text-primary-foreground tracking-[-1px] mb-12 leading-tight">
            Aussi simple<br /><em className="text-primary-foreground/35 not-italic">que ça.</em>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[2px] bg-primary-foreground/8 rounded-[20px] overflow-hidden">
            {[
              { n: '01', icon: '👕', title: 'Choisis ton produit', desc: 'T-shirt, hoodie, casquette, manteau. Choisis ta couleur et ta quantité. Zéro minimum.' },
              { n: '02', icon: '⬆️', title: 'Upload ton logo', desc: 'Glisse ton fichier. On enlève le fond et convertit en SVG auto. Aperçu en direct.' },
              { n: '03', icon: '📦', title: 'Reçois en 5 jours', desc: 'On imprime, on emballe, on livre. Garanti en 5 jours ouvrables. Qualité garantie 1 an.' },
            ].map((step, i) => (
              <div key={i} className="bg-primary-foreground/4 p-9 transition-colors hover:bg-primary-foreground/8 relative">
                <div className="text-[11px] font-extrabold tracking-[2.5px] text-primary-foreground/25 mb-5">{step.n} —</div>
                <div className="w-[52px] h-[52px] rounded-[14px] bg-primary-foreground/10 flex items-center justify-center mx-auto mb-4 text-2xl">
                  {step.icon}
                </div>
                <div className="text-base font-bold text-primary-foreground mb-2">{step.title}</div>
                <div className="text-[13px] text-primary-foreground/45 leading-relaxed">{step.desc}</div>
                {i < 2 && <span className="absolute right-[-1px] top-1/2 -translate-y-1/2 text-sm text-primary-foreground/20 hidden md:block">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-t border-b border-border">
        <div className="max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-4">
          {[
            { num: '33K+', label: 'Produits livrés' },
            { num: '5 jours', label: 'Livraison garantie' },
            { num: '500+', label: 'Entreprises clientes' },
            { num: '5★', label: 'Note Google' },
          ].map((item, i) => (
            <div key={i} className="py-7 text-center border-r border-border last:border-r-0">
              <div className="text-[30px] font-extrabold text-primary">{item.num}</div>
              <div className="text-[12px] text-muted-foreground mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Sam's Story */}
      <section className="py-20 px-6 md:px-10 max-w-[1100px] mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-[11px] font-bold tracking-[2px] uppercase text-primary mb-3">Notre histoire</div>
            <h2 className="text-[clamp(28px,3.5vw,42px)] font-extrabold tracking-[-1px] text-foreground leading-tight mb-5">
              Pourquoi j'ai lancé Vision en 2021
            </h2>
            <p className="text-[15px] text-muted-foreground leading-[1.75] mb-5">
              J'en avais assez de voir des bonnes entreprises perdre des clients à cause d'une image peu professionnelle. Des équipes brillantes, habillées n'importe comment, qui laissaient une première impression catastrophique.
            </p>
            <p className="text-[15px] text-muted-foreground leading-[1.75] mb-5">
              J'ai créé Vision pour que chaque entrepreneur puisse avoir l'air d'une grande entreprise — sans budget de grande entreprise. Ton logo, tes vêtements, livré en 5 jours. Simple. Garanti.
            </p>
            <p className="text-[15px] text-muted-foreground leading-[1.75]">
              Depuis, on a habillé plus de <strong className="text-foreground">500 équipes</strong>. Et chaque fois que je vois un client arriver à un événement avec notre merch sur le dos, je sais qu'on a fait notre job.
            </p>
            <div className="text-[22px] text-primary italic font-bold mt-6">— Sam</div>
            <div className="text-[12px] text-muted-foreground mt-1">Fondateur, Vision Affichage · 2021</div>
          </div>

          <div className="relative">
            <div className="w-full rounded-3xl aspect-[4/5] gradient-navy-dark" />
            <div className="absolute bottom-5 left-5 right-5 bg-card/95 backdrop-blur-[10px] rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 gradient-navy rounded-[10px] flex items-center justify-center text-lg flex-shrink-0">
                🏆
              </div>
              <div>
                <div className="text-[12px] font-semibold text-foreground">+33 000 produits livrés</div>
                <div className="text-[11px] text-muted-foreground">Depuis 2021 · Québec</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 px-6 md:px-10 bg-secondary border-t border-border">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[11px] font-bold tracking-[2px] uppercase text-primary mb-2.5">Boutique</div>
          <h2 className="text-[clamp(26px,3.5vw,40px)] font-extrabold tracking-[-1px] text-foreground mb-9">
            Nos produits populaires
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !products || products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {products.slice(0, 8).map((product) => (
                <ProductCard key={product.node.id} product={product} />
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              to="/products"
              className="text-[15px] font-bold text-primary-foreground gradient-navy px-8 py-3.5 rounded-full inline-block transition-opacity hover:opacity-85 shadow-navy"
            >
              Voir tous les produits →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 px-6 md:px-10 text-center" style={{ background: 'linear-gradient(180deg, hsl(var(--secondary)), hsl(var(--background)))' }}>
        <div className="inline-block bg-accent/12 border border-accent/25 text-accent text-[11px] font-bold tracking-[2px] px-4 py-1.5 rounded-full mb-5">
          ⚡ OFFRE LIMITÉE
        </div>
        <h2 className="text-[clamp(36px,5vw,62px)] font-extrabold tracking-[-2px] text-foreground mb-3.5 leading-none">
          Prêt à habiller<br />ton équipe?
        </h2>
        <p className="text-[15px] text-muted-foreground mb-9">
          Commande aujourd'hui, reçois en 5 jours ouvrables.
        </p>
        <Link
          to="/products"
          className="text-[17px] font-extrabold text-primary-foreground gradient-navy border-none px-12 py-[18px] rounded-full cursor-pointer transition-all shadow-navy hover:-translate-y-0.5 hover:shadow-navy-lg inline-block"
        >
          Voir les produits →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 md:px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-lg font-extrabold text-foreground/40 tracking-tight">VISION</span>
        <div className="flex gap-6">
          <Link to="/" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">Accueil</Link>
          <Link to="/products" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">Boutique</Link>
        </div>
        <span className="text-[12px] text-muted-foreground">© {new Date().getFullYear()} Vision Affichage</span>
      </footer>

      <BottomNav />
    </div>
  );
}
