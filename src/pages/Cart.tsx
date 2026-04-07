import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CartDrawer } from '@/components/CartDrawer';
import { useCartStore } from '@/stores/cartStore';
import { useLang } from '@/lib/langContext';
import { Minus, Plus, Trash2, Loader2, ShoppingCart, ArrowLeft, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function Cart() {
  const { lang } = useLang();
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl } = useCartStore();
  const [cartOpen, setCartOpen] = useState(false);

  const totalPrice = items.reduce(
    (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
    0,
  );
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) window.open(checkoutUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <div className="max-w-3xl mx-auto px-6 pt-20 pb-32">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === 'en' ? 'Continue shopping' : 'Continuer vos achats'}
        </Link>

        <div className="flex items-baseline gap-3 mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {lang === 'en' ? 'Your cart' : 'Votre panier'}
          </h1>
          {totalQty > 0 && (
            <span className="text-lg font-semibold text-muted-foreground">
              ({totalQty} {lang === 'en'
                ? `item${totalQty !== 1 ? 's' : ''}`
                : `article${totalQty !== 1 ? 's' : ''}`})
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-5">
              <ShoppingCart className="h-9 w-9 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg mb-1">
              {lang === 'en' ? 'Your cart is empty' : 'Votre panier est vide'}
            </p>
            <p className="text-sm text-muted-foreground/70 mb-6">
              {lang === 'en'
                ? 'Start by choosing a product and customizing it with your logo.'
                : 'Commencez par choisir un produit et personnalisez-le avec votre logo.'}
            </p>
            <Link
              to="/products"
              className="inline-block text-sm font-bold text-primary-foreground gradient-navy px-6 py-3 rounded-full shadow-navy"
            >
              {lang === 'en' ? 'See products' : 'Voir les produits'}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.variantId}
                className="flex gap-4 p-4 rounded-2xl border border-border bg-card"
              >
                <div className="w-20 h-20 bg-secondary rounded-xl overflow-hidden flex-shrink-0">
                  {item.product.node.images?.edges?.[0]?.node && (
                    <img
                      src={item.product.node.images.edges[0].node.url}
                      alt={item.product.node.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate text-foreground">{item.product.node.title}</h3>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.selectedOptions.map((o) => o.value).join(' · ')}
                    </p>
                  )}
                  <p className="font-extrabold text-primary mt-1.5">
                    {parseFloat(item.price.amount).toFixed(2)} {item.price.currencyCode}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      / {lang === 'en' ? 'unit' : 'unité'}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between flex-shrink-0">
                  <button
                    onClick={() => removeItem(item.variantId)}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive bg-transparent cursor-pointer transition-colors"
                    title={lang === 'en' ? 'Remove' : 'Supprimer'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      className="w-7 h-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent cursor-pointer transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      className="w-7 h-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent cursor-pointer transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Order summary */}
            <div className="rounded-2xl border border-border bg-card p-5 mt-6 space-y-3">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Order Summary' : 'Résumé de la commande'}
              </h2>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{lang === 'en' ? 'Subtotal' : 'Sous-total'}</span>
                  <span className="font-semibold text-foreground">
                    {totalPrice.toFixed(2)} {items[0]?.price.currencyCode}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{lang === 'en' ? 'Print & personalization' : 'Impression & personnalisation'}</span>
                  <span className="font-semibold text-green-600">
                    {lang === 'en' ? 'Included' : 'Incluse'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{lang === 'en' ? 'Taxes' : 'Taxes'}</span>
                  <span>{lang === 'en' ? 'Calculated at checkout' : 'Calculées au paiement'}</span>
                </div>
              </div>

              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-base font-extrabold">
                  {lang === 'en' ? 'Estimated total' : 'Total estimé'}
                </span>
                <span className="text-2xl font-extrabold text-primary">
                  {totalPrice.toFixed(2)} {items[0]?.price.currencyCode}
                </span>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-4 gradient-navy text-primary-foreground border-none rounded-xl text-[15px] font-extrabold cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ boxShadow: '0 8px 24px hsla(var(--navy), 0.35)' }}
                disabled={isLoading || isSyncing}
              >
                {isLoading || isSyncing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  lang === 'en' ? 'Place order →' : 'Passer la commande →'
                )}
              </button>

              <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" />
                {lang === 'en'
                  ? 'Secure Shopify checkout · Delivered in 5 business days'
                  : 'Paiement sécurisé Shopify · Livré en 5 jours ouvrables'}
              </p>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
