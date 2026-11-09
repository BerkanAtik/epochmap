import { useMemo, useSyncExternalStore } from "react";

export type Lang = "en" | "tr";
export const LANGS: readonly Lang[] = ["en", "tr"];

const STORAGE_KEY = "epochmap.lang";

/** `?lang=` wins, then the last choice, then the browser language. Defaults to English. */
function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (fromUrl === "en" || fromUrl === "tr") return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "tr") return saved;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); detection still works.
  }
  return window.navigator.language?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

let current: Lang = detectLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not remembering the choice is fine.
  }
  document.documentElement.lang = lang;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The UI language; components using it re-render when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

const en = {
  tagline: "An atlas of world history",
  search: "Search",
  searchPlaceholder: "Search empires, kingdoms, countries…",
  searchHint: "Type a name, then press Enter",
  noResults: "No matches",
  play: "Play",
  pause: "Pause",
  previousChange: "Previous border change",
  nextChange: "Next border change",
  speed: "Playback speed",
  yearsPerSecond: "yrs/s",
  timeline: "Timeline",
  editYear: "Type a year",
  bordersChanging: "Border changes over time",
  "era.ancient": "Antiquity",
  "era.medieval": "Middle Ages",
  "era.earlyModern": "Early modern",
  "era.modern": "Modern era",
  "era.contemporary": "Contemporary",
  onTheMap: "On the map",
  partOf: "Part of",
  alsoKnownAs: "Also known as",
  presence: "Across time",
  notOnMapIn: "Not on the map in",
  disputed: "Disputed territory",
  fromWikipedia: "From Wikipedia",
  readOnWikipedia: "Read on Wikipedia",
  noSummary: "No Wikipedia summary found for this name.",
  close: "Close",
  share: "Copy link to this view",
  linkCopied: "Link copied",
  language: "Language",
  about: "About",
  aboutTitle: "About Epochmap",
  aboutBody:
    "Epochmap shows the political map of the world for every year from 1 CE to today on a 3D globe. Drag the timeline or press play to watch borders change, and click any country or empire to learn more.",
  shortcuts: "Keyboard shortcuts",
  "shortcut.step": "One year back / forward",
  "shortcut.stepTen": "Ten years back / forward",
  "shortcut.change": "Previous / next border change",
  "shortcut.play": "Play / pause",
  "shortcut.search": "Search",
  "shortcut.close": "Close the panel",
  disclaimerTitle: "How accurate are the borders?",
  disclaimer:
    "Each period uses the best open dataset available for it. Borders are simplified for a world-scale map, and historical boundaries were often fluid or contested. From 1886 they follow internationally recognised (de jure) borders; from 2014 they show the situation on the ground, with disputed territories hatched.",
  dataTitle: "Data",
  dataCliopatria: "1–1885: Cliopatria, Seshat Global History Databank (CC BY 4.0)",
  dataCShapes: "1886–2013: CShapes 2.0, ETH Zürich (CC BY-NC-SA 4.0)",
  dataNaturalEarth: "2014–today, disputed areas, land: Natural Earth (public domain)",
  dataImagery: "Satellite imagery: NASA Blue Marble via GIBS (public domain)",
  dataWiki: "Names and summaries: Wikidata (CC0) and Wikipedia (CC BY-SA)",
  sourceCode: "Source code on GitHub",
  loading: "Loading…",
  webglError: "Your browser or device does not support WebGL 2, which Epochmap needs to draw the globe.",
  dataError: "The map data could not be loaded. Check your connection and reload the page.",
  reload: "Reload",
  windowError: "This period's map could not be loaded. Check your connection and try again.",
  crashed: "Something went wrong. Reloading the page usually fixes it.",
} as const;

export type MessageKey = keyof typeof en;

