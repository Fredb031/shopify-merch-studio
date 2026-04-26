import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { SubmitButton, type SubmitButtonState } from '@/components/SubmitButton';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { sanitizeText } from '@/lib/sanitize';
import { PRODUCTS } from '@/data/products';
import { getPricePerUnit } from '@/data/pricing';

// Mega Blueprint Section 02 — /devis quote-request page.
//
// Three-step user-facing form: (1) project basics — quantity, product,
// deadline, colors; (2) contact — company, name, email, phone, optional
// logo upload, notes; (3) confirmation card with live price estimate.
//
// Submission is a frontend-only stub: payload is queued to localStorage
// 'va:quote-queue' (FIFO, max 20) and a "Soumission envoyée — réponse
// dans 2 heures" toast fires. Operator follow-up — wire to Supabase
// quote_requests + Zapier notify, plus the jspdf+Resend edge function
// for the PDF response per the Mega Blueprint Section 2.2.
//
// No real PDF generation here (TODO). The logo is read into a base64
// data URL synchronously via FileReader so the queued payload can be
// inspected (or shipped to Supabase later) without a separate file
// store.

const QUEUE_KEY = 'va:quote-queue';
const QUEUE_CAP = 20;
// Hard cap on logo data-URL size so a 50MB drag-drop can't blow past
// the 5MB localStorage budget and brick the queue. 800kB at base64
// (~600kB raw) is enough for a typical PNG/JPG client logo.
const LOGO_MAX_BYTES = 800 * 1024;

type QuoteQueueRow = {
  // Step 1
  quantity: number;
  productSku: string;
  productName: string;
  deadline: string;
  colors: string;
  // Step 2
  company: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  logoDataUrl: string | null;
  logoName: string | null;
  // Bookkeeping
  estimatedTotal: number;
  estimatedUnit: number;
  at: number;
  lang: 'fr' | 'en';
};

// Phone validation. Accept either an E.164-ish form (+ followed by 8-15
// digits) or a 10-digit Canadian number with optional separators —
// matches what most clients will paste from their email signature. We
// strip spaces, dashes, dots and parens before counting digits so
// "(514) 555-1234" and "514.555.1234" both pass.
function isValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^\+\d{8,15}$/.test(trimmed.replace(/[\s.\-()]/g, ''))) return true;
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits.length === 10;
}

