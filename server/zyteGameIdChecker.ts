/**
 * Server-only Game ID / player-name checks through the owner-approved
 * nevercrystore.com `/check-user` endpoint, reached through the Zyte API
 * browser so the store's datacenter IP never touches the Cloudflare-protected
 * target directly. The Zyte credential stays server-side only: it is never
 * logged, returned to clients, or exposed in any response payload.
 *
 * Flow (one bounded Zyte browser request per attempt):
 *   1. Zyte loads the public nevercrystore game page in a real browser, which
 *      clears the anti-bot gate and yields the in-page CSRF token + session.
 *   2. A Zyte `evaluate` action runs `fetch("/check-user")` inside that same
 *      page/session and publishes the raw JSON response into a
 *      `<pre id="ncs-check-result">` DOM node (URI-encoded, so no HTML entity
 *      ambiguity can corrupt the payload).
 *   3. The node is read back from the returned `browserHtml` and parsed.
 *
 * Live-verified on 2026-08-23 with the owner-supplied Zyte credential: an
 * unknown Mobile Legends id returned `{"status":0,"error_msg":"USER ID ..."}`
 * through this exact flow, proving end-to-end reachability of the check API.
 *
 * Rotation contract: this module performs at most two Zyte attempts (the
 * second only after a session/CSRF failure) and never loops. Callers compose
 * it inside their own finite authorized provider chain.
 */
import { z } from "zod";

const ZYTE_API_URL = "https://api.zyte.com/v1/extract";
const NCS_ORIGIN = "https://nevercrystore.com";
const ZYTE_REQUEST_TIMEOUT_MS = 45_000;
const ZYTE_SESSION_TTL_MS = 15 * 60_000;

type NcsFieldKind = "user_server" | "player";

type NcsGameConfig = { categoryId: string; kind: NcsFieldKind; pageSlug: string };

/**
 * FZR catalog id prefix → owner-approved nevercrystore `/check-user` mapping.
 * Only games present in the owner-approved public catalog are mapped; extend
 * this list explicitly when a new sellable game gains nevercrystore coverage.
 */
const NCS_GAME_MAP: Array<{ pattern: RegExp; config: NcsGameConfig }> = [
  { pattern: /^mobile_legends/i, config: { categoryId: "23", kind: "user_server", pageSlug: "mobile-legends-kh1" } },
  { pattern: /^magic_chess/i, config: { categoryId: "25", kind: "user_server", pageSlug: "magic-chess-gogo" } },
  { pattern: /^free_fire/i, config: { categoryId: "21", kind: "player", pageSlug: "free-fire-sgmy" } },
  { pattern: /^pubg/i, config: { categoryId: "27", kind: "player", pageSlug: "pubg-mobile" } },
  { pattern: /^honor_of_kings/i, config: { categoryId: "22", kind: "player", pageSlug: "honor-of-kings-1" } },
];

export type ZyteGameIdCheckResult =
  | { status: "verified"; playerName: string }
  | { status: "invalid" }
  | { status: "not_supported" }
  | { status: "unavailable" };

const ncsPageSuccessSchema = z.object({
  status: z.literal(1),
  data: z.object({ username: z.string().trim().min(1).max(180) }),
});

const zyteExtractSchema = z.object({
  statusCode: z.number().int().optional(),
  browserHtml: z.string().optional(),
});

let cachedSession: { id: string; createdAt: number } | null = null;

