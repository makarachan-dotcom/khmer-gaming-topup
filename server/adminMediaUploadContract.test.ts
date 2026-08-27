import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const uploadSource = readFileSync(resolve(process.cwd(), "server/uploads.ts"), "utf8");

describe("Admin media upload contract", () => {
  it("verifies Appwrite-backed media can be read before returning its managed URL", () => {
    expect(uploadSource).toContain('import { getAppwriteMediaFile, isAppwriteMediaKey, storagePut } from "./storage";');
    expect(uploadSource).toContain("const stored = await storagePut(`admin-media/${input.adminUserId}/${safeName}-${nanoid(8)}.${extension}`, bytes, input.contentType);");
    expect(uploadSource).toContain("isAppwriteMediaKey(stored.key) && !(await getAppwriteMediaFile(stored.key))");
    expect(uploadSource).toContain("storage មិនអាចអានបាន");
  });
});
