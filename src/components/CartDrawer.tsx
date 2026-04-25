// Root CartDrawer — delegates to the full-featured cart/CartDrawer.
// Re-export both the named and default exports so consumers using
// either `import { CartDrawer }` (current call sites in pages/) or the
// occasional `import CartDrawer` default style resolve to the same
// component instead of getting `undefined` at runtime.
export { CartDrawer, default } from './cart/CartDrawer';
