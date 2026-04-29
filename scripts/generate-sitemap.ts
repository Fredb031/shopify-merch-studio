#!/usr/bin/env node
/**
 * generate-sitemap.ts — builds public/sitemap.xml at build time.
 *
 * Run via `node --experimental-strip-types scripts/generate-sitemap.ts`
 * (Node 22.6+) or plain `node scripts/generate-sitemap.ts` on Node
 * 23.6+ where type-stripping is unflagged. The repo doesn't ship a
 * TS runtime (tsx / ts-node) in its devDependencies, and Task 8.7
 * explicitly says "DON'T install new npm packages unless truly
 * needed" — Node's built-in type-stripping covers us without
 * adding a dep.
 *
 * Source of truth:
 *   - src/data/products.ts  -> /product/:handle URLs
 *   - src/App.tsx           -> static public routes (mirrored below)
 *
 * Admin / vendor / cart / checkout / account / track / quote-accept
 * URLs are intentionally omitted — they're either behind auth or
 * already `Disallow`d in robots.txt, so they don't belong in the
 * crawl index.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASE_URL = 'https://visionaffichage.com';

// YYYY-MM-DD in UTC so lastmod doesn't flip by timezone and cause
// spurious diffs when the same build runs on CI vs a dev machine in
// a different TZ.
const today: string = new Date().toISOString().slice(0, 10);

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
type StaticRoute = readonly [path: string, changefreq: ChangeFreq, priority: string];

// Static routes — keep in sync with src/App.tsx. Priorities follow
// the task spec: home 1.0 daily, products 0.9 weekly, conversion-
// driving content 0.7-0.8 weekly/monthly, legal 0.3 monthly, the rest
// 0.5 monthly. Cart / checkout / track / account / admin / vendor /
// quote-accept / merci / suivi are intentionally omitted — they're
// behind auth, transactional, or already `Disallow`d in robots.txt
// so they don't belong in the public crawl index.
const staticRoutes: readonly StaticRoute[] = [
  ['/',                                  'daily',   '1.0'],
  ['/products',                          'weekly',  '0.9'],
  ['/devis',                             'weekly',  '0.8'],
  ['/histoires-de-succes',               'weekly',  '0.7'],
  ['/industries',                        'weekly',  '0.7'],
  ['/industries/construction',           'monthly', '0.6'],
  ['/industries/paysagement',            'monthly', '0.6'],
  ['/industries/plomberie-electricite',  'monthly', '0.6'],
  ['/industries/corporate',              'monthly', '0.6'],
  ['/industries/municipalites',          'monthly', '0.6'],
  ['/comparer',                          'monthly', '0.5'],
  ['/compte-corporatif',                 'monthly', '0.5'],
  ['/about',                             'monthly', '0.5'],
  ['/contact',                           'monthly', '0.5'],
  ['/privacy',                           'monthly', '0.3'],
  ['/terms',                             'monthly', '0.3'],
  ['/returns',                           'monthly', '0.3'],
  ['/accessibility',                     'monthly', '0.3'],
];

// Extract every `shopifyHandle: '...'` from products.ts. The
// PRODUCTS array uses single-quoted string literals for handles, so
// a regex is enough — avoids needing a TS-module import (which
// type-stripping can't do; it has no loader for the '@/…' alias)
// and avoids duplicating the handle list.
const productsSrc: string = readFileSync(resolve(ROOT, 'src/data/products.ts'), 'utf8');
const handleRe = /shopifyHandle:\s*'([^']+)'/g;
const handles: string[] = [];
for (const m of productsSrc.matchAll(handleRe)) handles.push(m[1]);

if (handles.length === 0) {
  // A broken regex on an empty catalog would silently ship a sitemap
  // with zero product URLs. Fail loud instead.
  throw new Error('generate-sitemap: no product handles found in src/data/products.ts');
}

// Case study slugs — same regex-extraction strategy as the product
// handles above. /histoires-de-succes/:slug pages render real customer
// stories that deserve their own SERP entry (they target buyer-intent
// queries like "construction company uniforms quebec").
const caseStudiesSrc: string = readFileSync(resolve(ROOT, 'src/data/caseStudies.ts'), 'utf8');
const slugRe = /slug:\s*'([^']+)'/g;
const caseStudySlugs: string[] = [];
for (const m of caseStudiesSrc.matchAll(slugRe)) caseStudySlugs.push(m[1]);

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const urlEntry = (path: string, changefreq: ChangeFreq, priority: string): string =>
  `  <url>
    <loc>${esc(BASE_URL + path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

const parts: string[] = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...staticRoutes.map(([p, cf, pr]) => urlEntry(p, cf, pr)),
  ...handles.map((h) => urlEntry(`/product/${h}`, 'weekly', '0.8')),
  ...caseStudySlugs.map((s) => urlEntry(`/histoires-de-succes/${s}`, 'monthly', '0.6')),
  '</urlset>',
  '',
];

const outPath = resolve(ROOT, 'public/sitemap.xml');
writeFileSync(outPath, parts.join('\n'), 'utf8');

console.log(
  `generate-sitemap: wrote ${staticRoutes.length + handles.length + caseStudySlugs.length} URLs ` +
  `(${staticRoutes.length} static + ${handles.length} products + ${caseStudySlugs.length} case studies) -> public/sitemap.xml`,
);