const tr: Record<MessageKey, string> = {
  tagline: "Dünya tarihi atlası",
  search: "Ara",
  searchPlaceholder: "İmparatorluk, krallık veya ülke ara…",
  searchHint: "Bir isim yazıp Enter'a basın",
  noResults: "Sonuç yok",
  play: "Oynat",
  pause: "Duraklat",
  previousChange: "Önceki sınır değişikliği",
  nextChange: "Sonraki sınır değişikliği",
  speed: "Oynatma hızı",
  yearsPerSecond: "yıl/sn",
  timeline: "Zaman çizelgesi",
  editYear: "Bir yıl yazın",
  bordersChanging: "Zaman içinde sınır değişiklikleri",
  "era.ancient": "İlk Çağ",
  "era.medieval": "Orta Çağ",
  "era.earlyModern": "Yeni Çağ",
  "era.modern": "Yakın Çağ",
  "era.contemporary": "Çağdaş dönem",
  onTheMap: "Haritada",
  partOf: "Bağlı olduğu",
  alsoKnownAs: "Diğer adları",
  presence: "Zaman içinde",
  notOnMapIn: "Bu yılda haritada yok:",
  disputed: "Tartışmalı bölge",
  fromWikipedia: "Wikipedia'dan",
  readOnWikipedia: "Wikipedia'da oku",
  noSummary: "Bu isim için Wikipedia özeti bulunamadı.",
  close: "Kapat",
  share: "Bu görünümün bağlantısını kopyala",
  linkCopied: "Bağlantı kopyalandı",
  language: "Dil",
  about: "Hakkında",
  aboutTitle: "Epochmap hakkında",
  aboutBody:
    "Epochmap, MS 1 yılından bugüne her yılın siyasi dünya haritasını 3B bir küre üzerinde gösterir. Sınırların değişimini izlemek için zaman çizelgesini sürükleyin ya da oynatın; ayrıntı için herhangi bir ülkeye veya imparatorluğa tıklayın.",
  shortcuts: "Klavye kısayolları",
  "shortcut.step": "Bir yıl geri / ileri",
  "shortcut.stepTen": "On yıl geri / ileri",
  "shortcut.change": "Önceki / sonraki sınır değişikliği",
  "shortcut.play": "Oynat / duraklat",
  "shortcut.search": "Ara",
  "shortcut.close": "Paneli kapat",
  disclaimerTitle: "Sınırlar ne kadar doğru?",
  disclaimer:
    "Her dönem için o döneme ait en iyi açık veri seti kullanılır. Sınırlar dünya ölçeğinde bir harita için sadeleştirilmiştir ve tarihî sınırlar çoğu zaman değişken ya da tartışmalıydı. 1886'dan itibaren uluslararası hukukça tanınan (de jure) sınırlar, 2014'ten itibaren ise sahadaki durum gösterilir; tartışmalı bölgeler taralıdır.",
  dataTitle: "Veri",
  dataCliopatria: "1–1885: Cliopatria, Seshat Küresel Tarih Veri Bankası (CC BY 4.0)",
  dataCShapes: "1886–2013: CShapes 2.0, ETH Zürih (CC BY-NC-SA 4.0)",
  dataNaturalEarth: "2014–bugün, tartışmalı bölgeler, kara: Natural Earth (kamu malı)",
  dataImagery: "Uydu görüntüsü: NASA Blue Marble, GIBS üzerinden (kamu malı)",
  dataWiki: "Adlar ve özetler: Wikidata (CC0) ve Wikipedia (CC BY-SA)",
  sourceCode: "GitHub'da kaynak kodu",
  loading: "Yükleniyor…",
  webglError:
    "Tarayıcınız veya cihazınız, Epochmap'in küreyi çizmek için ihtiyaç duyduğu WebGL 2'yi desteklemiyor.",
  dataError: "Harita verisi yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.",
  reload: "Yenile",
  windowError: "Bu dönemin haritası yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.",
  crashed: "Bir şeyler ters gitti. Sayfayı yenilemek genellikle düzeltir.",
};

const messages: Record<Lang, Record<MessageKey, string>> = { en, tr };

export function translate(lang: Lang, key: MessageKey): string {
  return messages[lang][key];
}

/** A translator bound to the current language; its identity changes with the language. */
export function useT(): (key: MessageKey) => string {
  const lang = useLang();
  return useMemo(() => (key: MessageKey) => messages[lang][key], [lang]);
}
