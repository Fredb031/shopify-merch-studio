import { lazy, Suspense } from 'react';

// AIChat is mounted on every page (Index, Products, ProductDetail, Cart,
// Checkout, Account, TrackOrder, NotFound) but initially renders nothing
// more than a floating button that only opens on user click. The panel
// body ships ~23 KB of source (8 lucide icons, bilingual menu + chat
// UI, transcript plumbing) that otherwise lands in the eager route
// chunks — inflating the initial JS every visitor downloads before
// first paint.
//
// Defer the implementation: `@/components/AIChat` is now a tiny shim
// that lazy-loads the real panel in its own chunk. The Suspense
// fallback is null — the FAB was never above-the-fold (bottom-right
// floating element), so briefly omitting it while the chunk streams
// in is invisible to the user. The first render of Index drops the
// AIChat weight entirely.
const AIChatPanel = lazy(() =>
  import('./AIChatPanel').then(m => ({ default: m.AIChatPanel })),
);

export function AIChat() {
  return (
    <Suspense fallback={null}>
      <AIChatPanel />
    </Suspense>
  );
}
