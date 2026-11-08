import { describe, expect, it } from "vitest";
import { normalize, type SearchEntry, searchEntries } from "./search";

const entry = (name: string, snapshots = 1): SearchEntry => ({
  name,
  years: Array.from({ length: snapshots }, (_, i) => i),
});

describe("normalize", () => {
  it("ignores case and diacritics", () => {
    expect(normalize("Očhéthi Šakówiŋ")).toBe("ochethi sakowiŋ");
  });
});

describe("searchEntries", () => {
  const entries = [
    entry("Byzantine Empire", 10),
    entry("Holy Roman Empire", 12),
    entry("Roman Empire", 5),
    entry("Empire of Japan", 3),
    entry("Romania", 4),
  ];

  it("ranks prefix matches before word matches before substring matches", () => {
    expect(searchEntries(entries, "rom").map((e) => e.name)).toEqual([
      "Roman Empire",
      "Romania",
      "Holy Roman Empire",
    ]);
    expect(searchEntries([entry("Aromania"), entry("Rome")], "rom").map((e) => e.name)).toEqual([
      "Rome",
      "Aromania",
    ]);
  });

  it("breaks ties by how long the polity lasted", () => {
    expect(searchEntries(entries, "empire").map((e) => e.name)).toEqual([
      "Empire of Japan",
      "Holy Roman Empire",
      "Byzantine Empire",
      "Roman Empire",
    ]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchEntries(entries, "   ")).toEqual([]);
  });
});
