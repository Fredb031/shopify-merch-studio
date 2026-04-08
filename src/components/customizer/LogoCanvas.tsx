/**
 * LogoCanvas — Fabric.js logo placement on the REAL product photo
 *
 * Layers (back → front):
 *   1. Real Shopify product photo (e.g. ATCF2500-Devant.jpg)
 *   2. "Print zone" mask: a rounded rect of the garment colour that COVERS
 *      the embedded "VOTRE LOGO" placeholder text in the source JPG. This
 *      gives a clean canvas where the user can drop their own logo.
 *   3. The user's logo, locked to uniform scaling so it can never deform.
 *
 * Why a mask instead of a cleaner image?
 *   The Shopify CDN images all ship with a "VOTRE LOGO" marketing placeholder
 *   burned into the chest area. SanMar's Media Content API has clean photos,
 *   but we don't want the customizer to break while waiting for credentials.
 *   The mask is a robust workaround that works for every product today.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { AlignCenter, AlignLeft, AlignRight, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import type { Product, PrintZone } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';

interface LogoCanvasProps {
  product: Product;
  productImageUrl: string;   // real Shopify product photo (front or back)
  garmentColor?: string;     // hex of selected colour — used to mask the embedded placeholder
  logoUrl: string | null;
  currentPlacement: LogoPlacement | null;
  onPlacementChange: (p: LogoPlacement) => void;
}

export function LogoCanvas({
  product, productImageUrl, garmentColor, logoUrl, currentPlacement, onPlacementChange,
}: LogoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logoObj = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maskRef = useRef<any>(null);
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

  // ── Init canvas + load product photo + add mask ───────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let disposed = false;

    import('fabric').then(({ fabric }) => {
      if (disposed) return;
      if (fc.current) { fc.current.dispose(); fc.current = null; }

      const W = containerRef.current!.clientWidth || 320;
      const H = Math.round(W * 1.18);

      const canvas = new fabric.Canvas(canvasRef.current!, {
        width: W, height: H,
        backgroundColor: '#F4F3EF',
        selection: false,
        preserveObjectStacking: true,
      });
      fc.current = canvas;
      maskRef.current = null;

      // Load the REAL product photo as a background image, scaled to fill
      fabric.Image.fromURL(
        productImageUrl,
        (img: any) => {
          if (disposed || !fc.current) return;
          // Scale-to-fit (object-cover style) so the photo always fills the canvas
          const sx = W / (img.width ?? W);
          const sy = H / (img.height ?? H);
          const scale = Math.max(sx, sy);
          img.set({
            left: (W - (img.width ?? W) * scale) / 2,
            top:  (H - (img.height ?? H) * scale) / 2,
            scaleX: scale, scaleY: scale,
            selectable: false, evented: false,
            lockMovementX: true, lockMovementY: true,
            hoverCursor: 'default',
          });
          canvas.add(img);
          canvas.sendToBack(img);

          // Add the mask rectangle in the chest area to cover the embedded
          // "VOTRE LOGO" placeholder. Sized from the FIRST print zone.
          const zone = product.printZones[0];
          if (zone) {
            const mx = (zone.x / 100) * W;
            const my = (zone.y / 100) * H;
            const mw = (zone.width  / 100) * W;
            const mh = (zone.height / 100) * H;
            // Slightly inflate to fully cover the placeholder text edges
            const pad = 8;
            const mask = new fabric.Rect({
              left: mx - pad, top: my - pad,
              width: mw + pad * 2, height: mh + pad * 2,
              fill: garmentColor ?? '#1a1a1a',
              rx: 12, ry: 12,
              stroke: 'rgba(255,255,255,0.18)',
              strokeWidth: 1.5,
              strokeDashArray: [6, 4],
              selectable: false, evented: false,
              shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.25)', blur: 8, offsetY: 2 }),
            });
            canvas.add(mask);
            maskRef.current = mask;
          }

          setReady(true);
          canvas.renderAll();
        },
        { crossOrigin: 'anonymous' }
      );

      canvas.on('object:modified', () => { if (logoObj.current) emit(logoObj.current, zoneId); });
      canvas.on('object:moving',   () => { if (logoObj.current) emit(logoObj.current, 'manual'); });
    });

    return () => {
      disposed = true;
      fc.current?.dispose();
      fc.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productImageUrl, garmentColor]);

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
      let cx = W / 2, cy = H * 0.36, initWidthPct = 0.28;
      if (zone) {
        cx = (zone.x / 100) * W + (zone.width  / 100) * W / 2;
        cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
        initWidthPct = (zone.width / 100) * 0.85;
      }

      fabric.Image.fromURL(
        logoUrl,
        (img: any) => {
          if (disposed || !fc.current) return;
          // Compute uniform scale that fits the logo within initWidthPct of canvas width
          const targetW = W * initWidthPct;
          const naturalW = img.width ?? 100;
          const s = targetW / naturalW;
          img.set({
            left: cx - (img.width  ?? 0) * s / 2,
            top:  cy - (img.height ?? 0) * s / 2,
            scaleX: s, scaleY: s,
            selectable: true, evented: true,
            hasControls: true, hasBorders: true,
            cornerStyle: 'circle', cornerSize: 11,
            cornerColor: '#FFFFFF', borderColor: '#FFFFFF',
            borderScaleFactor: 2, transparentCorners: false,
            // CRITICAL: lock uniform scaling so the logo never deforms
            lockUniScaling: true,
            lockScalingFlip: true,
            centeredScaling: false,
          });
          // Disable middle handles entirely so users can ONLY scale from corners
          img.setControlsVisibility({
            mt: false, mb: false, ml: false, mr: false, // middles off → no stretch
            tl: true, tr: true, bl: true, br: true,     // corners on  → uniform scale
            mtr: true,                                   // top rotation handle
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
    if (!fc.current) return;
    const canvas = fc.current;
    const W = canvas.width as number;
    const H = canvas.height as number;

    // Move the mask rectangle to the new zone so it covers the new print area
    if (maskRef.current) {
      const pad = 8;
      maskRef.current.set({
        left: (zone.x / 100) * W - pad,
        top:  (zone.y / 100) * H - pad,
        width:  (zone.width  / 100) * W + pad * 2,
        height: (zone.height / 100) * H + pad * 2,
      });
    }

    if (logoObj.current) {
      const obj = logoObj.current;
      const cx = (zone.x / 100) * W + (zone.width  / 100) * W / 2;
      const cy = (zone.y / 100) * H + (zone.height / 100) * H / 2;
      const targetW = (zone.width / 100) * W * 0.88;
      const ns = targetW / (obj.width ?? 100);
      obj.set({
        left: cx - (obj.width  ?? 0) * ns / 2,
        top:  cy - (obj.height ?? 0) * ns / 2,
        scaleX: ns, scaleY: ns,
      });
      canvas.setActiveObject(obj);
      canvas.bringToFront(obj);
      emit(obj, zone.id);
    }
    canvas.renderAll();
  }, [emit]);

  // ── Toolbar actions ──────────────────────────────────────────────────────
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
    // Uniform scale on both axes — no deformation possible
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
      <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-border shadow-sm bg-secondary" style={{ aspectRatio: '0.85' }}>
        <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} />
        {!logoUrl && ready && (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-full bg-black/55 backdrop-blur-sm">
              <p className="text-[11px] text-white font-bold">Glisse ton logo dans la zone</p>
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
          <span className="text-[10px] text-muted-foreground hidden sm:block pl-1">
            <Move className="inline w-2.5 h-2.5" /> Glisse
          </span>
        </div>
      )}
    </div>
  );
}
