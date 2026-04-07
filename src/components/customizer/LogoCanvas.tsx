/**
 * LogoCanvas — Fabric.js logo placement on clean garment-coloured canvas
 * Background is the garment's solid hex colour — NO product mockup image
 * so there is ZERO logo duplication from embedded CDN watermarks.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { AlignCenter, AlignLeft, AlignRight, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import type { Product, PrintZone } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';

interface LogoCanvasProps {
  product: Product;
  garmentColor?: string;   // hex of selected colour — used as canvas background
  logoUrl: string | null;
  currentPlacement: LogoPlacement | null;
  onPlacementChange: (p: LogoPlacement) => void;
}

export function LogoCanvas({ product, garmentColor, logoUrl, currentPlacement, onPlacementChange }: LogoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc       = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoObj  = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [zoneId, setZoneId] = useState<string>(currentPlacement?.zoneId ?? (product.printZones[0]?.id ?? ''));

  const emit = useCallback((obj: any, zone: string) => {
    if (!fc.current || !obj) return;
    const W = fc.current.width as number;
    const H = fc.current.height as number;
    const cx = (obj.left ?? 0) + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    const cy = (obj.top ?? 0) + ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2;
    onPlacementChange({
      zoneId: zone,
      mode: zone === 'manual' ? 'manual' : 'preset',
      x: (cx / W) * 100,
      y: (cy / H) * 100,
      width: ((obj.width ?? 0) * (obj.scaleX ?? 1) / W) * 100,
      rotation: obj.angle ?? 0,
      previewUrl: logoUrl ?? undefined,
    });
  }, [logoUrl, onPlacementChange]);

  // ── Init canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let disposed = false;

    import('fabric').then(({ fabric }) => {
      if (disposed) return;
      if (fc.current) { fc.current.dispose(); fc.current = null; }

      const W = containerRef.current!.clientWidth || 320;
      const H = Math.round(W * 1.18);

      // Use the garment colour as background — clean surface, no embedded logos
      const bg = garmentColor ?? '#F2F0EB';
      const canvas = new fabric.Canvas(canvasRef.current!, {
        width: W, height: H,
        backgroundColor: bg,
        selection: false,
        preserveObjectStacking: true,
      });
      fc.current = canvas;

      // Dashed print-zone outline to guide logo placement
      const zone = product.printZones.find(z => z.id === zoneId) ?? product.printZones[0];
      if (zone) {
        const zx = (zone.x / 100) * W;
        const zy = (zone.y / 100) * H;
        const zw = (zone.width  / 100) * W;
        const zh = (zone.height / 100) * H;
        const rect = new fabric.Rect({
          left: zx, top: zy, width: zw, height: zh,
          fill: 'rgba(255,255,255,0.06)',
          stroke: 'rgba(255,255,255,0.40)',
          strokeDashArray: [6, 4], strokeWidth: 1.5,
          rx: 8, ry: 8,
          selectable: false, evented: false,
        });
        canvas.add(rect);
      }

      setReady(true);
      canvas.renderAll();

      canvas.on('object:modified', () => { if (logoObj.current) emit(logoObj.current, zoneId); });
      canvas.on('object:moving',   () => { if (logoObj.current) emit(logoObj.current, 'manual'); });
    });

    return () => {
      disposed = true;
      fc.current?.dispose();
      fc.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentColor]); // Re-init when garment colour changes

  // ── Place / update logo ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !fc.current || !logoUrl) return;
    let disposed = false;

    import('fabric').then(({ fabric }) => {
      if (disposed || !fc.current) return;
      const canvas = fc.current;

      if (logoObj.current) { canvas.remove(logoObj.current); logoObj.current = null; }

      const W = canvas.width as number;
      const H = canvas.height as number;

      const zone = product.printZones.find(z => z.id === zoneId) ?? product.printZones[0];
      let cx = W / 2, cy = H * 0.33, initScale = 0.28;
      if (zone) {
        cx = (zone.x / 100) * W + (zone.width  / 100) * W / 2;
        cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
        initScale = (zone.width / 100) * 0.9;
      }

      fabric.Image.fromURL(
        logoUrl,
        (img: any) => {
          if (disposed || !fc.current) return;
          const targetW = W * initScale;
          const s = targetW / (img.width ?? 100);
          img.set({
            left: cx - (img.width  ?? 0) * s / 2,
            top:  cy - (img.height ?? 0) * s / 2,
            scaleX: s, scaleY: s,
            selectable: true, evented: true,
            hasControls: true, hasBorders: true,
            cornerStyle: 'circle', cornerSize: 10,
            cornerColor: '#FFFFFF', borderColor: '#FFFFFF',
            borderScaleFactor: 1.8, transparentCorners: false,
            lockUniScaling: true,
          });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.bringToFront(img);
          canvas.renderAll();
          logoObj.current = img;
          emit(img, zoneId);
        },
        { crossOrigin: 'anonymous' }
      );
    });

    return () => { disposed = true; };
  }, [ready, logoUrl, zoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zone selector ─────────────────────────────────────────────────────────
  const selectZone = useCallback((zone: PrintZone) => {
    setZoneId(zone.id);
    if (!logoObj.current || !fc.current) return;
    const canvas = fc.current;
    const W = canvas.width as number;
    const H = canvas.height as number;
    const obj = logoObj.current;
    const cx = (zone.x / 100) * W + (zone.width  / 100) * W / 2;
    const cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
    const ns = (zone.width / 100) * W * 0.88 / (obj.width ?? 100);
    obj.set({
      left: cx - (obj.width  ?? 0) * ns / 2,
      top:  cy - (obj.height ?? 0) * ns / 2,
      scaleX: ns, scaleY: ns,
    });
    canvas.setActiveObject(obj);
    canvas.bringToFront(obj);
    canvas.renderAll();
    emit(obj, zone.id);
  }, [emit]);

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const snapLeft = () => {
    if (!logoObj.current || !fc.current) return;
    logoObj.current.set({ left: (fc.current.width as number) * 0.07 });
    fc.current.renderAll(); emit(logoObj.current, 'manual');
  };
  const snapCenter = () => {
    if (!logoObj.current || !fc.current) return;
    const obj = logoObj.current;
    obj.set({ left: ((fc.current.width as number) - (obj.width ?? 0) * (obj.scaleX ?? 1)) / 2 });
    fc.current.renderAll(); emit(obj, zoneId);
  };
  const snapRight = () => {
    if (!logoObj.current || !fc.current) return;
    const obj = logoObj.current;
    const W = fc.current.width as number;
    obj.set({ left: W * 0.93 - (obj.width ?? 0) * (obj.scaleX ?? 1) });
    fc.current.renderAll(); emit(obj, 'manual');
  };
  const rotate = () => {
    if (!logoObj.current || !fc.current) return;
    logoObj.current.set({ angle: ((logoObj.current.angle ?? 0) + 15) % 360 });
    fc.current.renderAll(); emit(logoObj.current, zoneId);
  };
  const rescale = (delta: number) => {
    if (!logoObj.current || !fc.current) return;
    const s = Math.max(0.04, Math.min(1.6, (logoObj.current.scaleX ?? 0.25) + delta));
    logoObj.current.set({ scaleX: s, scaleY: s });
    fc.current.renderAll(); emit(logoObj.current, zoneId);
  };

  return (
    <div className="space-y-2.5">
      {/* Zone buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        {product.printZones.map((z) => (
          <button
            key={z.id}
            onClick={() => selectZone(z)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left text-[11px] font-semibold transition-all ${
              zoneId === z.id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${zoneId === z.id ? 'bg-primary' : 'bg-border'}`} />
            {z.label}
          </button>
        ))}
      </div>

      {/* Fabric canvas */}
      <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-border shadow-sm" style={{ aspectRatio: '0.85' }}>
        <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} />
        {!logoUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-6 py-4 rounded-xl bg-black/30 backdrop-blur-sm">
              <Move className="mx-auto mb-2 text-white/70" size={20} />
              <p className="text-xs text-white/80 font-medium leading-snug">
                Upload ton logo<br/>puis place-le ici
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Alignment & transform toolbar */}
      {logoUrl && (
        <div className="flex items-center justify-between bg-secondary rounded-xl px-3 py-2 border border-border">
          <div className="flex gap-0.5">
            {[
              { icon: AlignLeft,   label: 'Gauche', fn: snapLeft   },
              { icon: AlignCenter, label: 'Centre', fn: snapCenter },
              { icon: AlignRight,  label: 'Droite', fn: snapRight  },
            ].map(({ icon: Icon, label, fn }) => (
              <button key={label} onClick={fn} title={label}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-0.5">
            {[
              { icon: ZoomOut,   label: 'Réduire',  fn: () => rescale(-0.06) },
              { icon: ZoomIn,    label: 'Agrandir', fn: () => rescale(0.06)  },
              { icon: RotateCcw, label: '+15°',     fn: rotate               },
            ].map(({ icon: Icon, label, fn }) => (
              <button key={label} onClick={fn} title={label}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:block pl-1">Glisse · Ajuste</span>
        </div>
      )}
    </div>
  );
}
