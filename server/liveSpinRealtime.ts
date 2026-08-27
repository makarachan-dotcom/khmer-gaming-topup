import Ably from "ably";
import { getPublicLiveSpinState } from "./liveSpinStore";

const LIVE_SPIN_CHANNEL_PREFIX = "zurs-live-spin:";
const LIVE_SPIN_TOKEN_TTL_MS = 10 * 60 * 1000;

function client() {
  const key = process.env.ABLY_API_KEY?.trim();
  return key ? new Ably.Rest({ key }) : null;
}

function channelName(eventId: string) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(eventId)) throw new Error("Invalid Live Spin event id.");
  return `${LIVE_SPIN_CHANNEL_PREFIX}${eventId}`;
}

/**
 * Clients receive subscribe-only tokens scoped to exactly one public event
 * channel. The ABLY_API_KEY remains server-only and is never returned.
 */
export async function createLiveSpinSubscriberToken(eventId: string) {
  const state = await getPublicLiveSpinState();
  if (!state.event || state.event.id !== eventId) throw new Error("This Live Spin event is not currently available.");
  const realtime = client();
  if (!realtime) return { enabled: false as const, tokenRequest: null };
  const name = channelName(eventId);
  const tokenRequest = await realtime.auth.createTokenRequest({
    clientId: `viewer-${crypto.randomUUID()}`,
    ttl: LIVE_SPIN_TOKEN_TTL_MS,
    capability: { [name]: ["subscribe"] },
  });
  return { enabled: true as const, tokenRequest, channelName: name };
}

/** Publishes only the sanitized public state after an authoritative server state change. */
export async function publishLiveSpinState(eventId: string) {
  const realtime = client();
  if (!realtime) return { published: false as const, reason: "realtime_not_configured" as const };
  const state = await getPublicLiveSpinState();
  if (!state.event || state.event.id !== eventId) return { published: false as const, reason: "event_not_public" as const };
  await realtime.channels.get(channelName(eventId)).publish("state", state);
  return { published: true as const };
}

export function isLiveSpinRealtimeConfigured() {
  return Boolean(process.env.ABLY_API_KEY?.trim());
}
