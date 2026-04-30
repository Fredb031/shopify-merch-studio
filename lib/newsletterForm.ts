import { z } from 'zod';

export const newsletterSchema = z.object({
  email: z.string().email('email'),
  firstName: z.string().max(100).optional(),
  language: z.enum(['fr', 'en']),
  // CASL: must be explicitly true; default unchecked at form layer.
  caslConsent: z
    .boolean()
    .refine((value) => value === true, { message: 'caslRequired' }),
});

export type NewsletterFormValues = z.infer<typeof newsletterSchema>;

export type StoredNewsletterSubscription = {
  ref: string;
  createdAt: string;
  email: string;
  firstName?: string;
  language: 'fr' | 'en';
  caslConsent: true;
};
