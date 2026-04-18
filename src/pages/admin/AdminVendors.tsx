import { Plus, Mail, TrendingUp } from 'lucide-react';

const MOCK_VENDORS = [
  { id: '1', name: 'Sophie Tremblay',  email: 'sophie@visionaffichage.com', quotesSent: 47, conversionRate: 68, revenue: 28400, lastActive: 'il y a 12 min' },
  { id: '2', name: 'Marc-André Pelletier', email: 'marc@visionaffichage.com', quotesSent: 32, conversionRate: 74, revenue: 19200, lastActive: 'il y a 1h' },
  { id: '3', name: 'Julie Gagnon', email: 'julie@visionaffichage.com', quotesSent: 28, conversionRate: 61, revenue: 15800, lastActive: 'il y a 4h' },
];

export default function AdminVendors() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vendeurs</h1>
          <p className="text-sm text-zinc-500 mt-1">Gère ton équipe et les rôles</p>
        </div>
        <button className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90">
          <Plus size={15} />
          Ajouter un vendeur
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_VENDORS.map(v => {
          const initials = v.name.split(' ').map(n => n[0]).slice(0, 2).join('');
          return (
            <div key={v.id} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center font-extrabold text-sm">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{v.name}</div>
                  <div className="text-xs text-zinc-500 truncate flex items-center gap-1">
                    <Mail size={11} />
                    {v.email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-zinc-900">{v.quotesSent}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Devis</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-emerald-600 inline-flex items-center gap-0.5">
                    {v.conversionRate}%
                    <TrendingUp size={11} />
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Conv.</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-zinc-900">{(v.revenue / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Ventes</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Actif {v.lastActive}</span>
                <button className="text-[#0052CC] font-bold hover:underline">Gérer →</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
