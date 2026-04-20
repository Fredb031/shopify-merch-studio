import { useEffect, useState } from 'react';
import { Link2, Building2, CreditCard, Shield, ExternalLink } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// localStorage key for the settings toggles. Persisting client-side only
// since these are stub features pending real backend wiring — the keys
// match what a future Supabase-backed sync would use.
const SETTINGS_KEY = 'vision-admin-settings';

interface SettingsState {
  twoFactor: boolean;
  newOrderEmail: boolean;
  zapierWebhook: boolean;
  // Company profile — persisted so edits survive refresh. Previously
  // the inputs were uncontrolled (defaultValue only), so typing into
  // them did nothing visible after navigation. That reads as a broken
  // admin panel.
  companyName: string;
  companyNeq: string;
  companyEmail: string;
  companyPhone: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  twoFactor: true,
  newOrderEmail: true,
  zapierWebhook: false,
  companyName: 'Vision Affichage',
  companyNeq: '',
  companyEmail: 'info@visionaffichage.com',
  companyPhone: '367-380-4808',
};

function readSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    // Coerce each field — a devtools edit could land strings or null
    // and break the strict aria-checked type on the toggles, or a
    // non-string on the controlled company inputs.
    const str = (v: unknown, fallback: string) => typeof v === 'string' ? v : fallback;
    return {
      twoFactor: Boolean(parsed.twoFactor ?? DEFAULT_SETTINGS.twoFactor),
      newOrderEmail: Boolean(parsed.newOrderEmail ?? DEFAULT_SETTINGS.newOrderEmail),
      zapierWebhook: Boolean(parsed.zapierWebhook ?? DEFAULT_SETTINGS.zapierWebhook),
      companyName: str(parsed.companyName, DEFAULT_SETTINGS.companyName),
      companyNeq: str(parsed.companyNeq, DEFAULT_SETTINGS.companyNeq),
      companyEmail: str(parsed.companyEmail, DEFAULT_SETTINGS.companyEmail),
      companyPhone: str(parsed.companyPhone, DEFAULT_SETTINGS.companyPhone),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function AdminSettings() {
  useDocumentTitle('Paramètres — Admin Vision Affichage');
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  // Hydrate from localStorage on mount. Done in an effect rather than
  // the useState initializer so the initial render matches SSR (we don't
  // SSR today, but this stays consistent with the rest of the codebase).
  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const persist = (next: SettingsState) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }
    catch { /* private mode — state still works in-memory */ }
  };

  const toggle = (key: 'twoFactor' | 'newOrderEmail' | 'zapierWebhook') => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      persist(next);
      return next;
    });
  };

  const updateField = (key: 'companyName' | 'companyNeq' | 'companyEmail' | 'companyPhone', value: string) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Paramètres</h1>
        <p className="text-sm text-zinc-500 mt-1">Configurez votre entreprise et vos intégrations</p>
      </header>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Informations de l'entreprise</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nom légal" value={settings.companyName} onChange={v => updateField('companyName', v)} />
          <Field label="NEQ" value={settings.companyNeq} onChange={v => updateField('companyNeq', v)} placeholder="Numéro d'entreprise du Québec" />
          <Field label="Courriel général" type="email" value={settings.companyEmail} onChange={v => updateField('companyEmail', v)} />
          <Field label="Téléphone" value={settings.companyPhone} onChange={v => updateField('companyPhone', v)} />
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Link2 size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Connexion Shopify</h2>
        </div>
        <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
          <div>
            <div className="font-semibold text-sm">visionaffichage.myshopify.com</div>
            <div className="text-xs text-zinc-500 mt-0.5">Connecté · 22 produits synchronisés</div>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">Actif</span>
        </div>
        {/* Link to Shopify's Apps & permissions page since the actual
            permission grants live there — the bare button with no
            onClick used to read as a broken integration. */}
        <a
          href="https://visionaffichage.myshopify.com/admin/apps"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gérer les permissions des apps dans Shopify Admin (nouvel onglet)"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
        >
          Gérer les permissions
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <CreditCard size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Paiements</h2>
        </div>
        <div className="text-sm text-zinc-600">
          Traitement via Shopify Payments. Configurez les taxes QST/TPS dans l'admin Shopify.
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <Shield size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Sécurité</h2>
        </div>
        <div className="space-y-2 text-sm">
          <Toggle label="Authentification à deux facteurs (2FA)" enabled={settings.twoFactor} onToggle={() => toggle('twoFactor')} />
          <Toggle label="Notifications par courriel sur nouvelle commande" enabled={settings.newOrderEmail} onToggle={() => toggle('newOrderEmail')} />
          <Toggle label="Webhook Zapier sur paiement reçu" enabled={settings.zapierWebhook} onToggle={() => toggle('zapierWebhook')} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
      />
    </label>
  );
}

function Toggle({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  // Build a stable id for the label association — avoid characters that
  // would need escaping in CSS selectors (the toggles include '(2FA)'
  // parens which are valid HTML but messy in querySelector strings).
  const id = `toggle-${label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
      <span className="text-sm" id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={id}
        onClick={onToggle}
        className={`relative inline-block w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${enabled ? 'bg-[#0052CC]' : 'bg-zinc-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} aria-hidden="true" />
      </button>
    </div>
  );
}
