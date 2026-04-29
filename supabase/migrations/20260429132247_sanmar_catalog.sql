-- SanMar Canada integration — Step 3 schema
--
-- Adds three tables:
--   sanmar_catalog   : denormalised product/part snapshot for the storefront
--   sanmar_orders    : audit log of every order submitted via sanmar-submit-order
--   sanmar_sync_log  : observability row per sync run (catalog/inventory/order_status)
--
-- RLS:
--   sanmar_orders has RLS enabled — users see only their own rows; the
--   service role (used by the edge function on insert/update) has full access.
--   sanmar_catalog and sanmar_sync_log are operator-only / public-read; we
--   leave RLS off until a consumer needs row-level scoping.

CREATE TABLE IF NOT EXISTS public.sanmar_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id TEXT NOT NULL,
  part_id TEXT NOT NULL UNIQUE,
  product_name TEXT,
  brand TEXT,
  category TEXT,
  color_name TEXT,
  size TEXT,
  price NUMERIC(12, 4),
  image_urls TEXT[],
  quantity_available INTEGER DEFAULT 0,
  quantity_by_warehouse JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sanmar_catalog_style ON public.sanmar_catalog(style_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_catalog_part ON public.sanmar_catalog(part_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_catalog_active ON public.sanmar_catalog(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.sanmar_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_order_id TEXT NOT NULL,
  sanmar_transaction_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_data JSONB NOT NULL,
  status_id INT,
  status_name TEXT,
  expected_ship_date DATE,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sanmar_orders_va_order ON public.sanmar_orders(va_order_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_orders_user ON public.sanmar_orders(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sanmar_orders_transaction ON public.sanmar_orders(sanmar_transaction_id);

ALTER TABLE public.sanmar_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own sanmar orders" ON public.sanmar_orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service role full access" ON public.sanmar_orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.sanmar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('catalog', 'inventory', 'order_status')),
  total_processed INT DEFAULT 0,
  errors JSONB,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
