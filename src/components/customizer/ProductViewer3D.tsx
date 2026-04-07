/**
 * ProductViewer3D — Accurate procedural 3D garment viewer
 *
 * T-Shirt / Hoodie: Real shirt silhouette (body + sleeves) via ShapeGeometry
 * Cap: Dome + brim + button + sweatband
 * Beanie: Ribbed cylinder + rounded crown + cuff + pompom
 *
 * All support:
 * - Real-time colour change via overlay plane
 * - Logo overlay at correct UV position
 * - OrbitControls for drag-to-rotate
 * - View switching (front / back / left / right)
 */
import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';
import {
  createShirtShape,
  createCapParts,
  createBeanieParts,
  createFabricMaterial,
  isNeutralColor,
} from '@/lib/garmentGeometry';
import { useLang } from '@/lib/langContext';

// ── Texture loader with correct colour space ──────────────────────────────────
function useProdTexture(url: string) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex, url]);
  return tex;
}

// ── Logo overlay (flat surface) ───────────────────────────────────────────────
function LogoFlat({
  url, x, y, w, rot = 0,
}: { url: string; x: number; y: number; w: number; rot?: number }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
  }, [tex, url]);
  return (
    <mesh position={[x, y, 0.03]} rotation={[0, 0, (rot * Math.PI) / 180]}>
      <planeGeometry args={[w, w * 0.6]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

// ── Logo on curved surface (cap / beanie front) ───────────────────────────────
function LogoCurved({ url, z = 0.92 }: { url: string; z?: number }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
  }, [tex, url]);
  return (
    <mesh position={[0, -0.06, z]}>
      <planeGeometry args={[0.36, 0.24]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

// ── Shirt / Hoodie mesh ───────────────────────────────────────────────────────
function ShirtMesh({
  texUrl, colorHex, logoUrl, logoPlacement, rotating, isHoodie,
}: {
  texUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; rotating: boolean; isHoodie: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useProdTexture(texUrl);
  const geo = useMemo(() => createShirtShape(isHoodie), [isHoodie]);
  const mat = useMemo(() => createFabricMaterial(tex, colorHex), [tex, colorHex]);

  useFrame((_, dt) => {
    if (groupRef.current && rotating) groupRef.current.rotation.y += dt * 0.36;
  });

  // Logo position: % coords → world coords (shirt spans ~2.35W × 2.3H in shape space)
  const W = 1.34; // shape width approx
  const H = 2.3;  // shape height approx
  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * W * 0.75 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 32)) / 100 * H * 0.7 : 0.1;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * W * 0.85 : 0.32;

  return (
    <group ref={groupRef} position={[0, 0.05, 0]}>
      {/* Shirt shape */}
      <mesh geometry={geo} material={mat} castShadow />

      {/* Colour tint overlay — only for non-white */}
      {!isNeutralColor(colorHex) && (
        <mesh position={[0, 0, 0.008]}>
          <planeGeometry args={[0.88, 2.1]} />
          <meshBasicMaterial color={colorHex} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}

      {/* Logo */}
      {logoUrl && logoPlacement && (
        <LogoFlat url={logoUrl} x={lx} y={ly} w={lw} rot={logoPlacement.rotation ?? 0} />
      )}
    </group>
  );
}

// ── Cap mesh ──────────────────────────────────────────────────────────────────
function CapMesh({
  texUrl, colorHex, logoUrl, rotating,
}: {
  texUrl: string; colorHex: string; logoUrl?: string; rotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useProdTexture(texUrl);
  const parts = useMemo(() => createCapParts(), []);
  const mat = useMemo(() => createFabricMaterial(tex, colorHex, 0.78), [tex, colorHex]);
  const solidMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isNeutralColor(colorHex)
      ? new THREE.Color('#e0ddd8')
      : new THREE.Color(colorHex).lerp(new THREE.Color('#888'), 0.25),
    roughness: 0.82,
  }), [colorHex]);

  useFrame((_, dt) => {
    if (groupRef.current && rotating) groupRef.current.rotation.y += dt * 0.36;
  });

  return (
    <group ref={groupRef} rotation={[-0.1, 0, 0]}>
      <mesh geometry={parts.dome} material={mat} castShadow />
      <mesh geometry={parts.brim} material={solidMat} castShadow />
      <mesh geometry={parts.button} material={solidMat} />
      <mesh geometry={parts.sweatband}>
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      {logoUrl && <LogoCurved url={logoUrl} z={0.91} />}
    </group>
  );
}

// ── Beanie / Toque mesh ───────────────────────────────────────────────────────
function BeanieMesh({
  texUrl, colorHex, logoUrl, rotating,
}: {
  texUrl: string; colorHex: string; logoUrl?: string; rotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useProdTexture(texUrl);
  const parts = useMemo(() => createBeanieParts(), []);
  const mat = useMemo(() => createFabricMaterial(tex, colorHex, 0.92), [tex, colorHex]);
  const cuffMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isNeutralColor(colorHex)
      ? new THREE.Color('#d8d5d0')
      : new THREE.Color(colorHex).multiplyScalar(0.8),
    roughness: 0.95,
  }), [colorHex]);

  useFrame((_, dt) => {
    if (groupRef.current && rotating) groupRef.current.rotation.y += dt * 0.36;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={parts.body} material={mat} castShadow />
      <mesh geometry={parts.crown} material={mat} castShadow />
      <mesh geometry={parts.cuff} material={cuffMat} />
      <mesh geometry={parts.pompom}>
        <meshStandardMaterial
          color={isNeutralColor(colorHex) ? '#ccc' : colorHex}
          roughness={1}
        />
      </mesh>
      {logoUrl && <LogoCurved url={logoUrl} z={0.73} />}
    </group>
  );
}

