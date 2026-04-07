import { useState } from 'react';
import type { Product } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';

export function PlacementSelector({
  product,
  selectedColor,
  logoPreviewUrl,
  currentPlacement,
  onPlacementChange,
}: {
  product: Product;
  selectedColor: { imageDevant?: string; imageDos?: string } | null;
  logoPreviewUrl: string;
  currentPlacement: LogoPlacement | null;
  onPlacementChange: (placement: LogoPlacement) => void;
}) {
  const [mode, setMode] = useState<'preset' | 'manual'>('preset');
  const imageUrl = selectedColor?.imageDevant ?? product.imageDevant;

  return (
    <div className="space-y-4">
      <div className="flex bg-secondary rounded-xl p-1 gap-1">
        {(['preset', 'manual'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            {m === 'preset' ? 'Zones prédéfinies' : 'Placement manuel'}
          </button>
        ))}
      </div>

      {mode === 'preset' ? (
        <div className="space-y-2">
          {product.printZones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => onPlacementChange({
                zoneId: zone.id,
                mode: 'preset',
                x: zone.x,
                y: zone.y,
                width: zone.width,
                previewUrl: logoPreviewUrl,
              })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                currentPlacement?.zoneId === zone.id
                  ? 'border-navy bg-navy/5'
                  : 'border-border hover:border-navy/40'
              }`}
            >
              <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                currentPlacement?.zoneId === zone.id
                  ? 'border-navy bg-navy'
                  : 'border-border'
              }`} />
              <span className="text-sm font-semibold text-foreground">{zone.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Clique sur l'image pour positionner ton logo</p>
          <div
            className="relative rounded-xl overflow-hidden border border-border cursor-crosshair"
            style={{ aspectRatio: '0.85' }}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              onPlacementChange({ zoneId: 'manual', mode: 'manual', x, y, width: 25, previewUrl: logoPreviewUrl });
            }}
          >
            <img src={imageUrl} alt={product.name} className="w-full h-full object-contain" />
            {currentPlacement?.mode === 'manual' && currentPlacement.x !== undefined && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${currentPlacement.x}%`,
                  top: `${currentPlacement.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${currentPlacement.width}%`,
                }}
              >
                <img src={logoPreviewUrl} alt="logo" className="w-full h-auto opacity-85" />
              </div>
            )}
          </div>
          {currentPlacement?.mode === 'manual' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Taille</span>
              <input
                type="range" min={10} max={60} step={2}
                value={currentPlacement.width ?? 25}
                onChange={(e) => onPlacementChange({ ...currentPlacement, width: Number(e.target.value) })}
                className="flex-1 accent-navy"
              />
              <span className="text-xs font-bold text-foreground">{currentPlacement.width}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
