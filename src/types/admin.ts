export type UserRole = 'admin' | 'vendor' | 'client';

export interface BaseUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  lastActiveAt?: string;
}

export interface AdminUser extends BaseUser {
  role: 'admin';
  permissions: Array<'orders' | 'products' | 'vendors' | 'settings' | 'billing'>;
}

export interface VendorUser extends BaseUser {
  role: 'vendor';
  commissionRate: number;
  quotesSent: number;
  conversionRate: number;
  totalRevenue: number;
}

export interface ClientUser extends BaseUser {
  role: 'client';
  company?: string;
  phone?: string;
  shippingAddress?: Address;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export type OrderStatus = 'pending' | 'processing' | 'printing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderSummary {
  id: string;
  number: string;
  clientName: string;
  clientEmail: string;
  itemsCount: number;
  total: number;
  currency: 'CAD' | 'USD';
  status: OrderStatus;
  placedAt: string;
  shopifyOrderId?: string;
  vendorId?: string;
}
