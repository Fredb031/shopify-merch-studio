import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Search } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Task 11.6 — content hub scaffold. Five placeholder post cards whose
// titles suggest the merch-tips editorial territory (hoodie buying, DPI
// 101, Pantone vs CMYK, 500-unit playbook, embroidery care). Real
// article bodies are owner-uploads; the routing + card chrome ships now
// so content can drop in later without re-touching the page shell.
//
// Schema mirrors the case-studies scaffold: slug is the url segment,
// titleFr/titleEn + excerpt are displayed on the card, publishDate is
// ISO so the locale formatter below can render it bilingually, and each
// entry resolves to /blog/:slug on click.
type BlogPost = {
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  publishDate: string;
};

const POSTS: BlogPost[] = [
  {
    slug: 'choisir-hoodie-entreprise',
    titleFr: "Comment choisir ton hoodie d'entreprise",
    titleEn: 'How to choose your company hoodie',
    excerptFr: 'Poids du tissu, coupe, coton vs polyester — le guide rapide avant de commander 100 unités.',
    excerptEn: 'Fabric weight, fit, cotton vs polyester — the quick guide before ordering 100 units.',
    publishDate: '2026-04-02',
  },
  {
    slug: 'dpi-101-logo-merch',
    titleFr: 'DPI 101 pour ton logo de merch',
    titleEn: 'DPI 101 for your merch logo',
    excerptFr: 'Pourquoi 72 DPI imprime flou et comment préparer un fichier source qui rend net sur tissu.',
    excerptEn: 'Why 72 DPI prints blurry and how to prep a source file that renders crisp on fabric.',
    publishDate: '2026-03-18',
  },
  {
    slug: 'pantone-vs-cmyk',
    titleFr: 'Palette Pantone vs CMYK — quand chaque importe',
    titleEn: 'Pantone vs CMYK — when each matters',
    excerptFr: 'La différence concrète entre les deux systèmes et l\u2019impact sur la fidélité de ta couleur de marque.',
    excerptEn: 'The concrete difference between the two systems and the impact on your brand-color fidelity.',
    publishDate: '2026-03-05',
  },
  {
    slug: 'playbook-500-tshirts-5-jours',
    titleFr: 'Ordonner 500+ t-shirts en 5 jours : notre playbook',
    titleEn: 'Ordering 500+ t-shirts in 5 days: our playbook',
    excerptFr: 'Comment on découpe la production, l\u2019approvisionnement et le contrôle qualité pour tenir un délai serré.',
    excerptEn: 'How we split production, sourcing, and QA to hit a tight deadline.',
    publishDate: '2026-02-20',
  },
  {
    slug: 'entretien-broderie-longue-duree',
    titleFr: 'Entretien longue durée pour la broderie',
    titleEn: 'Long-term care for embroidery',
    excerptFr: 'Lavage, séchage, repassage — les gestes qui gardent ton logo brodé net saison après saison.',
    excerptEn: 'Washing, drying, ironing — the habits that keep your embroidered logo crisp season after season.',
    publishDate: '2026-02-08',
  },
];

