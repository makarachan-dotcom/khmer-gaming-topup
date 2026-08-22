import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type SelectedProduct = { id: string; label: string; amountLabel: string; priceLabel: string; gameName: string; gameLogoUrl?: string };

type SelectedProductContextValue = {
  selectedProduct: SelectedProduct | null;
  setSelectedProduct: (product: SelectedProduct | null) => void;
  clearSelectedProduct: () => void;
};

const SelectedProductContext = createContext<SelectedProductContextValue | null>(null);

export function SelectedProductProvider({ children }: { children: ReactNode }) {
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const value = useMemo(() => ({ selectedProduct, setSelectedProduct, clearSelectedProduct: () => setSelectedProduct(null) }), [selectedProduct]);
  return <SelectedProductContext.Provider value={value}>{children}</SelectedProductContext.Provider>;
}

export function useSelectedProduct() {
  const value = useContext(SelectedProductContext);
  if (!value) throw new Error("useSelectedProduct must be used within SelectedProductProvider");
  return value;
}
