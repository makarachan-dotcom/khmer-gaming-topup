import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { methodIcon } from "@/components/DeliveryVault";
import type { DeliveryMethod } from "@shared/partnerDelivery";

const METHODS: Array<{ id: DeliveryMethod; label: string }> = [
  { id: "CDK", label: "CDK" },
  { id: "COUPON", label: "Coupon" },
  { id: "LINK", label: "Link" },
  { id: "READY_ACCOUNT", label: "Email + password" },
  { id: "NOTE", label: "ផ្សេងទៀត" },
];

export function AdminDeliveryForm({ orderId, defaultMethod, productName }: { orderId: string; defaultMethod?: string; productName: string }) {
  const utils = trpc.useUtils();
  const deliver = trpc.admin.deliverPartnerService.useMutation({
    onSuccess: () => void utils.admin.orders.invalidate(),
  });
  const [method, setMethod] = useState<DeliveryMethod>(
    defaultMethod === "CDK" || defaultMethod === "LINK" || defaultMethod === "READY_ACCOUNT" || defaultMethod === "COUPON" ? defaultMethod : "COUPON",
  );
  const [coupon, setCoupon] = useState("");
  const [link, setLink] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [note, setNote] = useState("");
  const [instructions, setInstructions] = useState("");

  return (
    <form
      className="zurs-deliver"
      onSubmit={(event) => {
        event.preventDefault();
        deliver.mutate({ orderId, method, coupon, link, accountEmail, accountPassword, note, instructions });
      }}
    >
      <p className="zurs-deliver__title">ផ្ញើសេវា · {productName}</p>
      <div className="zurs-deliver__methods">
        {METHODS.map((item) => (
          <button key={item.id} type="button" className={method === item.id ? "is-on" : ""} onClick={() => setMethod(item.id)}>
            {methodIcon(item.id)}
            {item.label}
          </button>
        ))}
      </div>
      {method === "CDK" ? <input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="លេខកូដ CDK" className="zurs-deliver__input" /> : null}
      {method === "COUPON" ? <input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="លេខកូដ Coupon" className="zurs-deliver__input" /> : null}
      {method === "LINK" ? <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" className="zurs-deliver__input" /> : null}
      {method === "READY_ACCOUNT" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="email@service.com" className="zurs-deliver__input" />
          <input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="ពាក្យសម្ងាត់" className="zurs-deliver__input" />
        </div>
      ) : null}
      {method === "NOTE" ? <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="ព័ត៌មានសេវា" className="zurs-deliver__input" /> : null}
      <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={2} placeholder="វិធីប្រើ (ស្រេចចិត្ត)" className="zurs-deliver__input" />
      <button type="submit" disabled={deliver.isPending} className="zurs-deliver__send">
        {deliver.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        ផ្ញើទៅអតិថិជន
      </button>
      {deliver.error ? <p className="text-[11px] font-semibold text-rose-700">{deliver.error.message}</p> : null}
      {deliver.isSuccess ? <p className="text-[11px] font-semibold text-emerald-700">បានផ្ញើ។ អតិថិជនឃើញក្នុងគណនី។</p> : null}
    </form>
  );
}
