import { z } from 'zod';

export const QUOTE_INDUSTRY_SLUGS = [
  'construction',
  'paysagement',
  'restauration',
  'demenagement',
  'metiers',
  'bureau',
] as const;

export type QuoteIndustrySlug = (typeof QUOTE_INDUSTRY_SLUGS)[number];

/**
 * Add 5 business days (Mon-Fri only) to the given date.
 */
export function addBusinessDays(start: Date, days: number): Date {
  const out = new Date(start);
  out.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < days) {
    out.setDate(out.getDate() + 1);
    const day = out.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return out;
}

export function getMinNeededByDate(now: Date = new Date()): Date {
  return addBusinessDays(now, 5);
}

export function formatDateInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const scopeSchema = z.object({
  employeeCount: z.number({ message: 'required' }).int().min(1).max(10000),
  neededBy: z
    .string()
    .regex(isoDateRegex, 'neededByInvalid')
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return false;
      const min = getMinNeededByDate();
      return parsed.getTime() >= min.getTime();
    }, 'neededByTooSoon'),
  industry: z.enum(QUOTE_INDUSTRY_SLUGS),
});

export const productSelectionSchema = z.object({
  productIds: z
    .array(z.string().min(1))
    .min(1, 'productsRequired')
    .max(50),
});

export const logoFileMetaSchema = z.object({
  name: z.string().min(1),
  size: z.number().int().min(0),
  type: z.string().min(1),
});

export const logoSchema = z
  .object({
    logoMode: z.enum(['ready', 'pending']),
    logoFileMeta: logoFileMetaSchema.optional(),
    logoDescription: z.string().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.logoMode === 'ready') {
      if (!value.logoFileMeta) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['logoFileMeta'],
          message: 'logoFileRequired',
        });
      }
      return;
    }
    const desc = value.logoDescription?.trim() ?? '';
    if (desc.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['logoDescription'],
        message: 'logoDescriptionRequired',
      });
    }
  });

const POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/;

export const shippingSchema = z
  .object({
    shippingMode: z.enum(['single', 'multiple']),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.literal('CA').optional(),
    locations: z.string().max(4000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.shippingMode === 'single') {
      if (!value.addressLine1 || value.addressLine1.trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addressLine1'],
          message: 'required',
        });
      }
      if (!value.city || value.city.trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['city'],
          message: 'required',
        });
      }
      if (!value.province || value.province.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['province'],
          message: 'required',
        });
      }
      if (!value.postalCode || !POSTAL_REGEX.test(value.postalCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['postalCode'],
          message: 'postalCode',
        });
      }
    } else {
      const locs = value.locations?.trim() ?? '';
      if (locs.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locations'],
          message: 'locationsRequired',
        });
      }
    }
  });

export const contactSchema = z.object({
  name: z.string().min(1, 'required'),
  email: z.string().email('email'),
  phone: z.string().min(10, 'phone'),
  company: z.string().min(1, 'required'),
  language: z.enum(['fr', 'en']),
  notes: z.string().max(1000).optional(),
  transactionalConsent: z.boolean(),
  marketingConsent: z.boolean(),
});

const baseQuoteShape = z.object({
  employeeCount: z.number().int().min(1).max(10000),
  neededBy: z.string().regex(isoDateRegex),
  industry: z.enum(QUOTE_INDUSTRY_SLUGS),
  productIds: z.array(z.string().min(1)).min(1).max(50),
  logoMode: z.enum(['ready', 'pending']),
  logoFileMeta: logoFileMetaSchema.optional(),
  logoDescription: z.string().max(1000).optional(),
  shippingMode: z.enum(['single', 'multiple']),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.literal('CA').optional(),
  locations: z.string().max(4000).optional(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  company: z.string().min(1),
  language: z.enum(['fr', 'en']),
  notes: z.string().max(1000).optional(),
  transactionalConsent: z.boolean(),
  marketingConsent: z.boolean(),
});

export const quoteFormSchema = baseQuoteShape;

export type ScopeValues = z.infer<typeof scopeSchema>;
export type ProductSelectionValues = z.infer<typeof productSelectionSchema>;
export type LogoValues = z.infer<typeof logoSchema>;
export type ShippingValues = z.infer<typeof shippingSchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type QuoteFormValues = z.infer<typeof quoteFormSchema>;

export const SCOPE_FIELDS = ['employeeCount', 'neededBy', 'industry'] as const;
export const PRODUCT_FIELDS = ['productIds'] as const;
export const LOGO_FIELDS = [
  'logoMode',
  'logoFileMeta',
  'logoDescription',
] as const;
export const SHIPPING_FIELDS = [
  'shippingMode',
  'addressLine1',
  'city',
  'province',
  'postalCode',
  'country',
  'locations',
] as const;
export const CONTACT_FIELDS = [
  'name',
  'email',
  'phone',
  'company',
  'language',
  'notes',
  'transactionalConsent',
  'marketingConsent',
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

export const LOGO_FILE_ACCEPT =
  '.pdf,.ai,.svg,.png,.jpg,.jpeg,application/pdf,image/svg+xml,image/png,image/jpeg';

export type StoredQuote = {
  quoteId: string;
  createdAt: string;
  scope: {
    employeeCount: number;
    neededBy: string;
    industry: QuoteIndustrySlug;
  };
  products: { productIds: string[] };
  logo: {
    logoMode: 'ready' | 'pending';
    logoFileMeta?: { name: string; size: number; type: string };
    logoDescription?: string;
  };
  shipping: {
    shippingMode: 'single' | 'multiple';
    addressLine1?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: 'CA';
    locations?: string;
  };
  contact: {
    name: string;
    email: string;
    phone: string;
    company: string;
    language: 'fr' | 'en';
    notes?: string;
    transactionalConsent: boolean;
    marketingConsent: boolean;
  };
};
