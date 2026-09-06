import { useMemo, useState } from "react";
import { PackEmoji } from "@/components/PackEmoji";
import { BrandMark, ServiceLogo, matchBrand } from "@/components/BrandMark";
import { useSelectedProduct } from "@/contexts/SelectedProductContext";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

type PartnerProduct = {
  id: number;
  slug: string;
  name: string;
  providerName: string;
  deliveryType: string;
  priceUsd: string;
  currency: string;
  durationDays: number | null;
  warrantyDays: number | null;
  inStock: boolean;
  stockCount: number | null;
  emoji: string | null;
  description?: string;
  instructions?: string;
};

const DELIVERY_LABEL: Record<string, string> = {
  LINK: "Link",
  COUPON: "Coupon",
  READY_ACCOUNT: "Account",
};

export function PartnerServicesShelf({ compact = false }: { compact?: boolean }) {
  const catalog = trpc.partner.catalog.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const { setSelectedProduct } = useSelectedProduct();
  const [, setLocation] = useLocation();
  const products = (catalog.data?.products ?? []) as PartnerProduct[];
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [delivery, setDelivery] = useState("all");
  const [stock, setStock] = useState<"all" | "in" | "out">("all");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const providers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of products) counts.set(item.providerName, (counts.get(item.providerName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [products]);
  const deliveries = useMemo(
    () => [...new Set(products.map((item) => item.deliveryType).filter(Boolean))],
    [products],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products
      .filter((item) => {
        if (provider !== "all" && item.providerName !== provider) return false;
        if (delivery !== "all" && item.deliveryType !== delivery) return false;
        if (stock === "in" && !item.inStock) return false;
        if (stock === "out" && item.inStock) return false;
        if (!needle) return true;
        return `${item.name} ${item.providerName} ${item.deliveryType} ${item.description ?? ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.providerName.localeCompare(b.providerName) || Number(a.priceUsd) - Number(b.priceUsd));
  }, [delivery, products, provider, query, stock]);

  const openProduct = filtered.find((item) => item.slug === openSlug) ?? products.find((item) => item.slug === openSlug) ?? null;

  const order = (product: PartnerProduct) => {
    setSelectedProduct({
      id: `partner:${product.slug}`,
      kind: "partner",
      partnerSlug: product.slug,
      label: product.name,
      amountLabel: product.durationDays ? `${product.durationDays} days` : product.deliveryType,
      priceLabel: `$${product.priceUsd}`,
      gameName: product.providerName,
      deliveryType: product.deliveryType,
      durationDays: product.durationDays,
      warrantyDays: product.warrantyDays,
    });
    setLocation("/checkout/preview");
  };

  const chip = (active: boolean) =>
    `inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[10px] font-bold transition ${active ? "bg-neon text-neon-ink" : "bg-panel-2 text-ink-muted"}`;

  return (
    <section className={compact ? "" : "container py-5 sm:py-8"} aria-label="Digital services">
      <div className="max-w-2xl">
        <p className="zurs-eyebrow font-bold uppercase">DIGITAL SERVICES</p>
        <h1 className="mt-1 font-display text-xl font-bold text-ink sm:text-3xl" style={{ lineHeight: 1.45 }}>សេវាឌីជីថល</h1>
        <p className="mt-1.5 text-sm text-ink-muted" style={{ lineHeight: 1.65 }}>Premium AI និង subscription — បន្ទាប់ពីបង់ប្រាក់ Admin បំពេញក្នុង ៥–១០ នាទី។</p>
      </div>

      {catalog.isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-2xl border border-line bg-panel" />
          ))}
        </div>
      ) : catalog.error ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel p-8 text-center text-xs text-ink-muted">មិនអាចផ្ទុកសេវាឌីជីថលបានទេឥឡូវនេះ។ សូមព្យាយាមម្ដងទៀត។</div>
      ) : products.length ? (
        <>
          <div className="mt-4 space-y-2">
            <label className="flex h-10 items-center gap-2 rounded-2xl border border-line bg-panel px-3">
              <PackEmoji name="search-user" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ស្វែងរកសេវា…"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </label>
            <div className="zurs-provider-strip" role="listbox" aria-label="Provider">
              <button type="button" title="ទាំងអស់" aria-selected={provider === "all"} className={`zurs-provider-dot ${provider === "all" ? "is-on" : ""}`} onClick={() => setProvider("all")}>
                <PackEmoji name="sparkles-z" size={18} />
              </button>
              {providers.map(([name]) => {
                const brand = matchBrand(name);
                return (
                  <button key={name} type="button" title={name} aria-selected={provider === name} className={`zurs-provider-dot ${provider === name ? "is-on" : ""}`} onClick={() => setProvider(name)}>
                    {brand ? <BrandMark id={brand} size={22} /> : <PackEmoji name="svc-sparkle" size={18} />}
                  </button>
                );
              })}
            </div>
            {provider !== "all" ? <p className="px-0.5 text-[11px] font-bold text-ink">{provider}</p> : null}
            <div className="flex flex-wrap gap-1" aria-label="Type and stock filter">
              {deliveries.map((type) => (
                <button key={type} type="button" className={chip(delivery === type)} onClick={() => setDelivery(delivery === type ? "all" : type)}>
                  {DELIVERY_LABEL[type] ?? type}
                </button>
              ))}
              <button type="button" className={chip(stock === "in")} onClick={() => setStock(stock === "in" ? "all" : "in")}>មានស្តុក</button>
              <button type="button" className={chip(stock === "out")} onClick={() => setStock(stock === "out" ? "all" : "out")}>អស់ស្តុក</button>
              <span className="ml-auto self-center text-[10px] font-semibold text-ink-muted">{filtered.length} សេវា</span>
            </div>
          </div>
          {filtered.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <article key={product.slug}>
                  <button type="button" onClick={() => setOpenSlug(product.slug)} className="zurs-mobile-glass zurs-game-card flex h-full min-h-[9.75rem] w-full flex-col rounded-2xl p-2.5 text-left">
                    <span className="flex items-start gap-2">
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
                        <ServiceLogo text={`${product.providerName} ${product.name}`} size={28} />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-[11px] font-bold leading-snug text-ink">{product.name}</span>
                        <span className="mt-0.5 block text-[10px] font-semibold text-ink-muted">
                          {product.durationDays ? `${product.durationDays} ថ្ងៃ` : DELIVERY_LABEL[product.deliveryType] ?? product.deliveryType}
                        </span>
                      </span>
                    </span>
                    {product.description ? <span className="mt-2 line-clamp-2 text-[10px] leading-4 text-ink-muted">{product.description}</span> : null}
                    <span className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <strong className="font-display text-sm font-extrabold text-ink">${product.priceUsd}</strong>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${product.inStock ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-600"}`}>
                        {product.inStock ? "មានស្តុក" : "អស់ស្តុក"}
                      </span>
                    </span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel p-8 text-center text-xs text-ink-muted">មិនមានសេវាដែលត្រូវនឹងតម្រងនេះទេ។</div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel p-8 text-center text-xs text-ink-muted">{catalog.data?.configured === false ? "សេវាឌីជីថលនឹងបង្ហាញពេល Admin ដាក់ Partner API key លើ Vercel។" : "មិនទាន់មានសេវាឌីជីថលនៅពេលនេះទេ។"}</div>
      )}

      {openProduct ? (
        <ProductSheet product={openProduct} onClose={() => setOpenSlug(null)} onBuy={() => order(openProduct)} />
      ) : null}
    </section>
  );
}