// ── Skeleton shimmer while texture loads ──────────────────────────────────────
function Skeleton() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) {
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.28 + Math.sin(Date.now() / 400) * 0.12;
    }
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1.5, 2.1]} />
      <meshBasicMaterial color="#E3E1DB" transparent opacity={0.35} />
    </mesh>
  );
}

// ── Camera per product category ───────────────────────────────────────────────
function CameraRig({ category }: { category: string }) {
  const { camera } = useThree();
  useEffect(() => {
    if (category === 'cap') camera.position.set(0, 0.5, 2.3);
    else if (category === 'toque') camera.position.set(0, 0.25, 2.5);
    else camera.position.set(0, 0, 3.0);
    camera.lookAt(0, 0, 0);
  }, [category, camera]);
  return null;
}

// ── Main exported component ───────────────────────────────────────────────────
export function ProductViewer3D({
  product,
  selectedColor,
  logoPlacement,
  activeView,
  onViewChange,
  compact = false,
}: {
  product: Product;
  selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null;
  activeView: 'front' | 'back' | 'left' | 'right';
  onViewChange: (v: 'front' | 'back' | 'left' | 'right') => void;
  compact?: boolean;
}) {
  const { t } = useLang();
  const [autoRotate, setAutoRotate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(true);
  const canvasH = compact ? 260 : 350;

  const texUrl = activeView === 'back'
    ? (selectedColor?.imageDos ?? product.imageDos)
    : (selectedColor?.imageDevant ?? product.imageDevant);

  const colorHex = selectedColor?.hex ?? '#f5f5f0';
  const logoUrl = logoPlacement?.previewUrl ?? logoPlacement?.processedUrl;
  const isHoodie = product.category === 'hoodie';
  const isShirt = ['tshirt','hoodie','polo','manteau'].includes(product.category);

  const sceneProps = {
    texUrl,
    colorHex,
    logoUrl,
    logoPlacement: logoPlacement ?? undefined,
    rotating: autoRotate && !dragging,
  };

  const views = [
    { id: 'front' as const, label: t('devant') },
    { id: 'back' as const, label: t('dos') },
    { id: 'left' as const, label: t('gauche') },
    { id: 'right' as const, label: t('droite') },
  ];

  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden bg-[#F8F7F4] border border-border"
      style={{ minHeight: canvasH + 52 }}
    >
      {/* 3D Canvas */}
      <div
        style={{ height: canvasH }}
        className="relative select-none"
        onPointerDown={() => { setDragging(true); setAutoRotate(false); setHint(false); }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <Canvas
          shadows
          camera={{ position: [0, 0, 3.0], fov: 36 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <CameraRig category={product.category} />

          {/* Lighting — soft studio */}
          <ambientLight intensity={1.3} />
          <directionalLight position={[3, 6, 4]} intensity={0.9} castShadow shadow-mapSize={[1024,1024]} />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} />
          <pointLight position={[0, -5, 3]} intensity={0.25} color="#ede8e0" />

          <Suspense fallback={<Skeleton />}>
            {isShirt && <ShirtMesh {...sceneProps} isHoodie={isHoodie} />}
            {product.category === 'cap' && <CapMesh {...sceneProps} />}
            {product.category === 'toque' && <BeanieMesh {...sceneProps} />}
          </Suspense>

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            rotateSpeed={0.62}
          />
        </Canvas>

        {/* Drag hint */}
        <AnimatePresence>
          {hint && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 0.7, y: 0 }} exit={{ opacity: 0 }}
              transition={{ delay: 1.8 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-foreground/60 backdrop-blur-sm text-background text-[11px] font-semibold px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap"
            >
              ⟳ {t('glisserTourner')}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live colour chip */}
        {selectedColor && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-background/85 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-border">
            <div className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: selectedColor.hex }} />
            <span className="text-[11px] font-semibold text-foreground">{selectedColor.name}</span>
          </div>
        )}

        {/* Logo placed badge */}
        {logoPlacement?.previewUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-3 right-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
          >
            {t('logoPlace')}
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1.5 py-2.5 border-t border-border bg-background/70 backdrop-blur-sm flex-wrap px-3">
        {views.map((v) => (
          <button key={v.id} onClick={() => onViewChange(v.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              activeView === v.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-muted-foreground border border-border hover:border-primary hover:text-primary'
            }`}
          >
            {v.label}
          </button>
        ))}
        <button onClick={() => setAutoRotate(!autoRotate)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
            autoRotate ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground border border-border'
          }`}
        >
          {autoRotate ? '■ Stop' : `▶ ${t('auto')}`}
        </button>
      </div>
    </div>
  );
}
