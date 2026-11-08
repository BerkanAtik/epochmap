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

const api = (lang: Lang) => `https://${lang}.wikipedia.org`;

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  return res.ok ? ((await res.json()) as T) : null;
}

async function restSummary(lang: Lang, title: string): Promise<RestSummary | null> {
  const summary = await getJson<RestSummary>(
    `${api(lang)}/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}?redirect=true`,
  );
  return summary && summary.type !== "disambiguation" && summary.extract ? summary : null;
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
  const data = await getJson<{ query?: { search?: { title: string }[] } }>(
    `${api("en")}/w/api.php?${params}`,
  );
  return data?.query?.search?.[0]?.title ?? null;
}

async function translatedTitle(enTitle: string, lang: Lang): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: enTitle,
    prop: "langlinks",
    lllang: lang,
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const data = await getJson<{ query?: { pages?: { langlinks?: { title: string }[] }[] } }>(
    `${api("en")}/w/api.php?${params}`,
  );
  return data?.query?.pages?.[0]?.langlinks?.[0]?.title ?? null;
}

/** The dataset's `wikipedia` field holds either a page title or a full article URL. */
function titleFromField(field: string): string {
  const match = /\/wiki\/([^?#]+)/.exec(field);
  return decodeURIComponent(match?.[1] ?? field).replaceAll("_", " ");
}

function toSummary(s: RestSummary, lang: Lang): WikiSummary {
  return {
    title: s.title,
    extract: s.extract ?? "",
    thumbnail: s.thumbnail?.source,
    url: s.content_urls?.desktop?.page ?? `${api(lang)}/wiki/${encodeURIComponent(s.title)}`,
    lang,
  };
}

async function resolve(name: string, wiki: string | undefined, lang: Lang): Promise<WikiSummary | null> {
  // Polity names in the dataset are English, so the English article is the anchor.
  let en = await restSummary("en", wiki ? titleFromField(wiki) : name);
  if (!en) {
    const found = await searchTitle(name);
    en = found ? await restSummary("en", found) : null;
  }
  if (!en) return null;

  if (lang !== "en") {
    const local = await translatedTitle(en.title, lang);
    const summary = local ? await restSummary(lang, local) : null;
    if (summary) return toSummary(summary, lang);
  }
  return toSummary(en, "en");
}

const cache = new Map<string, Promise<WikiSummary | null>>();

/**
 * Summary of the Wikipedia article for a polity, in the UI language when a translation exists.
 * Never rejects: network errors and missing articles both resolve to `null`.
 * The same promise is returned for repeated calls, so it can be passed straight to React's `use()`.
 */
export function wikiSummary(name: string, wiki: string | undefined, lang: Lang): Promise<WikiSummary | null> {
  const key = `${lang}:${name}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = resolve(name, wiki, lang).catch(() => null);
    cache.set(key, promise);
  }
  return promise;
}
