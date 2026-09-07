import { BrandMark, ServiceLogo, matchBrand } from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";
import { LoadingV2 } from "@/components/OutlineLoader";
import { useEffect, useMemo, useState } from "react";

type DigitalProduct = {
  slug: string;
  name: string;
  nameKh: string;
  providerName: string;
  deliveryType: string;
  priceUsd: string;
  apiPriceUsd: string;
  durationDays: number | null;
  inStock: boolean;
  hidden: boolean;
  descriptionKh: string;
  descriptionEn: string;
  instructionsKh: string;
  instructionsEn: string;
  sourceDescription: string;
  sourceInstructions: string;
};

type EditorValues = {
  priceUsd: string;
  nameKh: string;
  nameEn: string;
  descriptionKh: string;
  descriptionEn: string;
  instructionsKh: string;
  instructionsEn: string;
  hidden: boolean;
};

const DELIVERY: Record<string, string> = { LINK: "តំណ", COUPON: "Coupon", READY_ACCOUNT: "គណនី", CDK: "CDK" };

export function AdminDigitalServices() {
  const catalog = trpc.admin.partnerCatalog.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.admin.savePartnerService.useMutation({
    onSuccess: () => {
      void utils.admin.partnerCatalog.invalidate();
      void utils.partner.catalog.invalidate();
    },
  });
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const products = (catalog.data?.products ?? []) as DigitalProduct[];
  const providers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of products) counts.set(item.providerName, (counts.get(item.providerName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [products]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((item) => {
      if (provider !== "all" && item.providerName !== provider) return false;
      if (!needle) return true;
      return `${item.name} ${item.nameKh} ${item.providerName} ${item.slug}`.toLowerCase().includes(needle);
    });
  }, [products, provider, query]);

  if (catalog.isLoading) return <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center"><LoadingV2 size={20} color="#4f46e5" className="mx-auto" /></div>;
  if (catalog.data?.configured === false) {
    return <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">ដាក់ <b>ZURS_PARTNER_API_KEY</b> លើ Vercel ដើម្បីផ្ទុកសេវាឌីជីថល ZURS.me។</div>;
  }

  return (
    <section className="mt-6 space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-950">សេវាឌីជីថល</h2>
            <p className="mt-1 text-xs text-slate-500">កែតម្លៃ និងព័ត៌មានខ្មែរ/អង់គ្លេស — សរសេរខ្លី អតិថិជនអានងាយ។</p>
          </div>
          <label className="block sm:w-64">
            <span className="sr-only">ស្វែងរក</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ស្វែងរកសេវា…" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs" />
          </label>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="listbox" aria-label="Provider">
          <button type="button" title="ទាំងអស់" onClick={() => setProvider("all")} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${provider === "all" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>All</button>
          {providers.map(([name, count]) => {
            const brand = matchBrand(name);
            return (
              <button key={name} type="button" title={`${name} · ${count}`} onClick={() => setProvider(name)} className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border ${provider === name ? "border-slate-950 ring-2 ring-slate-950/20" : "border-slate-200"}`}>
                {brand ? <BrandMark id={brand} size={22} /> : <ServiceLogo text={name} size={22} />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] font-semibold text-slate-500">{provider === "all" ? `${filtered.length} សេវា` : `${provider} · ${filtered.length}`}</p>
      </div>
      {filtered.map((product) => (
        <DigitalEditor
          key={product.slug}
          product={product}
          open={openSlug === product.slug}
          onToggle={() => setOpenSlug((current) => current === product.slug ? null : product.slug)}
          pending={save.isPending}
          onSave={(values) => save.mutate({ slug: product.slug, ...values })}
        />
      ))}
      {!filtered.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">មិនមានសេវា។</div> : null}
      {save.error ? <p className="text-xs font-semibold text-rose-700">{save.error.message}</p> : null}
      {save.isSuccess ? <p className="text-xs font-semibold text-emerald-700">បានរក្សាទុក។</p> : null}
    </section>
  );
}

function DigitalEditor({
  product,
  open,
  onToggle,
  pending,
  onSave,
}: {
  product: DigitalProduct;
  open: boolean;
  onToggle: () => void;
  pending: boolean;
  onSave: (values: EditorValues) => void;
}) {
  const [priceUsd, setPriceUsd] = useState(product.priceUsd);
  const [nameKh, setNameKh] = useState(product.nameKh);
  const [nameEn, setNameEn] = useState(product.name);
  const [descriptionKh, setDescriptionKh] = useState(product.descriptionKh);
  const [descriptionEn, setDescriptionEn] = useState(product.descriptionEn);
  const [instructionsKh, setInstructionsKh] = useState(product.instructionsKh);
  const [instructionsEn, setInstructionsEn] = useState(product.instructionsEn);
  const [hidden, setHidden] = useState(product.hidden);

  useEffect(() => {
    setPriceUsd(product.priceUsd);
    setNameKh(product.nameKh);
    setNameEn(product.name);
    setDescriptionKh(product.descriptionKh);
    setDescriptionEn(product.descriptionEn);
    setInstructionsKh(product.instructionsKh);
    setInstructionsEn(product.instructionsEn);
    setHidden(product.hidden);
  }, [product]);

  const values = (): EditorValues => ({ priceUsd, nameKh, nameEn, descriptionKh, descriptionEn, instructionsKh, instructionsEn, hidden });

  return (
    <article className={`rounded-2xl border bg-white p-3 shadow-sm ${hidden ? "border-slate-200 opacity-70" : "border-slate-200"}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
          <ServiceLogo text={`${product.providerName} ${product.name}`} size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-950">{product.nameKh || product.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{product.providerName} · {DELIVERY[product.deliveryType] ?? product.deliveryType}{product.durationDays ? ` · ${product.durationDays} ថ្ងៃ` : ""} · {product.inStock ? "មានស្តុក" : "អស់"}{hidden ? " · លាក់" : ""}</p>
        </div>
        <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
          $<input value={priceUsd} onChange={(event) => setPriceUsd(event.target.value)} inputMode="decimal" className="h-8 w-[4.5rem] rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs" />
        </label>
        <button type="button" disabled={pending} onClick={() => onSave(values())} className="h-8 rounded-lg bg-slate-950 px-2 text-[10px] font-bold text-white disabled:opacity-40">Save</button>
        <button type="button" onClick={onToggle} className="h-8 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-slate-700">{open ? "បិទ" : "ព័ត៌មាន"}</button>
      </div>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">API ${product.apiPriceUsd}{product.priceUsd !== product.apiPriceUsd ? ` · លក់ $${product.priceUsd}` : ""}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="ឈ្មោះខ្មែរ" value={nameKh} onChange={setNameKh} />
            <Field label="Name EN" value={nameEn} onChange={setNameEn} />
            <Area label="ព័ត៌មានខ្មែរ" value={descriptionKh} onChange={setDescriptionKh} />
            <Area label="Info EN" value={descriptionEn} onChange={setDescriptionEn} />
            <Area label="វិធីប្រើខ្មែរ" value={instructionsKh} onChange={setInstructionsKh} />
            <Area label="How to use EN" value={instructionsEn} onChange={setInstructionsEn} />
          </div>
          {product.sourceDescription ? <p className="line-clamp-2 text-[10px] leading-4 text-slate-400">Provider: {product.sourceDescription}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />លាក់ពីហាង
            </label>
            <button type="button" disabled={pending} onClick={() => onSave(values())} className="ml-auto h-8 rounded-lg bg-slate-950 px-3 text-[11px] font-bold text-white disabled:opacity-40">
              {pending ? "កំពុងរក្សាទុក…" : "រក្សាទុកព័ត៌មាន"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-slate-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={180} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs" />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-slate-500">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={8} maxLength={6000} className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs leading-5" />
    </label>
  );
}
