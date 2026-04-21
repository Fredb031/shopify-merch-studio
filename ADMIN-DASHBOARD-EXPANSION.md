# Admin Dashboard Expansion — Phase 2

User priorities (verbatim):
- "I want a setting in admin dashboard where I can see my automation"
- "my emails template that are getting and send and can edit them"
- "all of the admin things that are needed to be seen and able to custom them from the admin dashboard"
- "I want to be able to add roles, etc."
- "make sure admin and salesman have access to what they need only"
- "make sure there's no bugs there, make sure that all of the dashboard works"

## Phase A — Email templates UI (HIGHEST PRIORITY)

- [ ] A1. /admin/emails/templates: list all template files in src/lib/emailTemplates.ts as cards
- [ ] A2. Per-template inline editor: subject + HTML body + preview pane
- [ ] A3. Save edited template back to localStorage (or expose download for paste-into-source)
- [ ] A4. Send-test button per template (via Outlook/Zapier integration once wired)
- [ ] A5. Sent-mail log: show recent sends with timestamp, recipient, template, status
- [ ] A6. Bounce/error log per send
- [ ] A7. Variables reference: list `{{clientName}}`, `{{quoteNumber}}` etc with auto-completion in editor
- [ ] A8. Copy-template-as-HTML button (for pasting into Mailchimp/Resend/Brevo)
- [ ] A9. Template diff vs default (show what was customized)
- [ ] A10. Reset-to-default button per template

## Phase B — Automation viewer

- [ ] B1. /admin/automations: list of active triggers (Zapier zaps, Shopify webhooks, internal cron)
- [ ] B2. Each automation row: name, trigger event, action, status (active/paused), last fired
- [ ] B3. Click to view recent executions (last 20) with success/error
- [ ] B4. Pause/resume toggle (writes to localStorage flag for app-side; external would need Zapier API)
- [ ] B5. Add-automation modal: pre-filled templates for common scenarios (new order → send confirmation, abandoned cart → reminder after 1h/24h/72h, vendor payout → monthly Friday)
- [ ] B6. Automation drag-reorder (priority ordering)
- [ ] B7. Automation logs export (CSV)

## Phase C — Roles & permissions

- [ ] C1. /admin/users existing — extend with: per-role permission matrix
- [ ] C2. Define permissions: read/write per resource (orders, customers, products, vendors, quotes, settings, emails, images, automations)
- [ ] C3. Role catalog: president (all), admin (all except billing), vendor (own quotes + own commissions), client (own orders)
- [ ] C4. Inline per-user permission overrides (grant/revoke specific permission)
- [ ] C5. Permission middleware: route guards check `user.permissions.has('orders:write')`
- [ ] C6. Permission matrix view: rows = users, columns = permissions, cells = ✓/✗
- [ ] C7. Audit log of permission changes
- [ ] C8. Bulk role assignment
- [ ] C9. Role-based navigation: hide nav items the user can't access
- [ ] C10. "Acting as" mode: president can preview the site as another role

## Phase D — Settings expansion

- [ ] D1. Brand settings: logo upload, primary color, secondary color (already partly there)
- [ ] D2. Tax settings: GST/QST rates (currently hardcoded 5% + 9.975%)
- [ ] D3. Shipping zones: postal-code → zone → cost mapping
- [ ] D4. Shipping methods: standard/express/overnight with custom names + ETAs
- [ ] D5. Discount codes admin: create/edit/delete VISION10/15/20 + custom codes
- [ ] D6. Bulk-discount thresholds: edit BULK_DISCOUNT_THRESHOLD (currently 12) and BULK_DISCOUNT_RATE (15%)
- [ ] D7. Print pricing: edit PRINT_PRICE per zone
- [ ] D8. Vendor commission %: edit per vendor or global default
- [ ] D9. Notification preferences: which events trigger admin email
- [ ] D10. Webhook outbound URLs: /admin/settings/webhooks
- [ ] D11. API keys: show/regenerate Storefront API token, Supabase anon, Replicate, OpenAI
- [ ] D12. Backup/restore: download all admin localStorage as JSON; upload to restore

## Phase E — Customer/CRM

- [ ] E1. Customer detail page (currently in drawer): full page with order history, lifetime value, tags
- [ ] E2. Add internal note per customer
- [ ] E3. Tag manager: create/delete tags, bulk-apply to customers
- [ ] E4. Segment builder: filter customers by tag/spend/recency
- [ ] E5. Email blast to segment

## Phase F — Bug-prone surfaces to harden

- [ ] F1. Defensive guards on every PRODUCTS lookup (already started)
- [ ] F2. Defensive guards on every Shopify response (already started)
- [ ] F3. Try/catch on every localStorage parse
- [ ] F4. Null-safe on every nested object access
- [ ] F5. Boundary clamps on every numeric input
- [ ] F6. Never use `arr[0]` without `Array.isArray(arr) && arr.length > 0`
- [ ] F7. Replace every `.toFixed()` with locale-aware fmtMoney helper
- [ ] F8. Every form: double-submit guard
- [ ] F9. Every async chain: cleanup on unmount
- [ ] F10. Every blob URL: revoke on cleanup

## Outlook/Zapier integration (newly available)

- [ ] G1. Wire `mcp__zapier__anthropic_claude_send_message` for send-test in template editor
- [ ] G2. Outlook compose UI in admin: To / Subject / Body
- [ ] G3. Sent log persisted (read-only display from Outlook via Zapier)
- [ ] G4. Inbox view (recent messages from Outlook)
