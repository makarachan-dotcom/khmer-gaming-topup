export const accentGradient: Record<string, string> = {
  indigo: "from-[#4468ed] to-[#6c4ee8]",
  orange: "from-[#ef6037] to-[#e5ae2f]",
  teal: "from-[#18a6a1] to-[#2068ac]",
  fuchsia: "from-[#9e4ac4] to-[#e867ae]",
};

export const getAccentGradient = (accent: string) => accentGradient[accent] ?? accentGradient.indigo;
export const formatUsd = (value: string | number) => `$${Number(value).toFixed(2)}`;
