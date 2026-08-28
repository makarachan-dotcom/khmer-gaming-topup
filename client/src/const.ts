export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Opens the owner-controlled Appwrite Email OTP login instead of an external OAuth portal. */
export const startLogin = (returnTo = `${window.location.pathname}${window.location.search}`) => {
  const safePath = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account";
  window.location.href = `/login?returnTo=${encodeURIComponent(safePath)}`;
};
