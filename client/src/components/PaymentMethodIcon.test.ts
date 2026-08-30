import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePaymentIconUrl } from "./PaymentMethodIcon";

describe("payment method icon URL resolution", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps trusted absolute HTTPS URLs unchanged and rejects unsupported schemes", () => {
    expect(resolvePaymentIconUrl("https://cdn.example.test/khqr.svg")).toBe("https://cdn.example.test/khqr.svg");
    expect(resolvePaymentIconUrl("http://cdn.example.test/khqr.png")).toBe("http://cdn.example.test/khqr.png");
    expect(resolvePaymentIconUrl("data:image/svg+xml;base64,unsafe")).toBeNull();
    expect(resolvePaymentIconUrl("javascript:alert(1)")).toBeNull();
    expect(resolvePaymentIconUrl("   ")).toBeNull();
  });

  it("expands managed public storage paths to the current browser origin", () => {
    vi.stubGlobal("window", { location: { origin: "https://zurs.me" } });
    expect(resolvePaymentIconUrl("/manus-storage/appwrite/bucket/source/file")).toBe("https://zurs.me/manus-storage/appwrite/bucket/source/file");
    expect(resolvePaymentIconUrl("manus-storage/appwrite/bucket/source/file")).toBe("https://zurs.me/manus-storage/appwrite/bucket/source/file");
  });

  it("keeps relative paths deploy-safe when rendered outside a browser", () => {
    expect(resolvePaymentIconUrl("/manus-storage/appwrite/bucket/source/file")).toBe("/manus-storage/appwrite/bucket/source/file");
  });

  it("uses one reusable fallback component across customer and owner payment surfaces", () => {
    const component = readFileSync(resolve(process.cwd(), "client/src/components/PaymentMethodIcon.tsx"), "utf8");
    const gate = readFileSync(resolve(process.cwd(), "client/src/components/PaymentMethodGate.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPayment.tsx"), "utf8");
    const routes = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const uploads = readFileSync(resolve(process.cwd(), "server/uploads.ts"), "utf8");

    expect(component).toContain("onError={() => setFailed(true)}");
    expect(component).toContain("khqrLogoUrl");
    expect(gate).toContain('import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";');
    expect(admin).toContain('import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";');
    expect(admin).toContain("preparePaymentMethodIcon");
    expect(admin).toContain("adminPaymentMethodIcon.useMutation");
    expect(routes).toContain("adminPaymentMethodIcon: ownerProcedure.input");
    expect(uploads).toContain("maxPaymentIconBytes = 2 * 1024 * 1024");
    expect(uploads).toContain("Unsafe SVG payment icon");
  });
});
