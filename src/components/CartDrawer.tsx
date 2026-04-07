import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Trash2, Tag, ChevronRight, Minus, Plus, Loader2, ExternalLink } from 'lucide-react';
import { useCartStore as useCustomizerCart } from '@/store/cartStore';
import { useCartStore as useShopifyCart } from '@/stores/cartStore';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  // Customizer-based cart (legacy items from the customizer flow)
  const customizerCart = useCustomizerCart();

  // Shopify real-time cart
  const shopifyCart = useShopifyCart();

  // Sync Shopify cart when drawer opens
  useEffect(() => {
    if (isOpen) shopifyCart.syncCart();
  }, [isOpen]);

  const hasCustomizerItems = customizerCart.items.length > 0;
  const hasShopifyItems = shopifyCart.items.length > 0;
  const isEmpty = !hasCustomizerItems && !hasShopifyItems;

  // Totals
  const customizerTotal = hasCustomizerItems ? customizerCart.getTotal() : 0;
  const shopifyTotal = shopifyCart.items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const grandTotal = customizerTotal + shopifyTotal;

  const totalItemCount = customizerCart.getItemCount() + shopifyCart.items.reduce((sum, i) => sum + i.quantity, 0);

  const handleCheckout = () => {
    const checkoutUrl = shopifyCart.getCheckoutUrl();
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/25 z-[490] backdrop-blur-[2px]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? '0%' : '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-card z-[500] shadow-2xl flex flex-col border-l border-border"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary" />
            <h2 className="text-base font-extrabold text-foreground">Mon panier</h2>
            {totalItemCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                {totalItemCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto p-5 space-y-3">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <ShoppingBag size={40} className="text-border" />
              <p className="text-sm text-muted-foreground font-medium">Ton panier est vide</p>
              <button onClick={onClose} className="text-xs font-bold text-primary underline">
                Explorer les produits
              </button>
            </div>
          ) : (
            <>
              {/* Shopify cart items */}
              {shopifyCart.items.map((item) => (
                <motion.div
                  key={item.variantId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  className="flex gap-3 p-3 border border-border rounded-xl bg-secondary/50"
                >
                  <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {item.product.node.images?.edges?.[0]?.node && (
                      <img
                        src={item.product.node.images.edges[0].node.url}
                        alt={item.product.node.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">{item.product.node.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.selectedOptions.map(o => o.value).join(' · ')}
                    </p>
                    <p className="text-xs font-extrabold text-primary mt-1">
                      {(parseFloat(item.price.amount) * item.quantity).toFixed(2)} {item.price.currencyCode}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => shopifyCart.removeItem(item.variantId)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => shopifyCart.updateQuantity(item.variantId, item.quantity - 1)}
                        className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary transition-colors"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        onClick={() => shopifyCart.updateQuantity(item.variantId, item.quantity + 1)}
                        className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary transition-colors"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Customizer cart items */}
              {customizerCart.items.map((item) => (
                <motion.div
                  key={item.cartId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  className="flex gap-3 p-3 border border-border rounded-xl bg-secondary/50"
                >
                  <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex-shrink-0 relative">
                    <img
                      src={item.previewSnapshot}
                      alt={item.productName}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.sizeQuantities.filter(s => s.quantity > 0).map(s => `${s.size}×${s.quantity}`).join(' · ')}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs font-extrabold text-primary">{item.totalPrice.toFixed(2)} $</p>
                      <span className="text-[10px] text-muted-foreground">
                        ({item.totalQuantity} unité{item.totalQuantity !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => customizerCart.removeItem(item.cartId)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 self-start mt-0.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {!isEmpty && (
          <div className="p-5 border-t border-border space-y-3 bg-card">
            {/* Total */}
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground font-medium">Total estimé</span>
              <span className="text-lg font-extrabold text-foreground">{grandTotal.toFixed(2)} $</span>
            </div>

            {/* Checkout */}
            {hasShopifyItems ? (
              <button
                className="w-full gradient-navy-dark text-primary-foreground font-extrabold text-sm py-4 rounded-full flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-50"
                style={{ boxShadow: '0 6px 20px hsla(var(--navy), 0.3)' }}
                onClick={handleCheckout}
                disabled={shopifyCart.isLoading || shopifyCart.isSyncing}
              >
                {shopifyCart.isLoading || shopifyCart.isSyncing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <ExternalLink size={14} />
                    Passer à la caisse Shopify
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            ) : (
              <button
                className="w-full gradient-navy-dark text-primary-foreground font-extrabold text-sm py-4 rounded-full flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px"
                style={{ boxShadow: '0 6px 20px hsla(var(--navy), 0.3)' }}
                onClick={onClose}
              >
                Continuer les achats
                <ChevronRight size={16} />
              </button>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              Livraison en 5 jours · Paiement sécurisé Shopify
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
};
