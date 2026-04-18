import type { Address } from './admin';

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'expired' | 'cancelled';

export interface QuoteLineItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  sku: string;
  variantId?: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  placementZones: string[];
  placementNote?: string;
  logoPlacementPreview?: string;
}

export type DiscountKind = 'percent' | 'flat';

export interface QuoteDiscount {
  kind: DiscountKind;
  value: number;
  reason?: string;
}

export interface Quote {
  id: string;
  token: string;
  vendorId: string;
  vendorName: string;
  clientEmail: string;
  clientName?: string;
  clientCompany?: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discount?: QuoteDiscount;
  tax: number;
  total: number;
  currency: 'CAD' | 'USD';
  shippingAddress?: Address;
  logoUploadUrl?: string;
  termsAccepted: boolean;
  status: QuoteStatus;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  paidAt?: string;
  expiresAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDraftInput {
  clientEmail: string;
  clientName?: string;
  clientCompany?: string;
  lineItems: Omit<QuoteLineItem, 'id'>[];
  discount?: QuoteDiscount;
  notes?: string;
}
