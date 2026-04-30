import { z } from 'zod';

export const contactSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().min(1),
  language: z.enum(['fr', 'en']),
  // CASL: must be explicitly true, default unchecked at form layer.
  marketingConsent: z.boolean(),
});

export const shippingSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  province: z.string().min(2),
  postalCode: z.string().regex(/^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/),
  country: z.literal('CA'),
});

export const billingSchema = shippingSchema.extend({
  sameAsShipping: z.boolean().optional(),
});

export const paymentSchema = z.object({
  cardNumber: z.string().min(12),
  cardExpiry: z.string().regex(/^\d{2}\/\d{2}$/),
  cardCvc: z.string().regex(/^\d{3,4}$/),
  cardName: z.string().min(1),
});

export const orderFormSchema = contactSchema
  .merge(shippingSchema)
  .merge(billingSchema)
  .merge(paymentSchema);

export type ContactValues = z.infer<typeof contactSchema>;
export type ShippingValues = z.infer<typeof shippingSchema>;
export type BillingValues = z.infer<typeof billingSchema>;
export type PaymentValues = z.infer<typeof paymentSchema>;
export type OrderFormValues = z.infer<typeof orderFormSchema>;

export const CONTACT_FIELDS = [
  'email',
  'phone',
  'firstName',
  'lastName',
  'company',
  'language',
  'marketingConsent',
] as const;

export const SHIPPING_FIELDS = [
  'addressLine1',
  'addressLine2',
  'city',
  'province',
  'postalCode',
  'country',
] as const;

export const BILLING_FIELDS = [
  'sameAsShipping',
  'addressLine1',
  'addressLine2',
  'city',
  'province',
  'postalCode',
  'country',
] as const;

export const PAYMENT_FIELDS = [
  'cardNumber',
  'cardExpiry',
  'cardCvc',
  'cardName',
] as const;

export const QC_PROVINCES = [
  { code: 'QC', label: 'Québec' },
  { code: 'ON', label: 'Ontario' },
  { code: 'NB', label: 'Nouveau-Brunswick' },
  { code: 'NS', label: 'Nouvelle-Écosse' },
  { code: 'PE', label: 'Île-du-Prince-Édouard' },
  { code: 'NL', label: 'Terre-Neuve-et-Labrador' },
  { code: 'MB', label: 'Manitoba' },
  { code: 'SK', label: 'Saskatchewan' },
  { code: 'AB', label: 'Alberta' },
  { code: 'BC', label: 'Colombie-Britannique' },
  { code: 'YT', label: 'Yukon' },
  { code: 'NT', label: 'Territoires du Nord-Ouest' },
  { code: 'NU', label: 'Nunavut' },
] as const;

export type StoredOrder = {
  orderNumber: string;
  createdAt: string;
  contact: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    company: string;
    language: 'fr' | 'en';
    marketingConsent: boolean;
  };
  shipping: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: 'CA';
  };
  billing: {
    sameAsShipping: boolean;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: 'CA';
  };
  items: Array<{
    productId: string;
    variantKey: string;
    productSlug: string;
    titleFr: string;
    titleEn: string;
    color: string;
    size: string;
    qty: number;
    unitPriceCents: number;
  }>;
  totals: {
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
};
