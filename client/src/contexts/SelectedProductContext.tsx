import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type SelectedProduct = {
  id: string;
  label: string;
  amountLabel: string;
  priceLabel: string;
  gameName: string;
  gameLogoUrl?: string;
  playerId?: string;
  zoneId?: string | null;
  playerName?: string;
  requiresVerifiedPlayerName?: boolean;
};

type SelectedProductContextValue = {
  selectedProduct: SelectedProduct | null;
  selectedPaymentMethodId: string | null;
  setSelectedProduct: (product: SelectedProduct | null) => void;
  setSelectedPaymentMethodId: (methodId: string | null) => void;
  clearSelectedProduct: () => void;
};

type PersistedCheckoutContext = {
  selectedProduct: SelectedProduct | null;
  selectedPaymentMethodId: string | null;
};

const checkoutContextStorageKey = "zurs.checkout.preview.v1";
const SelectedProductContext = createContext<SelectedProductContextValue | null>(null);

function isSelectedProduct(value: unknown): value is SelectedProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return ["id", "label", "amountLabel", "priceLabel", "gameName"].every((key) => typeof product[key] === "string");
}

function readPersistedCheckoutContext(): PersistedCheckoutContext {
  if (typeof window === "undefined") return { selectedProduct: null, selectedPaymentMethodId: null };
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(checkoutContextStorageKey) ?? "null") as Partial<PersistedCheckoutContext> | null;
    return {
      selectedProduct: isSelectedProduct(parsed?.selectedProduct) ? parsed.selectedProduct : null,
      selectedPaymentMethodId: typeof parsed?.selectedPaymentMethodId === "string" ? parsed.selectedPaymentMethodId : null,
    };
  } catch {
    return { selectedProduct: null, selectedPaymentMethodId: null };
  }
}

function persistCheckoutContext(value: PersistedCheckoutContext) {
  if (typeof window === "undefined") return;
  try {
    if (!value.selectedProduct) window.sessionStorage.removeItem(checkoutContextStorageKey);
    else window.sessionStorage.setItem(checkoutContextStorageKey, JSON.stringify(value));
  } catch {
    // Session persistence is a recovery enhancement only. The in-memory checkout flow remains usable.
  }
}

export function SelectedProductProvider({ children }: { children: ReactNode }) {
  const [checkoutContext, setCheckoutContext] = useState<PersistedCheckoutContext>(readPersistedCheckoutContext);
  const setSelectedProduct = useCallback((product: SelectedProduct | null) => {
    setCheckoutContext((current) => {
      const next = { selectedProduct: product, selectedPaymentMethodId: product ? current.selectedPaymentMethodId : null };
      persistCheckoutContext(next);
      return next;
    });
  }, []);
  const setSelectedPaymentMethodId = useCallback((methodId: string | null) => {
    setCheckoutContext((current) => {
      const next = { ...current, selectedPaymentMethodId: methodId };
      persistCheckoutContext(next);
      return next;
    });
  }, []);
  const clearSelectedProduct = useCallback(() => {
    const next = { selectedProduct: null, selectedPaymentMethodId: null };
    persistCheckoutContext(next);
    setCheckoutContext(next);
  }, []);
  const value = useMemo(() => ({ selectedProduct: checkoutContext.selectedProduct, selectedPaymentMethodId: checkoutContext.selectedPaymentMethodId, setSelectedProduct, setSelectedPaymentMethodId, clearSelectedProduct }), [checkoutContext, clearSelectedProduct, setSelectedPaymentMethodId, setSelectedProduct]);
  return <SelectedProductContext.Provider value={value}>{children}</SelectedProductContext.Provider>;
}

export function useSelectedProduct() {
  const value = useContext(SelectedProductContext);
  if (!value) throw new Error("useSelectedProduct must be used within SelectedProductProvider");
  return value;
}
