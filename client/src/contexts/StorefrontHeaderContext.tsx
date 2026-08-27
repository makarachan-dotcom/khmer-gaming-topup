import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type StorefrontHeaderContextValue = {
  playerTitle: string | null;
  setPlayerTitle: (title: string | null) => void;
};

const StorefrontHeaderContext = createContext<StorefrontHeaderContextValue | null>(null);

export function StorefrontHeaderProvider({ children }: { children: ReactNode }) {
  const [playerTitle, setPlayerTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ playerTitle, setPlayerTitle }), [playerTitle]);
  return <StorefrontHeaderContext.Provider value={value}>{children}</StorefrontHeaderContext.Provider>;
}

export function useStorefrontHeader() {
  const value = useContext(StorefrontHeaderContext);
  if (!value) throw new Error("useStorefrontHeader must be used within StorefrontHeaderProvider");
  return value;
}
