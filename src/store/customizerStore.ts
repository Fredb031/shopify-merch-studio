import { create } from 'zustand';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import type { CustomizationState, LogoPlacement } from '@/types/customization';

interface CustomizerStore extends CustomizationState {
  setProduct: (productId: string) => void;
  setColor: (colorId: string) => void;
  setLogoPlacement: (placement: LogoPlacement) => void;
  updateLogoPosition: (x: number, y: number, width?: number, rotation?: number) => void;
  setSizeQuantity: (size: string, quantity: number) => void;
  setView: (view: CustomizationState['activeView']) => void;
  setStep: (step: CustomizationState['step']) => void;
  getTotalQuantity: () => number;
  getEstimatedPrice: () => number;
  reset: () => void;
}

const initialState: CustomizationState = {
  productId: null,
  colorId: null,
  logoPlacement: null,
  sizeQuantities: [],
  activeView: 'front',
  step: 1,
};

export const useCustomizerStore = create<CustomizerStore>((set, get) => ({
  ...initialState,

  setProduct: (productId) => set({ productId, colorId: null, step: 1 }),
  setColor: (colorId) => set({ colorId, step: 2 }),
  setLogoPlacement: (placement) => set({ logoPlacement: placement }),

  updateLogoPosition: (x, y, width, rotation) =>
    set((state) => ({
      logoPlacement: state.logoPlacement
        ? { ...state.logoPlacement, x, y, width: width ?? state.logoPlacement.width, rotation: rotation ?? state.logoPlacement.rotation }
        : null,
    })),

  setSizeQuantity: (size, quantity) =>
    set((state) => {
      const existing = state.sizeQuantities.filter((s) => s.size !== size);
      if (quantity > 0) return { sizeQuantities: [...existing, { size, quantity }] };
      return { sizeQuantities: existing };
    }),

  setView: (activeView) => set({ activeView }),
  setStep: (step) => set({ step }),

  getTotalQuantity: () =>
    get().sizeQuantities.reduce((sum, s) => sum + s.quantity, 0),

  getEstimatedPrice: () => {
    const { productId, sizeQuantities } = get();
    if (!productId) return 0;
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return 0;
    const total = sizeQuantities.reduce((sum, s) => sum + s.quantity, 0);
    const unitBase = product.basePrice + PRINT_PRICE;
    const discount = total >= BULK_DISCOUNT_THRESHOLD ? 1 - BULK_DISCOUNT_RATE : 1;
    return parseFloat((total * unitBase * discount).toFixed(2));
  },

  reset: () => set(initialState),
}));
