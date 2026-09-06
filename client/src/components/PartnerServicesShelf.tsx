import { useMemo, useState } from "react";
import { PackEmoji, serviceEmojiName } from "@/components/PackEmoji";
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

  const providers = useMemo(
    () => [...new Set(products.map((item) => item.providerName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );
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
        return `${item.name} ${item.providerName} ${item.deliveryType}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.providerName.localeCompare(b.providerName) || Number(a.priceUsd) - Number(b.priceUsd));
  }, [delivery, products, provider, query, stock]);

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
    `inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${active ? "bg-neon text-neon-ink shadow-sm" : "bg-panel-2 text-ink-muted hover:text-ink"}`;

  return (
    <section className={compact ? "" : "container py-5 sm:py-10"} aria-label="Digital services">
      <div className="max-w-2xl">
        <p className="zurs-eyebrow font-bold uppercase">DIGITAL SERVICES</p>
        <h1 className="mt-1.5 font-display text-xl font-bold text-ink sm:text-3xl" style={{ lineHeight: 1.45 }}>សេវាឌីជីថល</h1>
        <p className="mt-2 text-sm text-ink-muted" style={{ lineHeight: 1.7 }}>សេវា Premium (AI, Entertainment, និងផ្សេងៗ) ពី Partner API — បន្ទាប់ពីបង់ប្រាក់ Admin បំពេញក្នុង ៥–១០ នាទី។</p>
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-neon/25 bg-neon/10 p-3.5">
        <PackEmoji name="clock" size={20} className="mt-0.5" />
        <p className="text-xs text-ink" style={{ lineHeight: 1.6 }}><strong>ចំណាំ៖</strong> សេវាកម្មនេះចំណាយពេល <strong>៥ ទៅ ១០ នាទី</strong> បន្ទាប់ពីការទូទាត់ជោគជ័យ។ ការកម្មង់ផ្ញើទៅផ្ទាំង Admin ដើម្បី top-up។</p>
      </div>

      {catalog.isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex h-44 flex-col justify-between rounded-2xl border border-line bg-panel p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-12 w-12 animate-pulse rounded-2xl bg-panel-2" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-panel-2" />
                  <div className="h-2 w-16 animate-pulse rounded bg-panel-2" />
                </div>
              </div>
              <div className="h-8 animate-pulse rounded-xl bg-panel-2" />
            </div>
          ))}
        </div>
      ) : catalog.error ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel p-8 text-center text-xs text-ink-muted">មិនអាចផ្ទុកសេវាឌីជីថលបានទេឥឡូវនេះ។ សូមព្យាយាមម្ដងទៀត។</div>
      ) : products.length ? (
        <>
          <div className="mt-4 space-y-3 rounded-2xl border border-line bg-panel/80 p-3">
            <label className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-canvas px-3">
              <PackEmoji name="search-user" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ស្វែងរក Gemini, ChatGPT, CapCut…"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" aria-label="Provider filter">
              <button type="button" className={chip(provider === "all")} onClick={() => setProvider("all")}>ទាំងអស់</button>
              {providers.map((name) => (
                <button key={name} type="button" className={chip(provider === name)} onClick={() => setProvider(name)}>
                  <PackEmoji name={serviceEmojiName(name)} size={14} />
                  {name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Type and stock filter">
              <button type="button" className={chip(delivery === "all")} onClick={() => setDelivery("all")}>គ្រប់ប្រភេទ</button>
              {deliveries.map((type) => (
                <button key={type} type="button" className={chip(delivery === type)} onClick={() => setDelivery(type)}>
                  {DELIVERY_LABEL[type] ?? type}
                </button>
              ))}
              <button type="button" className={chip(stock === "all")} onClick={() => setStock("all")}>គ្រប់ស្តុក</button>
              <button type="button" className={chip(stock === "in")} onClick={() => setStock("in")}>មានស្តុក</button>
              <button type="button" className={chip(stock === "out")} onClick={() => setStock("out")}>អស់ស្តុក</button>
            </div>
            <p className="text-[11px] font-semibold text-ink-muted">{filtered.length} / {products.length} សេវា</p>
          </div>
          {filtered.length ? (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <article key={product.slug} className="zurs-mobile-glass zurs-game-card flex h-full min-h-[11.5rem] flex-col rounded-2xl p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                      <PackEmoji name={serviceEmojiName(`${product.providerName} ${product.name}`)} size={34} />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="line-clamp-2 text-xs font-bold leading-snug text-ink">{product.name}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-ink-muted">{product.providerName}{product.durationDays ? ` · ${product.durationDays} ថ្ងៃ` : ""}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    {product.inStock ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600"><PackEmoji name="check-badge" size={12} />មានស្តុក{typeof product.stockCount === "number" ? ` ${product.stockCount}` : ""}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-600"><PackEmoji name="warning" size={12} />អស់ស្តុក</span>
                    )}
                    <span className="rounded-full bg-panel-2 px-2 py-0.5 text-ink-muted">{DELIVERY_LABEL[product.deliveryType] ?? product.deliveryType}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <strong className="font-display text-base font-extrabold text-ink">${product.priceUsd}</strong>
                    <button type="button" disabled={!product.inStock} onClick={() => order(product)} className="inline-flex h-8 items-center gap-1 rounded-xl bg-neon px-3 text-[11px] font-extrabold text-neon-ink transition hover:brightness-110 disabled:opacity-40">
                      ទិញឥឡូវ
                    </button>
                  </div>
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
    </section>
  );
}
