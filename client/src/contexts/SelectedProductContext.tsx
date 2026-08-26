import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type SelectedProduct = {
  id: string;
  label: string;
  amountLabel: string;
  priceLabel: string;
  gameName: string;
  gameLogoUrl?: string;
  playerId?: string;
  zoneId?: string | null;
};

type SelectedProductContextValue = {
  selectedProduct: SelectedProduct | null;
  selectedPaymentMethodId: string | null;
  setSelectedProduct: (product: SelectedProduct | null) => void;
  setSelectedPaymentMethodId: (methodId: string | null) => void;
  clearSelectedProduct: () => void;
};

const SelectedProductContext = createContext<SelectedProductContextValue | null>(null);

export function SelectedProductProvider({ children }: { children: ReactNode }) {
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const value = useMemo(() => ({ selectedProduct, selectedPaymentMethodId, setSelectedProduct, setSelectedPaymentMethodId, clearSelectedProduct: () => setSelectedProduct(null) }), [selectedProduct, selectedPaymentMethodId]);
  return <SelectedProductContext.Provider value={value}>{children}</SelectedProductContext.Provider>;
}

export function useSelectedProduct() {
  const value = useContext(SelectedProductContext);
  if (!value) throw new Error("useSelectedProduct must be used within SelectedProductProvider");
  return value;
}
