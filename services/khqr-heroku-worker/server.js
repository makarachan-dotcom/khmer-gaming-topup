"use strict";

require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { checkTransactionByMd5, renewAccessToken } = require("./bakong");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const POLL_INTERVAL_MS = boundedNumber(process.env.POLL_INTERVAL_MS, 3_500, 3_000, 15_000);
const CALLBACK_RETRY_BASE_MS = boundedNumber(process.env.CALLBACK_RETRY_BASE_MS, 5_000, 3_000, 60_000);
const MAX_CALLBACK_ATTEMPTS = boundedNumber(process.env.MAX_CALLBACK_ATTEMPTS, 8, 1, 20);
const MAX_ACTIVE_WATCHES = boundedNumber(process.env.MAX_ACTIVE_WATCHES, 500, 1, 5_000);
const TOKEN_RENEW_INTERVAL_MS = boundedNumber(process.env.BAKONG_TOKEN_RENEW_INTERVAL_MS, 50 * 60 * 1_000, 60_000, 24 * 60 * 60 * 1_000);
const BAKONG_API_BASE_URL = normalizedHttpsUrl(process.env.BAKONG_API_BASE_URL || "https://api-bakong.nbc.gov.kh");
const WORKER_API_KEY = requiredSecret("WORKER_API_KEY", 32);
const CALLBACK_HMAC_SECRET = requiredSecret("CALLBACK_HMAC_SECRET", 32);
const BAKONG_REGISTERED_EMAIL = requiredText("BAKONG_REGISTERED_EMAIL");
const DATABASE_URL = requiredText("DATABASE_URL");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
});

let accessToken = process.env.BAKONG_ACCESS_TOKEN?.trim() || "";
let tokenRenewedAt = accessToken ? Date.now() : 0;
let processing = false;

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: false }));
app.use(express.json({ limit: "16kb", type: "application/json" }));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ ok: true, service: "khqr-payment-worker" });
  } catch {
    return res.status(503).json({ ok: false, service: "khqr-payment-worker" });
  }
});

