import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin media management contract", () => {
  it("keeps image uploading restricted to administrators and stored outside the client bundle", () => {
    const uploads = readFileSync(
      resolve(process.cwd(), "server/uploads.ts"),
      "utf8"
    );
    const router = readFileSync(
      resolve(process.cwd(), "server/routers.ts"),
      "utf8"
    );
    expect(uploads).toContain("uploadAdminMediaImage");
    expect(uploads).toContain("admin-media/${input.adminUserId}");
    expect(router).toContain("adminMediaImage: adminProcedure");
    expect(router).toContain('startsWith("/manus-storage/")');
  });

  it("supports many records and renders direct video media on the homepage as muted looping inline playback", () => {
    const adminMedia = readFileSync(
      resolve(process.cwd(), "client/src/pages/AdminMedia.tsx"),
      "utf8"
    );
    const home = readFileSync(
      resolve(process.cwd(), "client/src/pages/Home.tsx"),
      "utf8"
    );
    expect(adminMedia).toContain("Banner ថ្មី");
    expect(adminMedia).toContain("Promotion ថ្មី");
    expect(adminMedia).toContain("Announcement ថ្មី");
    expect(adminMedia).toContain("Upload រូបភាព");
    expect(adminMedia).toContain("MP4/WEBM/OGG URL");
    expect(home).toContain("trpc.content.active.useQuery");
    expect(home.replace(/\s+/g, " ")).toContain(
      "autoPlay={!prefersReducedMotion} loop muted playsInline"
    );
  });
});
