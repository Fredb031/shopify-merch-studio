import type { Product } from '@/data/products';
import type { LogoPlacement } from '@/types/customization';
import { LogoCanvas } from './LogoCanvas';

export function PlacementSelector({
  product, selectedColor, logoPreviewUrl, currentPlacement, onPlacementChange,
}: {
  product: Product;
  selectedColor: { hex?: string; imageDevant?: string; imageDos?: string } | null;
  logoPreviewUrl: string;
  currentPlacement: LogoPlacement | null;
  onPlacementChange: (placement: LogoPlacement) => void;
}) {
  return (
    <LogoCanvas
      product={product}
      garmentColor={selectedColor?.hex}
      logoUrl={logoPreviewUrl}
      currentPlacement={currentPlacement}
      onPlacementChange={onPlacementChange}
    />
  );
}
