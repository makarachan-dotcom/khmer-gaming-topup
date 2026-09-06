import type { Request } from "express";

/**
 * User-Agent (plus Client Hints) -> a readable device description.
 *
 * Deliberately small and dependency-free. The admin ban table needs to say
 * "Samsung Galaxy A15 · Chrome · Android 14", not run a full device database.
 *
 * Client Hints are preferred when present, because a modern Chrome User-Agent
 * string is frozen and no longer contains the model at all — on Android it just
 * says "Android 10; K" forever. Without the hint there is genuinely no model to
 * report, and this module says so rather than inventing one.
 */

export type DeviceInsight = {
  /** Marketing name when we can resolve it, else the raw model code, else "". */
  model: string;
  os: string;
  browser: string;
  /** One-line summary for the admin table. Never empty. */
  label: string;
  kind: "phone" | "tablet" | "desktop" | "bot" | "unknown";
};

export type DeviceHints = {
  userAgent?: string | null;
  /** `sec-ch-ua-model` or our own `x-zurs-model` header. */
  model?: string | null;
  platform?: string | null;
  platformVersion?: string | null;
};

/**
 * Model codes common in the Cambodian market, mapped to the name a customer
 * would recognise. An unmatched code is still shown verbatim — a raw "SM-A155F"
 * is far more useful to an admin than a blank cell, so there is no reason to
 * hide it behind a lookup miss.
 */
const modelNames: Record<string, string> = {
  "SM-A155F": "Samsung Galaxy A15",
  "SM-A165F": "Samsung Galaxy A16",
  "SM-A245F": "Samsung Galaxy A24",
  "SM-A256E": "Samsung Galaxy A25",
  "SM-A346E": "Samsung Galaxy A34",
  "SM-A356E": "Samsung Galaxy A35",
  "SM-A546E": "Samsung Galaxy A54",
  "SM-A556E": "Samsung Galaxy A55",
  "SM-S911B": "Samsung Galaxy S23",
  "SM-S918B": "Samsung Galaxy S23 Ultra",
  "SM-S921B": "Samsung Galaxy S24",
  "SM-S928B": "Samsung Galaxy S24 Ultra",
  "CPH2557": "OPPO A18",
  "CPH2565": "OPPO A38",
  "CPH2591": "OPPO Reno 11",
  "CPH2617": "OPPO A60",
  "V2312": "vivo Y28",
  "V2325": "vivo Y18",
  "V2352": "vivo Y36",
  "23021RAAEG": "Redmi 12C",
  "23053RN02A": "Redmi 13C",
  "23129RN51X": "Redmi Note 13",
  "2201117TY": "Redmi Note 11",
  "22120RN86G": "Redmi Note 12",
  "24069RA21C": "Redmi Note 14",
  "M2101K6G": "Redmi Note 10 Pro",
  "TECNO KJ5": "TECNO Spark 20",
  "Infinix X6831": "Infinix Hot 30",
};

