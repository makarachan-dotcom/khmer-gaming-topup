import { describe, expect, it } from "vitest";

describe.runIf(process.env.VITEST_LIVE_CREDENTIALS === "1")(
  "Zyte API credential for nevercrystore Game ID checks",
  () => {
    it("authorizes the browser extract route and reaches the nevercrystore check-user API without exposing account data", async () => {
      const apiKey = process.env.ZYTE_API_KEY;
      expect(apiKey).toMatch(/^[a-f0-9]{32}$/i);

      const script = `(async () => {
        const token = document.querySelector('meta[name="csrf-token"]')?.content || "";
        const form = new URLSearchParams();
        form.set("game_code", "mobilelegend");
        form.set("category_id", "23");
        form.set("user_id", "12345678");
        form.set("server_id", "1234");
        const response = await fetch("/check-user", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-CSRF-TOKEN": token, "X-Requested-With": "XMLHttpRequest" },
          body: form.toString(),
        });
        const node = document.createElement("pre");
        node.id = "ncs-check-result";
        node.textContent = "NCS:" + encodeURIComponent(JSON.stringify({ httpStatus: response.status, body: await response.text() }));
        document.body.appendChild(node);
      })();`;

      const response = await fetch("https://api.zyte.com/v1/extract", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
        body: JSON.stringify({
          url: "https://nevercrystore.com/game/mobile-legends-kh1",
          browserHtml: true,
          actions: [{ action: "evaluate", source: script }],
          sessionContext: [{ name: "id", value: `zurs-live-probe-${Date.now().toString(36)}` }],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      expect(response.status).not.toBe(401);
      expect(response.ok).toBe(true);
      const payload = (await response.json()) as { statusCode?: number; browserHtml?: string };
      expect(payload.statusCode).toBe(200);
      const match = payload.browserHtml?.match(/<pre id="ncs-check-result">NCS:([^<]+)<\/pre>/);
      expect(match?.[1]).toBeTruthy();
      const result = JSON.parse(decodeURIComponent(match![1]!)) as { httpStatus: number; body: string };
      expect(result.httpStatus).toBe(200);
      // The intentionally-unknown id must produce a parseable verdict, proving the
      // full browser → CSRF → /check-user round-trip works end to end.
      const verdict = JSON.parse(result.body) as { status?: number };
      expect([0, 1]).toContain(verdict.status);
    }, 90_000);
  }
);
