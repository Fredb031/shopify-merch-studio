import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCartSync } from "@/hooks/useCartSync";
import Index from "./pages/Index";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  useCartSync();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:handle" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
