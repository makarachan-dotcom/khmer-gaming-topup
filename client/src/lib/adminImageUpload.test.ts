import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin image upload resilience", () => {
  it("validates supported source files and compresses raster images below the server payload limit", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/adminImageUpload.ts"), "utf8");
    expect(source).toContain('new Set(["image/jpeg", "image/png", "image/webp"])');
    expect(source).toContain("const maxSourceBytes = 12 * 1024 * 1024");
    expect(source).toContain("const maxPreparedBytes = 4_500_000");
    expect(source).toContain('for (const contentType of ["image/webp", "image/jpeg"] as const)');
    expect(source).toContain("for (const quality of [0.86, 0.76, 0.66, 0.56])");
    expect(source).toContain("មិនអាចបង្រួមរូបភាពឲ្យសមស្របសម្រាប់ upload បានទេ");
  });

  it("uses the hardened preprocessor and clear feedback in Admin game/package artwork controls", () => {
    const gameImages = readFileSync(resolve(process.cwd(), "client/src/pages/AdminGameImages.tsx"), "utf8");
    const packageArtwork = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPackageArtwork.tsx"), "utf8");
    expect(gameImages).toContain('prepareAdminImage(file, slot === "logo" ? "square" : "card")');
    expect(packageArtwork).toContain('prepareAdminImage(file, "card")');
    expect(packageArtwork).toContain("await upload.mutateAsync");
    expect(packageArtwork).toContain("await save.mutateAsync");
    expect(packageArtwork).toContain("let uploadedMediaUrl: string | null = null");
    expect(packageArtwork).toContain("setMediaUrl(uploadedMediaUrl ?? previousMediaUrl)");
    expect(packageArtwork).toContain("Upload និងរក្សាទុក");
    expect(packageArtwork).toContain("អ្នកប្រើប្រាស់អាចឃើញរូបថ្មីភ្លាមៗ");
    expect(packageArtwork).toContain("សូមជ្រើសហ្គេម និងកញ្ចប់សិន");
    expect(packageArtwork).toContain("setWarning(prepared.warning)");
    expect(packageArtwork).toContain("មិនអាច upload រូបភាពកញ្ចប់បានទេ");
  });
});
