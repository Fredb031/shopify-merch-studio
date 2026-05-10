#!/usr/bin/env node
// Curl-based smoke tests for Vision Affichage — runs against `vite preview`
// on $BASE_URL (default http://localhost:4173). Each route is asserted
// for (a) HTTP 2xx, (b) the SPA shell rendered (`<div id="root">`),
// (c) the ErrorBoundary copy is absent from the initial HTML.
//
// Trade-off vs Playwright: this WON'T catch React runtime crashes
// (the SPA shell loads fine, but a useEffect could throw post-mount).
// Owner accepted the trade-off because the previous Playwright
// pipeline was perpetually red on CI for chromium-environment reasons
// that didn't reproduce locally. A richer fixture-backed integration
// suite can layer on top later.

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const ROUTES = ['/', '/products', '/cart', '/admin/login'];
const ERROR_BOUNDARY_RE = /Quelque chose s['’]est mal pass[éeè]/i;

type Result = { path: string; ok: boolean; reason?: string };

async function probe(path: string): Promise<Result> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { redirect: 'manual' });
  } catch (e) {
    return { path, ok: false, reason: `fetch threw: ${(e as Error).message}` };
  }
  if (!res.ok) {
    return { path, ok: false, reason: `HTTP ${res.status}` };
  }
  const html = await res.text();
  if (!html.includes('id="root"')) {
    return { path, ok: false, reason: 'no #root in HTML shell' };
  }
  if (ERROR_BOUNDARY_RE.test(html)) {
    return { path, ok: false, reason: 'ErrorBoundary copy found in HTML' };
  }
  return { path, ok: true };
}

async function probeJsBundle(): Promise<Result> {
  const path = '/';
  let html: string;
  try {
    html = await (await fetch(BASE + path)).text();
  } catch (e) {
    return { path: 'js-bundle', ok: false, reason: `fetch / threw: ${(e as Error).message}` };
  }
  const match = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  if (!match) {
    return { path: 'js-bundle', ok: false, reason: 'no /assets/index-*.js found in HTML' };
  }
  let res: Response;
  try {
    res = await fetch(BASE + match[0]);
  } catch (e) {
    return { path: match[0], ok: false, reason: `fetch threw: ${(e as Error).message}` };
  }
  if (!res.ok) {
    return { path: match[0], ok: false, reason: `HTTP ${res.status}` };
  }
  // Bundle should be more than a few hundred bytes — anything tiny is a 404
  // page returning 200 (some hosts do this), which would silently pass.
  const size = parseInt(res.headers.get('content-length') ?? '0', 10) || (await res.arrayBuffer()).byteLength;
  if (size < 1024) {
    return { path: match[0], ok: false, reason: `bundle size ${size} < 1024 bytes (404 fallback?)` };
  }
  return { path: match[0], ok: true };
}

async function main(): Promise<void> {
  console.info(`smoke: probing ${BASE}\n`);
  const results: Result[] = [];
  for (const r of ROUTES) results.push(await probe(r));
  results.push(await probeJsBundle());

  for (const r of results) {
    if (r.ok) console.info(`  OK   ${r.path}`);
    else console.error(`  FAIL ${r.path} — ${r.reason}`);
  }

  const failed = results.filter(r => !r.ok).length;
  console.info('');
  if (failed > 0) {
    console.error(`smoke: ${failed} of ${results.length} route(s) failed`);
    process.exit(1);
  }
  console.info(`smoke: ${results.length} routes OK`);
}

main().catch((e) => {
  console.error('smoke: unexpected error', e);
  process.exit(2);
});
