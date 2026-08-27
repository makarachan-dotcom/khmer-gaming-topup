import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Admin Contact save contract", () => {
  it("accepts native time-input H:mm values instead of an accidentally escaped digit pattern", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(router).toContain("workingHoursStart: z.string().regex(/^(?:[01]\\d|2[0-3]):[0-5]\\d$/)");
    expect(router).toContain("workingHoursEnd: z.string().regex(/^(?:[01]\\d|2[0-3]):[0-5]\\d$/)");
    expect(router).not.toContain("workingHoursStart: z.string().regex(/^(?:[01]\\\\d|2[0-3]):[0-5]\\\\d$/)");
  });

  it("normalizes managed photos, refreshes public consumers, and never renders raw mutation JSON", () => {
    const editor = readFileSync(resolve(process.cwd(), "client/src/pages/AdminContactAdmins.tsx"), "utf8");
    const sheet = readFileSync(resolve(process.cwd(), "client/src/components/ContactAdminControl.tsx"), "utf8");
    expect(editor).toContain('notifyPublicAssetChanged("contact-admins")');
    expect(editor).toContain("toWebsiteMediaUrl(draft.photoUrl)");
    expect(editor).toContain("មិនអាចរក្សាទុកព័ត៌មាន Admin បានទេ");
    expect(editor).not.toContain("save.error?.message");
    expect(sheet).toContain("toWebsiteMediaUrl(admin.photoUrl)");
    expect(sheet).toContain('area === "contact-admins"');
    expect(sheet).toContain("refetchInterval: 5_000");
  });
});
