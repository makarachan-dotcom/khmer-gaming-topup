import { CheckCircle2, Download, FileText } from "lucide-react";

export type PaymentReceiptData = { receiptNumber: string; orderNumber: string; trackingCode: string; productName: string; amount: string; currency: "KHR" | "USD"; orderType: "topup" | "smm" | "wallet"; paidAt: Date | string; issuedAt: Date | string };

function amountText(receipt: PaymentReceiptData) { return receipt.currency === "USD" ? `$${Number(receipt.amount).toFixed(2)}` : `៛ ${Number(receipt.amount).toLocaleString("km-KH", { maximumFractionDigits: 0 })}`; }
function dateText(value: Date | string) { return new Date(value).toLocaleString("km-KH", { dateStyle: "medium", timeStyle: "short" }); }

export function downloadPaymentReceipt(receipt: PaymentReceiptData) {
  const document = `ZURS.me\nបង្កាន់ដៃទូទាត់\n\nលេខបង្កាន់ដៃ: ${receipt.receiptNumber}\nលេខការកម្មង់: ${receipt.orderNumber}\nPurchase ID: ${receipt.trackingCode}\nសេវាកម្ម: ${receipt.productName}\nចំនួនទឹកប្រាក់: ${amountText(receipt)}\nស្ថានភាព: បានបង់រួច\nពេលទូទាត់: ${dateText(receipt.paidAt)}\n\nបង្កាន់ដៃនេះបង្ហាញតែព័ត៌មានការកម្មង់ដែលបានផ្ទៀងផ្ទាត់។`;
  const url = URL.createObjectURL(new Blob([document], { type: "text/plain;charset=utf-8" }));
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${receipt.receiptNumber}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReceiptCard({ receipt, compact = false }: { receipt: PaymentReceiptData; compact?: boolean }) {
  return <section className={`receipt-card rounded-2xl border border-slate-200 bg-white ${compact ? "p-4" : "p-5"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.15em] text-indigo-700">ZURS.me · VERIFIED RECEIPT</p><h1 className="mt-1 font-display text-xl font-bold text-slate-950">បង្កាន់ដៃទូទាត់</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span></div><div className="mt-5 space-y-3 border-y border-dashed border-slate-200 py-4 text-xs"><ReceiptLine label="សេវាកម្ម" value={receipt.productName} /><ReceiptLine label="លេខការកម្មង់" value={receipt.orderNumber} mono /><ReceiptLine label="Purchase ID" value={receipt.trackingCode} mono /><ReceiptLine label="ពេលទូទាត់" value={dateText(receipt.paidAt)} /><div className="flex items-end justify-between gap-3 pt-1"><span className="text-slate-500">ចំនួនទឹកប្រាក់</span><strong className="font-mono text-lg text-slate-950">{amountText(receipt)}</strong></div></div><div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />បានផ្ទៀងផ្ទាត់រួចរាល់</div></section>;
}

function ReceiptLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-start justify-between gap-3"><span className="shrink-0 text-slate-500">{label}</span><span className={`min-w-0 text-right font-semibold text-slate-800 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span></div>; }

export function ReceiptActionButtons({ receipt, onView }: { receipt: PaymentReceiptData; onView: () => void }) { return <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={onView} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-extrabold text-white"><FileText className="h-4 w-4" />មើលបង្កាន់ដៃ</button><button type="button" onClick={() => downloadPaymentReceipt(receipt)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700"><Download className="h-4 w-4" />ទាញយកបង្កាន់ដៃ</button></div>; }
