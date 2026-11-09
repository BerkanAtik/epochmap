import { describe, expect, it } from "vitest";
import { hash, PALETTE, paletteColor } from "./colors";

describe("paletteColor", () => {
  it("returns a CSS colour for any index, wrapping around the palette", () => {
    expect(paletteColor(0)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(paletteColor(PALETTE.length)).toBe(paletteColor(0));
    expect(paletteColor(-1)).toBe(paletteColor(1));
  });
});

describe("hash", () => {
  it("is stable, so unconstrained polities keep their colour between builds", () => {
    expect(hash("Q12560")).toBe(hash("Q12560"));
    expect(hash("Q12560")).not.toBe(hash("Q2277"));
  });
});
