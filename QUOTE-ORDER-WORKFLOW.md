# Quote & Order Workflow — Phase 3

User asks (verbatim, 2026-04-20):

> "Je veux que dans le admin dashboard pour chaque 1 produit, ils peuvent choisir les couleurs avec la palette de couleurs et des couleurs différentes avec taille différente et quantité différente et pour chaque produit décider place du logo et si c'est devant + dos, dos, devant et montrer les frais qui sont les mêmes que sur notre Shopify, assure-toi que les prix soient les mêmes aussi, le but c'est que quand le client reçoit sa merch, lui ce qui reçoit c'est ça et ils reçoivent l'endroit pour confirmer la commande, upload son logo, remplir ses infos et payer."

> "Au niveau des vendeurs… les ventes, etc. ? Soit link au Shopify et matcher les opportunités avec GoaLevo… matches les deux ensemble… les assignés sur GoaLevo. C'est les vendeurs qui ont généré cette vente là, donc les vendeurs, ils ont une place avec les commissions. Tu peux voir combien d'années ils ont généré. Ils ont 10 % de la vente et tu peux voir combien qu'ils ont fait."

> "Je voulais pas tout le temps link les opportunités ensemble Shopify avec GoaLevo, faque c'est tout le temps les mêmes qu'on voit dans le dashboard. Il faut pouvoir traiter nos commandes directement sur ce site. Quelqu'un ajoute dans son panier et paye sur le site → commandes → on voit le logo qu'on a mis qui est transféré et converti en SVG pour nous déjà, ça c'est super important."

> "On arrive sur notre commande de client, on peut l'ingérer. Il upload son logo, fait sa commande de merch, qu'il vienne de soumission ou du site web, c'est la même chose. Logo transféré en SVG. Beau dashboard pour download le logo en SVG. On voit le nombre de merchs, nombre de couleurs, super simple, super clean, connecté avec Shopify, statuts comme des projets. Teste le site aussi."

---

## Phase A — Per-product quote builder (admin-side, HIGHEST PRIORITY)

The vendor/admin picks a product, builds a spec, and sends a one-click accept link to the client. The client confirms, uploads a logo, fills info, pays.

