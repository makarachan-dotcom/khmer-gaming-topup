import { describe, expect, it } from "vitest";
import { validateAdminRoleChange } from "./adminRoles";

describe("admin role safety", () => {
  it("prevents self-lockout of the designated owner administrator", () => {
    expect(() => validateAdminRoleChange({ targetEmail: "chanmakara672@gmail.com", previousRole: "admin", nextRole: "user", confirmationEmail: "chanmakara672@gmail.com", reason: "Owner account protection check" })).toThrow("cannot be demoted");
  });
  it("requires target-email confirmation and an audit reason", () => {
    expect(() => validateAdminRoleChange({ targetEmail: "member@example.com", previousRole: "user", nextRole: "admin", confirmationEmail: "wrong@example.com", reason: "Grant trusted operations access" })).toThrow("Confirm");
  });
});
