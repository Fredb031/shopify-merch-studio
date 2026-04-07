import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { Minus, Plus, Trash2, ExternalLink, Loader2, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Cart() {
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl } = useCartStore();
  const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);

  const handleCheckout = () => {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) window.open(checkoutUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Link to="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Continuer vos achats
        </Link>
        <h1 className="text-3xl font-black tracking-tight mb-8">Votre panier</h1>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg mb-4">Votre panier est vide</p>
            <Link to="/products"><Button>Voir les produits</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-4 p-4 rounded-lg border border-border">
                <div className="w-20 h-20 bg-secondary rounded-md overflow-hidden flex-shrink-0">
                  {item.product.node.images?.edges?.[0]?.node && (
                    <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{item.product.node.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.selectedOptions.map(o => o.value).join(' • ')}</p>
                  <p className="font-bold mt-1">{parseFloat(item.price.amount).toFixed(2)} {item.price.currencyCode}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.variantId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Total</span>
                <span className="text-2xl font-black">{totalPrice.toFixed(2)} {items[0]?.price.currencyCode}</span>
              </div>
              <Button onClick={handleCheckout} className="w-full font-bold" size="lg" disabled={isLoading || isSyncing}>
                {isLoading || isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ExternalLink className="w-4 h-4 mr-2" />Passer la commande</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
