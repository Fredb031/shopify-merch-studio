export type LogoPlacement = {
  zoneId: string;
  mode: 'preset' | 'manual';
  x?: number;
  y?: number;
  width?: number;
  rotation?: number;
  originalFile?: File;
  processedUrl?: string;
  previewUrl?: string;
};

export type SizeQuantity = {
  size: string;
  quantity: number;
};

export type ProductView = 'front' | 'back';

/** Which sides the customer wants printed. Drives whether the modal asks
 * for a front placement, a back placement, both, or neither. */
export type PlacementSides = 'none' | 'front' | 'back' | 'both';

export type CustomizationState = {
  productId: string | null;
  colorId: string | null;
  /** Front-side placement (used when placementSides is 'front' or 'both'). */
  logoPlacement: LogoPlacement | null;
  /** Back-side placement (used when placementSides is 'back' or 'both'). */
  logoPlacementBack: LogoPlacement | null;
  /** Chosen printing sides. Default 'front'. */
  placementSides: PlacementSides;
  sizeQuantities: SizeQuantity[];
  activeView: ProductView;
  step: 1 | 2 | 3 | 4;
};

export type CartItemCustomization = CustomizationState & {
  cartId: string;
  productName: string;
  previewSnapshot: string;
  unitPrice: number;
  totalQuantity: number;
  totalPrice: number;
  addedAt: Date;
  /** Shopify variant IDs for each (color, size) sub-line that was synced
   * to the Shopify cart. Used to remove from Shopify when this local
   * cart line is removed. */
  shopifyVariantIds?: string[];
};
