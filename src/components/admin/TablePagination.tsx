import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * TablePagination — minimal prev/next pagination for admin tables.
 *
 * Used by AdminCustomers, AdminOrders, etc. Stays stateless; the
 * parent owns `page` and passes it in so the filter→reset-to-page-0
 * logic lives next to the filter state (React idiom).
 */
interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
  /** Bilingual label suffix for the counter, e.g. "commandes". */
  itemLabel?: string;
}

function TablePaginationInner({ page, pageSize, total, onPageChange, itemLabel }: Props) {
  // Nothing to paginate — don't render the footer at all. Keeps the
  // UI clean for small result sets.
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = page * pageSize + 1;
  const last  = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 text-xs text-zinc-500">
      <span>
        {first}–{last} sur {total}
        {itemLabel ? ` ${itemLabel}` : ''}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Page précédente"
          className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 font-semibold text-zinc-700">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          aria-label="Page suivante"
          className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export const TablePagination = memo(TablePaginationInner);
