import { useAuth } from "@/_core/hooks/useAuth";
import { OutlineLoader } from "@/components/OutlineLoader";
import StorefrontLayout from "@/components/StorefrontLayout";
import { formatUsd } from "@/lib/display";
import { trpc } from "@/lib/trpc";
import { Heart, Trash2 } from "lucide-react";
import { Link } from "wouter";

export default function Favorites() {
  const { user, loading } = useAuth();
  const favorites = trpc.marketplace.favorites.useQuery(undefined, { enabled: Boolean(user) });
  const utils = trpc.useUtils();
  const remove = trpc.marketplace.removeFavorite.useMutation({ onSuccess: () => utils.marketplace.favorites.invalidate() });
  return <StorefrontLayout><main className="container py-6 sm:py-10"><section className="mx-auto max-w-3xl"><p className="text-[10px] font-bold tracking-[0.16em] text-rose-600">FAVORITES</p><h1 className="mt-2 font-display text-2xl font-bold text-slate-950 sm:text-4xl">គណនីដែលបានរក្សាទុក</h1><p className="mt-2 text-xs leading-6 text-slate-600 sm:text-sm">រក្សាទុកគណនីដែលអ្នកចង់ពិនិត្យ ឬទិញនៅពេលក្រោយ។ មានតែអ្នកប៉ុណ្ណោះដែលអាចមើលបញ្ជីនេះ។</p>{loading || favorites.isLoading ? <div className="mt-5 grid h-40 place-items-center rounded-2xl border border-slate-200 bg-white"><OutlineLoader size={20} color="#4f46e5" /></div> : !user ? <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-xs leading-6 text-amber-900">សូមចូលគណនីជាមុនសិន ដើម្បីរក្សាទុកគណនីដែលអ្នកចង់ទិញ។</div> : favorites.data?.length ? <div className="mt-5 space-y-3">{favorites.data.map(({ favorite, listing }) => <article key={favorite.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold text-indigo-700">{listing.game}</p><h2 className="mt-1 truncate text-sm font-bold text-slate-900">{listing.title}</h2><p className="mt-1 text-xs text-slate-500">{listing.rankLevel}</p><p className="mt-2 font-display text-base font-bold text-slate-950">{listing.priceUsd ? formatUsd(listing.priceUsd) : "សួរបន្ថែម"}</p></div><button type="button" disabled={remove.isPending} onClick={() => remove.mutate({ listingId: listing.id })} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-bold text-rose-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />លុប</button></div><Link href="/marketplace" className="mt-4 inline-flex text-xs font-bold text-indigo-700">មើលទីផ្សារ</Link></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Heart className="mx-auto h-6 w-6 text-rose-300" /><p className="mt-3 text-sm font-bold text-slate-700">មិនទាន់មានគណនីរក្សាទុកទេ</p><Link href="/marketplace" className="mt-4 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ទៅកាន់ទីផ្សារ</Link></div>}</section></main></StorefrontLayout>;
}
