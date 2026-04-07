/**
 * ProductViewer3D — Interactive 3D product viewer
 * - Procedural geometry per product category
 * - Real-time color change via overlay
 * - Logo placement from LogoCanvas coordinates
 * - OrbitControls drag to rotate
 * - Auto-rotation toggle
 */
import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';
import { useLang } from '@/lib/langContext';

// ── Shared texture hook with correct colour space ──────────────────────────
function useProdTexture(url: string) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex, url]);
  return tex;
}

// ── Shirt / Hoodie mesh ─────────────────────────────────────────────────────
function ShirtScene({
  texUrl, colorHex, logoUrl, logoPlacement, rotating,
}: {
  texUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; rotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useProdTexture(texUrl);
  useFrame((_, dt) => { if (groupRef.current && rotating) groupRef.current.rotation.y += dt * 0.38; });

  const isNeutral = colorHex === '#f5f5f0' || colorHex === '#ffffff';
  const matColor = isNeutral ? '#ffffff' : new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.7).getStyle();

  // Logo position (placement coords are % of product image; map to world coords)
  const W = 1.8; const H = 2.4;
  const lx = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 100 * W * 0.9 : 0;
  const ly = logoPlacement ? (50 - (logoPlacement.y ?? 32)) / 100 * H * 0.85 : 0;
  const lw = logoPlacement?.width ? (logoPlacement.width / 100) * W * 0.88 : 0.35;

  return (
    <group ref={groupRef}>
      {/* High-poly fabric plane */}
      <mesh castShadow>
        <planeGeometry args={[W, H, 64, 80]} />
        <meshStandardMaterial map={tex} color={matColor} side={THREE.DoubleSide} roughness={0.84} metalness={0} transparent={false} />
      </mesh>
      {/* Color tint overlay */}
      {!isNeutral && (
        <mesh position={[0, 0, 0.006]}>
          <planeGeometry args={[W * 0.88, H * 0.88]} />
          <meshBasicMaterial color={colorHex} transparent opacity={0.17} depthWrite={false} />
        </mesh>
      )}
      {/* Logo */}
      {logoUrl && logoPlacement && <LogoFlat url={logoUrl} x={lx} y={ly} w={lw} rot={logoPlacement.rotation ?? 0} />}
    </group>
  );
}

// ── Cap mesh ────────────────────────────────────────────────────────────────
function CapScene({
  texUrl, colorHex, logoUrl, logoPlacement, rotating,
}: {
  texUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; rotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useProdTexture(texUrl);
  useFrame((_, dt) => { if (groupRef.current && rotating) groupRef.current.rotation.y += dt * 0.36; });

  const isNeutral = colorHex === '#f5f5f0' || colorHex === '#ffffff';
  const tint = isNeutral ? '#ffffff' : new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.68).getStyle();

  return (
    <group ref={groupRef} rotation={[-0.12, 0, 0]}>
      {/* Dome */}
      <mesh castShadow>
        <sphereGeometry args={[0.88, 64, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={tex} color={tint} roughness={0.76} metalness={0} />
      </mesh>
      {/* Brim */}
      <mesh position={[0, -0.02, 0.12]} rotation={[-Math.PI / 2.2, 0, 0]}>
        <cylinderGeometry args={[0, 1.28, 0.05, 64, 1, false]} />
        <meshStandardMaterial map={tex} color={tint} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* Top button */}
      <mesh position={[0, 0.88, 0]}>
        <sphereGeometry args={[0.062, 12, 8]} />
        <meshStandardMaterial color={tint} roughness={0.7} />
      </mesh>
      {/* Logo on front panel */}
      {logoUrl && logoPlacement && (
        <LogoOnSphere url={logoUrl} />
      )}
    </group>
  );
}

// ── Beanie mesh ─────────────────────────────────────────────────────────────
function BeanieScene({
  texUrl, colorHex, logoUrl, logoPlacement, rotating,
}: {
  texUrl: string; colorHex: string; logoUrl?: string;
  logoPlacement?: LogoPlacement; rotating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useProdTexture(texUrl);
  useFrame((_, dt) => { if (groupRef.current && rotating) groupRef.current.rotation.y += dt * 0.38; });

  const isNeutral = colorHex === '#f5f5f0' || colorHex === '#ffffff';
  const tint = isNeutral ? '#ffffff' : new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.7).getStyle();

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.74, 0.68, 1.4, 64, 24]} />
        <meshStandardMaterial map={tex} color={tint} roughness={0.9} metalness={0} />
      </mesh>
      {/* Rounded crown */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.74, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={tex} color={tint} roughness={0.9} />
      </mesh>
      {/* Cuff ring */}
      <mesh position={[0, -0.64, 0]}>
        <torusGeometry args={[0.69, 0.09, 16, 64]} />
        <meshStandardMaterial color={tint} roughness={0.95} />
      </mesh>
      {/* Logo on front */}
      {logoUrl && logoPlacement && (
        <LogoOnSphere url={logoUrl} radius={0.76} />
      )}
    </group>
  );
}

