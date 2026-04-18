import { Link } from 'react-router-dom';
import { ShoppingBag, DollarSign, FileText, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';

const MOCK_RECENT_ORDERS = [
  { id: '1', number: '#VA-1048', client: 'Sous Pression', total: 1840, status: 'processing', date: '2026-04-17' },
  { id: '2', number: '#VA-1047', client: 'Perfocazes', total: 620, status: 'shipped', date: '2026-04-17' },
  { id: '3', number: '#VA-1046', client: 'Extreme Fab', total: 3450, status: 'printing', date: '2026-04-16' },
  { id: '4', number: '#VA-1045', client: 'Sports Experts', total: 2100, status: 'delivered', date: '2026-04-16' },
];

const STATUS_COLORS: Record<string, string> = {
  processing: 'bg-blue-50 text-blue-700',
  printing: 'bg-amber-50 text-amber-700',
  shipped: 'bg-purple-50 text-purple-700',
  delivered: 'bg-emerald-50 text-emerald-700',
};

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-zinc-500 mt-1">Vue d'ensemble de Vision Affichage</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Commandes (7j)" value="24" delta={12} deltaLabel="vs. sem. dernière" icon={ShoppingBag} accent="blue" />
        <StatCard label="Revenus (7j)" value="18 420 $" delta={8} deltaLabel="vs. sem. dernière" icon={DollarSign} accent="green" />
        <StatCard label="Soumissions ouvertes" value="6" delta={-2} icon={FileText} accent="gold" />
        <StatCard label="Produits actifs" value="22" icon={Package} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-zinc-900">Commandes récentes</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-[#0052CC] hover:underline">
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {MOCK_RECENT_ORDERS.map(order => (
              <div key={order.id} className="py-3 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{order.number}</div>
                  <div className="text-xs text-zinc-500">{order.client}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{order.total.toLocaleString('fr-CA')} $</div>
                  <div className="text-[10px] text-zinc-500">{order.date}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${STATUS_COLORS[order.status]}`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-zinc-900 text-sm">Shopify sync</h2>
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Produits synchronisés</span>
                <span className="font-bold">22 / 22</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Dernière sync</span>
                <span className="font-bold">il y a 2 min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Commandes à traiter</span>
                <span className="font-bold">3</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0F2341] to-[#1B3A6B] text-white rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} />
              </div>
              <div>
                <div className="font-bold text-sm mb-1">Stock faible</div>
                <div className="text-xs text-white/70 mb-3">3 produits ont un inventaire sous 10 unités.</div>
                <Link to="/admin/products?filter=low-stock" className="text-[11px] font-bold text-[#E8A838] hover:underline">
                  Voir les produits →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
