import { useEffect, useMemo, useState } from 'react';
import { Save, Gauge, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getCurrentCapacity,
  getRemainingSlots,
  setCurrentCapacity,
  type WeeklyCapacity,
} from '@/lib/capacity';

// Volume II §10.1 — operator-side capacity editor.
//
// The Supabase weekly_capacity table is the eventual source of
// truth, but until the Shopify webhook → Supabase sync lands the
// VA team needs a manual lever to keep the public scarcity widget
// honest. This page is that lever:
//
//   • totalSlots is the shop's effective production ceiling for
//     the current ISO week (default 50; bump up for holiday
//     weeks, drop for short weeks / equipment-down events).
//   • bookedSlots is paid orders that have hit production. Until
//     the sync ships, an operator increments this manually after
//     each Shopify checkout — friction is intentional, the form
//     should NOT be replaced by an inferred count from local
//     order history (we don't have one yet, and the public number
//     drives a public urgency claim).
//
// Saved values flow into localStorage (`va:capacity`), which
// CapacityWidget reads. When the Supabase wiring lands, swap the
// implementation in src/lib/capacity.ts; this page can stay as-is.

export default function AdminCapacity() {
  useDocumentTitle('Capacité hebdomadaire — Admin');

  const [capacity, setCapacity] = useState<WeeklyCapacity>(() => getCurrentCapacity());
  // Track input-side state separately from the persisted capacity
  // so the operator can clear a field, retype it, and the gauge
  // below the form keeps showing the saved snapshot rather than
  // flickering to 0 mid-edit.
  const [totalInput, setTotalInput] = useState<string>(String(capacity.totalSlots));
  const [bookedInput, setBookedInput] = useState<string>(String(capacity.bookedSlots));

  // If the page is left open across a midnight Sunday→Monday
  // boundary, the stored weekStartIso would still be last week's
  // Monday and the gauge would lie. Re-pull on mount; the parent
  // route remount on navigation already covers most cases.
  useEffect(() => {
    const fresh = getCurrentCapacity();
    setCapacity(fresh);
    setTotalInput(String(fresh.totalSlots));
    setBookedInput(String(fresh.bookedSlots));
  }, []);

  const remaining = getRemainingSlots(capacity);
  const pctBooked = useMemo(() => {
    if (capacity.totalSlots <= 0) return 0;
    return Math.min(100, Math.round((capacity.bookedSlots / capacity.totalSlots) * 100));
  }, [capacity]);

  // Strict non-negative integer parse. parseInt silently accepts
  // "3.7" (→3) and "12abc" (→12); Number() rejects trailing junk
  // but accepts "" (→0) and floats. We need both signals: reject
  // empty/whitespace, reject non-finite, reject non-integers, reject
  // negatives. The public scarcity widget reads these values, so a
  // bogus float here would surface as "Plus que 12.5 créneaux".
  const parseSlotCount = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    if (!Number.isInteger(n)) return null;
    if (n < 0) return null;
    // Guard against absurd inputs (typos like "500000") that would
    // make the gauge math meaningless. 10k is well above any real
    // weekly ceiling.
    if (n > 10000) return null;
    return n;
  };

  const handleSave = () => {
    const total = parseSlotCount(totalInput);
    const booked = parseSlotCount(bookedInput);
    if (total === null) {
      toast.error('Total invalide — entrez un entier entre 0 et 10000.');
      return;
    }
    if (booked === null) {
      toast.error('Réservés invalide — entrez un entier entre 0 et 10000.');
      return;
    }
    if (booked > total) {
      toast.error('Réservés ne peut pas dépasser le total.');
      return;
    }
    const next: WeeklyCapacity = {
      weekStartIso: capacity.weekStartIso,
      totalSlots: total,
      bookedSlots: booked,
    };
    const ok = setCurrentCapacity(next);
    if (!ok) {
      toast.error('Sauvegarde impossible — stockage local indisponible.');
      return;
    }
    setCapacity(next);
    toast.success('Capacité mise à jour.');
  };

  const weekLabel = (() => {
    const d = new Date(`${capacity.weekStartIso}T00:00:00`);
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          Capacité hebdomadaire
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Volume II §10.1 — ajuste manuellement les créneaux de production de
          la semaine courante. Le widget de rareté sur la page d&apos;accueil
          et les pages produit s&apos;active automatiquement lorsque les
          créneaux restants tombent sous 15.
        </p>
      </header>

      {/* Form */}
      <section className="rounded-2xl border border-border bg-background p-6 mb-6">
        <div className="grid gap-5">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="cap-total">
              Total des créneaux
            </label>
            <input
              id="cap-total"
              type="number"
              min={0}
              max={10000}
              step={1}
              inputMode="numeric"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Capacité totale de production pour la semaine (défaut 50).
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="cap-booked">
              Créneaux réservés
            </label>
            <input
              id="cap-booked"
              type="number"
              min={0}
              max={10000}
              step={1}
              inputMode="numeric"
              value={bookedInput}
              onChange={(e) => setBookedInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Commandes payées déjà entrées en production cette semaine.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Save size={16} aria-hidden="true" />
            Sauvegarder
          </button>
        </div>
      </section>

      {/* Live gauge */}
      <section className="rounded-2xl border border-border bg-background p-6">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={16} className="text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Semaine du {weekLabel}
          </h2>
        </div>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-4xl font-extrabold tabular-nums text-foreground">
            {remaining}
          </span>
          <span className="text-sm text-muted-foreground">
            créneaux restants sur {capacity.totalSlots}
          </span>
        </div>
        <div
          className="w-full h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={pctBooked}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pctBooked}% des créneaux réservés`}
        >
          <div
            className={`h-full transition-all duration-300 ${
              remaining < 15 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pctBooked}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {pctBooked}% réservés · Le widget public s&apos;active sous 15 créneaux restants.
        </p>

        {remaining < 15 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <AlertCircle size={14} className="text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-amber-900 leading-snug">
              Le widget de rareté est <strong>actif</strong> sur la page d&apos;accueil et les pages produit.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
