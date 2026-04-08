/**
 * ProductViewer3D — Image-based product preview (NOT actually 3D anymore)
 *
 * The 3D code-rendered models did not look like the real garments, so this
 * component now renders the actual Shopify product photo (devant + dos)
 * with the user's logo overlaid as a CSS layer at the placement coordinates
 * the customizer chose.
 *
 * The "VOTRE LOGO" placeholder text in the source JPG is hidden by a small
 * coloured mask div positioned over the chest area. The user's real logo
 * sits on top of that mask.
 *
 * Filename kept as ProductViewer3D for compatibility with existing imports.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement, ProductView } from '@/types/customization';
import { useLang } from '@/lib/langContext';

interface Props {
  product: Product;
  selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null;
  activeView: ProductView;
  onViewChange: (v: ProductView) => void;
  compact?: boolean;
}

export function ProductViewer3D({
  product, selectedColor, logoPlacement, activeView, onViewChange, compact = false,
}: Props) {
  const { t, lang } = useLang();
  const [imgError, setImgError] = useState(false);
  const H = compact ? 240 : 360;

  // Pick the variant-specific image when the user has chosen a colour
  const imageDevant = selectedColor?.imageDevant ?? product.imageDevant;
  const imageDos    = selectedColor?.imageDos    ?? product.imageDos;
  const currentImage = activeView === 'front' ? imageDevant : imageDos;

  const logoUrl = logoPlacement?.previewUrl ?? logoPlacement?.processedUrl;
  const colorHex = selectedColor?.hex ?? '#1a1a1a';
  const colorLabel = (lang === 'en' && selectedColor?.nameEn) ? selectedColor.nameEn : (selectedColor?.name ?? '');

  // The first print zone is where the embedded "VOTRE LOGO" placeholder lives —
  // we cover it with a coloured mask and place the user's logo on top.
  const maskZone = product.printZones[0];

  // Logo CSS positioning — derived from the placement the customizer set
  const lx = logoPlacement?.x ?? (maskZone ? maskZone.x + maskZone.width / 2 : 50);
  const ly = logoPlacement?.y ?? (maskZone ? maskZone.y + maskZone.height / 2 : 35);
  const lw = logoPlacement?.width ?? (maskZone ? maskZone.width * 0.85 : 26);
  const lr = logoPlacement?.rotation ?? 0;

  return (
    <div className="relative flex flex-col rounded-2xl overflow-hidden bg-[#F4F3EF] border border-border">
      {/* Photo area */}
      <div style={{ height: H }} className="relative overflow-hidden bg-secondary">
        {currentImage && !imgError ? (
          <img
            src={currentImage}
            alt={product.shortName}
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => setImgError(true)}
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ImageOff size={28} />
            <span className="text-xs">{lang === 'en' ? 'No image' : "Pas d'image"}</span>
          </div>
        )}

        {/* Mask covers the embedded "VOTRE LOGO" placeholder when viewing the front
            and the user has not yet placed their own logo. Once they place a logo,
            the logo itself covers the area, so we keep the mask only for the front. */}
        {activeView === 'front' && maskZone && (
          <div
            className="absolute pointer-events-none rounded-xl"
            style={{
              left:   `${maskZone.x - 1}%`,
              top:    `${maskZone.y - 1}%`,
              width:  `${maskZone.width + 2}%`,
              height: `${maskZone.height + 2}%`,
              background: colorHex,
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            }}
          />
        )}

        {/* User's logo overlaid at the chosen placement */}
        {activeView === 'front' && logoUrl && (
          <img
            src={logoUrl}
            alt="Logo"
            className="absolute pointer-events-none object-contain"
            style={{
              left:   `${lx - lw / 2}%`,
              top:    `${ly - lw * 0.35}%`,
              width:  `${lw}%`,
              maxWidth: '85%',
              transform: `rotate(${lr}deg)`,
              transformOrigin: 'center',
            }}
          />
        )}

        {/* Bottom-left: colour chip */}
        {selectedColor && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-border shadow-sm">
            <div className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10 flex-shrink-0" style={{ background: colorHex }} />
            <span className="text-[11px] font-semibold text-foreground">{colorLabel}</span>
          </div>
        )}

        {/* Logo placed badge */}
        <AnimatePresence>
          {logoUrl && (
            <motion.div
              initial={{ opacity:0, scale:0.85 }}
              animate={{ opacity:1, scale:1 }}
              exit={{ opacity:0 }}
              className="absolute top-3 right-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
            >
              {t('logoPlace')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Devant / Dos toggle */}
      <div className="flex border-t border-border">
        {(['front', 'back'] as const).map(v => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${
              activeView === v
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {v === 'front' ? t('devant') : t('dos')}
          </button>
        ))}
      </div>
    </div>
  );
}
