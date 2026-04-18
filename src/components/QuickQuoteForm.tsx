import { useState } from 'react';
import { CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';

const PRODUCT_OPTIONS = [
  { id: 'tshirt',     fr: 'T-shirt',     en: 'T-shirt',  basePrice: 4.15 },
  { id: 'hoodie',     fr: 'Hoodie',      en: 'Hoodie',   basePrice: 28.90 },
  { id: 'crewneck',   fr: 'Crewneck',    en: 'Crewneck', basePrice: 16.81 },
  { id: 'polo',       fr: 'Polo',        en: 'Polo',     basePrice: 27.99 },
  { id: 'cap',        fr: 'Casquette',   en: 'Cap',      basePrice: 11.54 },
  { id: 'toque',      fr: 'Tuque',       en: 'Beanie',   basePrice: 4.50 },
];

const PRINT_PRICE = 4.50; // matches PRINT_PRICE in src/data/products.ts

export function QuickQuoteForm() {
  const { lang } = useLang();
  const [productId, setProductId] = useState('hoodie');
  const [qty, setQty] = useState('25');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const product = PRODUCT_OPTIONS.find(p => p.id === productId)!;
  const quantity = Math.max(parseInt(qty) || 0, 0);
  const unitPrice = product.basePrice + PRINT_PRICE;
  const subtotal = unitPrice * quantity;
  const isBulk = quantity >= 12;
  const discount = isBulk ? subtotal * 0.10 : 0;
  const total = subtotal - discount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Persist locally so the next vendor session can pick it up. In prod,
    // POST to a Supabase edge function or Zapier webhook.
    try {
      const leads = JSON.parse(localStorage.getItem('vision-quote-leads') ?? '[]');
      leads.unshift({
        productId, qty: quantity, email, name,
        estimatedTotal: total,
        createdAt: new Date().toISOString(),
        lang,
      });
      localStorage.setItem('vision-quote-leads', JSON.stringify(leads.slice(0, 50)));
    } catch {}
    await new Promise(r => setTimeout(r, 600));
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-8 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} strokeWidth={2.5} />
        </div>
        <h3 className="text-2xl font-extrabold text-emerald-900 mb-2">
          {lang === 'en' ? 'Quote request sent!' : 'Demande envoyée !'}
        </h3>
        <p className="text-sm text-emerald-700 leading-relaxed">
          {lang === 'en'
            ? `One of our reps will email you within 24h with a custom quote and visual mockups. Expected delivery: 5 business days from approval.`
            : `Un de nos conseillers va te contacter dans les 24h avec une soumission personnalisée et des maquettes visuelles. Livraison prévue : 5 jours ouvrables après approbation.`}
        </p>
        <button
          type="button"
          onClick={() => { setSubmitted(false); setEmail(''); setName(''); }}
          className="mt-5 text-xs font-bold text-emerald-700 hover:underline"
        >
          {lang === 'en' ? 'Submit another' : 'Soumettre une autre demande'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[2px] text-[#0052CC] mb-2">
        <Sparkles size={14} />
        {lang === 'en' ? 'Free quote in 60 seconds' : 'Soumission gratuite en 60 secondes'}
      </div>
      <h3 className="text-2xl md:text-3xl font-extrabold tracking-[-0.5px] text-foreground mb-1">
        {lang === 'en' ? 'Get your custom quote' : 'Obtiens ta soumission'}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        {lang === 'en'
          ? 'Tell us what you need — we\'ll send personalized pricing + mockups within 24h.'
          : 'Dis-nous ce qu\'il te faut — on t\'envoie un prix personnalisé + maquettes en 24h.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === 'en' ? 'Product' : 'Produit'}
            </span>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background outline-none focus:border-[#0052CC]"
            >
              {PRODUCT_OPTIONS.map(p => (
                <option key={p.id} value={p.id}>{lang === 'en' ? p.en : p.fr}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === 'en' ? 'Quantity' : 'Quantité'}
            </span>
            <input
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
              min="1"
              required
              className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background outline-none focus:border-[#0052CC]"
            />
          </label>
        </div>

        <div className="bg-secondary/50 rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              {lang === 'en' ? 'Estimated total' : 'Total estimé'}
            </span>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-foreground">
                {total.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 })}
              </div>
              {isBulk && (
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  -10% {lang === 'en' ? 'volume' : 'volume'} ({discount.toFixed(0)} $)
                </div>
              )}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {quantity} × {unitPrice.toFixed(2)} $ {lang === 'en' ? '(includes printing)' : "(impression incluse)"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === 'en' ? 'Your name' : 'Ton nom'}
            </span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              required
              placeholder={lang === 'en' ? 'Jane Doe' : 'Marie Tremblay'}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background outline-none focus:border-[#0052CC]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === 'en' ? 'Email' : 'Courriel'}
            </span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@company.com"
              className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background outline-none focus:border-[#0052CC]"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 gradient-navy-dark text-primary-foreground rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 hover:shadow-xl transition-all disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          {submitting
            ? lang === 'en' ? 'Sending…' : 'Envoi…'
            : lang === 'en' ? 'Get my custom quote' : 'Recevoir ma soumission'}
        </button>

        <p className="text-[11px] text-muted-foreground text-center">
          {lang === 'en'
            ? '✓ Free · ✓ No commitment · ✓ Reply within 24h'
            : '✓ Gratuit · ✓ Sans engagement · ✓ Réponse en 24h'}
        </p>
      </form>
    </div>
  );
}
