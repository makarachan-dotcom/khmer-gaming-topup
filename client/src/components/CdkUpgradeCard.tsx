import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Sparkles } from "lucide-react";
import { ServiceLogo } from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";
import type { PublicCdkStatus } from "@shared/cdkToken";

export function CdkUpgradeCard({
  orderId,
  status,
  cdk,
  productName,
  onUpdated,
}: {
  orderId: string;
  status: string;
  cdk?: PublicCdkStatus | null;
  productName?: string;
  onUpdated?: () => void;
}) {
  const submitted = Boolean(cdk?.submitted);
  const upgraded = status === "delivered" || Boolean(cdk?.upgraded);
  const submit = trpc.orders.submitCdkToken.useMutation({
    onSuccess: () => onUpdated?.(),
  });
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!submitted || upgraded) return;
    const timer = window.setInterval(() => onUpdated?.(), 8000);
    return () => window.clearInterval(timer);
  }, [submitted, upgraded, onUpdated]);

  if (upgraded) {
    return (
      <section className="zurs-cdk zurs-cdk--done" aria-live="polite">
        <header className="zurs-cdk__head">
          <span className="zurs-cdk__mark"><ServiceLogo text={productName || "CDK"} size={28} /></span>
          <div>
            <p className="zurs-cdk__kicker">Plan upgraded</p>
            <h3>{productName || "សេវា CDK"}</h3>
            <p>Plan បាន upgrade រួចរាល់។ សូម refresh ទំព័រសេវា។</p>
          </div>
        </header>
        <p className="zurs-cdk__done"><CheckCircle2 className="h-4 w-4" />Upgrade ជោគជ័យ</p>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="zurs-cdk zurs-cdk--wait" aria-live="polite">
        <header className="zurs-cdk__head">
          <span className="zurs-cdk__mark"><ServiceLogo text={productName || "CDK"} size={28} /></span>
          <div>
            <p className="zurs-cdk__kicker">កំពុង upgrade</p>
            <h3>{productName || "សេវា CDK"}</h3>
            <p>បានទទួល token{cdk?.preview ? ` ${cdk.preview}` : ""}។ សូមរង់ចាំបន្តិច — plan កំពុង upgrade។</p>
          </div>
        </header>
        <div className="zurs-cdk__pulse"><Loader2 className="h-4 w-4 animate-spin" />កំពុងដំណើរការ…</div>
      </section>
    );
  }

  return (
    <form
      className="zurs-cdk"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate({ orderId, token });
      }}
    >
      <header className="zurs-cdk__head">
        <span className="zurs-cdk__mark"><KeyRound className="h-5 w-5" /></span>
        <div>
          <p className="zurs-cdk__kicker">Paste token</p>
          <h3>បញ្ចូល token ដើម្បី upgrade</h3>
          <p>បន្ទាប់ពីបង់ប្រាក់រួច paste token ពីគណនីដែលអ្នកចង់ upgrade។ រង់ចាំបន្តិច — plan នឹង upgrade។</p>
        </div>
      </header>
      <textarea
        value={token}
        onChange={(event) => setToken(event.target.value)}
        rows={4}
        spellCheck={false}
        autoComplete="off"
        placeholder="Paste token នៅទីនេះ"
        className="zurs-cdk__input"
      />
      <button type="submit" disabled={submit.isPending || token.trim().length < 20} className="zurs-cdk__send">
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        ផ្ញើ Token
      </button>
      {submit.error ? <p className="zurs-cdk__error">{submit.error.message}</p> : null}
    </form>
  );
}
