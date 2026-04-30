'use client';

import { NewsletterSignup } from '@/components/NewsletterSignup';
import type { Locale } from '@/lib/types';

type Props = {
  locale: Locale;
  defaultEmail?: string;
};

export function InfolettreClient({ locale, defaultEmail }: Props) {
  return (
    <NewsletterSignup
      variant="page"
      locale={locale}
      defaultEmail={defaultEmail}
    />
  );
}
