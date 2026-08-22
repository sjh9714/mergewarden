import { describe, expect, it } from "vitest";

import { sha256Hex, utf8ByteLength, utf8Prefix } from "../src/text.js";

describe("browser-safe text utilities", () => {
  it("matches the SHA-256 standard vector", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("counts and truncates UTF-8 without splitting code points", () => {
    expect(utf8ByteLength("A한😀")).toBe(8);
    expect(utf8Prefix("A한😀", 4)).toBe("A한");
    expect(utf8Prefix("A한😀", 5)).toBe("A한");
    expect(utf8Prefix("A한😀", 8)).toBe("A한😀");
  });
});