function ProductSheet({ product, onClose, onBuy }: { product: PartnerProduct; onClose: () => void; onBuy: () => void }) {
  const brandText = `${product.providerName} ${product.name}`;
  return (
    <div className="zurs-product-sheet" role="dialog" aria-modal="true" aria-labelledby="zurs-product-title">
      <button type="button" className="zurs-product-sheet__backdrop" aria-label="បិទ" onClick={onClose} />
      <div className="zurs-product-sheet__panel">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-start gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
            <ServiceLogo text={brandText} size={40} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{product.providerName}</p>
            <h2 id="zurs-product-title" className="mt-0.5 font-display text-base font-extrabold leading-snug text-ink">{product.name}</h2>
            <p className="mt-1 text-xs font-semibold text-ink-muted">
              {product.durationDays ? `${product.durationDays} ថ្ងៃ` : "—"} · {DELIVERY_LABEL[product.deliveryType] ?? product.deliveryType}
              {product.warrantyDays ? ` · warranty ${product.warrantyDays} ថ្ងៃ` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-lg leading-none text-ink-muted" aria-label="បិទ">×</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          {product.inStock ? (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700">មានស្តុក{typeof product.stockCount === "number" ? ` ${product.stockCount}` : ""}</span>
          ) : (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-600">អស់ស្តុក</span>
          )}
          <span className="rounded-full bg-panel-2 px-2 py-0.5 text-ink-muted">{DELIVERY_LABEL[product.deliveryType] ?? product.deliveryType}</span>
          <span className="rounded-full bg-neon/15 px-2 py-0.5 text-ink">៥–១០ នាទី</span>
        </div>
        <p className="mt-3 font-display text-2xl font-extrabold text-ink">${product.priceUsd} <span className="text-sm font-bold text-ink-muted">USD</span></p>
        {product.description ? (
          <section className="mt-4">
            <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-ink-muted">ព័ត៌មាន</h3>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">{product.description}</p>
          </section>
        ) : null}
        {product.instructions ? (
          <section className="mt-4 rounded-2xl bg-panel-2/80 p-3">
            <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-ink-muted">វិធីប្រើ / Activation</h3>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">{product.instructions}</p>
          </section>
        ) : null}
        <section className="mt-4 rounded-2xl border border-line p-3">
          <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-ink-muted">ចំណាំ</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-ink">
            <li>បន្ទាប់ពីបង់ប្រាក់ Admin បំពេញក្នុង ៥ ទៅ ១០ នាទី។</li>
            {product.warrantyDays ? <li>Warranty {product.warrantyDays} ថ្ងៃ តាមលក្ខខណ្ឌរបស់សេវា។</li> : null}
            <li>សូមអានវិធីប្រើខាងលើឲ្យបានច្បាស់ មុនទិញ។</li>
          </ul>
        </section>
        <button type="button" disabled={!product.inStock} onClick={onBuy} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-neon text-sm font-extrabold text-neon-ink disabled:opacity-40">
          ទិញឥឡូវ · ${product.priceUsd}
        </button>
      </div>
    </div>
  );
}