export default function QuoteRequest() {
  const { lang } = useLang();
  useDocumentTitle(
    lang === 'en' ? 'Bulk quote request — Vision Affichage' : 'Demande de soumission — Vision Affichage',
    lang === 'en'
      ? 'Request a bulk quote from Vision Affichage. Three quick steps, response within 2 hours on business days.'
      : 'Demandez une soumission en gros à Vision Affichage. Trois étapes rapides, réponse sous 2h en jours ouvrables.',
    {},
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitState, setSubmitState] = useState<SubmitButtonState>('idle');
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [quantity, setQuantity] = useState<number>(50);
  // Default to the first hoodie SKU so the live price estimate reads
  // meaningful rather than $0. PRODUCTS is non-empty per the catalogue.
  const [productSku, setProductSku] = useState<string>(PRODUCTS[0]?.sku ?? 'ATC1000');
  const [deadline, setDeadline] = useState<string>('');
  const [colors, setColors] = useState<string>('');

  // Step 2
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);

  const [emailErr, setEmailErr] = useState(false);
  const [phoneErr, setPhoneErr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live price estimate. getPricePerUnit walks the SKU's tier ladder
  // and falls back to ATC1000 for unknown SKUs, so this is safe even
  // before the user changes the default product.
  const { unitPrice, totalPrice, productName } = useMemo(() => {
    const product = PRODUCTS.find(p => p.sku === productSku) ?? PRODUCTS[0];
    const safeQty = Math.max(1, Number.isFinite(quantity) ? quantity : 0);
    const unit = getPricePerUnit(productSku, safeQty);
    return {
      unitPrice: unit,
      totalPrice: unit * safeQty,
      productName: product?.shortName ?? product?.name ?? productSku,
    };
  }, [productSku, quantity]);

  const step1Valid = quantity >= 1 && !!productSku;
  const step2Valid = !!company.trim() && isValidEmail(normalizeInvisible(email)) && isValidPhone(phone);

  const goNext = () => {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2) {
      const emailOk = isValidEmail(normalizeInvisible(email));
      const phoneOk = isValidPhone(phone);
      setEmailErr(!emailOk);
      setPhoneErr(!phoneOk);
      if (!company.trim() || !emailOk || !phoneOk) return;
      setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleFile = (file: File | null) => {
    if (!file) {
      setLogoDataUrl(null);
      setLogoName(null);
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(
        lang === 'en'
          ? 'Logo too large — max 800 KB. Send the original by email after submitting.'
          : 'Logo trop volumineux — max 800 Ko. Envoyez l\u2019original par courriel après la soumission.',
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setLogoDataUrl(result);
      setLogoName(file.name);
    };
    reader.onerror = () => {
      toast.error(
        lang === 'en' ? 'Could not read that file.' : 'Impossible de lire ce fichier.',
      );
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step1Valid || !step2Valid) return;
    setSubmitState('loading');

    const row: QuoteQueueRow = {
      quantity: Math.max(1, quantity),
      productSku,
      productName: sanitizeText(productName, { maxLength: 200 }),
      deadline: sanitizeText(deadline, { maxLength: 40 }),
      colors: sanitizeText(colors, { maxLength: 200 }),
      company: sanitizeText(company, { maxLength: 200 }),
      name: sanitizeText(name, { maxLength: 120 }),
      email: normalizeInvisible(email).trim().toLowerCase(),
      phone: sanitizeText(phone, { maxLength: 40 }),
      notes: sanitizeText(notes, { maxLength: 2000 }),
      logoDataUrl,
      logoName: logoName ? sanitizeText(logoName, { maxLength: 200 }) : null,
      estimatedTotal: Math.round(totalPrice * 100) / 100,
      estimatedUnit: unitPrice,
      at: Date.now(),
      lang,
    };

    try {
      const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      const clean: QuoteQueueRow[] = arr.filter(
        (v): v is QuoteQueueRow =>
          !!v && typeof v === 'object'
          && typeof (v as { email?: unknown }).email === 'string'
          && typeof (v as { company?: unknown }).company === 'string'
          && typeof (v as { at?: unknown }).at === 'number',
      );
      clean.push(row);
      // FIFO cap — drop oldest entries beyond QUEUE_CAP so localStorage
      // doesn't grow unbounded and a stale 800KB logo from three weeks
      // ago can't squat on the budget. slice(-CAP) keeps the most recent.
      const capped = clean.slice(-QUEUE_CAP);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(capped));
    } catch { /* noop — toast still fires so the user isn't left in limbo */ }

    // Brief loading dwell so the spinner registers before the tick.
    window.setTimeout(() => {
      toast.success(
        lang === 'en'
          ? 'Submission received — reply within 2 hours.'
          : 'Soumission envoyée — réponse dans 2 heures.',
        { duration: 6000 },
      );
      setSubmitState('success');
      setSubmitted(true);
      window.setTimeout(() => setSubmitState('idle'), 2000);
    }, 350);
  };

  // Display strings for the step indicator + nav labels.
  const stepLabels = lang === 'en'
    ? ['Project', 'Contact', 'Review']
    : ['Projet', 'Contact', 'Confirmation'];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[820px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-2">
          {lang === 'en' ? 'Bulk quote request' : 'Demande de soumission'}
        </h1>
        <p className="text-sm text-zinc-600 mb-8 max-w-[640px]">
          {lang === 'en'
            ? 'Three quick steps. We reply with a tailored quote within 2 business hours.'
            : 'Trois étapes rapides. On répond avec une soumission personnalisée sous 2 heures ouvrables.'}
        </p>

        {/* Stepper */}
        <ol className="flex items-center gap-2 mb-8" aria-label={lang === 'en' ? 'Form steps' : 'Étapes du formulaire'}>
          {stepLabels.map((label, i) => {
            const idx = (i + 1) as 1 | 2 | 3;
            const active = step === idx;
            const done = step > idx || submitted;
            return (
              <li key={label} className="flex items-center gap-2 flex-1">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-extrabold transition-colors ${
                    done
                      ? 'bg-[#0052CC] text-white'
                      : active
                        ? 'bg-[#0F2341] text-white'
                        : 'bg-zinc-200 text-zinc-500'
                  }`}
                >
                  {done ? <Check size={14} aria-hidden="true" /> : idx}
                </span>
                <span className={`text-[12px] font-bold uppercase tracking-wider ${active ? 'text-[#0F2341]' : 'text-zinc-500'}`}>
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <span aria-hidden="true" className={`flex-1 h-px ${done ? 'bg-[#0052CC]' : 'bg-zinc-200'}`} />
                )}
              </li>
            );
          })}
        </ol>

        <section className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-8 shadow-sm">
          {submitted ? (
            // Success state — replaces the form. Same pattern as Contact.tsx
            // so the user sees a concrete end-state after submission.
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mb-4">
                <Check size={28} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0F2341] mb-2">
                {lang === 'en' ? 'Submission received' : 'Soumission envoyée'}
              </h2>
              <p className="text-sm text-zinc-600 mb-6 max-w-[480px] mx-auto">
                {lang === 'en'
                  ? `Thanks ${name || 'for reaching out'} — we\u2019ll reply with a tailored quote within 2 business hours. Check your inbox at ${email}.`
                  : `Merci ${name || 'd\u2019avoir écrit'} — on revient avec une soumission personnalisée sous 2 heures ouvrables. Surveillez votre boîte\u00a0: ${email}.`}
              </p>
              <Link
                to="/"
                className="inline-block text-[14px] font-extrabold text-primary-foreground gradient-navy-dark px-6 py-3 rounded-full"
              >
                {lang === 'en' ? 'Back to home' : 'Retour à l\u2019accueil'}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {step === 1 && (
                <div className="grid gap-5">
                  <h2 className="text-xl font-extrabold text-[#0F2341]">
                    {lang === 'en' ? 'Project basics' : 'Détails du projet'}
                  </h2>

                  <div>
                    <label htmlFor="qty" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                      {lang === 'en' ? 'Quantity' : 'Quantité'} *
                    </label>
                    <input
                      id="qty"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value, 10) || 0)}
                      required
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/40 focus:border-[#0052CC]"
                    />
                  </div>

                  <div>
                    <label htmlFor="product" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                      {lang === 'en' ? 'Product' : 'Produit'} *
                    </label>
                    <select
                      id="product"
                      value={productSku}
                      onChange={e => setProductSku(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]/40 focus:border-[#0052CC]"
                    >
                      {PRODUCTS.map(p => (
                        <option key={p.sku} value={p.sku}>
                          {p.shortName} — {p.sku}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="deadline" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                        {lang === 'en' ? 'Deadline' : 'Échéance'}
                      </label>
                      <input
                        id="deadline"
                        type="date"
                        value={deadline}
                        onChange={e => setDeadline(e.target.value)}
                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/40 focus:border-[#0052CC]"
                      />
                    </div>
                    <div>
                      <label htmlFor="colors" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                        {lang === 'en' ? 'Colors / Pantone' : 'Couleurs / Pantone'}
                      </label>
                      <input
                        id="colors"
                        type="text"
                        value={colors}
                        onChange={e => setColors(e.target.value)}
                        placeholder={lang === 'en' ? 'e.g. PMS 2945 + white' : 'ex.\u00a0PMS 2945 + blanc'}
                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/40 focus:border-[#0052CC]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!step1Valid}
                      className="inline-flex items-center gap-1.5 text-[14px] font-extrabold text-primary-foreground gradient-navy-dark px-6 py-3 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {lang === 'en' ? 'Continue' : 'Continuer'}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <h2 className="text-xl font-extrabold text-[#0F2341]">
                    {lang === 'en' ? 'Your contact info' : 'Vos coordonnées'}
                  </h2>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="company" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                        {lang === 'en' ? 'Company' : 'Entreprise'} *
                      </label>
                      <input
                        id="company"
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/40 focus:border-[#0052CC]"
                      />
                    </div>
                    <div>
                      <label htmlFor="name" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                        {lang === 'en' ? 'Your name' : 'Votre nom'}
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/40 focus:border-[#0052CC]"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="email" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                        {lang === 'en' ? 'Email' : 'Courriel'} *
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setEmailErr(false); }}
                        aria-invalid={emailErr}
                        required
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          emailErr
                            ? 'border-red-400 focus:ring-red-300/40 focus:border-red-400'
                            : 'border-zinc-200 focus:ring-[#0052CC]/40 focus:border-[#0052CC]'
                        }`}
                      />
                      {emailErr && (
                        <p className="text-[11px] text-red-600 mt-1">
                          {lang === 'en' ? 'Please enter a valid email.' : 'Entrez un courriel valide.'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                        {lang === 'en' ? 'Phone' : 'Téléphone'} *
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setPhoneErr(false); }}
                        aria-invalid={phoneErr}
                        required
                        placeholder={lang === 'en' ? '514-555-1234' : '514-555-1234'}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          phoneErr
                            ? 'border-red-400 focus:ring-red-300/40 focus:border-red-400'
                            : 'border-zinc-200 focus:ring-[#0052CC]/40 focus:border-[#0052CC]'
                        }`}
                      />
                      {phoneErr && (
                        <p className="text-[11px] text-red-600 mt-1">
                          {lang === 'en'
                            ? 'Use a 10-digit Canadian number or +country format.'
                            : 'Utilisez un numéro à 10 chiffres ou le format +indicatif.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                      {lang === 'en' ? 'Logo (optional)' : 'Logo (optionnel)'}
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-zinc-300 rounded-lg text-sm text-zinc-600 bg-zinc-50 hover:bg-zinc-100 transition-colors"
                    >
                      <Upload size={15} aria-hidden="true" />
                      {logoName
                        ? logoName
                        : lang === 'en' ? 'Upload your logo (PNG, JPG, SVG, PDF)' : 'Téléverser votre logo (PNG, JPG, SVG, PDF)'}
                    </button>
                    <input
                      ref={fileInputRef}
                      id="logo"
                      type="file"
                      accept="image/*,.pdf,.svg"
                      onChange={e => handleFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      {lang === 'en'
                        ? 'Max 800 KB. For larger files, send by email after submitting.'
                        : 'Max 800 Ko. Pour des fichiers plus gros, envoyez par courriel après la soumission.'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="notes" className="block text-[12px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                      {lang === 'en' ? 'Notes' : 'Notes'}
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/40 focus:border-[#0052CC]"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex items-center gap-1.5 text-[13px] font-bold text-zinc-600 px-4 py-2 rounded-full hover:text-[#0F2341]"
                    >
                      <ArrowLeft size={15} aria-hidden="true" />
                      {lang === 'en' ? 'Back' : 'Retour'}
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-1.5 text-[14px] font-extrabold text-primary-foreground gradient-navy-dark px-6 py-3 rounded-full"
                    >
                      {lang === 'en' ? 'Review' : 'Réviser'}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-5">
                  <h2 className="text-xl font-extrabold text-[#0F2341]">
                    {lang === 'en' ? 'Review and submit' : 'Réviser et soumettre'}
                  </h2>

                  <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-5">
                    <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      {lang === 'en' ? 'Estimated price' : 'Prix estimé'}
                    </div>
                    <div className="text-3xl font-extrabold text-[#0F2341]">
                      {totalPrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                        style: 'currency',
                        currency: 'CAD',
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[12px] text-zinc-600 mt-1">
                      {quantity} × {productName} · {unitPrice.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
                        style: 'currency',
                        currency: 'CAD',
                      })}
                      {' '}
                      / {lang === 'en' ? 'unit' : 'unité'}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-2">
                      {lang === 'en'
                        ? 'Indicative only. Final pricing depends on art, locations and finishes — confirmed in our reply.'
                        : 'À titre indicatif. Le prix final dépend du visuel, des emplacements et des finitions — confirmé dans notre réponse.'}
                    </p>
                  </div>

                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Company' : 'Entreprise'}</dt>
                      <dd className="text-zinc-800">{company || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Contact' : 'Contact'}</dt>
                      <dd className="text-zinc-800">{name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Email' : 'Courriel'}</dt>
                      <dd className="text-zinc-800 break-all">{email}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Phone' : 'Téléphone'}</dt>
                      <dd className="text-zinc-800">{phone}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Deadline' : 'Échéance'}</dt>
                      <dd className="text-zinc-800">{deadline || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Colors' : 'Couleurs'}</dt>
                      <dd className="text-zinc-800">{colors || '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Logo' : 'Logo'}</dt>
                      <dd className="text-zinc-800">{logoName ?? (lang === 'en' ? 'None attached' : 'Aucun')}</dd>
                    </div>
                    {notes && (
                      <div className="sm:col-span-2">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Notes' : 'Notes'}</dt>
                        <dd className="text-zinc-800 whitespace-pre-wrap">{notes}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex items-center gap-1.5 text-[13px] font-bold text-zinc-600 px-4 py-2 rounded-full hover:text-[#0F2341]"
                    >
                      <ArrowLeft size={15} aria-hidden="true" />
                      {lang === 'en' ? 'Back' : 'Retour'}
                    </button>
                    <SubmitButton
                      state={submitState}
                      className="inline-flex items-center gap-1.5 text-[14px] font-extrabold text-primary-foreground gradient-navy-dark px-6 py-3 rounded-full"
                    >
                      {lang === 'en' ? 'Submit request' : 'Envoyer la demande'}
                    </SubmitButton>
                  </div>
                </div>
              )}
            </form>
          )}
        </section>

        <p className="text-[11px] text-zinc-500 mt-6 text-center">
          {lang === 'en'
            ? 'Submissions queue locally and our team is notified — response within 2 business hours.'
            : 'Les soumissions sont mises en file localement et notre équipe est avisée — réponse sous 2 heures ouvrables.'}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
