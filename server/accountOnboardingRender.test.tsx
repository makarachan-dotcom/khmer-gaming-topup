// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 300001, openId: "owner", email: "chanmakara672@gmail.com", name: "Chan Makara", displayName: null, role: "user" },
    loading: false,
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/components/StorefrontLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    auth: { setMemberDisplayName: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) } },
    orders: {
      mine: { useQuery: () => ({ data: [], isLoading: false }) },
      paymentHistory: { useQuery: () => ({ data: [], isLoading: false }) },
    },
  },
}));

import Account from "../client/src/pages/Account";

describe("Account onboarding dashboard", () => {
  it("renders admin recognition, logout, purchase history, and transaction history before choosing a display name", () => {
    render(<Account />);
    expect(screen.getByText("ZURS Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ZURS AI" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ចាកចេញ" })).toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByText("ប្រវត្តិការទិញ")).toBeInTheDocument();
    expect(screen.getByText("ប្រវត្តិប្រតិបត្តិការ")).toBeInTheDocument();
    expect(screen.getByText("បង្កើតឈ្មោះ ZURS Member")).toBeInTheDocument();
  });
});
