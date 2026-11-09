import { describe, expect, it } from "vitest";
import type { Polity } from "../data/atlas";
import { normalize, searchPolities } from "./search";

const polity = (id: string, en: string[], tr: string[], spans: [number, number][]): Polity => ({
  id,
  en,
  tr,
  spans,
  wiki: {},
});

const polities = [
  polity("Q12560", ["Ottoman Empire"], ["Osmanlı İmparatorluğu"], [[1305, 1923]]),
  polity("Q2277", ["Roman Empire"], ["Roma İmparatorluğu"], [[0, 394]]),
  polity("Q12548", ["Holy Roman Empire"], ["Kutsal Roma İmparatorluğu"], [[962, 1806]]),
  polity("Q218", ["Romania"], ["Romanya"], [[1881, 2026]]),
];

describe("normalize", () => {
  it("ignores case, diacritics and the Turkish dotless i", () => {
    expect(normalize("Osmanlı İmparatorluğu")).toBe("osmanli imparatorlugu");
    expect(normalize("Očhéthi Šakówiŋ")).toBe("ochethi sakowiŋ");
  });
});

describe("searchPolities", () => {
  it("matches names in either language", () => {
    expect(searchPolities(polities, "osmanli").map((p) => p.id)).toEqual(["Q12560"]);
    expect(searchPolities(polities, "ottoman").map((p) => p.id)).toEqual(["Q12560"]);
  });

  it("ranks prefixes first, then word starts, and longer-lived polities on ties", () => {
    // Roman Empire (395 years) and Romania (146) both start with "rom"; Holy Roman only has the word.
    expect(searchPolities(polities, "rom").map((p) => p.id)).toEqual(["Q2277", "Q218", "Q12548"]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchPolities(polities, "  ")).toEqual([]);
  });
});
