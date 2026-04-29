/**
 * Volume II — Placeholder asset pipeline.
 *
 * Generates dark-branded placeholder images for the just-landed industry
 * pages (commit 7a1e1b1) and case-study teasers, so the hero side-columns
 * don't render with empty `<img>` slots before the operator drops in
 * real photography.
 *
 * Output targets:
 *   - public/industries/<slug>.webp        (5 files, 1024x768)
 *   - public/case-studies/<slug>.webp+.jpg (4 case studies, 1024x768)
 *   - public/hero-team.webp                (upgraded from 34-byte 1x1
 *                                           to a 1280x720 wordmark)
 *
 * Layout philosophy: hero side-image renders with `mix-blend-luminosity`
 * over a dark va-ink background. So a flat dark base + a subtle SVG
 * texture + a faint label is enough to read as intentional.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INDUSTRIES_DIR = path.join(PUBLIC_DIR, 'industries');
const CASE_STUDIES_DIR = path.join(PUBLIC_DIR, 'case-studies');

// Ensure output directories exist before sharp tries to write.
for (const dir of [INDUSTRIES_DIR, CASE_STUDIES_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// --- Industry slug -> human label (matches IndustriesHub data) -----
const INDUSTRIES = [
  { slug: 'construction', label: 'Construction' },
  { slug: 'corporate', label: 'Corporate' },
  { slug: 'municipalites', label: 'Municipalités' },
  { slug: 'paysagement', label: 'Paysagement' },
  { slug: 'plomberie-electricite', label: 'Plomberie & Électricité' },
];

// --- Case studies parsed from src/data/caseStudies.ts ---------------
// Hard-coded mirror of the dataset to avoid pulling in a TS toolchain
// inside this CJS one-shot script. If the source dataset changes,
// regenerate this list. Each entry mirrors the slug + companyName from
// CASE_STUDIES (Volume II §14.1).
const CASE_STUDIES = [
  { slug: 'construction-rivard', companyName: 'Construction Rivard' },
  { slug: 'paysagement-verdure-qc', companyName: 'Paysagement Verdure QC' },
  { slug: 'cabinet-lafleur-conseil', companyName: 'Cabinet Lafleur Conseil' },
  { slug: 'ville-saint-eustache', companyName: 'Ville de Saint-Eustache' },
];

/**
 * Build an SVG overlay for the industry placeholders:
 *  - Diagonal stripe pattern at 4% opacity for subtle texture
 *  - Industry-name centered in Syne semibold at 24% white opacity
 */
function industryOverlaySvg(label, width, height) {
  // Escape minimal XML chars in label.
  const safeLabel = String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="stripes" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(45)">
      <rect width="24" height="24" fill="transparent"/>
      <line x1="0" y1="0" x2="0" y2="24" stroke="#FFFFFF" stroke-width="1" opacity="0.04"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#stripes)"/>
  <text
    x="50%" y="50%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Syne, 'Inter', system-ui, sans-serif"
    font-weight="600"
    font-size="56"
    fill="#FFFFFF"
    fill-opacity="0.24"
    letter-spacing="0.02em">${safeLabel}</text>
</svg>`;
}

/**
 * Build an SVG overlay for case-study placeholders:
 *  - "Étude de cas" eyebrow uppercase tracking-wider in va-blue at 50%
 *  - Company name centered in Syne white at 32% opacity
 */
function caseStudyOverlaySvg(companyName, width, height) {
  const safeName = String(companyName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // va-blue from the design system (mega blueprint §02 — adjust if needed).
  const vaBlue = '#3B82F6';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="stripes" patternUnits="userSpaceOnUse" width="28" height="28" patternTransform="rotate(45)">
      <rect width="28" height="28" fill="transparent"/>
      <line x1="0" y1="0" x2="0" y2="28" stroke="#FFFFFF" stroke-width="1" opacity="0.03"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#stripes)"/>
  <text
    x="50%" y="44%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="'Inter', system-ui, sans-serif"
    font-weight="500"
    font-size="20"
    fill="${vaBlue}"
    fill-opacity="0.5"
    letter-spacing="0.32em">ÉTUDE DE CAS</text>
  <text
    x="50%" y="54%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Syne, 'Inter', system-ui, sans-serif"
    font-weight="600"
    font-size="44"
    fill="#FFFFFF"
    fill-opacity="0.32"
    letter-spacing="0.02em">${safeName}</text>
</svg>`;
}

