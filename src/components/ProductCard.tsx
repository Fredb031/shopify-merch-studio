import { Link } from 'react-router-dom';
import { ShopifyProduct } from '@/lib/shopify';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface ProductCardProps {
  product: ShopifyProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore(state => state.addItem);
  const isLoading = useCartStore(state => state.isLoading);
  const { node } = product;
  const image = node.images.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;
  const firstVariant = node.variants.edges[0]?.node;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firstVariant) return;
    await addItem({
      product,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: firstVariant.price,
      quantity: 1,
      selectedOptions: firstVariant.selectedOptions || [],
    });
    toast.success(`${node.title} ajouté au panier`, { position: 'top-center' });
  };

  return (
    <Link to={`/product/${node.handle}`} className="group block">
      <div className="overflow-hidden rounded-lg bg-secondary aspect-square mb-3">
        {image ? (
          <img
            src={image.url}
            alt={image.altText || node.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Pas d'image
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-sm truncate group-hover:text-accent transition-colors">{node.title}</h3>
        <div className="flex items-center justify-between">
          <p className="font-bold text-sm">
            {parseFloat(price.amount).toFixed(2)} {price.currencyCode}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handleAddToCart}
            disabled={isLoading || !firstVariant?.availableForSale}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </Link>
  );
}
