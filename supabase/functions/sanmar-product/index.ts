/**
 * Supabase Edge Function — sanmar-product
 *
 * Proxies SanMar Canada PromoStandards SOAP web services from the browser.
 * The browser cannot call SanMar directly because:
 *   1. CORS — SanMar does not whitelist browser origins
 *   2. Credentials must stay server-side (customerID + EDI password)
 *
 * Supported actions (POST body { action, productId, partId? }):
 *   - "product"    → Product Data 2.0.0   getProduct
 *   - "inventory"  → Inventory 2.0.0      getInventoryLevels
 *   - "media"      → Media Content 1.1.0  getMediaContent
 *   - "pricing"    → Pricing 1.0.0        getConfigurationAndPricing
 *
 * Required Supabase secrets (set with `supabase secrets set`):
 *   SANMAR_CUSTOMER_ID    — your SanMar Canada account ID
 *   SANMAR_PASSWORD       — registered EDI email used as the SOAP password
 *   SANMAR_MEDIA_PASSWORD — special media-content password (request from SanMar EDI team)
 *   SANMAR_ENV            — "uat" or "production" (defaults to "production")
 */

// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ID       = Deno.env.get('SANMAR_CUSTOMER_ID') ?? '';
const PASS     = Deno.env.get('SANMAR_PASSWORD') ?? '';
const MEDIA_PW = Deno.env.get('SANMAR_MEDIA_PASSWORD') ?? PASS;
const ENV      = (Deno.env.get('SANMAR_ENV') ?? 'production').toLowerCase();

const HOST = ENV === 'uat'
  ? 'https://edi.atc-apparel.com/uat-ws/promostandards'
  : 'https://edi.atc-apparel.com/pstd';

const ENDPOINTS = {
  product:   `${HOST}/productdata2.0/ProductDataServiceV2.php`,
  inventory: `${HOST}/inventory2.0/InventoryServiceV2.php`,
  media:     `${HOST}/mediacontent1.1/MediaContentService.php`,
  pricing:   `${HOST}/productpricingconfiguration/PricingAndConfigurationService.php`,
};

// ── XML helpers ────────────────────────────────────────────────────────────

const escape = (s: string) =>
  String(s).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' }[c]!));

async function soap(url: string, body: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '""' },
    body,
  });
  if (!res.ok) throw new Error(`SanMar ${res.status}: ${await res.text()}`);
  return await res.text();
}

// Tiny XML extractor — good enough for the flat PromoStandards responses we care about
function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-z0-9]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
const extractFirst = (xml: string, tag: string) => extractAll(xml, tag)[0] ?? null;

// ── Builders ───────────────────────────────────────────────────────────────

function buildGetProduct(productId: string, partId?: string, lang = 'en') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
  <Body>
    <GetProductRequest xmlns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
      <wsVersion>2.0.0</wsVersion>
      <id>${escape(ID)}</id>
      <password>${escape(PASS)}</password>
      <localizationCountry>CA</localizationCountry>
      <localizationLanguage>${escape(lang)}</localizationLanguage>
      <productId>${escape(productId)}</productId>
      ${partId ? `<partId>${escape(partId)}</partId>` : '<partId></partId>'}
      <colorName></colorName>
    </GetProductRequest>
  </Body>
</Envelope>`;
}

function buildGetInventory(productId: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
  <Body>
    <GetInventoryLevelsRequest xmlns="http://www.promostandards.org/WSDL/Inventory/2.0.0/">
      <wsVersion>2.0.0</wsVersion>
      <id>${escape(ID)}</id>
      <password>${escape(PASS)}</password>
      <productId>${escape(productId)}</productId>
    </GetInventoryLevelsRequest>
  </Body>
</Envelope>`;
}

function buildGetMedia(productId: string, partId?: string, lang = 'en') {
  // Note: namespace prefixes per the SanMar spec (page 71)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
  <Body>
    <GetMediaContentRequest xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/">
      <wsVersion xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">1.1.0</wsVersion>
      <id xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">${escape(ID)}</id>
      <password xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">${escape(MEDIA_PW)}</password>
      <cultureName xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">${escape(lang)}-CA</cultureName>
      <mediaType xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">Image</mediaType>
      <productId xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">${escape(productId)}</productId>
      <partId xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">${partId ? escape(partId) : ''}</partId>
      <classType>1006</classType>
    </GetMediaContentRequest>
  </Body>
</Envelope>`;
}

function buildGetPricing(productId: string, partId?: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
  <Body>
    <GetConfigurationAndPricingRequest xmlns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/">
      <wsVersion>1.0.0</wsVersion>
      <id>${escape(ID)}</id>
      <password>${escape(PASS)}</password>
      <productId>${escape(productId)}</productId>
      <partId>${partId ? escape(partId) : ''}</partId>
      <currency>CAD</currency>
      <fobId>1</fobId>
      <priceType>Customer</priceType>
      <localizationCountry>CA</localizationCountry>
      <localizationLanguage>en</localizationLanguage>
      <configurationType>Blank</configurationType>
    </GetConfigurationAndPricingRequest>
  </Body>
</Envelope>`;
}

