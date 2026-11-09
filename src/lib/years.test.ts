import { describe, expect, it } from "vitest";
import { clampYear, eraOf, formatSpans, nextIn, previousIn } from "./years";

describe("eraOf", () => {
  it.each([
    [0, "era.ancient"],
    [499, "era.ancient"],
    [500, "era.medieval"],
    [1453, "era.medieval"],
    [1500, "era.earlyModern"],
    [1815, "era.modern"],
    [2026, "era.contemporary"],
  ] as const)("English: %i is %s", (year, era) => {
    expect(eraOf(year, "en")).toBe(era);
  });

  it("follows Turkish school conventions in Turkish", () => {
    expect(eraOf(476, "tr")).toBe("era.medieval");
    expect(eraOf(1453, "tr")).toBe("era.earlyModern");
    expect(eraOf(1789, "tr")).toBe("era.modern");
  });
});

describe("clampYear", () => {
  it("keeps years inside the timeline and rounds them", () => {
    expect(clampYear(-50, 0, 2026)).toBe(0);
    expect(clampYear(3000, 0, 2026)).toBe(2026);
    expect(clampYear(1452.6, 0, 2026)).toBe(1453);
  });
});

describe("formatSpans", () => {
  it("joins spans and shows ongoing ones as running to today", () => {
    expect(
      formatSpans(
        [
          [395, 1226],
          [1279, 1453],
        ],
        2026,
        "2026",
      ),
    ).toBe("395–1226, 1279–1453");
    expect(formatSpans([[1924, 2026]], 2026, "today")).toBe("1924–today");
    expect(formatSpans([[1919, 1919]], 2026, "today")).toBe("1919");
  });
});

describe("previousIn / nextIn", () => {
  const changes = [100, 500, 1453, 1923];

  it("finds the closest change strictly before or after a year", () => {
    expect(previousIn(changes, 1453)).toBe(500);
    expect(previousIn(changes, 1500)).toBe(1453);
    expect(nextIn(changes, 1453)).toBe(1923);
    expect(nextIn(changes, 0)).toBe(100);
  });

  it("returns undefined at the ends", () => {
    expect(previousIn(changes, 100)).toBeUndefined();
    expect(nextIn(changes, 1923)).toBeUndefined();
  });
});