// ── Logo overlays ────────────────────────────────────────────────────────────
function LogoFlat({ url, x, y, w, rot }: { url: string; x: number; y: number; w: number; rot: number }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
  }, [tex, url]);
  return (
    <mesh position={[x, y, 0.024]} rotation={[0, 0, (rot * Math.PI) / 180]}>
      <planeGeometry args={[w, w * 0.6]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

function LogoOnSphere({ url, radius = 0.92 }: { url: string; radius?: number }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
  }, [tex, url]);
  return (
    <mesh position={[0, -0.05, radius]}>
      <planeGeometry args={[0.34, 0.22]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

// ── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + Math.sin(Date.now() * 0.004) * 0.15;
    }
  });
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1.8, 2.4]} />
      <meshBasicMaterial color="#E3E1DB" transparent opacity={0.35} />
    </mesh>
  );
}

// ── Camera adjustment per product ───────────────────────────────────────────
function CameraSetup({ category }: { category: string }) {
  const { camera } = useThree();
  useEffect(() => {
    if (category === 'cap') { camera.position.set(0, 0.4, 2.4); }
    else if (category === 'toque') { camera.position.set(0, 0.2, 2.6); }
    else { camera.position.set(0, 0, 2.9); }
    camera.lookAt(0, 0, 0);
  }, [category, camera]);
  return null;
}

// ── Main exported component ──────────────────────────────────────────────────
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
  const [showHint, setShowHint] = useState(true);
  const h = compact ? 260 : 340;

  const getTexUrl = () => {
    if (activeView === 'back') return selectedColor?.imageDos ?? product.imageDos;
    return selectedColor?.imageDevant ?? product.imageDevant;
  };

  const colorHex = selectedColor?.hex ?? '#f5f5f0';
  const logoUrl = logoPlacement?.previewUrl ?? logoPlacement?.processedUrl;

  const sceneProps = {
    texUrl: getTexUrl(),
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
    <div className="relative flex flex-col rounded-2xl overflow-hidden bg-secondary border border-border" style={{ minHeight: h + 52 }}>
      {/* Canvas */}
      <div
        style={{ height: h }}
        className="relative"
        onPointerDown={() => { setDragging(true); setAutoRotate(false); setShowHint(false); }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <Canvas
          shadows
          camera={{ position: [0, 0, 2.9], fov: 36 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <CameraSetup category={product.category} />
          <ambientLight intensity={1.25} />
          <directionalLight position={[3, 5, 4]} intensity={0.92} castShadow />
          <directionalLight position={[-2, 2, -3]} intensity={0.38} />
          <pointLight position={[0, -4, 3]} intensity={0.22} color="#e8e4dc" />

          <Suspense fallback={<SkeletonMesh />}>
            {(product.category === 'tshirt' || product.category === 'hoodie' || product.category === 'polo' || product.category === 'manteau') && (
              <ShirtScene {...sceneProps} />
            )}
            {product.category === 'cap' && <CapScene {...sceneProps} />}
            {product.category === 'toque' && <BeanieScene {...sceneProps} />}
          </Suspense>

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3.2}
            maxPolarAngle={Math.PI / 1.75}
            rotateSpeed={0.65}
          />
        </Canvas>

        {/* Drag hint */}
        <AnimatePresence>
          {showHint && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 0.75, y: 0 }} exit={{ opacity: 0 }}
              transition={{ delay: 1.6 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-foreground/60 backdrop-blur-sm text-background text-[11px] font-semibold px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap"
            >
              ⟳ {t('glisserTourner')}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Colour chip */}
        {selectedColor && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-background/85 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-border">
            <div className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: selectedColor.hex }} />
            <span className="text-[11px] font-semibold text-foreground">{selectedColor.name}</span>
          </div>
        )}

        {/* Logo badge */}
        {logoPlacement?.previewUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-3 right-3 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
          >
            {t('logoPlace')}
          </motion.div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-1.5 py-2.5 border-t border-border bg-background/70 backdrop-blur-sm flex-wrap px-3">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === v.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-muted-foreground border border-border hover:border-primary hover:text-primary'
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            autoRotate ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground border border-border hover:border-accent'
          }`}
        >
          {autoRotate ? '■ Stop' : `▶ ${t('auto')}`}
        </button>
      </div>
    </div>
  );
}
