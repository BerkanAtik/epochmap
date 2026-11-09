import type { Lang, MessageKey } from "./i18n";

/**
 * Era boundaries follow each language's own convention: Turkish schools date the Middle Ages
 * from 476 to 1453 and the "Yakın Çağ" from the French Revolution.
 */
export const ERAS: Record<Lang, readonly { from: number; key: MessageKey }[]> = {
  en: [
    { from: Number.NEGATIVE_INFINITY, key: "era.ancient" },
    { from: 500, key: "era.medieval" },
    { from: 1500, key: "era.earlyModern" },
    { from: 1800, key: "era.modern" },
    { from: 1946, key: "era.contemporary" },
  ],
  tr: [
    { from: Number.NEGATIVE_INFINITY, key: "era.ancient" },
    { from: 476, key: "era.medieval" },
    { from: 1453, key: "era.earlyModern" },
    { from: 1789, key: "era.modern" },
    { from: 1946, key: "era.contemporary" },
  ],
};

export function eraOf(year: number, lang: Lang): MessageKey {
  let key: MessageKey = "era.ancient";
  for (const era of ERAS[lang]) if (year >= era.from) key = era.key;
  return key;
}

export function clampYear(year: number, start: number, end: number): number {
  return Math.min(end, Math.max(start, Math.round(year)));
}

/** "1300–1923", or several spans joined: "395–1226, 1279–1453". */
export function formatSpans(spans: readonly (readonly [number, number])[], end: number, now: string): string {
  return spans.map(([f, t]) => (f === t ? `${f}` : `${f}–${t >= end ? now : t}`)).join(", ");
}

/** The nearest year in a sorted list strictly before / after `year`, if any. */
export function previousIn(years: readonly number[], year: number): number | undefined {
  let found: number | undefined;
  for (const y of years) {
    if (y >= year) break;
    found = y;
  }
  return found;
}

export function nextIn(years: readonly number[], year: number): number | undefined {
  return years.find((y) => y > year);
}
