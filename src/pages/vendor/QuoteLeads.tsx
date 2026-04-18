import { useEffect, useState } from 'react';
import { Mail, Trash2, Sparkles, ArrowRight, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Lead {
  productId: string;
  qty: number;
  email: string;
  name: string;
  estimatedTotal: number;
  createdAt: string;
  lang: string;
}

const PRODUCT_LABEL: Record<string, string> = {
  tshirt: 'T-shirt',
  hoodie: 'Hoodie',
  crewneck: 'Crewneck',
  polo: 'Polo',
  cap: 'Casquette',
  toque: 'Tuque',
};

export default function QuoteLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('vision-quote-leads') ?? '[]');
      setLeads(Array.isArray(raw) ? raw : []);
    } catch {
      setLeads([]);
    }
  }, []);

  const remove = (idx: number) => {
    const next = leads.filter((_, i) => i !== idx);
    setLeads(next);
    localStorage.setItem('vision-quote-leads', JSON.stringify(next));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Inbox size={22} className="text-[#0052CC]" />
            Demandes entrantes
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Visiteurs qui ont rempli le formulaire de soumission rapide sur le site
          </p>
        </div>
        <Link
          to="/vendor/quotes/new"
          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90"
        >
          Créer une soumission ad hoc <ArrowRight size={14} />
        </Link>
      </header>

      {leads.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
            <Inbox size={28} className="text-zinc-400" />
          </div>
          <h3 className="font-bold text-zinc-900">Aucune demande pour le moment</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
            Quand un visiteur soumet le formulaire de soumission rapide sur la page d'accueil,
            sa demande apparaît ici. Tu peux ensuite la convertir en soumission complète.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead, i) => {
            const date = new Date(lead.createdAt);
            const product = PRODUCT_LABEL[lead.productId] ?? lead.productId;
            return (
              <div
                key={i}
                className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white flex items-center justify-center text-sm font-extrabold flex-shrink-0">
                    {(lead.name || lead.email)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-bold">{lead.name || lead.email.split('@')[0]}</div>
                      <div className="text-[11px] text-zinc-400 whitespace-nowrap">
                        {date.toLocaleString('fr-CA')}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">{lead.email}</div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                      <div className="bg-zinc-50 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Produit</div>
                        <div className="font-bold mt-0.5">{product}</div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Quantité</div>
                        <div className="font-bold mt-0.5">{lead.qty}</div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Estimé</div>
                        <div className="font-extrabold text-[#0052CC] mt-0.5">
                          {lead.estimatedTotal.toFixed(0)} $
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <a
                        href={`mailto:${lead.email}?subject=${encodeURIComponent(`Ta soumission Vision Affichage — ${product} × ${lead.qty}`)}&body=${encodeURIComponent(`Bonjour ${lead.name},\n\nMerci pour ta demande !\n\nJe te prépare une soumission détaillée pour ${lead.qty} ${product}(s) avec ton logo. Je reviens vers toi avec les options de couleurs, tailles et placement dans la journée.\n\nQuestions en attendant ?\n\n— L'équipe Vision Affichage`)}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90"
                      >
                        <Mail size={13} />
                        Répondre
                      </a>
                      <Link
                        to="/vendor/quotes/new"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50"
                      >
                        <Sparkles size={13} />
                        Créer soumission
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="ml-auto w-8 h-8 rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

