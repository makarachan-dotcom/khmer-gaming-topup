import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("animated Back button contract", () => {
  it("uses the owner-supplied asset only after click and retains an accessible static fallback", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/AnimatedBackButton.tsx"), "utf8");
    expect(source).toContain("/manus-storage/lottieflow-back-arrow_74481687.json");
    expect(source).toContain("autoplay: false");
    expect(source).toContain("loop: true");
    expect(source).toContain("animationRef.current?.play()");
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("<ArrowLeft");
  });
});
