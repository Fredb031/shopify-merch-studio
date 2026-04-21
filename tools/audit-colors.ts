/**
 * tools/audit-colors.ts — Unit-test-style audit for `findColorImage()`.
 *
 * Runs `findColorImage(sku, colorName)` for every (product, color) pair in
 * PRODUCTS using BOTH the French `name` and the English `nameEn`, then prints:
 *   - total pairs, hits, misses
 *   - per-SKU miss rate
 *   - a detailed list of misses (SKU + colour FR/EN) for triage
 *
 * The script also exercises a handful of adversarial inputs (e.g. "Or" must
 * NOT match "orange", "Red" must match "red_*", empty/garbage inputs return
 * null) as hard assertions — the process exits non-zero if any fail.
 *
 * Usage:
 *   npx tsx tools/audit-colors.ts
 *   npx tsx tools/audit-colors.ts --strict   # non-zero exit if any miss
 */

import { PRODUCTS, findColorImage, type ProductColor } from '../src/data/products.ts';

type ProbeResult = {
  sku: string;
  colorId: string;
  fr: string;
  en: string;
  hitFr: boolean;
  hitEn: boolean;
};

const STRICT = process.argv.includes('--strict');

// ── Adversarial / regression assertions ───────────────────────────────────────
type Assertion = { label: string; actual: boolean; expected: boolean };
const assertions: Assertion[] = [];

function assert(label: string, actual: boolean, expected = true): void {
  assertions.push({ label, actual, expected });
}

// 1. Unknown SKU returns null
assert(
  'unknown SKU returns null',
  findColorImage('DOES-NOT-EXIST', 'Black') === null,
);

// 2. Empty color returns null
assert(
  'empty color name returns null',
  findColorImage('ATC1000', '') === null,
);

// 3. Empty SKU returns null
assert(
  'empty SKU returns null',
  findColorImage('', 'Black') === null,
);

// 4. "Or" (FR gold) must NOT match "orange_012017" — it must translate to gold
{
  const img = findColorImage('ATC1000', 'Or');
  const path = img?.front ?? img?.back ?? '';
  assert('"Or" (FR) maps to gold, not orange', /gold/i.test(path) && !/orange/i.test(path));
}

// 5. "Orange" DOES match orange_*
{
  const img = findColorImage('ATC1000', 'Orange');
  const path = img?.front ?? img?.back ?? '';
  assert('"Orange" matches orange_*', /orange/i.test(path));
}

// 6. "Red" matches red_* (not "reddish" or similar)
{
  const img = findColorImage('ATC1000', 'Red');
  const path = img?.front ?? img?.back ?? '';
  assert('"Red" matches red_*', /red/i.test(path));
}

// 7. "Noir chiné" resolves to black_heather (via FR_EN map) — not a false positive
{
  const img = findColorImage('ATCF2500', 'Noir chiné');
  // ATCF2500 has no black_heather entry, so this should be null OR match a
  // legit black heather key. Either is acceptable; a wrong match to "black_022017"
  // is NOT acceptable because "Noir chiné" ≠ "Noir".
  // Since ATCF2500 has only 'black' and 'black_022017', we expect null for chiné.
  // (If we did add black_heather_cil for this SKU later, it would also be fine.)
  const path = img?.front ?? img?.back ?? '';
  const ok = img === null || /heather|chine/i.test(path);
  assert('"Noir chiné" does not collapse to plain black', ok);
}

// 8. "Black" matches black_* on ATC1000
{
  const img = findColorImage('ATC1000', 'Black');
  assert('"Black" matches on ATC1000', !!img && (!!img.front || !!img.back));
}

// 9. French "Rouge" matches red_*
{
  const img = findColorImage('ATC1000', 'Rouge');
  const path = img?.front ?? img?.back ?? '';
  assert('"Rouge" (FR) matches red_*', /red/i.test(path));
}

// 10. Two-tone: "Noir/Blanc" matches black_white_*
{
  const img = findColorImage('ATC6606', 'Noir/Blanc');
  const path = img?.front ?? img?.back ?? '';
  assert('"Noir/Blanc" (FR) matches black_white_*', /black_white/i.test(path));
}

// ── Exhaustive PRODUCTS × colors probe ────────────────────────────────────────
const results: ProbeResult[] = [];

for (const p of PRODUCTS) {
  for (const c of p.colors as ProductColor[]) {
    const hitFr = !!findColorImage(p.sku, c.name);
    const hitEn = !!findColorImage(p.sku, c.nameEn);
    results.push({
      sku: p.sku,
      colorId: c.id,
      fr: c.name,
      en: c.nameEn,
      hitFr,
      hitEn,
    });
  }
}

// ── Summaries ─────────────────────────────────────────────────────────────────
const total = results.length;
const eitherHit = results.filter((r) => r.hitFr || r.hitEn).length;
const bothHit = results.filter((r) => r.hitFr && r.hitEn).length;
const misses = results.filter((r) => !r.hitFr && !r.hitEn);

const perSku = new Map<string, { total: number; miss: number }>();
for (const r of results) {
  const cur = perSku.get(r.sku) ?? { total: 0, miss: 0 };
  cur.total += 1;
  if (!r.hitFr && !r.hitEn) cur.miss += 1;
  perSku.set(r.sku, cur);
}

function pct(n: number, d: number): string {
  if (d === 0) return '—';
  return `${((n / d) * 100).toFixed(1)}%`;
}

// Assertion report
let assertionsFailed = 0;
console.log('── Assertions ────────────────────────────────────────');
for (const a of assertions) {
  const ok = a.actual === a.expected;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${a.label}`);
  if (!ok) assertionsFailed += 1;
}

console.log('');
console.log('── Coverage summary ──────────────────────────────────');
console.log(`  total pairs : ${total}`);
console.log(`  matched (FR or EN) : ${eitherHit}  (${pct(eitherHit, total)})`);
console.log(`  matched both FR+EN : ${bothHit}  (${pct(bothHit, total)})`);
console.log(`  missed entirely    : ${misses.length}  (${pct(misses.length, total)})`);

console.log('');
console.log('── Per-SKU miss rate ─────────────────────────────────');
const skus = Array.from(perSku.entries()).sort((a, b) => b[1].miss - a[1].miss);
for (const [sku, s] of skus) {
  const pad = sku.padEnd(10);
  console.log(`  ${pad} ${String(s.miss).padStart(3)} / ${String(s.total).padStart(3)} missed  (${pct(s.miss, s.total)})`);
}

if (misses.length > 0) {
  console.log('');
  console.log('── Misses (detail) ───────────────────────────────────');
  for (const m of misses) {
    console.log(`  ${m.sku.padEnd(10)} ${m.colorId.padEnd(20)} FR="${m.fr}" / EN="${m.en}"`);
  }
}

console.log('');
if (assertionsFailed > 0) {
  console.error(`FAILED: ${assertionsFailed} assertion(s) failed`);
  process.exit(1);
}
if (STRICT && misses.length > 0) {
  console.error(`FAILED (--strict): ${misses.length} miss(es) above zero`);
  process.exit(1);
}
console.log('OK');