// ── Parsers ────────────────────────────────────────────────────────────────

function parseInventory(xml: string) {
  const blocks = xml.match(/<(?:[a-z0-9]+:)?PartInventory[^>]*>[\s\S]*?<\/(?:[a-z0-9]+:)?PartInventory>/gi) ?? [];
  return blocks.map(block => {
    const partId    = extractFirst(block, 'partId');
    const partColor = extractFirst(block, 'partColor');
    const labelSize = extractFirst(block, 'labelSize');

    let totalQty = 0;
    const totalMatch = block.match(/<(?:[a-z0-9]+:)?quantityAvailable>[\s\S]*?<(?:[a-z0-9]+:)?value>(\d+)<\/(?:[a-z0-9]+:)?value>/i);
    if (totalMatch) totalQty = parseInt(totalMatch[1], 10);

    const locBlocks = block.match(/<(?:[a-z0-9]+:)?InventoryLocation>[\s\S]*?<\/(?:[a-z0-9]+:)?InventoryLocation>/gi) ?? [];
    const locations = locBlocks.map(lb => {
      const id   = extractFirst(lb, 'inventoryLocationId');
      const name = extractFirst(lb, 'inventoryLocationName');
      const qm   = lb.match(/<(?:[a-z0-9]+:)?inventoryLocationQuantity>[\s\S]*?<(?:[a-z0-9]+:)?value>(\d+)<\/(?:[a-z0-9]+:)?value>/i);
      return { id, name, qty: qm ? parseInt(qm[1], 10) : 0 };
    });

    return { partId, partColor, labelSize, totalQty, locations };
  });
}

function parseMedia(xml: string) {
  const urlBlock = extractFirst(xml, 'url') ?? '';
  const urls = urlBlock
    .split(/\s+/)
    .map(s => s.trim())
    .filter(u => /^https?:\/\//.test(u));
  const description = extractFirst(xml, 'description') ?? '';
  return { urls, description };
}

function parseProduct(xml: string) {
  const productName = extractFirst(xml, 'productName');
  const description = extractFirst(xml, 'description');
  const productBrand = extractFirst(xml, 'productBrand');
  const category = extractFirst(xml, 'category');

  const partBlocks = xml.match(/<(?:[a-z0-9]+:)?ProductPart>[\s\S]*?<\/(?:[a-z0-9]+:)?ProductPart>/gi) ?? [];
  const colors = new Set<string>();
  const sizes  = new Set<string>();
  const parts: Array<{ partId: string|null; color: string|null; size: string|null }> = [];

  for (const pb of partBlocks) {
    const partId = extractFirst(pb, 'partId');
    const color  = extractFirst(pb, 'standardColorName') ?? extractFirst(pb, 'colorName');
    const size   = extractFirst(pb, 'labelSize');
    if (color) colors.add(color);
    if (size) sizes.add(size);
    parts.push({ partId, color, size });
  }

  return {
    productName, description, productBrand, category,
    colors: [...colors],
    sizes:  [...sizes],
    parts,
  };
}

function parsePricing(xml: string) {
  const partBlocks = xml.match(/<(?:[a-z0-9]+:)?Part>[\s\S]*?<\/(?:[a-z0-9]+:)?Part>/gi) ?? [];
  return partBlocks.map(pb => ({
    partId: extractFirst(pb, 'partId'),
    minQty: parseInt(extractFirst(pb, 'minQuantity') ?? '1', 10),
    price:  parseFloat(extractFirst(pb, 'price') ?? '0'),
  }));
}

// ── Handler ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!ID || !PASS) {
    return new Response(JSON.stringify({
      error: 'SanMar credentials not configured',
      hint: 'Set SANMAR_CUSTOMER_ID and SANMAR_PASSWORD via `supabase secrets set`',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { action, productId, partId, lang } = await req.json();

    if (!action || !productId) {
      return new Response(JSON.stringify({ error: 'action and productId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let xml: string;
    let parsed: any;

    switch (action) {
      case 'product':
        xml = await soap(ENDPOINTS.product, buildGetProduct(productId, partId, lang));
        parsed = parseProduct(xml);
        break;
      case 'inventory':
        xml = await soap(ENDPOINTS.inventory, buildGetInventory(productId));
        parsed = parseInventory(xml);
        break;
      case 'media':
        xml = await soap(ENDPOINTS.media, buildGetMedia(productId, partId, lang));
        parsed = parseMedia(xml);
        break;
      case 'pricing':
        xml = await soap(ENDPOINTS.pricing, buildGetPricing(productId, partId));
        parsed = parsePricing(xml);
        break;
      default:
        return new Response(JSON.stringify({ error: `unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
