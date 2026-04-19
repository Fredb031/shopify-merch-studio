import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create client when both env vars are present
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const LOGO_BUCKET = 'vision-logos';

export async function uploadLogo(blob: Blob, filename: string): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
    return null;
  }
  // Strip the original extension before we append .png — otherwise
  // "logo.png" landed as "logo.png.png" in the bucket and the admin
  // saw double-extension files when browsing Supabase Storage. Also
  // cap the base name so a pathological filename can't blow Supabase's
  // path length limit, and add a random suffix so two same-ms uploads
  // of the same file don't collide on the upsert:false write.
  const base = filename
    .replace(/\.[a-z0-9]+$/i, '')       // drop trailing extension
    .replace(/[^a-z0-9.]/gi, '-')       // sanitize
    .slice(0, 60) || 'logo';
  const suffix = Math.random().toString(36).slice(2, 8);
  const path = `logos/${Date.now()}-${suffix}-${base}.png`;
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: false });

  if (error) {
    console.error('Logo upload failed:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
