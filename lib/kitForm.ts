import { z } from 'zod';

export const kitOrderSchema = z.object({
  kitId: z.enum(['starter', 'workwear', 'corporate']),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  company: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(2),
  postalCode: z.string().regex(/^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/),
  country: z.literal('CA'),
  language: z.enum(['fr', 'en']),
  // CASL: must be explicitly true; default unchecked at form layer.
  marketingConsent: z.boolean(),
});

export type KitOrderValues = z.infer<typeof kitOrderSchema>;

export type StoredKitOrder = {
  orderNumber: string;
  createdAt: string;
  kitId: KitOrderValues['kitId'];
  priceCents: number;
  contact: {
    name: string;
    email: string;
    phone: string;
    company: string;
    language: 'fr' | 'en';
    marketingConsent: boolean;
  };
  shipping: {
    addressLine1: string;
    city: string;
    province: string;
    postalCode: string;
    country: 'CA';
  };
};
