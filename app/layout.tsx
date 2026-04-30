import type { ReactNode } from 'react';
import './globals.css';

// Root layout simply forwards children. The locale layout under [locale]/layout.tsx
// renders the actual <html>/<body>. next-intl requires the locale layout to own the
// document for proper RSC handling.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
