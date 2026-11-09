/**
 * Hand-curated corrections and notes layered on top of the source datasets.
 * Keep entries short, neutral and sourced from widely accepted facts.
 */

export type NameFix = {
  /** Cliopatria polity name to correct. */
  match: string;
  /** First year (inclusive) the fix applies to. Several fixes for one name apply in order. */
  from: number;
  /** Corrected English name, or `null` to use the CShapes country name (for wrongly merged colonies). */
  name: string | null;
  /** Wikidata id for the corrected name (all ids checked against wikidata.org). */
  wikidata?: string;
  /** Turkish name when Wikidata's label for the id doesn't fit the period. */
  tr?: string;
  /** Remove the polity from `from` onwards (the source keeps it alive too long). */
  drop?: boolean;
};

/**
 * Corrections to Cliopatria names and Wikidata ids that are wrong or out of date
 * (found by `npm run data -- report`).
 */
export const NAME_FIXES: NameFix[] = [
  // Polities the source keeps alive too long
  { match: "Byzantine Empire", from: 1454, name: null, drop: true }, // Constantinople fell in 1453

  // Outdated names
  { match: "Mali Federation", from: 1961, name: "Mali", wikidata: "Q912" }, // federation broke up in 1960
  { match: "People's Republic of Angola", from: 1993, name: "Angola", wikidata: "Q916" }, // renamed 1992
  {
    match: "Kingdom of Great Britain",
    from: 1801,
    name: "United Kingdom of Great Britain and Ireland",
    wikidata: "Q174193",
  },
  { match: "Kingdom of Great Britain", from: 1927, name: "United Kingdom", wikidata: "Q145" },
  { match: "Éire", from: 1949, name: "Ireland", wikidata: "Q27" }, // Republic of Ireland Act
  { match: "Serbs", from: 1882, name: "Kingdom of Serbia", wikidata: "Q241748" },
  { match: "Hungarian Republic", from: 1920, name: "Kingdom of Hungary", wikidata: "Q171150" },
  { match: "Hungarian Nationalists", from: 1949, name: "Hungarian People's Republic", wikidata: "Q16410" },
  { match: "Communist Cuba", from: 1959, name: "Republic of Cuba", wikidata: "Q241" },
  { match: "Communist Laos", from: 1975, name: "Lao People's Democratic Republic", wikidata: "Q819" },
  {
    match: "Taliban",
    from: 1996,
    name: "Islamic Emirate of Afghanistan",
    wikidata: "Q42418",
    tr: "Afganistan İslam Emirliği",
  },
  { match: "Taliban", from: 2002, name: "Islamic Republic of Afghanistan", wikidata: "Q889" },
  { match: "Mujahideen", from: 1987, name: "Republic of Afghanistan", wikidata: "Q889" },
  { match: "Mujahideen", from: 1992, name: "Islamic State of Afghanistan", wikidata: "Q889" },
  { match: "Serbia-Montenegro", from: 1992, name: "Federal Republic of Yugoslavia", wikidata: "Q37024" },
  { match: "Serbia-Montenegro", from: 2003, name: "Serbia and Montenegro", wikidata: "Q37024" },
  { match: "Netherlands Antilles", from: 1, name: "Surinam", wikidata: "Q730" },
  // Regions that lump many colonies or dominions together: each country keeps its own name.
  { match: "British East Africa", from: 1886, name: null },
  { match: "British Colonial Empire", from: 1886, name: null },
  // Argentina has been the Argentine Republic since 1860.
  { match: "Argentine Confederation", from: 1861, name: "Argentine Republic", wikidata: "Q414" },

  // Typos and names that only fit a narrower period
  {
    match: "Federated Republic of Germany",
    from: 1990,
    name: "Federal Republic of Germany",
    wikidata: "Q183",
  },
  { match: "Second Republic of Austria", from: 1945, name: "Republic of Austria", wikidata: "Q40" },
  { match: "Third Hellenic Republic", from: 1974, name: "Hellenic Republic", wikidata: "Q41" },

  // Wrong Wikidata ids (they pointed at another country, period or topic)
  { match: "Roman Empire", from: 1, name: "Roman Empire", wikidata: "Q2277" },
  { match: "Byzantine Empire", from: 1, name: "Byzantine Empire", wikidata: "Q12544" },
  { match: "Han Dynasty", from: 1, name: "Han Dynasty", wikidata: "Q7209" },
  { match: "Sasanian Empire", from: 1, name: "Sasanian Empire", wikidata: "Q83891" },
  { match: "Joseon", from: 1, name: "Joseon", wikidata: "Q28179" },
  { match: "Buyid Dynasty", from: 1, name: "Buyid Dynasty", wikidata: "Q273874" },
  { match: "Đại Việt", from: 1, name: "Đại Việt", wikidata: "Q430309" },
  { match: "County of Barcelona", from: 1, name: "County of Barcelona", wikidata: "Q1233672" },
  { match: "Barghawata Conference", from: 1, name: "Barghawata", wikidata: "Q808139" },
  { match: "Old Kingdom of Norway", from: 1, name: "Kingdom of Norway", wikidata: "Q20" },
  // No reliable id: drop the wrong one and keep the source's name in every language.
  { match: "Sultanate of Bone", from: 1, name: "Sultanate of Bone" },
  { match: "Bahrani Dynasty", from: 1, name: "Bahrani Dynasty" },
  { match: "Republic of Korea", from: 1948, name: "Republic of Korea", wikidata: "Q884" },
  { match: "Republic of China", from: 1912, name: "Republic of China", wikidata: "Q13426199" },
  { match: "Republic of China", from: 1950, name: "Republic of China (Taiwan)", wikidata: "Q865" },
  { match: "Austria-Hungary", from: 1867, name: "Austria-Hungary", wikidata: "Q28513" },
  { match: "Republic of Albania", from: 1991, name: "Republic of Albania", wikidata: "Q222" },
  { match: "Republic of Bulgaria", from: 1990, name: "Republic of Bulgaria", wikidata: "Q219" },
  { match: "Republic of Yemen", from: 1990, name: "Republic of Yemen", wikidata: "Q805" },
  {
    match: "Democratic Republic of the Congo",
    from: 1960,
    name: "Democratic Republic of the Congo",
    wikidata: "Q974",
  },
];

