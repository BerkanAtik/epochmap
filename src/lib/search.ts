import type { Polity } from "../data/atlas";

/** Lower-cases and strips diacritics (and Turkish dotless/dotted i) so "osmanli" finds "Osmanlı". */
export function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Total years a polity spends on the map. */
export function lifespan(polity: Pick<Polity, "spans">): number {
  return polity.spans.reduce((sum, [f, t]) => sum + t - f + 1, 0);
}

/**
 * Ranks polities for a query against all their names in both languages: a name starting with
 * the query, then a word in a name starting with it, then a match anywhere. Ties go to the
 * polity that lasted longer.
 */
export function searchPolities(polities: readonly Polity[], query: string, limit = 30): Polity[] {
  const q = normalize(query.trim());
  if (!q) return [];

  const scored: { polity: Polity; score: number }[] = [];
  for (const polity of polities) {
    let best = Number.POSITIVE_INFINITY;
    for (const name of [...polity.en, ...polity.tr]) {
      const n = normalize(name);
      const at = n.indexOf(q);
      if (at < 0) continue;
      const score = at === 0 ? 0 : /[\s\-(']/.test(n[at - 1] ?? "") ? 1 : 2;
      best = Math.min(best, score);
    }
    if (best < Number.POSITIVE_INFINITY) scored.push({ polity, score: best });
  }

  scored.sort((a, b) => a.score - b.score || lifespan(b.polity) - lifespan(a.polity));
  return scored.slice(0, limit).map((s) => s.polity);
}