function cleanToken(value: string | null | undefined, max = 64) {
  if (typeof value !== "string") return "";
  // Strip quotes Client Hints wrap values in, plus control characters, so a
  // crafted header cannot break the admin table layout or inject markup.
  return value.replace(/^"|"$/g, "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);
}

function friendlyModel(raw: string) {
  if (!raw) return "";
  const exact = modelNames[raw];
  if (exact) return `${exact} (${raw})`;
  // Vendor prefixes worth naming even when the exact code is unknown.
  if (/^SM-/i.test(raw)) return `Samsung ${raw}`;
  if (/^CPH/i.test(raw)) return `OPPO ${raw}`;
  if (/^RMX/i.test(raw)) return `realme ${raw}`;
  if (/^V\d{4}/i.test(raw)) return `vivo ${raw}`;
  if (/^(Redmi|POCO|M\d{4})/i.test(raw)) return `Xiaomi ${raw}`;
  if (/^(TECNO|Infinix|itel)/i.test(raw)) return raw;
  return raw;
}

function detectBrowser(ua: string) {
  // Order matters: every Chromium browser also claims "Chrome", and every
  // Chromium browser on iOS also claims "Safari".
  if (/SamsungBrowser\/([\d.]+)/.test(ua)) return `Samsung Internet ${RegExp.$1.split(".")[0]}`;
  if (/EdgA?\/([\d.]+)/.test(ua)) return `Edge ${RegExp.$1.split(".")[0]}`;
  if (/OPR\/([\d.]+)|Opera/.test(ua)) return "Opera";
  if (/FBAV|FBAN|FB_IAB/.test(ua)) return "Facebook in-app";
  if (/Instagram/.test(ua)) return "Instagram in-app";
  if (/Line\//.test(ua)) return "LINE in-app";
  if (/CriOS\/([\d.]+)/.test(ua)) return `Chrome iOS ${RegExp.$1.split(".")[0]}`;
  if (/FxiOS\/([\d.]+)/.test(ua)) return `Firefox iOS ${RegExp.$1.split(".")[0]}`;
  if (/Firefox\/([\d.]+)/.test(ua)) return `Firefox ${RegExp.$1.split(".")[0]}`;
  if (/Chrome\/([\d.]+)/.test(ua)) return `Chrome ${RegExp.$1.split(".")[0]}`;
  if (/Version\/([\d.]+).*Safari/.test(ua)) return `Safari ${RegExp.$1.split(".")[0]}`;
  if (/Safari/.test(ua)) return "Safari";
  return "";
}

function detectOs(ua: string, hints: DeviceHints) {
  const platform = cleanToken(hints.platform, 24);
  const platformVersion = cleanToken(hints.platformVersion, 24);
  if (platform && platformVersion) return `${platform} ${platformVersion.split(".").slice(0, 2).join(".")}`;

  if (/iPhone OS ([\d_]+)/.test(ua)) return `iOS ${RegExp.$1.replace(/_/g, ".")}`;
  if (/CPU OS ([\d_]+)/.test(ua)) return `iPadOS ${RegExp.$1.replace(/_/g, ".")}`;
  if (/Android ([\d.]+)/.test(ua)) return `Android ${RegExp.$1}`;
  if (/Windows NT 10\.0/.test(ua)) return "Windows 10/11";
  if (/Windows NT ([\d.]+)/.test(ua)) return `Windows NT ${RegExp.$1}`;
  if (/Mac OS X ([\d_.]+)/.test(ua)) return `macOS ${RegExp.$1.replace(/_/g, ".")}`;
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return platform || "";
}

function detectModel(ua: string, hints: DeviceHints) {
  const hinted = cleanToken(hints.model, 48);
  if (hinted && hinted !== "K" && hinted !== "Unknown") return friendlyModel(hinted);

  // Apple never exposes the model, by design. Saying "iPhone" is the honest
  // ceiling here — claiming a specific iPhone would be a guess.
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";

  // Legacy Android UA strings still carry the model between the OS version and
  // the Build tag: "(Linux; Android 14; SM-A155F Build/UP1A...)".
  const android = /Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/|\)|;)/.exec(ua);
  if (android?.[1]) {
    const raw = cleanToken(android[1], 48);
    if (raw && raw !== "K" && !/^wv$/i.test(raw)) return friendlyModel(raw);
  }
  if (/Windows/.test(ua)) return "Windows PC";
  return "";
}

function detectKind(ua: string): DeviceInsight["kind"] {
  if (!ua) return "unknown";
  if (/bot|crawler|spider|curl|wget|python-requests|axios|postman/i.test(ua)) return "bot";
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return "tablet";
  if (/Mobi|iPhone|Android/.test(ua)) return "phone";
  if (/Windows|Macintosh|CrOS|Linux/.test(ua)) return "desktop";
  return "unknown";
}

export function describeDevice(hints: DeviceHints): DeviceInsight {
  const ua = cleanToken(hints.userAgent, 512);
  const model = detectModel(ua, hints);
  const os = detectOs(ua, hints);
  const browser = detectBrowser(ua);
  const kind = detectKind(ua);
  const parts = [model, browser, os].filter(Boolean);
  return {
    model,
    os,
    browser,
    // "Unknown device" is the correct answer when a client sends no UA at all.
    // A blank string in the admin table reads like a rendering bug instead.
    label: parts.length > 0 ? parts.join(" · ") : "Unknown device",
    kind,
  };
}

/**
 * Reads every device signal a request can carry. `x-zurs-model` is our own
 * header, filled in by the browser from `navigator.userAgentData`, because that
 * is the only way to learn an Android model from a modern Chromium build.
 */
export function deviceHintsFromRequest(req: Request): DeviceHints {
  const header = (name: string) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  };
  return {
    userAgent: header("user-agent"),
    model: header("x-zurs-model") ?? header("sec-ch-ua-model"),
    platform: header("x-zurs-platform") ?? header("sec-ch-ua-platform"),
    platformVersion: header("x-zurs-platform-version") ?? header("sec-ch-ua-platform-version"),
  };
}

export function describeRequestDevice(req: Request): DeviceInsight {
  return describeDevice(deviceHintsFromRequest(req));
}
