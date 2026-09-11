import { describe, expect, it } from "vitest";
import { getAccountDashboardState } from "../client/src/lib/accountDashboardState";

describe("Account dashboard onboarding state", () => {
  it("keeps the owner admin controls and history available before a display name is chosen", () => {
    const state = getAccountDashboardState({ email: "chanmakara672@gmail.com", role: "user", displayName: null });
    expect(state).toMatchObject({ authenticated: true, isAdmin: true, needsDisplayName: true, showLogout: true, showPurchaseHistory: true, showTransactionHistory: true });
  });

  it("does not ask for a name again after one has been saved", () => {
    const state = getAccountDashboardState({ email: "member@example.com", role: "user", displayName: "Makara ZURS Member" });
    expect(state.needsDisplayName).toBe(false);
  });
});
