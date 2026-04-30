export type SanmarColor = { name: string; hex: string; available: boolean };

export type SanmarProduct = {
  styleNumber: string;
  productName: string;
  brandName: string;
  description: string;
  category: string;
  status: 'active' | 'discontinued';
  colors: SanmarColor[];
  sizes: string[];
  imageUrl?: string;
};

export type WarehouseLevel = {
  warehouseId: number;
  warehouseName: 'Vancouver' | 'Mississauga' | 'Calgary';
  quantity: number;
  futureQuantities: Array<{ quantity: number; expectedDate: string }>;
};

export type SanmarInventory = {
  styleNumber: string;
  color?: string;
  size?: string;
  locations: WarehouseLevel[];
  total: number;
};

export type PriceBreak = {
  minQuantity: number;
  maxQuantity: number | null;
  priceCad: number;
};

export type SanmarPricing = {
  styleNumber: string;
  color?: string;
  size?: string;
  currency: 'CAD';
  fobId: 'CUSTOMER';
  priceType: 'BLANK';
  breaks: PriceBreak[];
};

export type SanmarSourceTag = 'cache' | 'fallback' | 'error';

export type SanmarFetchResult<T> = {
  data: T | null;
  source: SanmarSourceTag;
  error?: string;
};
