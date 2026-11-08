export type SearchEntry = {
  name: string;
  /** Snapshot years in which the polity appears, ascending. */
  years: number[];
  wiki?: string;
};

/** Lower-cases and strips diacritics so "Očhéthi" matches "ochethi". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Ranks entries for a query: name starts with the query, then a word in the name
 * starts with it, then it appears anywhere. Ties prefer polities that appear in more snapshots.
 */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = 30): SearchEntry[] {
  const q = normalize(query.trim());
  if (!q) return [];

  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = normalize(entry.name);
    const at = name.indexOf(q);
    if (at < 0) continue;
    const score = at === 0 ? 0 : /[\s\-(']/.test(name[at - 1] ?? "") ? 1 : 2;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => a.score - b.score || b.entry.years.length - a.entry.years.length);
  return scored.slice(0, limit).map((s) => s.entry);
}
