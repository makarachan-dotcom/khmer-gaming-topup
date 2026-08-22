import { cn } from "@/lib/utils";
import { cambodiaSupportMarker, countryFlagForRegion, gameRegionMarker } from "@/lib/providerPresentation";
import { Gamepad2, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ArtworkProps = {
  name: string;
  logoUrl?: string;
  className?: string;
  iconClassName?: string;
  priority?: boolean;
  region?: string | null;
};

const managedProviderArtwork: Array<{ matches: RegExp; url: string }> = [
  { matches: /^mobile legends/i, url: "/api/provider-artwork/mobile-legends" },
];

export function hasProviderApprovedGameLogo(logoUrl?: string) {
  return Boolean(logoUrl?.startsWith("https://"));
}

export function resolveProviderGameLogo(name: string, logoUrl?: string) {
  return managedProviderArtwork.find((item) => item.matches.test(name))?.url ?? logoUrl;
}

export function canRenderProviderArtwork(url?: string) {
  return hasProviderApprovedGameLogo(url) || url?.startsWith("/manus-storage/") || url?.startsWith("/api/provider-artwork/");
}

export function ProviderGameArtwork({ name, logoUrl, className, iconClassName, priority = false, region }: ArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedLogoUrl = resolveProviderGameLogo(name, logoUrl);
  const cambodiaSupport = cambodiaSupportMarker(name, region);
  useEffect(() => setImageFailed(false), [resolvedLogoUrl]);
  if (canRenderProviderArtwork(resolvedLogoUrl) && !imageFailed) {
    return <span className={cn("game-logo-frame", className)}><img src={resolvedLogoUrl} alt={`${name} official logo`} className="game-logo-image" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />{cambodiaSupport ? <span className="game-logo-cambodia-flag" aria-label={`${cambodiaSupport.label} support`}>{cambodiaSupport.flag}</span> : null}</span>;
  }
  return <span className={cn("game-logo-fallback", className)} aria-label={`${name} game icon`}><Gamepad2 className={cn("h-5 w-5", iconClassName)} />{cambodiaSupport ? <span className="game-logo-cambodia-flag" aria-label={`${cambodiaSupport.label} support`}>{cambodiaSupport.flag}</span> : null}</span>;
}

export function ProviderGameRegion({ name, region, className }: { name: string; region?: string | null; className?: string }) {
  const cambodiaSupport = cambodiaSupportMarker(name, region);
  const marker = gameRegionMarker(name, region);
  if (cambodiaSupport) return <span className={cn("game-region-marker", className)}><span className="country-flag" aria-hidden="true">{cambodiaSupport.flag}</span>{cambodiaSupport.label}</span>;
  return marker.kind === "country" ? <span className={cn("game-region-marker", className)}><span className="country-flag" aria-hidden="true">{marker.flag}</span>{marker.label}</span> : <span className={cn("game-region-marker game-region-marker--global", className)}><Globe2 className="motion-icon h-3 w-3" aria-hidden="true" />Global</span>;
}

export function ProviderGameTitle({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const country = countryFlagForRegion(name);

  useEffect(() => {
    const node = ref.current;
    const measure = measureRef.current;
    if (!node || !measure) return;
    const checkOverflow = () => setOverflows(measure.scrollWidth > node.clientWidth + 1);
    checkOverflow();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(checkOverflow);
    observer?.observe(node);
    window.addEventListener("resize", checkOverflow);
    return () => { observer?.disconnect(); window.removeEventListener("resize", checkOverflow); };
  }, [name]);

  const title = <span className="inline-flex items-center gap-1">{country ? <span className="country-flag" aria-hidden="true">{country.flag}</span> : null}<span>{name}</span></span>;
  return <span ref={ref} title={name} aria-label={name} className={cn("game-title-marquee-wrap relative block min-w-0 overflow-hidden whitespace-nowrap", className)}><span ref={measureRef} aria-hidden="true" className="game-title-measure">{title}</span>{overflows ? <span className="game-title-marquee-track"><span>{title}</span><span aria-hidden="true">{title}</span></span> : <span className="block truncate">{title}</span>}</span>;
}
