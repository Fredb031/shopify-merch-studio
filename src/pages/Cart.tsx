import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { useCartStore } from '@/stores/cartStore';
import { Minus, Plus, Trash2, ExternalLink, Loader2, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function Cart() {
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl } = useCartStore();
  const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const [cartOpen, setCartOpen] = useState(false);

  const handleCheckout = () => {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) window.open(checkoutUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-3xl mx-auto px-6 pt-20 pb-32">
        <Link to="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Continuer vos achats
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Votre panier</h1>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg mb-4">Votre panier est vide</p>
            <Link to="/products" className="inline-block text-sm font-bold text-primary-foreground gradient-navy px-6 py-3 rounded-full shadow-navy">
              Voir les produits
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-4 p-4 rounded-2xl border border-border bg-card">
                <div className="w-20 h-20 bg-secondary rounded-xl overflow-hidden flex-shrink-0">
                  {item.product.node.images?.edges?.[0]?.node && (
                    <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{item.product.node.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.selectedOptions.map(o => o.value).join(' · ')}</p>
                  <p className="font-extrabold text-primary mt-1">{parseFloat(item.price.amount).toFixed(2)} {item.price.currencyCode}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button onClick={() => removeItem(item.variantId)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.variantId, item.quantity - 1)} className="w-7 h-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent cursor-pointer">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="w-7 h-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent cursor-pointer">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Total</span>
                <span className="text-2xl font-extrabold text-primary">{totalPrice.toFixed(2)} {items[0]?.price.currencyCode}</span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full py-4 gradient-navy text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={isLoading || isSyncing}
              >
                {isLoading || isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Passer la commande →</>}
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
