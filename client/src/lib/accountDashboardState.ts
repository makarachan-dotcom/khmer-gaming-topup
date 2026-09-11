export type AccountDashboardIdentity = { role?: "admin" | "user" | null; email?: string | null; displayName?: string | null } | null | undefined;

export function getAccountDashboardState(user: AccountDashboardIdentity) {
  const authenticated = Boolean(user);
  const isAdmin = user?.role === "admin" || user?.email?.trim().toLowerCase() === "chanmakara672@gmail.com";
  return {
    authenticated,
    isAdmin,
    needsDisplayName: authenticated && !user?.displayName?.trim(),
    showLogout: authenticated,
    showPurchaseHistory: authenticated,
    showTransactionHistory: authenticated,
  };
}
