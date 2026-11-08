import type { Lang } from "./i18n";

export type Era = "prehistory" | "ancient" | "medieval" | "earlyModern" | "modern";

/** Conventional era boundaries; each era starts at `from` (inclusive). */
export const ERAS: readonly { id: Era; from: number }[] = [
  { id: "prehistory", from: Number.NEGATIVE_INFINITY },
  { id: "ancient", from: -3000 },
  { id: "medieval", from: 500 },
  { id: "earlyModern", from: 1500 },
  { id: "modern", from: 1800 },
];

export function eraOf(year: number): Era {
  let era: Era = "prehistory";
  for (const e of ERAS) if (year >= e.from) era = e.id;
  return era;
}

export type YearParts = {
  /** Digits only, e.g. "323" or "123,000". */
  value: string;
  /** "BCE"/"CE" in English, "MÖ"/"MS" in Turkish. Empty for unambiguous CE years. */
  marker: string;
  /** Turkish writes the marker before the number ("MÖ 323"). */
  markerFirst: boolean;
};

/**
 * Negative years are BCE (the data has no year zero: -1 is 1 BCE).
 * The CE marker is only shown for years below 1000, where "300" alone would be ambiguous.
 */
export function yearParts(year: number, lang: Lang, labels: { bce: string; ce: string }): YearParts {
  const abs = Math.abs(year);
  // Group digits only for very old dates ("123,000"), never for ordinary years ("1492").
  const value = abs >= 10_000 ? abs.toLocaleString(lang === "tr" ? "tr-TR" : "en-US") : String(abs);
  const marker = year < 0 ? labels.bce : year < 1000 ? labels.ce : "";
  return { value, marker, markerFirst: lang === "tr" };
}

export function formatYear(year: number, lang: Lang, labels: { bce: string; ce: string }): string {
  const { value, marker, markerFirst } = yearParts(year, lang, labels);
  if (!marker) return value;
  return markerFirst ? `${marker} ${value}` : `${value} ${marker}`;
}

/** Index of the year in `years` (sorted ascending) closest to `target`; ties go to the earlier one. */
export function nearestIndex(years: readonly number[], target: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  years.forEach((y, i) => {
    const d = Math.abs(y - target);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}
