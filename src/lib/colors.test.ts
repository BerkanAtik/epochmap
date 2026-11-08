import { describe, expect, it } from "vitest";
import { polityColor } from "./colors";

describe("polityColor", () => {
  it("is stable for the same polity", () => {
    expect(polityColor("Ottoman Empire", undefined)).toBe(polityColor("Ottoman Empire", "Ottoman Empire"));
  });

  it("gives subjects their ruler's hue, but lighter", () => {
    const ruler = polityColor("Spain", "Spain");
    const colony = polityColor("New Spain", "Spain");
    const hue = (c: string) => c.slice(0, c.lastIndexOf(","));
    expect(hue(colony)).toBe(hue(ruler));
    expect(colony).not.toBe(ruler);
  });
});