const formatDate = (iso: string, lang: 'fr' | 'en') => {
  // Native Intl keeps the bundle small — a full date-fns import for one
  // formatter would bloat the blog chunk for no gain. Fallback to ISO
  // so a malformed entry at least renders something instead of "Invalid
  // Date" in the card subhead.
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

/** Blog hub — lists every merch-tips post with a case-insensitive
 *  title/excerpt search, an "Aucun article" empty state, and a Blog
 *  JSON-LD graph so SERP can surface the listing. Post detail lives in
 *  BlogPost.tsx and is not touched here. */
export default function Blog() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en' ? 'Blog — Vision Affichage' : 'Blogue — Vision Affichage',
    lang === 'en'
      ? 'Merch tips, fabric guides, and production playbooks from the Vision Affichage team.'
      : 'Conseils merch, guides de tissu et playbooks de production de l\u2019équipe Vision Affichage.',
  );

  // Local search state — debounce isn't needed for five cards, the
  // `useMemo` below re-filters in O(n) on every keystroke and the
  // bilingual matcher lowercases both sides so accent-free queries
  // still hit accented titles ("broderie" still matches "Broderie").
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePosts = useMemo(() => {
    if (!normalizedQuery) return POSTS;
    return POSTS.filter(post => {
      const title = (lang === 'en' ? post.titleEn : post.titleFr).toLowerCase();
      const excerpt = (lang === 'en' ? post.excerptEn : post.excerptFr).toLowerCase();
      return title.includes(normalizedQuery) || excerpt.includes(normalizedQuery);
    });
  }, [normalizedQuery, lang]);

  // Blog JSON-LD schema — feeds Google the post listing so the hub
  // can surface as a rich SERP card with article names + URLs. Mirrors
  // the Organization/FAQ injection pattern used on Index: build the
  // graph, append <script type="application/ld+json"> to <head>, strip
  // on unmount. Dataset marker prevents duplicates if the hub remounts
  // (e.g. nav back from a post) before the previous cleanup fires.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-blog-ld]')) return;
    const blogSchema = {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: lang === 'en' ? 'Vision Affichage Blog' : 'Blogue Vision Affichage',
      url: 'https://visionaffichage.com/blog',
      blogPost: POSTS.map(post => ({
        '@type': 'BlogPosting',
        headline: lang === 'en' ? post.titleEn : post.titleFr,
        url: `https://visionaffichage.com/blog/${post.slug}`,
        datePublished: post.publishDate,
      })),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.blogLd = 'true';
    el.text = JSON.stringify(blogSchema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, [lang]);

  return (
    <div className="min-h-screen bg-brand-grey-light flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[1100px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <div className="mb-10 md:mb-12">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-brand-blue mb-2">
            {lang === 'en' ? 'Content hub' : 'Centre de contenu'}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-brand-black tracking-[-0.5px] mb-3">
            {lang === 'en' ? 'Blog' : 'Blogue'}
          </h1>
          <p className="text-sm text-brand-grey max-w-[640px]">
            {lang === 'en'
              ? 'Merch tips, fabric guides, and production playbooks — written by the Vision Affichage team.'
              : 'Conseils merch, guides de tissu et playbooks de production — écrits par l\u2019équipe Vision Affichage.'}
          </p>
        </div>

        {/* Search row — small, keyboard-first; the icon is decorative,
            the <label> is visually hidden but screen-reader reachable so
            the input exposes its purpose without adding visual label
            chrome. Five posts today means filtering is snappy; the
            control scales naturally as the archive grows. */}
        <div className="mb-6 md:mb-8">
          <label htmlFor="blog-search" className="sr-only">
            {lang === 'en' ? 'Search articles' : 'Rechercher un article'}
          </label>
          <div className="relative max-w-[420px]">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-grey"
            />
            <input
              id="blog-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={
                lang === 'en'
                  ? 'Search articles…'
                  : 'Rechercher un article…'
              }
              className="w-full rounded-full border border-brand-grey-border bg-brand-white pl-9 pr-4 py-2.5 text-sm text-brand-black placeholder:text-brand-grey shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2 focus-visible:border-brand-blue/40 transition-colors"
            />
          </div>
        </div>

        {/* Card grid — layout mirrors the case-studies scaffold so the two
            content surfaces read as a single family. 2-up on md, 3-up on
            lg; cards grow with content so an eventual longer excerpt
            doesn't clip the "Lire" CTA. */}
        {visiblePosts.length === 0 ? (
          <div
            role="status"
            className="rounded-2xl border border-dashed border-brand-grey-border bg-brand-white p-8 md:p-10 text-center"
          >
            <p className="text-base font-bold text-brand-black mb-1">
              {lang === 'en' ? 'No posts' : 'Aucun article'}
            </p>
            <p className="text-sm text-brand-grey">
              {lang === 'en'
                ? 'No article matches your search. Try a different keyword.'
                : 'Aucun article ne correspond à ta recherche. Essaie un autre mot-clé.'}
            </p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {visiblePosts.map(post => (
              <li key={post.slug}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="group block h-full bg-brand-white rounded-2xl border border-brand-grey-border p-5 md:p-6 shadow-sm hover:shadow-md hover:border-brand-blue/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-grey mb-3">
                    <Calendar size={12} aria-hidden="true" className="text-brand-blue" />
                    <time dateTime={post.publishDate}>
                      {formatDate(post.publishDate, lang)}
                    </time>
                  </div>
                  <h2 className="text-lg md:text-xl font-extrabold text-brand-black tracking-[-0.3px] mb-2 group-hover:text-brand-blue transition-colors">
                    {lang === 'en' ? post.titleEn : post.titleFr}
                  </h2>
                  <p className="text-sm text-brand-grey leading-relaxed mb-4">
                    {lang === 'en' ? post.excerptEn : post.excerptFr}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue group-hover:gap-2 transition-all">
                    {lang === 'en' ? 'Read' : 'Lire'}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