/**
 * Country names that changed during the Natural Earth era (2014–today). Natural Earth 5.1.2
 * predates some of them, so each entry gives the name used from `from` to `to` (inclusive).
 */
export const MODERN_RENAMES: { wikidata: string; from: number; to: number; en: string; tr?: string }[] = [
  // The UN adopted "Türkiye" in June 2022.
  { wikidata: "Q43", from: 2022, to: 9999, en: "Türkiye" },
  // Became North Macedonia in February 2019 (Prespa agreement).
  { wikidata: "Q221", from: 2014, to: 2018, en: "Macedonia", tr: "Makedonya" },
  // Swaziland became Eswatini in April 2018.
  { wikidata: "Q1050", from: 2014, to: 2017, en: "Swaziland", tr: "Svaziland" },
  { wikidata: "Q1050", from: 2018, to: 9999, en: "Eswatini" },
];

/**
 * Period names for CShapes countries, used where Cliopatria has no polity of its own there
 * (or only a whole colonial region). Each entry is `[last year, name]`; the last entry is open-ended.
 */
export const CSHAPES_NAMES: Record<string, [number, string][]> = {
  "Turkey (Ottoman Empire)": [
    [1922, "Ottoman Empire"],
    [9999, "Turkey"],
  ],
  "Russia (Soviet Union)": [
    [1916, "Russian Empire"],
    [1921, "Russian SFSR"],
    [1991, "Soviet Union"],
    [9999, "Russia"],
  ],
  "Iran (Persia)": [
    [1934, "Persia"],
    [9999, "Iran"],
  ],
  "Germany (Prussia)": [[9999, "Germany"]],
  "Burkina Faso (Upper Volta)": [
    [1983, "Upper Volta"],
    [9999, "Burkina Faso"],
  ],
  "Congo, Democratic Republic of (Zaire)": [
    [1907, "Congo Free State"],
    [1959, "Belgian Congo"],
    [1970, "Democratic Republic of the Congo"],
    [1996, "Zaire"],
    [9999, "Democratic Republic of the Congo"],
  ],
  "Congo, Democratic Republic of": [
    [1907, "Congo Free State"],
    [1959, "Belgian Congo"],
    [9999, "Democratic Republic of the Congo"],
  ],
  Congo: [
    [1959, "French Congo"],
    [9999, "Republic of the Congo"],
  ],
  "Tanzania (Tanganyika)": [
    [1918, "German East Africa"],
    [1963, "Tanganyika"],
    [9999, "Tanzania"],
  ],
  "Zimbabwe (Rhodesia)": [
    [1979, "Rhodesia"],
    [9999, "Zimbabwe"],
  ],
  Zimbabwe: [
    [1979, "Rhodesia"],
    [9999, "Zimbabwe"],
  ],
  "Swaziland (Eswatini)": [
    [2017, "Swaziland"],
    [9999, "Eswatini"],
  ],
  "Madagascar (Malagasy)": [[9999, "Madagascar"]],
  "Yemen (Arab Republic of Yemen)": [
    [1961, "Kingdom of Yemen"],
    [1989, "North Yemen"],
    [9999, "Yemen"],
  ],
  "Myanmar (Burma)": [
    [1988, "Burma"],
    [9999, "Myanmar"],
  ],
  "Sri Lanka (Ceylon)": [
    [1971, "Ceylon"],
    [9999, "Sri Lanka"],
  ],
  "Cambodia (Kampuchea)": [
    [1974, "Cambodia"],
    [1988, "Kampuchea"],
    [9999, "Cambodia"],
  ],
  "Vietnam (Annam/Cochin China/Tonkin)": [[9999, "French Indochina"]],
  "Sabah (North Borneo)": [[9999, "North Borneo"]],
  "West Irian (Dutch New Guinea)": [[9999, "Dutch New Guinea"]],
  "New Guinea (German New Guinea) (Kaiser Wilhelmsland)": [
    [1914, "German New Guinea"],
    [9999, "Territory of New Guinea"],
  ],
  "Macedonia (FYROM/North Macedonia)": [
    [2018, "Macedonia"],
    [9999, "North Macedonia"],
  ],
  "Belarus (Byelorussia)": [[9999, "Belarus"]],
  "Kashmir (North, Azad)": [[9999, "Azad Kashmir"]],
  "British Somaliland (Somaliland Republic)": [[9999, "British Somaliland"]],
  Jordan: [
    [1945, "Transjordan"],
    [9999, "Jordan"],
  ],
  Oman: [
    [1969, "Muscat and Oman"],
    [9999, "Oman"],
  ],
  Djibouti: [
    [1966, "French Somaliland"],
    [1976, "French Territory of the Afars and the Issas"],
    [9999, "Djibouti"],
  ],
  "Cote D'Ivoire": [[9999, "Côte d'Ivoire"]],
  Guyana: [
    [1965, "British Guiana"],
    [9999, "Guyana"],
  ],
  Belize: [
    [1972, "British Honduras"],
    [9999, "Belize"],
  ],
  Ghana: [
    [1956, "Gold Coast"],
    [9999, "Ghana"],
  ],
  Malawi: [
    [1963, "Nyasaland"],
    [9999, "Malawi"],
  ],
  Zambia: [
    [1963, "Northern Rhodesia"],
    [9999, "Zambia"],
  ],
  Botswana: [
    [1965, "Bechuanaland"],
    [9999, "Botswana"],
  ],
  Lesotho: [
    [1965, "Basutoland"],
    [9999, "Lesotho"],
  ],
  Namibia: [
    [1914, "German South West Africa"],
    [1989, "South West Africa"],
    [9999, "Namibia"],
  ],
  Benin: [
    [1974, "Dahomey"],
    [9999, "Benin"],
  ],
  Mali: [
    [1959, "French Sudan"],
    [9999, "Mali"],
  ],
  Indonesia: [
    [1944, "Dutch East Indies"],
    [9999, "Indonesia"],
  ],
  Suriname: [
    [1974, "Surinam"],
    [9999, "Suriname"],
  ],
  Taiwan: [
    [1944, "Taiwan (Japanese)"],
    [9999, "Taiwan"],
  ],
  "Korea, People's Republic of": [
    [1947, "Korea (Soviet zone)"],
    [9999, "North Korea"],
  ],
  "Korea, Republic of": [
    [1947, "Korea (US zone)"],
    [9999, "South Korea"],
  ],
  "Vietnam, Republic of": [[9999, "South Vietnam"]],
  "Vietnam, Democratic Republic of": [[9999, "North Vietnam"]],
  "Yemen, People's Republic of": [[9999, "South Yemen"]],
  "German Federal Republic": [
    [1948, "Allied-occupied Germany"],
    [9999, "West Germany"],
  ],
  "German Democratic Republic": [
    [1948, "Soviet-occupied Germany"],
    [9999, "East Germany"],
  ],
  "Italy/Sardinia": [[9999, "Italy"]],
  Rumania: [[9999, "Romania"]],
  Selangore: [[9999, "Selangor"]],
};

