import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ShopifyProduct } from '@/lib/shopify';
import { ProductCustomizer } from '@/components/customizer/ProductCustomizer';
import { findProductByHandle, matchProductByTitle } from '@/data/products';
import { useLang } from '@/lib/langContext';

interface ProductCardProps { product: ShopifyProduct; }

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useLang();
  const { node } = product;
  const [open, setOpen] = useState(false);

  const image = node.images.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;

  // Match to local product by handle or title
  const local = findProductByHandle(node.handle) ?? matchProductByTitle(node.title);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="group border border-border rounded-[18px] overflow-hidden bg-card cursor-pointer transition-all duration-300 hover:border-primary/25 hover:shadow-[0_12px_32px_rgba(27,58,107,0.12)] hover:-translate-y-0.5"
      >
        {/* Image */}
        <div className="relative overflow-hidden bg-secondary" style={{ aspectRatio: '1' }}>
          {image ? (
            <img
              src={image.url}
              alt={image.altText || node.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Pas d'image</div>
          )}

          {/* "Votre logo" ghost — disparaît au hover */}
          <div className="absolute left-1/2 top-[33%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[2] transition-opacity duration-300 group-hover:opacity-0">
            <svg width="62" height="32" viewBox="0 0 62 32" fill="none">
              <rect x="0.5" y="0.5" width="61" height="31" rx="5.5" fill="white" fillOpacity="0.72" stroke="rgba(27,58,107,0.28)" strokeDasharray="3 2.5"/>
              <text x="31" y="19.5" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="8" fontWeight="700" fill="rgba(27,58,107,0.42)" letterSpacing="0.5">VOTRE LOGO</text>
            </svg>
          </div>

          {/* Hover CTA */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 z-[3]">
            <span className="text-[11px] font-extrabold px-4 py-2 rounded-full bg-white/95 text-primary shadow-lg border border-primary/15 translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
              {t('personnaliserProduit')} →
            </span>
          </div>

          {/* Colour swatches */}
          {local && (
            <div className="absolute bottom-2 left-2 flex gap-1 z-[4]">
              {local.colors.slice(0, 7).map(c => (
                <div key={c.id} className="w-3.5 h-3.5 rounded-full ring-1 ring-white/60 shadow-sm" style={{ background: c.hex }} title={c.name} />
              ))}
              {local.colors.length > 7 && (
                <div className="w-3.5 h-3.5 rounded-full bg-white/80 ring-1 ring-white/50 flex items-center justify-center text-[7px] font-bold text-foreground">
                  +{local.colors.length - 7}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5 pb-4">
          <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wide mb-0.5">{local?.sku ?? ''}</p>
          <div className="text-[13px] font-bold text-foreground truncate">{node.title}</div>
          {local?.description && (
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{local.description.split('.')[0]}.</div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[13px] font-extrabold text-primary">Dès {parseFloat(price.amount).toFixed(2)} $</span>
            <span className="text-[10px] font-bold text-muted-foreground border border-border px-2 py-0.5 rounded-full group-hover:border-primary group-hover:text-primary transition-colors">
              Personnaliser
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && local && (
          <ProductCustomizer productId={local.id} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
