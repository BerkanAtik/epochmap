export type Lang = "en" | "tr";

/** UI language: `?lang=` wins, then the browser language. Defaults to English. */
function detectLang(): Lang {
  const fromUrl = new URLSearchParams(globalThis.location?.search ?? "").get("lang");
  if (fromUrl === "tr" || fromUrl === "en") return fromUrl;
  return globalThis.navigator?.language?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export const lang: Lang = detectLang();

const en = {
  tagline: "An atlas of world history",
  search: "Search",
  searchPlaceholder: "Search empires, kingdoms, peoples…",
  searchHint: "Type a name, then press Enter",
  noResults: "No matches",
  snapshots: "snapshots",
  play: "Play",
  pause: "Pause",
  previous: "Previous period",
  next: "Next period",
  timeline: "Timeline",
  bce: "BCE",
  ce: "CE",
  "era.prehistory": "Prehistory",
  "era.ancient": "Antiquity",
  "era.medieval": "Middle Ages",
  "era.earlyModern": "Early modern",
  "era.modern": "Modern era",
  onTheMap: "On the map",
  presence: "Presence across time",
  notOnMapIn: "Not on the map in",
  subjectOf: "Under the authority of",
  partOf: "Part of",
  "precision.1": "Approximate borders",
  "precision.2": "Moderately precise borders",
  "precision.3": "Borders set by international law",
  fromWikipedia: "From Wikipedia",
  readOnWikipedia: "Read on Wikipedia",
  noSummary: "No Wikipedia summary found for this name.",
  close: "Close",
  share: "Copy link to this view",
  linkCopied: "Link copied",
  about: "About",
  aboutTitle: "About Epochmap",
  aboutBody:
    "Epochmap lets you travel through 125,000 years of history on an interactive globe. Drag the timeline to watch empires, kingdoms and peoples rise and fall, and click any region to learn more.",
  shortcuts: "Keyboard shortcuts",
  "shortcut.step": "Previous / next period",
  "shortcut.play": "Play / pause",
  "shortcut.search": "Search",
  "shortcut.close": "Close panel",
  disclaimerTitle: "About the borders",
  disclaimer:
    "Borders are approximate and simplified for a world-scale map. Historical boundaries were often fluid, contested or simply unknown, and many regions are labelled by culture rather than by state.",
  dataTitle: "Data",
  dataBorders: "Historical borders: historical-basemaps by André Ourednik and contributors (GPL-3.0)",
  dataLand: "Land: Natural Earth (public domain)",
  dataWiki: "Summaries: Wikipedia (CC BY-SA)",
  sourceCode: "Source code on GitHub",
  loading: "Loading…",
  webglError: "Your browser or device does not support WebGL 2, which Epochmap needs to draw the globe.",
  dataError: "The map data could not be loaded. Check your connection and reload the page.",
  reload: "Reload",
} as const;

export type MessageKey = keyof typeof en;

const tr: Record<MessageKey, string> = {
  tagline: "Dünya tarihi atlası",
  search: "Ara",
  searchPlaceholder: "İmparatorluk, krallık veya halk ara…",
  searchHint: "Bir isim yazıp Enter'a basın",
  noResults: "Sonuç yok",
  snapshots: "dönem",
  play: "Oynat",
  pause: "Duraklat",
  previous: "Önceki dönem",
  next: "Sonraki dönem",
  timeline: "Zaman çizelgesi",
  bce: "MÖ",
  ce: "MS",
  "era.prehistory": "Tarih öncesi",
  "era.ancient": "İlk Çağ",
  "era.medieval": "Orta Çağ",
  "era.earlyModern": "Yeni Çağ",
  "era.modern": "Yakın Çağ",
  onTheMap: "Haritada",
  presence: "Zaman içindeki varlığı",
  notOnMapIn: "Bu dönemde haritada yok:",
  subjectOf: "Bağlı olduğu güç",
  partOf: "Parçası olduğu bölge",
  "precision.1": "Yaklaşık sınırlar",
  "precision.2": "Orta hassasiyette sınırlar",
  "precision.3": "Uluslararası hukukla belirlenmiş sınırlar",
  fromWikipedia: "Wikipedia'dan",
  readOnWikipedia: "Wikipedia'da oku",
  noSummary: "Bu isim için Wikipedia özeti bulunamadı.",
  close: "Kapat",
  share: "Bu görünümün bağlantısını kopyala",
  linkCopied: "Bağlantı kopyalandı",
  about: "Hakkında",
  aboutTitle: "Epochmap hakkında",
  aboutBody:
    "Epochmap ile 125.000 yıllık tarihte etkileşimli bir küre üzerinde gezinebilirsiniz. Zaman çizelgesini sürükleyerek imparatorlukların, krallıkların ve halkların yükselişini ve çöküşünü izleyin, ayrıntı için herhangi bir bölgeye tıklayın.",
  shortcuts: "Klavye kısayolları",
  "shortcut.step": "Önceki / sonraki dönem",
  "shortcut.play": "Oynat / duraklat",
  "shortcut.search": "Ara",
  "shortcut.close": "Paneli kapat",
  disclaimerTitle: "Sınırlar hakkında",
  disclaimer:
    "Sınırlar dünya ölçeğindeki bir harita için yaklaşık ve sadeleştirilmiştir. Tarihî sınırlar çoğu zaman değişken, tartışmalı ya da bilinmezdi; birçok bölge bir devlet yerine kültür adıyla gösterilir.",
  dataTitle: "Veri",
  dataBorders: "Tarihî sınırlar: André Ourednik ve katkıcıların historical-basemaps projesi (GPL-3.0)",
  dataLand: "Kara parçaları: Natural Earth (kamu malı)",
  dataWiki: "Özetler: Wikipedia (CC BY-SA)",
  sourceCode: "GitHub'da kaynak kodu",
  loading: "Yükleniyor…",
  webglError:
    "Tarayıcınız veya cihazınız, Epochmap'in küreyi çizmek için ihtiyaç duyduğu WebGL 2'yi desteklemiyor.",
  dataError: "Harita verisi yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.",
  reload: "Yenile",
};

const messages: Record<Lang, Record<MessageKey, string>> = { en, tr };

export function t(key: MessageKey): string {
  return messages[lang][key];
}