/** Reuse one Zyte session per process for up to 15 minutes so repeated checks share the cleared browser session (fewer credits, faster checks). */
function zyteSessionId(forceRefresh = false) {
  if (!forceRefresh && cachedSession && Date.now() - cachedSession.createdAt < ZYTE_SESSION_TTL_MS) return cachedSession.id;
  cachedSession = { id: `zurs-ncs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, createdAt: Date.now() };
  return cachedSession.id;
}

function ncsGameConfig(gameId: string): NcsGameConfig | null {
  return NCS_GAME_MAP.find((entry) => entry.pattern.test(gameId))?.config ?? null;
}

function ncsIdentityFields(config: NcsGameConfig, fields: Record<string, string>) {
  const playerId = (fields.player_id ?? fields.user_id ?? fields.id ?? "").trim();
  if (!/^\d{4,20}$/.test(playerId)) return null;
  if (config.kind === "player") return { playerId, serverId: null as string | null };
  const serverId = (fields.server_id ?? fields.zone_id ?? fields.server ?? "").trim();
  if (!/^\d{1,12}$/.test(serverId)) return null;
  return { playerId, serverId };
}

/** In-page script executed by the Zyte browser: posts the check form with the page's own CSRF token and publishes the raw response into the DOM. */
function ncsCheckPageScript(config: NcsGameConfig, ids: { playerId: string; serverId: string | null }) {
  const formEntries: Array<[string, string]> = [
    ["game_code", "mobilelegend"],
    ["category_id", config.categoryId],
  ];
  if (config.kind === "user_server") {
    formEntries.push(["user_id", ids.playerId]);
    if (ids.serverId) formEntries.push(["server_id", ids.serverId]);
  } else {
    formEntries.push(["player_id", ids.playerId]);
  }
  return `(async () => {
  const publish = (value) => {
    const node = document.createElement("pre");
    node.id = "ncs-check-result";
    node.textContent = "NCS:" + encodeURIComponent(JSON.stringify(value));
    document.body.appendChild(node);
  };
  try {
    const token = document.querySelector('meta[name="csrf-token"]')?.content || "";
    const form = new URLSearchParams();
    ${formEntries.map(([key, value]) => `form.set(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join("\n    ")}
    const response = await fetch("/check-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-CSRF-TOKEN": token,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: form.toString(),
    });
    publish({ httpStatus: response.status, body: await response.text() });
  } catch (error) {
    publish({ httpStatus: 0, error: String((error && error.message) || error) });
  }
})();`;
}

function extractNcsResult(browserHtml: string) {
  const match = browserHtml.match(/<pre id="ncs-check-result">NCS:([^<]+)<\/pre>/);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as { httpStatus?: unknown; body?: unknown };
    if (typeof parsed?.httpStatus !== "number") return null;
    return { httpStatus: parsed.httpStatus, body: typeof parsed.body === "string" ? parsed.body : null };
  } catch {
    return null;
  }
}

async function zyteExtract(payload: Record<string, unknown>, apiKey: string) {
  const response = await fetch(ZYTE_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(ZYTE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Zyte extract request failed (${response.status})`);
  return zyteExtractSchema.parse(await response.json());
}

/**
 * Check one player id through the owner-approved nevercrystore route.
 * Returns `not_supported` for games outside the approved map, `unavailable`
 * when the Zyte credential is missing or every bounded attempt fails, and
 * never throws: rotation decisions stay with the caller.
 */
export async function checkProviderGameIdViaZyte(gameId: string, fields: Record<string, string>): Promise<ZyteGameIdCheckResult> {
  const config = ncsGameConfig(gameId);
  if (!config) return { status: "not_supported" };
  const apiKey = process.env.ZYTE_API_KEY;
  if (!apiKey) return { status: "unavailable" };
  const ids = ncsIdentityFields(config, fields);
  if (!ids) return { status: "invalid" };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let extract: z.infer<typeof zyteExtractSchema>;
    try {
      extract = await zyteExtract(
        {
          url: `${NCS_ORIGIN}/game/${config.pageSlug}`,
          browserHtml: true,
          actions: [{ action: "evaluate", source: ncsCheckPageScript(config, ids) }],
          sessionContext: [{ name: "id", value: zyteSessionId(attempt === 1) }],
        },
        apiKey,
      );
    } catch {
      if (attempt === 0) continue;
      return { status: "unavailable" };
    }
    if (extract.statusCode !== 200 || !extract.browserHtml) {
      if (attempt === 0) continue;
      return { status: "unavailable" };
    }
    const result = extractNcsResult(extract.browserHtml);
    if (!result) {
      if (attempt === 0) continue;
      return { status: "unavailable" };
    }
    // CSRF/session expiry (Laravel 419) → exactly one retry on a fresh browser session.
    if (result.httpStatus === 419 && attempt === 0) continue;
    if (result.httpStatus !== 200 || !result.body) return { status: "unavailable" };

    let pagePayload: unknown;
    try {
      pagePayload = JSON.parse(result.body);
    } catch {
      return { status: "unavailable" };
    }
    const success = ncsPageSuccessSchema.safeParse(pagePayload);
    if (success.success) return { status: "verified", playerName: success.data.data.username };
    if (pagePayload && typeof pagePayload === "object" && (pagePayload as { status?: unknown }).status === 0) return { status: "invalid" };
    return { status: "unavailable" };
  }
  return { status: "unavailable" };
}