/**
 * Disputed territories drawn as a hatched overlay. `ne` is the Natural Earth NAME_EN in the
 * disputed-areas layer (plus SOVEREIGNT where a name appears twice). `from`/`to` limit the
 * years in which the dispute, in its current shape, is shown.
 */
export const DISPUTES: { ne: string; sov?: string; from: number; to?: number; en: string; tr: string }[] = [
  {
    ne: "Crimean Peninsula",
    from: 2014,
    en: "Administered by Russia since 2014; claimed by Ukraine",
    tr: "2014'ten beri Rusya yönetiminde; Ukrayna hak iddia ediyor",
  },
  {
    ne: "Donetsk People's Republic",
    from: 2014,
    en: "Controlled by Russian-backed forces since 2014; claimed by Ukraine",
    tr: "2014'ten beri Rusya destekli güçlerin kontrolünde; Ukrayna hak iddia ediyor",
  },
  {
    ne: "Luhansk People's Republic",
    from: 2014,
    en: "Controlled by Russian-backed forces since 2014; claimed by Ukraine",
    tr: "2014'ten beri Rusya destekli güçlerin kontrolünde; Ukrayna hak iddia ediyor",
  },
  {
    ne: "Transnistria",
    from: 1992,
    en: "Self-governing since 1992; claimed by Moldova",
    tr: "1992'den beri kendi kendini yönetiyor; Moldova hak iddia ediyor",
  },
  {
    ne: "Abkhazia",
    from: 1993,
    en: "Self-governing since 1993; claimed by Georgia",
    tr: "1993'ten beri kendi kendini yönetiyor; Gürcistan hak iddia ediyor",
  },
  {
    ne: "South Ossetia",
    from: 1992,
    en: "Self-governing since 1992; claimed by Georgia",
    tr: "1992'den beri kendi kendini yönetiyor; Gürcistan hak iddia ediyor",
  },
  {
    ne: "Nagorno-Karabakh",
    from: 1992,
    to: 2023,
    en: "Self-governing from 1992 until 2023, when it returned to Azerbaijani control",
    tr: "1992'den 2023'te yeniden Azerbaycan kontrolüne geçene kadar kendi kendini yönetti",
  },
  {
    ne: "Turkish Republic of Northern Cyprus",
    from: 1974,
    en: "Under Turkish Cypriot administration since 1974 (TRNC declared in 1983); recognised by Turkey; claimed by the Republic of Cyprus",
    tr: "1974'ten beri Kıbrıs Türk yönetiminde (KKTC 1983'te ilan edildi); Türkiye tanıyor; Kıbrıs Cumhuriyeti hak iddia ediyor",
  },
  {
    ne: "Western Sahara",
    sov: "Morocco",
    from: 1976,
    en: "Administered by Morocco since 1976; claimed by the Sahrawi Arab Democratic Republic",
    tr: "1976'dan beri Fas yönetiminde; Sahra Arap Demokratik Cumhuriyeti hak iddia ediyor",
  },
  {
    ne: "Western Sahara",
    sov: "Western Sahara",
    from: 1976,
    en: "Administered by the Sahrawi Arab Democratic Republic; claimed by Morocco",
    tr: "Sahra Arap Demokratik Cumhuriyeti yönetiminde; Fas hak iddia ediyor",
  },
  {
    ne: "Kashmir",
    from: 1948,
    en: "Administered by India; claimed by Pakistan",
    tr: "Hindistan yönetiminde; Pakistan hak iddia ediyor",
  },
  {
    ne: "Azad Kashmir",
    from: 1948,
    en: "Administered by Pakistan; claimed by India",
    tr: "Pakistan yönetiminde; Hindistan hak iddia ediyor",
  },
  {
    ne: "Gilgit-Baltistan",
    from: 1948,
    en: "Administered by Pakistan; claimed by India",
    tr: "Pakistan yönetiminde; Hindistan hak iddia ediyor",
  },
  {
    ne: "Aksai Chin",
    from: 1962,
    en: "Administered by China; claimed by India",
    tr: "Çin yönetiminde; Hindistan hak iddia ediyor",
  },
  {
    ne: "Arunachal Pradesh",
    from: 1962,
    en: "Administered by India; claimed by China",
    tr: "Hindistan yönetiminde; Çin hak iddia ediyor",
  },
  {
    ne: "Golan Heights",
    from: 1967,
    en: "Administered by Israel since 1967; claimed by Syria",
    tr: "1967'den beri İsrail yönetiminde; Suriye hak iddia ediyor",
  },
  {
    ne: "West Bank",
    from: 1967,
    en: "Palestinian territory under Israeli occupation since 1967",
    tr: "1967'den beri İsrail işgali altındaki Filistin toprağı",
  },
  {
    ne: "East Jerusalem",
    from: 1967,
    en: "Administered by Israel since 1967; claimed by Palestine",
    tr: "1967'den beri İsrail yönetiminde; Filistin hak iddia ediyor",
  },
  {
    ne: "Gaza Strip",
    from: 1967,
    en: "Palestinian territory; its status is disputed",
    tr: "Filistin toprağı; statüsü tartışmalı",
  },
  {
    ne: "Kosovo",
    from: 2008,
    en: "Declared independence in 2008; recognised by about half of UN members; claimed by Serbia",
    tr: "2008'de bağımsızlığını ilan etti; BM üyelerinin yaklaşık yarısı tanıyor; Sırbistan hak iddia ediyor",
  },
  {
    ne: "Taiwan",
    from: 1949,
    en: "Governed by the Republic of China since 1949; claimed by the People's Republic of China",
    tr: "1949'dan beri Çin Cumhuriyeti tarafından yönetiliyor; Çin Halk Cumhuriyeti hak iddia ediyor",
  },
  {
    ne: "Somaliland",
    from: 1991,
    en: "Self-governing since 1991; claimed by Somalia",
    tr: "1991'den beri kendi kendini yönetiyor; Somali hak iddia ediyor",
  },
  {
    ne: "Kuril Islands",
    from: 1945,
    en: "Administered by Russia (the Soviet Union until 1991) since 1945; claimed by Japan",
    tr: "1945'ten beri Rusya (1991'e kadar Sovyetler Birliği) yönetiminde; Japonya hak iddia ediyor",
  },
  {
    ne: "Falkland Islands",
    from: 1833,
    en: "Administered by the United Kingdom since 1833; claimed by Argentina",
    tr: "1833'ten beri Birleşik Krallık yönetiminde; Arjantin hak iddia ediyor",
  },
  {
    ne: "Abyei",
    from: 2011,
    en: "Contested between Sudan and South Sudan since 2011",
    tr: "2011'den beri Sudan ile Güney Sudan arasında tartışmalı",
  },
];
