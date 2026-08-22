import type { Express } from "express";

const approvedArtwork = {
  mobileLegends: "https://khmergame-girzfgts.manus.space/manus-storage/fzr-mobile-legends-global_d1d5e868.webp",
} as const;

export function providerArtworkSource(key: keyof typeof approvedArtwork) {
  return approvedArtwork[key];
}

export function isImageContentType(contentType: string | null) {
  return Boolean(contentType?.toLowerCase().startsWith("image/"));
}

export function registerProviderArtworkRoutes(app: Express) {
  app.get("/api/provider-artwork/mobile-legends", async (_req, res) => {
    try {
      const upstream = await fetch(providerArtworkSource("mobileLegends"), {
        headers: { Accept: "image/avif,image/webp,image/*;q=0.8" },
        signal: AbortSignal.timeout(12_000),
      });
      const contentType = upstream.headers.get("content-type");
      if (!upstream.ok || !isImageContentType(contentType)) {
        return res.status(502).json({ error: "provider_artwork_unavailable" });
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", contentType!);
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
      return res.send(bytes);
    } catch {
      return res.status(502).json({ error: "provider_artwork_unavailable" });
    }
  });
}
