import type { Lang } from "./i18n";

export type WikiSummary = {
  title: string;
  extract: string;
  thumbnail?: string;
  url: string;
  lang: Lang;
};

type RestSummary = {
  type: string;
  title: string;
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
};

const site = (lang: Lang) => `https://${lang}.wikipedia.org`;

async function restSummary(lang: Lang, title: string): Promise<RestSummary | null> {
  const res = await fetch(
    `${site(lang)}/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}?redirect=true`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) return null;
  const summary = (await res.json()) as RestSummary;
  return summary.type !== "disambiguation" && summary.extract ? summary : null;
}

async function searchTitle(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`${site("en")}/w/api.php?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { query?: { search?: { title: string }[] } };
  return data.query?.search?.[0]?.title ?? null;
}

function toSummary(s: RestSummary, lang: Lang): WikiSummary {
  return {
    title: s.title,
    extract: s.extract ?? "",
    thumbnail: s.thumbnail?.source,
    url: s.content_urls?.desktop?.page ?? `${site(lang)}/wiki/${encodeURIComponent(s.title)}`,
    lang,
  };
}

async function resolve(
  titles: { en?: string; tr?: string },
  name: string,
  lang: Lang,
): Promise<WikiSummary | null> {
  // The data build looked up the article titles on Wikidata; use the UI language's when it exists.
  if (lang === "tr" && titles.tr) {
    const tr = await restSummary("tr", titles.tr);
    if (tr) return toSummary(tr, "tr");
  }
  let en = await restSummary("en", titles.en ?? name);
  if (!en && !titles.en) {
    const found = await searchTitle(name);
    en = found ? await restSummary("en", found) : null;
  }
  return en ? toSummary(en, "en") : null;
}

const cache = new Map<string, Promise<WikiSummary | null>>();

/**
 * The Wikipedia summary for a polity, in the UI language when an article exists in it.
 * Never rejects: network errors and missing articles both resolve to `null`. The same promise
 * is returned for repeated calls, so it can be passed straight to React's `use()`.
 */
export function wikiSummary(
  key: string,
  titles: { en?: string; tr?: string },
  name: string,
  lang: Lang,
): Promise<WikiSummary | null> {
  const id = `${lang}:${key}`;
  let promise = cache.get(id);
  if (!promise) {
    promise = resolve(titles, name, lang).catch(() => null);
    cache.set(id, promise);
  }
  return promise;
}
