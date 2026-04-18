import { useMemo, useState } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import type { OrderStatus } from '@/types/admin';

interface MockOrder {
  id: string;
  number: string;
  client: string;
  email: string;
  items: number;
  total: number;
  status: OrderStatus;
  date: string;
  shopifyId: string;
}

const MOCK_ORDERS: MockOrder[] = [
  { id: '1', number: 'VA-1048', client: 'Sous Pression', email: 'anthony@souspression.ca', items: 24, total: 1840, status: 'processing', date: '2026-04-17', shopifyId: '#8043210' },
  { id: '2', number: 'VA-1047', client: 'Perfocazes', email: 'hubert@perfocazes.com', items: 8, total: 620, status: 'shipped', date: '2026-04-17', shopifyId: '#8043209' },
  { id: '3', number: 'VA-1046', client: 'Extreme Fab', email: 'info@extremefab.ca', items: 48, total: 3450, status: 'printing', date: '2026-04-16', shopifyId: '#8043208' },
  { id: '4', number: 'VA-1045', client: 'Sports Experts', email: 'commandes@sportsexperts.ca', items: 30, total: 2100, status: 'delivered', date: '2026-04-16', shopifyId: '#8043207' },
  { id: '5', number: 'VA-1044', client: 'Lacasse', email: 'marie@lacasse.com', items: 12, total: 840, status: 'pending', date: '2026-04-15', shopifyId: '#8043206' },
  { id: '6', number: 'VA-1043', client: 'Uni', email: 'contact@uni-ca.com', items: 18, total: 1260, status: 'cancelled', date: '2026-04-15', shopifyId: '#8043205' },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'En attente',
  processing: 'En traitement',
  printing: 'Impression',
  shipped: 'Expédié',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-700',
  processing: 'bg-blue-50 text-blue-700',
  printing: 'bg-amber-50 text-amber-700',
  shipped: 'bg-purple-50 text-purple-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

export default function AdminOrders() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selected, setSelected] = useState<MockOrder | null>(null);

  const filtered = useMemo(() => {
    return MOCK_ORDERS.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return o.client.toLowerCase().includes(q) || o.number.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
    });
  }, [query, statusFilter]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Commandes</h1>
          <p className="text-sm text-zinc-500 mt-1">{MOCK_ORDERS.length} commandes total · synchronisées avec Shopify</p>
        </div>
        <button className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white">
          <Download size={15} />
          Exporter CSV
        </button>
      </header>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par client, #commande, courriel"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-zinc-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as OrderStatus | 'all')}
              className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC]"
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
              <tr>
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-right px-4 py-3">Articles</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Shopify</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-400 text-sm">
                    Aucune commande trouvée
                  </td>
                </tr>
              ) : (
                filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-bold">{o.number}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{o.client}</div>
                      <div className="text-xs text-zinc-500">{o.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{o.items}</td>
                    <td className="px-4 py-3 text-right font-bold">{o.total.toLocaleString('fr-CA')} $</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_COLOR[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{o.date}</td>
                    <td className="px-4 py-3 text-right text-[11px] text-zinc-400 font-mono">{o.shopifyId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-zinc-500">Commande</div>
                  <h2 className="text-xl font-extrabold">{selected.number}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-700 text-sm">Fermer</button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Client</div>
                  <div className="font-semibold">{selected.client}</div>
                  <div className="text-zinc-500">{selected.email}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Total</div>
                  <div className="text-2xl font-extrabold">{selected.total.toLocaleString('fr-CA')} $ CAD</div>
                  <div className="text-xs text-zinc-500">{selected.items} articles</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Statut</div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${STATUS_COLOR[selected.status]}`}>
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Shopify</div>
                  <a className="text-[#0052CC] font-mono text-xs hover:underline">{selected.shopifyId} ↗</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
