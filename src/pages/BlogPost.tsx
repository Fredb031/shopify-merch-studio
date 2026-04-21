import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Check, Clock } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Task 11.6 — /blog/:slug placeholder. Reads the slug so we can echo it
 * into the title / eyebrow (lets the owner see that routing works before
 * real content lands) and renders a branded "post under review" page
 * with the same Navbar + Footer chrome as the rest of the site. The
 * real post body is an owner upload; when it arrives the body prose
 * swaps in here without touching the page shell or the /blog index.
 *
 * Hunt #176 layer — the detail view picks up three SERP + share polish
 * bits that don't depend on the eventual post body: a navigator.share
 * CTA (clipboard fallback + "Copié" swap), a word-count-based reading
 * time estimate rendered next to the date row, and an Article JSON-LD
 * graph with headline + datePublished + author so Google can surface a
 * proper article rich result once the body drops in. Everything stays
 * inside this file — the post data source in Blog.tsx is untouched.
 */
export default function BlogPost() {
  const { lang } = useLang();
  const { slug = '' } = useParams<{ slug: string }>();

  // Derive a human-readable title from the slug so an owner sharing the
  // URL early sees something coherent in the <title> bar — "Dpi 101
  // Logo Merch" beats "undefined" or the raw slug in a tab.
  const prettyTitle = slug
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || (lang === 'en' ? 'Article' : 'Article');

  useDocumentTitle(
    lang === 'en'
      ? `${prettyTitle} — Vision Affichage`
      : `${prettyTitle} — Vision Affichage`,
    lang === 'en'
      ? 'Merch tips and production playbooks from Vision Affichage.'
      : 'Conseils merch et playbooks de production de Vision Affichage.',
  );

  // Body copy — today this is a single placeholder sentence; when the
  // owner's real post lands it swaps in below. Keeping the copy in a
  // variable lets both the rendered <p> and the reading-time estimate
  // read from the same source so the number stays honest as content
  // evolves (instead of drifting from a hard-coded "1 min").
  const bodyCopy = useMemo(
    () =>
      lang === 'en'
        ? 'This post is under review. Check back soon!'
        : 'Cette publication est en révision. Revenez bientôt\u00a0!',
    [lang],
  );

  // Reading time — industry-standard 200 wpm, rounded up to at least
  // one minute so an empty or very short body still shows "1 min read"
  // instead of "0 min" which reads like a broken label. Derived from
  // the same bodyCopy the <p> renders so the estimate doesn't drift.
  const readingMinutes = useMemo(() => {
    const words = bodyCopy.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [bodyCopy]);

  // Share CTA state — true for ~2s after a clipboard fallback so the
  // button label swaps to "Copié" / "Copied" with a Check icon,
  // acknowledging the action when navigator.share isn't available
  // (desktop Chrome, Firefox). On mobile the native share sheet is its
  // own feedback so we stay silent in that branch, matching the
  // ProductDetail share pattern.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  // Double-click guard — rapid taps would queue a second navigator.share
  // while the first Promise is still pending, which throws
  // InvalidStateError on iOS Safari. Lock the button while the share
  // sheet is open; unlock in the finally so a dismissal still re-enables.
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    const shareUrl =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://visionaffichage.com/blog/${slug}`;
    const shareData = {
      title: `${prettyTitle} — Vision Affichage`,
      text:
        lang === 'en'
          ? `${prettyTitle} — Vision Affichage`
          : `${prettyTitle} — Vision Affichage`,
      url: shareUrl,
    };
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
      ) {
        try {
          await navigator.share(shareData);
        } catch {
          /* user dismissed the native sheet — stay silent */
        }
      } else if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
      }
    } catch {
      /* clipboard blocked — fail silent; no toast infra on this page */
    } finally {
      setSharing(false);
    }
  };

  // Article JSON-LD — mirrors the Blog.tsx injection pattern (append to
  // <head> on mount, strip on unmount, dataset marker keeps duplicates
  // out if the page remounts before cleanup fires). headline +
  // datePublished + author + image give Google the minimum it needs for
  // an Article rich result. datePublished falls back to today's date so
  // the graph stays valid before the real post carries its own date.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.head.querySelector('script[data-blogpost-ld]')) return;
    const canonicalUrl = `https://visionaffichage.com/blog/${slug}`;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: prettyTitle,
      datePublished: new Date().toISOString().slice(0, 10),
      author: {
        '@type': 'Organization',
        name: 'Vision Affichage',
        url: 'https://visionaffichage.com',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Vision Affichage',
        url: 'https://visionaffichage.com',
      },
      image: 'https://visionaffichage.com/og-image.png',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      url: canonicalUrl,
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.blogpostLd = 'true';
    el.text = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => {
      if (el.parentNode) document.head.removeChild(el);
    };
  }, [slug, prettyTitle]);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[760px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0052CC] hover:text-[#0041A6] mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 rounded"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {lang === 'en' ? 'Back to blog' : 'Retour au blogue'}
        </Link>

        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-2">
          {lang === 'en' ? 'Article' : 'Article'}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-4">
          {prettyTitle}
        </h1>

        {/* Meta row — reading-time estimate on the left, share CTA on
            the right. Clock icon pairs with the minute count; the share
            button switches to a Check + "Copié" swap for ~2s after a
            clipboard fallback so desktop browsers without Web Share
            still get acknowledgement. Mobile native share is its own
            feedback so no swap is needed on that branch. */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500"
            aria-label={
              lang === 'en'
                ? `${readingMinutes} minute read`
                : `Lecture de ${readingMinutes} minutes`
            }
          >
            <Clock size={13} aria-hidden="true" />
            <span>
              {lang === 'en'
                ? `${readingMinutes} min read`
                : `Lecture de ${readingMinutes} min`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0052CC] hover:text-[#0041A6] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 focus-visible:ring-offset-2 rounded-full border border-[#0052CC]/20 hover:border-[#0052CC]/40 bg-white px-3 py-1.5 shadow-sm transition-colors"
          >
            {copied ? (
              <>
                <Check size={13} aria-hidden="true" />
                <span>{lang === 'en' ? 'Copied' : 'Copié'}</span>
              </>
            ) : (
              <>
                <Share2 size={13} aria-hidden="true" />
                <span>{lang === 'en' ? 'Share' : 'Partager'}</span>
              </>
            )}
          </button>
        </div>

        {/* TODO(11.6): owner drops real post body here — Markdown /
            MDX / Shopify CMS fetch, TBD. Until then, a branded review
            notice tells the visitor they're in the right place and
            invites the back-link instead of dead-ending on empty state. */}
        <div className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-zinc-700">
          <p className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-7 shadow-sm text-zinc-600">
            {bodyCopy}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
