import { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

const REMOVE_BG_API_KEY = import.meta.env.VITE_REMOVE_BG_API_KEY;

async function removeBackground(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append('image_file', file);
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVE_BG_API_KEY },
    body: formData,
  });

  if (!response.ok) throw new Error('remove.bg failed');
  return response.blob();
}

async function uploadToSupabase(blob: Blob, filename: string): Promise<string> {
  const path = `logos/${Date.now()}-${filename.replace(/\.[^.]+$/, '')}.png`;
  const { error } = await supabase.storage
    .from('vision-logos')
    .upload(path, blob, { contentType: 'image/png', upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('vision-logos').getPublicUrl(path);
  return data.publicUrl;
}

type UploadStatus = 'idle' | 'uploading' | 'removing-bg' | 'saving' | 'done' | 'error';

export function LogoUploader({
  onLogoReady,
}: {
  onLogoReady: (previewUrl: string, processedUrl: string, originalFile: File) => void;
}) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format invalide. PNG, JPG ou SVG requis.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('Fichier trop volumineux (max 20MB).');
      return;
    }

    setErrorMsg(null);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setStatus('removing-bg');

    try {
      const noBgBlob = await removeBackground(file);
      const noBgUrl = URL.createObjectURL(noBgBlob);
      setPreview(noBgUrl);

      setStatus('saving');
      const processedUrl = await uploadToSupabase(noBgBlob, file.name);

      setStatus('done');
      onLogoReady(noBgUrl, processedUrl, file);
    } catch (err) {
      console.error(err);
      // Fallback: use original without remove.bg
      setStatus('done');
      onLogoReady(localUrl, localUrl, file);
    }
  }, [onLogoReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const statusMessages: Record<UploadStatus, string> = {
    idle: '',
    uploading: 'Chargement...',
    'removing-bg': 'Suppression du fond automatique...',
    saving: 'Sauvegarde sécurisée...',
    done: 'Logo prêt !',
    error: errorMsg ?? 'Erreur',
  };

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {status === 'idle' || status === 'error' ? (
          <motion.div
            key="drop-zone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-navy bg-navy/5 scale-[1.01]'
                : 'border-border hover:border-navy/50 hover:bg-secondary'
            }`}
          >
            <Upload className="mx-auto mb-3 text-muted-foreground" size={28} />
            <p className="text-sm font-semibold text-foreground">Glisse ton logo ici</p>
            <p className="text-xs text-muted-foreground mt-1">PNG · JPG · SVG · AI — max 20MB</p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#1B7A3E' }}>
              <CheckCircle2 size={12} />
              Fond supprimé automatiquement
            </div>
          </motion.div>
        ) : status === 'done' && preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-xl overflow-hidden border border-border bg-secondary"
            style={{ height: '140px' }}
          >
            <img src={preview} alt="Logo" className="w-full h-full object-contain p-4" />
            <button
              onClick={() => { setStatus('idle'); setPreview(null); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background shadow flex items-center justify-center text-muted-foreground hover:bg-destructive/10"
            >
              <X size={14} />
            </button>
            <div className="absolute bottom-2 left-2 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: 'rgba(27,122,62,0.9)' }}>
              <CheckCircle2 size={11} /> Fond supprimé
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-secondary flex flex-col items-center justify-center gap-3"
            style={{ height: '140px' }}
          >
            <Loader2 className="text-navy animate-spin" size={28} />
            <p className="text-sm font-medium text-muted-foreground">{statusMessages[status]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMsg && (
        <p className="text-xs text-destructive font-medium px-1">{errorMsg}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />
    </div>
  );
}
