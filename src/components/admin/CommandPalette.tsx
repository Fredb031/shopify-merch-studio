import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, UserCircle, FileText,
  Users, KeyRound, Mail, Sparkles, Settings, Search,
} from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Admin command palette — Cmd/Ctrl+K from anywhere inside the admin
 * section pops a quick-jump list of the top-level pages. Keeps keyboard
 * power users from hunting through the sidebar on narrow windows or
 * hopping pages via the address bar.
 *
 * The global binding deliberately skips text inputs so the shortcut
 * never eats a keystroke while someone is mid-edit (notes field, email
 * composer, search boxes). Escape dismisses via useEscapeKey; Tab is
 * contained via useFocusTrap so focus can't leak to the dimmed page.
 */
type PaletteItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  keywords?: string;
};

const ITEMS: PaletteItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, keywords: 'tableau de bord home accueil' },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingBag, keywords: 'commandes' },
  { label: 'Products', to: '/admin/products', icon: Package, keywords: 'produits catalogue' },
  { label: 'Customers', to: '/admin/customers', icon: UserCircle, keywords: 'clients' },
  { label: 'Quotes', to: '/admin/quotes', icon: FileText, keywords: 'soumissions devis' },
  { label: 'Vendors', to: '/admin/vendors', icon: Users, keywords: 'vendeurs equipe' },
  { label: 'Users', to: '/admin/users', icon: KeyRound, keywords: 'comptes acces users' },
  { label: 'Emails', to: '/admin/emails', icon: Mail, keywords: 'courriels messages' },
  { label: 'Images', to: '/admin/images', icon: Sparkles, keywords: 'generation ai ia images' },
  { label: 'Settings', to: '/admin/settings', icon: Settings, keywords: 'parametres configuration' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const close = useCallback(() => setOpen(false), []);
  useEscapeKey(open, close);

  // Bind Cmd+K / Ctrl+K globally — but ignore when focus sits in a
  // text-editing surface so we never clobber what the user is typing.
  // CapsLock flips e.key to 'K', so compare case-insensitively.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'k') return;
      const t = document.activeElement as HTMLElement | null;
      const tag = t?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable;
      if (isEditing) return;
      e.preventDefault();
      setOpen(prev => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset transient state each time we reopen so the palette never
  // surfaces a stale search / selection.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    // Focus the input after the focus trap has settled — useFocusTrap
    // focuses the first tabbable child, which IS our input, so this is
    // just a defensive re-focus for the empty-list edge case.
    queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.keywords?.toLowerCase().includes(q) ?? false),
    );
  }, [query]);

  // Clamp the active index whenever the filter shrinks — otherwise the
  // highlight would point past the end of the list and Enter would be a
  // no-op.
  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  const go = useCallback((to: string) => {
    setOpen(false);
    navigate(to);
  }, [navigate]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[active];
      if (item) go(item.to);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fermer la palette de commandes"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 border-b border-zinc-200">
          <Search size={16} className="text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Aller à…"
            aria-label="Rechercher une page"
            aria-controls="command-palette-list"
            className="flex-1 py-3 text-sm bg-transparent outline-none placeholder:text-zinc-400"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <ul
          id="command-palette-list"
          role="listbox"
          aria-label="Pages d'administration"
          className="max-h-80 overflow-y-auto py-1"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-sm text-zinc-500 text-center">
              Aucun résultat
            </li>
          )}
          {filtered.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === active;
            return (
              <li key={item.to} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => go(item.to)}
                  onMouseEnter={() => setActive(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isActive ? 'bg-[#0052CC]/10 text-[#0F2341]' : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="text-zinc-500" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[11px] text-zinc-400">{item.to}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