/**
 * Hero-team overlay — Vision Affichage wordmark at 8% opacity
 * so even before a real photo lands, the hero side-image looks intentional.
 */
function heroTeamOverlaySvg(width, height) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="stripes" patternUnits="userSpaceOnUse" width="32" height="32" patternTransform="rotate(45)">
      <rect width="32" height="32" fill="transparent"/>
      <line x1="0" y1="0" x2="0" y2="32" stroke="#FFFFFF" stroke-width="1" opacity="0.03"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#stripes)"/>
  <text
    x="50%" y="50%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Syne, 'Inter', system-ui, sans-serif"
    font-weight="700"
    font-size="96"
    fill="#FFFFFF"
    fill-opacity="0.08"
    letter-spacing="0.04em">VISION AFFICHAGE</text>
</svg>`;
}

async function generateIndustryPlaceholder(slug, label) {
  const width = 1024;
  const height = 768;
  const outPath = path.join(INDUSTRIES_DIR, `${slug}.webp`);
  const svg = Buffer.from(industryOverlaySvg(label, width, height));
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#0A0A0A', // va-ink
    },
  })
    .composite([{ input: svg, blend: 'over' }])
    .webp({ quality: 85 })
    .toFile(outPath);
  return outPath;
}

async function generateCaseStudyPlaceholder(slug, companyName) {
  const width = 1024;
  const height = 768;
  const svg = Buffer.from(caseStudyOverlaySvg(companyName, width, height));
  // Build the composite once, then encode to both webp and jpg so the
  // <picture><source> fallback pattern from commit 5114f9e still has
  // both formats to choose from.
  const baseComposite = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#1B1B1B', // one notch up from black per spec
    },
  }).composite([{ input: svg, blend: 'over' }]);

  const webpPath = path.join(CASE_STUDIES_DIR, `${slug}.webp`);
  const jpgPath = path.join(CASE_STUDIES_DIR, `${slug}.jpg`);
  // sharp's pipeline can only be consumed once — clone for the second output.
  await baseComposite.clone().webp({ quality: 85 }).toFile(webpPath);
  await baseComposite.clone().jpeg({ quality: 85, mozjpeg: true }).toFile(jpgPath);
  return [webpPath, jpgPath];
}

async function upgradeHeroTeam() {
  const width = 1280;
  const height = 720;
  const outPath = path.join(PUBLIC_DIR, 'hero-team.webp');
  const svg = Buffer.from(heroTeamOverlaySvg(width, height));
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#0A0A0A',
    },
  })
    .composite([{ input: svg, blend: 'over' }])
    .webp({ quality: 85 })
    .toFile(outPath);
  return outPath;
}

async function main() {
  const generated = [];

  console.log('[assets] Generating industry placeholders…');
  for (const ind of INDUSTRIES) {
    const p = await generateIndustryPlaceholder(ind.slug, ind.label);
    generated.push(p);
  }

  console.log('[assets] Generating case-study placeholders…');
  for (const cs of CASE_STUDIES) {
    if (!cs.slug) {
      console.warn('[assets] case study missing slug:', cs);
      continue;
    }
    const paths = await generateCaseStudyPlaceholder(cs.slug, cs.companyName);
    generated.push(...paths);
  }

  console.log('[assets] Upgrading hero-team.webp…');
  generated.push(await upgradeHeroTeam());

  // --- Verification pass: dimensions + size budget --------------------
  let totalBytes = 0;
  let oversize = 0;
  for (const p of generated) {
    const stat = fs.statSync(p);
    totalBytes += stat.size;
    const meta = await sharp(p).metadata();
    const flag = stat.size > 100 * 1024 ? ' [OVER 100KB]' : '';
    if (stat.size > 100 * 1024) oversize++;
    console.log(
      `  ${path.relative(ROOT, p).padEnd(50)} ${String(meta.width).padStart(4)}x${String(meta.height).padStart(4)} ${(stat.size / 1024).toFixed(1)}KB${flag}`,
    );
  }
  console.log(`[assets] ${generated.length} files, ${(totalBytes / 1024).toFixed(1)}KB total`);
  if (oversize > 0) {
    console.error(`[assets] ${oversize} file(s) exceed 100KB budget`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[assets] failed:', err);
  process.exit(1);
});
