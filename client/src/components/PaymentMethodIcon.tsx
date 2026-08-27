import { CreditCard, Landmark } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { khqrLogoUrl } from "@/lib/mobileLegendsAssets";

export type PaymentIconSource = {
  iconUrl?: string | null;
  name: string;
  providerKey?: "bakong_khqr" | "manual";
};

/**
 * Converts persisted managed-storage paths into a browser-resolvable same-origin
 * URL. Database records may safely retain `/manus-storage/...`; the application
 * proxy is responsible for serving or redirecting that path.
 */
export function resolvePaymentIconUrl(iconUrl?: string | null): string | null {
  const value = iconUrl?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const publicPath = value.startsWith("manus-storage/") ? `/${value}` : value;
  if (publicPath.startsWith("/manus-storage/") || publicPath.startsWith("/")) {
    if (typeof window === "undefined") return publicPath;
    return new URL(publicPath, window.location.origin).toString();
  }
  return null;
}

export function PaymentMethodIcon({ method, className, fallbackClassName }: { method: PaymentIconSource; className: string; fallbackClassName?: string }) {
  const imageUrl = useMemo(() => resolvePaymentIconUrl(method.iconUrl), [method.iconUrl]);
  const [failed, setFailed] = useState(false);
  const [khqrFallbackFailed, setKhqrFallbackFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setKhqrFallbackFailed(false);
  }, [imageUrl, method.providerKey]);

  if (imageUrl && !failed) {
    return <img src={imageUrl} alt={`${method.name} payment icon`} className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }

  const fallbackClass = fallbackClassName ?? className;
  if (method.providerKey === "bakong_khqr" && !khqrFallbackFailed) {
    return <span className={`${fallbackClass} payment-method-icon-fallback`} role="img" aria-label={`${method.name} payment icon`}><img src={khqrLogoUrl} alt="KHQR" className="h-full w-full object-contain p-1" onError={() => setKhqrFallbackFailed(true)} /></span>;
  }

  return <span className={`${fallbackClass} payment-method-icon-fallback`} role="img" aria-label={`${method.name} payment icon`}><Landmark className="h-5 w-5" aria-hidden="true" /><span className="sr-only"><CreditCard className="h-4 w-4" />{method.name} payment icon</span></span>;
}
