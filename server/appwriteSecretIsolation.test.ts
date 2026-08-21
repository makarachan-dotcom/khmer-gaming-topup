import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function textFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return textFiles(path);
    return /\.(ts|tsx|js|jsx|html|css)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

describe("Appwrite secret isolation", () => {
  it("does not expose the server API key to client source files", async () => {
    const files = await textFiles(new URL("../client", import.meta.url).pathname);
    const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
    expect(contents.join("\n")).not.toContain("APPWRITE_API_KEY");
  });
});
