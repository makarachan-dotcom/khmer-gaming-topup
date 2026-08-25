import StorefrontLayout from "@/components/StorefrontLayout";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ReceiptActionButtons, ReceiptCard } from "@/components/PaymentReceipt";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Printer, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Receipt() {
  const [location] = useLocation();
  const orderId = location.split("/").pop() ?? "";
  const receipt = trpc.orders.receipt.useQuery({ orderId }, { enabled: orderId.length >= 4 });
  return <StorefrontLayout><main className="container max-w-xl py-7 sm:py-12"><Link href="/account" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700"><ChevronLeft className="h-4 w-4" />ត្រឡប់ទៅគណនី</Link>{receipt.isLoading ? <div className="mt-6 grid h-64 place-items-center rounded-2xl bg-white"><OutlineLoader size={30} color="#4f46e5" /></div> : receipt.error || !receipt.data ? <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-center text-sm leading-6 text-amber-900">បង្កាន់ដៃមានសម្រាប់តែការទូទាត់ដែលបានផ្ទៀងផ្ទាត់រួចរាល់។</div> : <div className="mt-6"><ReceiptCard receipt={receipt.data} /><div className="mt-4 flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />បង្កាន់ដៃនេះមិនបង្ហាញ QR, transaction hash ឬព័ត៌មានសម្ងាត់ពីអ្នកផ្តល់សេវាទូទាត់ទេ។</div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-extrabold text-white"><Printer className="h-4 w-4" />បោះពុម្ពបង្កាន់ដៃ</button><ReceiptActionButtons receipt={receipt.data} onView={() => window.scrollTo({ top: 0, behavior: "smooth" })} /></div></div>}</main></StorefrontLayout>;
}
