import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, ReceiptText, Sparkles } from "lucide-react";

function displayAmount(value: string | number, currency: "KHR" | "USD") {
  const numeric = Number(value || 0);
  return currency === "USD"
    ? `$${numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `៛ ${numeric.toLocaleString("km-KH", { maximumFractionDigits: 0 })}`;
}

function receiptText(input: { title: string; reference: string; amount: string | number; currency: "KHR" | "USD"; paidAt?: Date | string | null }) {
  const paidTime = input.paidAt ? new Date(input.paidAt).toLocaleString("km-KH") : new Date().toLocaleString("km-KH");
  return [
    "ZURS STORE — PAYMENT RECEIPT",
    "",
    `Service: ${input.title}`,
    `Reference: ${input.reference}`,
    `Amount: ${displayAmount(input.amount, input.currency)}`,
    `Currency: ${input.currency}`,
    `Verified at: ${paidTime}`,
    "Status: PAID AND VERIFIED",
    "",
    "This receipt was created after the payment session was confirmed.",
  ].join("\n");
}

export function PaymentSuccessDialog({
  open,
  onOpenChange,
  title,
  reference,
  amount,
  currency,
  paidAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  reference: string;
  amount: string | number;
  currency: "KHR" | "USD";
  paidAt?: Date | string | null;
}) {
  const downloadReceipt = () => {
    const blob = new Blob([receiptText({ title, reference, amount, currency, paidAt })], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zurs-receipt-${reference}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="overflow-hidden border-0 bg-white p-0 shadow-2xl sm:max-w-md" aria-describedby="payment-success-description">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-6 pb-8 pt-10 text-center text-white">
        <div className="absolute -left-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-10 bottom-0 h-36 w-36 rounded-full bg-amber-200/20 blur-2xl" />
        <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-white/15 shadow-lg ring-8 ring-white/10 motion-safe:animate-pulse">
          <AnimatedGlyph name="success" size={46} color="#ffffff" />
        </div>
        <div className="relative mt-5 flex items-center justify-center gap-1.5 text-emerald-100"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-extrabold tracking-[0.18em]">PAYMENT VERIFIED</span><Sparkles className="h-4 w-4" /></div>
        <DialogTitle className="relative mt-2 font-display text-2xl font-extrabold text-white">ការទូទាត់ជោគជ័យ</DialogTitle>
        <DialogDescription id="payment-success-description" className="relative mt-2 text-sm leading-6 text-emerald-50">Bakong បានបញ្ជាក់ការទូទាត់រួចហើយ។ សូមរក្សាទុកបង្កាន់ដៃនេះ។</DialogDescription>
      </div>
      <div className="p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold tracking-[0.14em] text-emerald-700">AMOUNT RECEIVED</p><p className="mt-1 font-display text-2xl font-extrabold text-emerald-950">{displayAmount(amount, currency)}</p></div><ReceiptText className="h-6 w-6 text-emerald-600" /></div>
          <div className="mt-3 border-t border-emerald-100 pt-3"><p className="text-[10px] font-bold tracking-[0.12em] text-emerald-700">REFERENCE</p><p className="mt-1 break-all font-mono text-xs font-bold text-emerald-950">{reference}</p></div>
        </div>
        <button type="button" onClick={downloadReceipt} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"><Download className="h-4 w-4" />ទាញយកបង្កាន់ដៃ</button>
        <button type="button" onClick={() => onOpenChange(false)} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FileText className="h-4 w-4" />បិទបង្កាន់ដៃ</button>
      </div>
    </DialogContent>
  </Dialog>;
}