- [ ] A1. /admin/quotes/new: product picker (searchable, thumbnail, real Shopify price shown)
- [ ] A2. Color palette per product: multi-select swatches — only colors the product actually stocks (pulled from Shopify variants, filtered through COLOR_IMAGES)
- [ ] A3. Per-color size/quantity breakdown: matrix of rows (colors) × columns (sizes XS/S/M/L/XL/XXL/3XL), cells are qty inputs
- [ ] A4. Logo placement selector per product: "Devant seulement" · "Dos seulement" · "Devant + dos" (with preview of where it'll go)
- [ ] A5. Print/decoration fee: read from existing `PRINT_PRICE` per zone (matches Shopify). Multi-location pricing aggregates.
- [ ] A6. Base product price: pulled live from Shopify Storefront API (NOT hardcoded) — assert parity at quote-save time
- [ ] A7. Bulk-discount preview: show threshold (12+ = 15% off) in the quote summary, auto-applied when total qty crosses
- [ ] A8. Tax preview: GST 5% + QST 9.975% (from admin settings, editable in D2)
- [ ] A9. Multi-product quote: add a second/third product to the same quote (tabs or accordion)
- [ ] A10. Quote save → generates shareable link `/quote/:id` (QuoteAccept already exists, check it handles this flow)
- [ ] A11. Send-to-client button: emails a polished link via Zapier→Outlook (integration from G1)
- [ ] A12. Quote status tracking: draft / sent / viewed / accepted / paid / rejected (persisted + visible in /admin/quotes list)
- [ ] A13. Client-side /quote/:id confirmation page: **ultra clean** — show all products, quantities, logo placement, total; ONE prominent "Confirmer et payer" CTA
- [ ] A14. Logo upload on the client confirmation page: drag-drop zone with SVG/PNG/JPG accept
- [ ] A15. Client info form: company name, contact name, email, phone, shipping address (pre-fill from Shopify customer if email matches)
- [ ] A16. Stripe / Shopify checkout redirect after logo + info submitted
- [ ] A17. "Accepted → pending production" state triggers an admin email
- [ ] A18. PDF export of the quote (so the vendor can send offline if needed)

## Phase B — Logo → SVG conversion pipeline

The money ask: every uploaded raster logo gets auto-converted to SVG so production can download it print-ready.

- [ ] B1. Client uploads logo on /quote/:id confirmation page or on customizer
- [ ] B2. Background worker (Supabase Edge Function) runs the raster → SVG conversion (use existing Replicate / OpenAI or a vectorizer like potrace-wasm for client-side fallback)
- [ ] B3. Store both: raw upload (in vision-logos bucket) + generated SVG (in vision-logos-svg)
- [ ] B4. In /admin/orders/:id, show both original + SVG with "Download SVG" button
- [ ] B5. Fallback: if conversion fails, show a "Manually vectorize" CTA that opens the raw in Illustrator/Inkscape download link
- [ ] B6. Logo preview in the order detail with aspect-ratio-preserved thumbnail
- [ ] B7. Multiple logos per order (one per product/placement): grid layout

## Phase C — Orders dashboard (site-paid + from-quote unified)

Today: paid orders from Shopify → admin shows them (AdminOrders.tsx). Quote-accepted orders also end up here.

- [ ] C1. /admin/orders: unify Shopify orders + quote-accepted orders in ONE list
- [ ] C2. Each row: order #, customer, total, status, merch count, color count, age
- [ ] C3. Filter: "De Shopify" · "De soumission" · "Tous"
- [ ] C4. Click row → /admin/orders/:id full page showing:
  - Summary: customer info, total, tax breakdown, shipping address
  - Line items: for each product, the per-size-per-color breakdown
  - Logo section: uploaded logo(s), SVG conversion status, download buttons
  - Placement diagrams: visual showing where logo goes on each product
  - Status tracker (project-style): New → Logo reçu → En production → Expédié → Livré
  - Status update buttons
  - Notes field (internal)
  - Send-update-to-client button
- [ ] C5. Order status transitions are timestamped + logged (who + when)
- [ ] C6. Cart-paid orders from the site automatically land here with logo attached
- [ ] C7. Per-order commission row: which salesman gets credit

## Phase D — Salesman (Vendor) commission tracking

Currently `/vendor/*` exists. Extend.

- [ ] D1. /vendor/dashboard: quick stats — this month's sales, commission earned, # orders
- [ ] D2. Commission rate: per-salesman configurable (default 10%)
- [ ] D3. Commission ledger: each order credited to the salesman with the commission amount
- [ ] D4. Payout-tracking: mark commissions as "paid / pending" with a payment date
- [ ] D5. Commission report: CSV export per month
- [ ] D6. Client list per salesman: which companies they've sold to
- [ ] D7. Leaderboard (optional, internal): ranking by volume — motivational
- [ ] D8. /admin/vendors extends to show per-vendor commission totals + paid vs pending

## Phase E — GoHighLevel (GHL / "GoaLevo") integration

User wants opportunities synced with GHL, but NOT auto-linked — manual matching keeps the admin dashboard clean.

- [ ] E1. /admin/integrations/ghl: connection setup (API key via Zapier → LeadConnector, already surfaced in Zapier tools list)
- [ ] E2. Pull GHL opportunities on demand (not continuous polling — button-triggered)
- [ ] E3. /admin/opportunities: list of GHL opps with status, owner, value
- [ ] E4. Manual link: "Link to Shopify order" button on an opportunity — creates a 1-1 mapping stored in localStorage (or Supabase if wired)
- [ ] E5. Once linked, commission credit propagates: the GHL opportunity owner becomes the salesman assignee on the order
- [ ] E6. Unlink + re-link supported
- [ ] E7. Unlinked opps are NOT shown in the main orders dashboard — they live in /admin/opportunities until explicitly linked
- [ ] E8. Bulk-link view: side-by-side Shopify orders + GHL opps, drag-line or checkbox to match

## Phase F — Site test + smoke verification

User explicitly asked: "Teste le site aussi." Automate what can be automated.

- [ ] F1. Playwright smoke test: homepage loads
- [ ] F2. Playwright: /products loads, at least one ProductCard visible, clicking navigates to /product/:handle without crash
- [ ] F3. Playwright: /product/:handle — no ErrorBoundary fallback (would catch the lazy TDZ class of bug)
- [ ] F4. Playwright: customizer opens from PDP, logo uploads, size qty input works
- [ ] F5. Playwright: /admin/login + /admin/dashboard + every sub-route renders without error
- [ ] F6. Playwright: /quote/:id with a seeded quote ID renders
- [ ] F7. CI hook to run the smoke pack on every push to main
- [ ] F8. Error-tracker wiring: Sentry or equivalent so prod crashes ping us

## Phase G — Visual polish (admin)

User: "des beaux visuels, un plus beau dashboard simple pour les vendeurs"

- [ ] G1. Admin dashboard landing: card-based KPI tiles (orders today, revenue MTD, open quotes, logos-awaiting-SVG)
- [ ] G2. Consistent iconography (lucide 1.5 stroke, 14/16/18 sizes) across every admin page
- [ ] G3. Status-badge system: single `<StatusBadge status="en-production" />` component reused everywhere
- [ ] G4. Table density toggle: compact / comfortable
- [ ] G5. Empty-state illustrations (not just text) on every empty list
- [ ] G6. Light/dark mode toggle (not critical — time-gated)
