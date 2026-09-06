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

export function PartnerServicesShelf({ compact = false }: { compact?: boolean }) {
  const catalog = trpc.partner.catalog.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const { setSelectedProduct } = useSelectedProduct();
  const [, setLocation] = useLocation();
  const products = (catalog.data?.products ?? []) as PartnerProduct[];

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

  return (
    <section className={compact ? "" : "container py-5 sm:py-10"} aria-label="Digital services">
      <div className="max-w-2xl">
        <p className="zurs-eyebrow font-bold uppercase">DIGITAL SERVICES</p>
        <h1 className="zp-heading mt-1.5 font-display text-xl font-bold leading-tight text-ink text-balance sm:text-3xl">សេវាឌីជីថល</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted text-pretty">សេវា Premium (AI, Entertainment, និងផ្សេងៗ) ពី Partner API — បន្ទាប់ពីបង់ប្រាក់ Admin បំពេញក្នុង ៥–១០ នាទី។</p>
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-neon/25 bg-neon/10 p-3.5">
        <PackEmoji name="clock" size={20} className="mt-0.5" />
        <p className="text-xs leading-5 text-ink"><strong>ចំណាំ៖</strong> សេវាកម្មង់នេះចំណាយពេល <strong>៥ ទៅ ១០ នាទី</strong> បន្ទាប់ពីការទូទាត់ជោគជ័យ។ ការកម្មង់ផ្ញើទៅផ្ទាំង Admin ដើម្បី topup។</p>
      </div>
      {catalog.isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex h-40 flex-col justify-between rounded-2xl border border-line bg-panel p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-panel-2 text-lg">✨</span>
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
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <article key={product.slug} className="zurs-mobile-glass zurs-game-card flex h-full flex-col rounded-2xl p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel-2">
                  <PackEmoji name={serviceEmojiName(`${product.providerName} ${product.name}`)} size={30} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink">{product.name}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-ink-muted">{product.providerName}{product.durationDays ? ` · ${product.durationDays} ថ្ងៃ` : ""}</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                {product.inStock ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600"><PackEmoji name="check-badge" size={11} />មានស្តុក{typeof product.stockCount === "number" ? ` ${product.stockCount}` : ""}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-600"><PackEmoji name="warning" size={11} />អៅស្តុក</span>
                )}
                <span className="rounded-full bg-panel-2 px-2 py-0.5 text-ink-muted">{product.deliveryType}</span>
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
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel p-8 text-center text-xs text-ink-muted">{catalog.data?.configured === false ? "សេវាឌីជីថលនឹងបង្ហាញពេល Admin ដាក់ Partner API key លើ Vercel។" : "មិនទាន់មានសេវាឌីជីថលនៅពេលនេះទេ។"}</div>
      )}
    </section>
  );
}
