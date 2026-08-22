import { cn } from "@/lib/utils";
import { countryFlagForRegion, gameRegionMarker } from "@/lib/providerPresentation";
import { Gamepad2, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ArtworkProps = {
  name: string;
  logoUrl?: string;
  className?: string;
  iconClassName?: string;
};

export function hasProviderApprovedGameLogo(logoUrl?: string) {
  return Boolean(logoUrl?.startsWith("https://"));
}

export function ProviderGameArtwork({ name, logoUrl, className, iconClassName }: ArtworkProps) {
  if (hasProviderApprovedGameLogo(logoUrl)) {
    return <span className={cn("game-logo-frame", className)}><img src={logoUrl} alt={`${name} official logo`} className="game-logo-image" loading="lazy" /></span>;
  }
  return <span className={cn("game-logo-fallback", className)} aria-label={`${name} game icon`}><Gamepad2 className={cn("h-5 w-5", iconClassName)} /></span>;
}

export function ProviderGameRegion({ name, region, className }: { name: string; region?: string | null; className?: string }) {
  const marker = gameRegionMarker(name, region);
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
