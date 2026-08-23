import { describe, expect, it } from "vitest";

describe.runIf(process.env.VITEST_LIVE_CREDENTIALS === "1")(
  "RapidAPI Game ID Checker credential",
  () => {
    it("authorizes the Mobile Legends name-check route without exposing account data", async () => {
      const apiKey = process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
      expect(apiKey).toMatch(/^[a-z0-9-]{30,}$/i);

      const response = await fetch(
        "https://id-game-checker.p.rapidapi.com/mobile-legends/1393323764/15748",
        {
          headers: {
            "x-rapidapi-host": "id-game-checker.p.rapidapi.com",
            "x-rapidapi-key": apiKey!,
          },
          signal: AbortSignal.timeout(15_000),
        }
      );
      const payload = (await response.json()) as {
        error?: boolean;
        success?: boolean;
        data?: { username?: string };
        msg?: string;
      };

      expect(response.ok).toBe(true);
      expect(payload.error).not.toBe(true);
      expect(payload.success).not.toBe(false);
      expect(payload.data?.username).toEqual(expect.any(String));
      expect(payload.data?.username?.trim().length).toBeGreaterThan(0);
    }, 20_000);
  }
);
