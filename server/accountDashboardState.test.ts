import { describe, expect, it } from "vitest";
import { getAccountDashboardState } from "../client/src/lib/accountDashboardState";

describe("Account dashboard onboarding state", () => {
  it("keeps the owner admin controls and history available before a display name is chosen", () => {
    const state = getAccountDashboardState({ email: "chanmakara672@gmail.com", role: "user", displayName: null });
    expect(state).toMatchObject({ authenticated: true, isAdmin: true, needsDisplayName: true, showLogout: true, showPurchaseHistory: true, showTransactionHistory: true });
  });
});