app.post(["/api/track-payment", "/api/payments/watch"], requireWorkerApiKey, async (req, res) => {
  try {
    const watch = parseWatchRequest(req.body);
    const result = await upsertWatch(watch);
    return res.status(result.created ? 201 : 200).json({ ok: true, accepted: true, duplicate: !result.created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payment watch request";
    const status = /conflict|limit|expired/i.test(message) ? 409 : 400;
    return res.status(status).json({ ok: false, error: message });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: "not found" }));

async function start() {
  await initializeDatabase();
  app.listen(PORT, () => console.log(JSON.stringify({ event: "worker.started", port: PORT })));
  void runLoop();
  setInterval(() => void runLoop(), POLL_INTERVAL_MS).unref();
}

async function runLoop() {
  if (processing) return;
  processing = true;
  try {
    const watches = await claimDueWatches();
    for (const watch of watches) {
      try {
        await processWatch(watch);
      } catch (error) {
        await scheduleRetry(watch.md5, `worker_error:${safeErrorCode(error)}`);
      }
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "worker.loop_error", code: safeErrorCode(error) }));
  } finally {
    processing = false;
  }
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS khqr_payment_watches (
      md5 varchar(128) PRIMARY KEY,
      order_id varchar(128) NOT NULL,
      amount numeric(18, 6) NOT NULL,
      currency varchar(3) NOT NULL,
      expires_at timestamptz NOT NULL,
      callback_url text NOT NULL,
      status varchar(48) NOT NULL DEFAULT 'pending',
      callback_event varchar(64),
      poll_attempts integer NOT NULL DEFAULT 0,
      callback_attempts integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      last_error varchar(160),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS khqr_payment_watches_due_idx ON khqr_payment_watches (status, next_attempt_at)");
}

async function upsertWatch(watch) {
  const active = await pool.query("SELECT count(*)::int AS count FROM khqr_payment_watches WHERE status IN ('pending', 'callback_pending')");
  const activeCount = Number(active.rows[0]?.count || 0);
  const existing = await pool.query("SELECT md5, order_id, amount::text AS amount, currency, callback_url, expires_at FROM khqr_payment_watches WHERE md5 = $1", [watch.md5]);
  if (existing.rowCount) {
    const saved = existing.rows[0];
    if (saved.order_id !== watch.orderId || Number(saved.amount) !== Number(watch.amount) || saved.currency !== watch.currency || saved.callback_url !== watch.callbackUrl || new Date(saved.expires_at).getTime() !== watch.expiresAt.getTime()) throw new Error("payment watch conflict");
    return { created: false };
  }
  if (activeCount >= MAX_ACTIVE_WATCHES) throw new Error("active watch limit reached");
  await pool.query(
    "INSERT INTO khqr_payment_watches (md5, order_id, amount, currency, expires_at, callback_url) VALUES ($1, $2, $3, $4, $5, $6)",
    [watch.md5, watch.orderId, watch.amount, watch.currency, watch.expiresAt, watch.callbackUrl],
  );
  return { created: true };
}

async function claimDueWatches() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      SELECT md5, order_id, amount::text AS amount, currency, expires_at, callback_url, status, callback_event, callback_attempts
      FROM khqr_payment_watches
      WHERE status IN ('pending', 'callback_pending') AND next_attempt_at <= now()
      ORDER BY next_attempt_at ASC
      LIMIT 25
      FOR UPDATE SKIP LOCKED
    `);
    for (const watch of result.rows) {
      await client.query(
        "UPDATE khqr_payment_watches SET next_attempt_at = now() + ($2 || ' milliseconds')::interval, updated_at = now() WHERE md5 = $1",
        [watch.md5, POLL_INTERVAL_MS],
      );
    }
    await client.query("COMMIT");
    return result.rows.map(rowToWatch);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function processWatch(watch) {
  if (watch.status === "callback_pending") return dispatchCallback(watch);
  const expired = Date.now() >= watch.expiresAt.getTime();
  // Always perform one final official MD5 lookup before sending an expiry event.
  // A payment that lands immediately before the five-minute deadline must still
  // be sent through the main site's exact reconciliation path as payment.paid.
  const outcome = await pollBakong(watch.md5);
  if (outcome.kind === "paid") return queueCallback(watch, "payment.paid");
  if (outcome.kind === "rate_limited") return queueCallback(watch, "payment.verification_deferred", "bakong_daily_request_limit");
  if (expired) return queueCallback(watch, "payment.expired");
  if (outcome.kind === "unpaid") return scheduleRetry(watch.md5, null, true);
  return scheduleRetry(watch.md5, outcome.code);
}

async function pollBakong(md5) {
  let token = await getAccessToken(false);
  let response = await checkTransactionByMd5({ baseUrl: BAKONG_API_BASE_URL, token, md5 });
  if (response.httpStatus === 401 || response.payload?.errorCode === 6) {
    token = await getAccessToken(true);
    response = await checkTransactionByMd5({ baseUrl: BAKONG_API_BASE_URL, token, md5 });
  }
  if (response.httpStatus === 429) return { kind: "rate_limited" };
  if (response.payload?.responseCode === 0 && response.payload?.data?.hash) return { kind: "paid" };
  if (response.payload?.responseCode === 1 && [1, 3, 17].includes(Number(response.payload?.errorCode))) return { kind: "unpaid" };
  return { kind: "unavailable", code: `bakong_${response.httpStatus}_${response.payload?.responseCode ?? "none"}_${response.payload?.errorCode ?? "none"}` };
}

async function getAccessToken(forceRenew) {
  const shouldRenew = forceRenew || !accessToken || Date.now() - tokenRenewedAt >= TOKEN_RENEW_INTERVAL_MS;
  if (!shouldRenew) return accessToken;
  const renewed = await renewAccessToken({ baseUrl: BAKONG_API_BASE_URL, email: BAKONG_REGISTERED_EMAIL });
  if (!renewed) {
    if (accessToken && !forceRenew) return accessToken;
    throw new Error("bakong_token_renewal_failed");
  }
  accessToken = renewed;
  tokenRenewedAt = Date.now();
  return accessToken;
}

async function queueCallback(watch, event, reason) {
  await pool.query(
    "UPDATE khqr_payment_watches SET status = 'callback_pending', callback_event = $2, next_attempt_at = now(), last_error = $3, updated_at = now() WHERE md5 = $1 AND status = 'pending'",
    [watch.md5, event, reason || null],
  );
  return dispatchCallback({ ...watch, status: "callback_pending", callbackEvent: event, callbackAttempts: watch.callbackAttempts || 0 });
}

async function dispatchCallback(watch) {
  const event = watch.callbackEvent;
  if (!["payment.paid", "payment.expired", "payment.verification_deferred"].includes(event)) return scheduleRetry(watch.md5, "missing_callback_event");
  const payload = {
    event,
    ...(event === "payment.verification_deferred" ? { reason: "bakong_daily_request_limit" } : {}),
    md5: watch.md5,
    orderId: watch.orderId,
    amount: watch.amount,
    currency: watch.currency,
    timestamp: new Date().toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", CALLBACK_HMAC_SECRET).update(rawBody).digest("hex");
  try {
    const response = await fetch(watch.callbackUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-khqr-signature": signature },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`callback_http_${response.status}`);
    const terminalStatus = event === "payment.paid" ? "paid" : event === "payment.expired" ? "expired" : "verification_deferred";
    await pool.query("UPDATE khqr_payment_watches SET status = $2, updated_at = now(), last_error = NULL WHERE md5 = $1", [watch.md5, terminalStatus]);
  } catch (error) {
    const attempts = (watch.callbackAttempts || 0) + 1;
    if (attempts >= MAX_CALLBACK_ATTEMPTS) {
      await pool.query("UPDATE khqr_payment_watches SET status = 'callback_failed', callback_attempts = $2, last_error = $3, updated_at = now() WHERE md5 = $1", [watch.md5, attempts, safeErrorCode(error)]);
      console.error(JSON.stringify({ event: "worker.callback_failed", md5: redactMd5(watch.md5), code: safeErrorCode(error) }));
      return;
    }
    const delay = Math.min(CALLBACK_RETRY_BASE_MS * (2 ** Math.min(attempts - 1, 5)), 60_000);
    await pool.query("UPDATE khqr_payment_watches SET status = 'callback_pending', callback_attempts = $2, next_attempt_at = now() + ($3 || ' milliseconds')::interval, last_error = $4, updated_at = now() WHERE md5 = $1", [watch.md5, attempts, delay, safeErrorCode(error)]);
  }
}

async function scheduleRetry(md5, errorCode, unpaid = false) {
  await pool.query(
    "UPDATE khqr_payment_watches SET poll_attempts = poll_attempts + 1, next_attempt_at = now() + ($2 || ' milliseconds')::interval, last_error = $3, updated_at = now() WHERE md5 = $1 AND status = 'pending'",
    [md5, POLL_INTERVAL_MS, errorCode || (unpaid ? null : "bakong_unavailable")],
  );
}

function requireWorkerApiKey(req, res, next) {
  const candidate = req.get("x-api-key") || "";
  if (!safeEqual(candidate, WORKER_API_KEY)) return res.status(401).json({ ok: false, error: "unauthorized" });
  return next();
}

function parseWatchRequest(input) {
  if (!input || typeof input !== "object") throw new Error("invalid request body");
  const md5 = typeof input.md5 === "string" ? input.md5.trim().toLowerCase() : "";
  const orderId = typeof input.orderId === "string" ? input.orderId.trim() : "";
  const amount = typeof input.amount === "string" || typeof input.amount === "number" ? String(input.amount).trim() : "";
  const currency = input.currency === "KHR" || input.currency === "USD" ? input.currency : "";
  const callbackUrl = typeof input.callbackUrl === "string" ? input.callbackUrl.trim() : "";
  const expiresAt = new Date(typeof input.expiresAt === "string" ? input.expiresAt : "");
  if (!/^[a-f0-9]{16,128}$/.test(md5)) throw new Error("invalid md5");
  if (!/^(?:wallet:)?[A-Za-z0-9_-]{4,120}$/.test(orderId)) throw new Error("invalid orderId");
  if (!/^\d+(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) throw new Error("invalid amount");
  if (!currency) throw new Error("invalid currency");
  if (!normalizedHttpsUrl(callbackUrl)) throw new Error("invalid callbackUrl");
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 30 * 60 * 1_000) throw new Error("invalid or expired payment window");
  return { md5, orderId, amount, currency, callbackUrl, expiresAt };
}

function rowToWatch(row) {
  return {
    md5: row.md5,
    orderId: row.order_id,
    amount: String(row.amount),
    currency: row.currency,
    expiresAt: new Date(row.expires_at),
    callbackUrl: row.callback_url,
    status: row.status,
    callbackEvent: row.callback_event,
    callbackAttempts: Number(row.callback_attempts || 0),
  };
}

function requiredText(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredSecret(name, minimumLength) {
  const value = requiredText(name);
  if (value.length < minimumLength) throw new Error(`${name} must be at least ${minimumLength} characters`);
  return value;
}

function normalizedHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.toString().replace(/\/$/, "");
  } catch { return ""; }
}

function boundedNumber(raw, fallback, minimum, maximum) {
  const value = Number.parseInt(raw || "", 10);
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function safeErrorCode(error) {
  const message = error instanceof Error ? error.message : "unknown";
  return message.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 160);
}

function redactMd5(value) {
  return value.length <= 8 ? "[redacted]" : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

start().catch((error) => {
  console.error(JSON.stringify({ event: "worker.start_failed", code: safeErrorCode(error) }));
  process.exit(1);
});
