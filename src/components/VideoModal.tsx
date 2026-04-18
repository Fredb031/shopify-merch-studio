import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  src?: string;
  poster?: string;
  title?: string;
  subtitle?: string;
}

export function VideoModal({ isOpen, onClose, src, poster, title, subtitle }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, src]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Video'}
      className="fixed inset-0 z-[800] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close video"
        className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border-none cursor-pointer"
      >
        <X size={22} />
      </button>

      <div
        className="w-full max-w-[960px] aspect-video bg-black rounded-[16px] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.55)] relative"
        onClick={e => e.stopPropagation()}
      >
        {src ? (
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <div
            className="w-full h-full bg-center bg-cover flex items-center justify-center"
            style={{ backgroundImage: poster ? `url(${poster})` : undefined }}
          >
            <div className="bg-black/60 backdrop-blur-sm px-5 py-3 rounded-lg text-white text-sm">
              Vidéo disponible bientôt
            </div>
          </div>
        )}
      </div>

      {(title || subtitle) && (
        <div className="absolute bottom-6 left-0 right-0 text-center text-white pointer-events-none">
          {title && <div className="text-[15px] font-bold">{title}</div>}
          {subtitle && <div className="text-[12px] opacity-70 mt-0.5">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
