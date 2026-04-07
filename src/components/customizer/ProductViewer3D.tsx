import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Product, ProductColor } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';

function ProductPlane({
  textureUrl,
  logoUrl,
  logoPlacement,
  color,
  isRotating,
}: {
  textureUrl: string;
  logoUrl?: string;
  logoPlacement?: LogoPlacement;
  color: string;
  isRotating: boolean;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const texture = useTexture(textureUrl);

  useFrame((_, delta) => {
    if (meshRef.current && isRotating) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  // Compute logo position from placement percentages
  const logoX = logoPlacement ? ((logoPlacement.x ?? 50) - 50) / 50 * 0.8 : 0;
  const logoY = logoPlacement ? (50 - (logoPlacement.y ?? 50)) / 50 * 1.1 : 0;
  const logoScale = logoPlacement?.width ? logoPlacement.width / 100 * 1.6 : 0.3;

  return (
    <group ref={meshRef}>
      <mesh>
        <planeGeometry args={[1.6, 2.2]} />
        <meshStandardMaterial
          map={texture}
          color={color}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {logoUrl && logoPlacement && (
        <LogoOverlay
          logoUrl={logoUrl}
          x={logoX}
          y={logoY}
          scale={logoScale}
          rotation={logoPlacement.rotation ?? 0}
        />
      )}
    </group>
  );
}

function LogoOverlay({
  logoUrl,
  x,
  y,
  scale,
  rotation,
}: {
  logoUrl: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}) {
  const logoTexture = useTexture(logoUrl);

  return (
    <mesh
      position={[x, y, 0.01]}
      rotation={[0, 0, (rotation * Math.PI) / 180]}
    >
      <planeGeometry args={[scale, scale]} />
      <meshBasicMaterial map={logoTexture} transparent />
    </mesh>
  );
}

export function ProductViewer3D({
  product,
  selectedColor,
  logoPlacement,
  activeView,
  onViewChange,
}: {
  product: Product;
  selectedColor: ProductColor | null;
  logoPlacement: LogoPlacement | null;
  activeView: 'front' | 'back' | 'left' | 'right';
  onViewChange: (view: 'front' | 'back' | 'left' | 'right') => void;
}) {
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const getImageUrl = () => {
    if (activeView === 'front') return selectedColor?.imageDevant ?? product.imageDevant;
    if (activeView === 'back') return selectedColor?.imageDos ?? product.imageDos;
    return selectedColor?.imageDevant ?? product.imageDevant;
  };

  const logoUrl = logoPlacement?.processedUrl ?? logoPlacement?.previewUrl;

  const viewButtons = [
    { id: 'front' as const, label: 'Devant' },
    { id: 'back' as const, label: 'Dos' },
    { id: 'left' as const, label: 'Gauche' },
    { id: 'right' as const, label: 'Droite' },
  ];

  return (
    <div className="relative w-full h-full min-h-[360px] bg-secondary flex flex-col">
      {/* Canvas Three.js */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 0, 2.5], fov: 35 }}
          onPointerDown={() => { setIsDragging(true); setIsAutoRotating(false); }}
          onPointerUp={() => setIsDragging(false)}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <directionalLight position={[-3, 2, -2]} intensity={0.3} />

            <ProductPlane
              textureUrl={getImageUrl()}
              logoUrl={logoUrl}
              logoPlacement={logoPlacement ?? undefined}
              color={selectedColor?.hex ?? '#ffffff'}
              isRotating={isAutoRotating && !isDragging}
            />

            <OrbitControls
              enablePan={false}
              enableZoom={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.6}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* View buttons */}
      <div className="flex items-center justify-center gap-2 py-3 border-t border-border bg-background/80 backdrop-blur-sm">
        {viewButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => onViewChange(btn.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
              activeView === btn.id
                ? 'bg-navy text-white shadow-md'
                : 'bg-background text-muted-foreground border border-border hover:border-navy'
            }`}
          >
            {btn.label}
          </button>
        ))}
        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
            isAutoRotating ? 'bg-gold text-white' : 'bg-background text-muted-foreground border border-border'
          }`}
        >
          {isAutoRotating ? '⏹ Stop' : '▶ Tourner'}
        </button>
      </div>

      {/* Drag hint */}
      {!isDragging && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-foreground/70 text-background text-[11px] font-semibold px-3 py-1.5 rounded-full pointer-events-none opacity-60">
          ⟳ Glisse pour tourner
        </div>
      )}
    </div>
  );
}
