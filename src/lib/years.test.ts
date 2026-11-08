import { describe, expect, it } from "vitest";
import { eraOf, formatYear, nearestIndex, yearParts } from "./years";

const en = { bce: "BCE", ce: "CE" };
const tr = { bce: "MÖ", ce: "MS" };

describe("formatYear", () => {
  it("marks BCE years and early CE years, but not ordinary modern years", () => {
    expect(formatYear(-323, "en", en)).toBe("323 BCE");
    expect(formatYear(300, "en", en)).toBe("300 CE");
    expect(formatYear(1492, "en", en)).toBe("1492");
  });

  it("puts the marker first in Turkish", () => {
    expect(formatYear(-323, "tr", tr)).toBe("MÖ 323");
    expect(formatYear(1492, "tr", tr)).toBe("1492");
  });

  it("groups digits only for very old dates", () => {
    expect(formatYear(-123_000, "en", en)).toBe("123,000 BCE");
    expect(formatYear(-123_000, "tr", tr)).toBe("MÖ 123.000");
    expect(yearParts(-8000, "en", en).value).toBe("8000");
  });
});

describe("eraOf", () => {
  it.each([
    [-10_000, "prehistory"],
    [-3000, "ancient"],
    [499, "ancient"],
    [500, "medieval"],
    [1492, "medieval"],
    [1500, "earlyModern"],
    [1815, "modern"],
  ] as const)("%i is %s", (year, era) => {
    expect(eraOf(year)).toBe(era);
  });
});

describe("nearestIndex", () => {
  const years = [-500, 100, 1000, 1492];

  it("finds the closest year", () => {
    expect(nearestIndex(years, 1453)).toBe(3);
    expect(nearestIndex(years, -10_000)).toBe(0);
    expect(nearestIndex(years, 2026)).toBe(3);
  });

  it("prefers the earlier year on a tie", () => {
    expect(nearestIndex(years, 550)).toBe(1);
  });
});
