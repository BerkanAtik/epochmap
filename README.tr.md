<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="" />
</p>

<h1 align="center">Epochmap</h1>

<p align="center">
  <b>Etkileşimli bir dünya tarihi atlası.</b><br />
  125.000 yıllık tarihte gezinin; imparatorlukların, krallıkların ve halkların 3B bir küre üzerinde yükselişini ve çöküşünü izleyin.
</p>

<p align="center">
  <a href="https://berkanatik.github.io/epochmap/?lang=tr"><b>Atlası aç →</b></a>
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

![Epochmap küresinde 1279 yılında dünya](docs/hero.png)

## Özellikler

- Yakınlaştırdıkça düz haritaya dönüşen, atmosferli **3B küre**.
- MÖ 123.000'den 2010'a **tarihten 54 an**. Sınırlar dönemler arasında yanıp sönmek yerine yumuşak geçişle değişir.
- Tarihi bir hızlandırılmış film gibi **oynatın** ya da ok tuşlarıyla adım adım ilerleyin.
- **Herhangi bir bölgeye tıklayın**: Wikipedia özeti (çevirisi varsa sizin dilinizde), haritada hangi dönemlerde yer aldığı ve hangi güce bağlı olduğu açılır.
- 3.000'den fazla imparatorluk, krallık ve halk arasında <kbd>Ctrl</kbd> <kbd>K</kbd> / <kbd>⌘</kbd> <kbd>K</kbd> ile **arayın** ve doğrudan oraya uçun.
- **Paylaşılabilir bağlantılar**: adres çubuğu her zaman yılı, seçili devleti ve kamera konumunu tutar.
- Sömürgeler ve bağlı devletler, bağlı oldukları gücün renginin açık tonuyla çizilir; imparatorluklar tek parça gibi okunur.
- İngilizce ve Türkçe arayüz, klavye kısayolları ve azaltılmış hareket desteği.
- Tamamen statik site: sunucu yok, API anahtarı yok, takip yok.

![1279'da Bizans İmparatorluğu ve açık bilgi paneli](docs/detail.png)

## Klavye kısayolları

| Tuş                                                                       | İşlev                  |
| ------------------------------------------------------------------------- | ---------------------- |
| <kbd>←</kbd> <kbd>→</kbd>                                                 | Önceki / sonraki dönem |
| <kbd>Boşluk</kbd>                                                         | Oynat / duraklat       |
| <kbd>Ctrl</kbd> <kbd>K</kbd>, <kbd>⌘</kbd> <kbd>K</kbd> veya <kbd>/</kbd> | Ara                    |
| <kbd>Esc</kbd>                                                            | Bilgi panelini kapat   |

## Nasıl çalışıyor

**Veri hattı** ([`scripts/build-data.ts`](scripts/build-data.ts)). Sınır verisi [historical-basemaps](https://github.com/aourednik/historical-basemaps) projesinden gelir. Çıktının her seferinde aynı olması için belirli bir commit'e sabitlenir. Her dönem [mapshaper](https://github.com/mbloch/mapshaper) ile şu adımlardan geçer:

1. İsimsiz alanlar çıkarılır (bunları kara katmanı gösterir).
2. Şekiller topolojiyi koruyarak sadeleştirilir, böylece komşu sınırlar birbirine uyumlu kalır.
3. Her devlet tek bir nesnede birleştirilir. Böylece fareyle üzerine gelince devletin tamamı vurgulanır.
4. Her devletin alanı ve şeklinin içinde kalan bir etiket noktası hesaplanır.

Sonuçta dönem başına bölünmüş yaklaşık 6 MB GeoJSON ve her devletin hangi dönemlerde göründüğünü tutan bir arama dizini çıkar.

**Çizim** ([`src/components/GlobeMap.tsx`](src/components/GlobeMap.tsx)). Küreyi MapLibre GL JS 6 çizer. Birbirinin aynısı iki katman yığını vardır. Bir sonraki dönem gizli yığına yüklenir, sonra ikisi saydamlık geçişiyle yer değiştirir. Geçiş bitince gizli yığın boşaltılır, böylece çizim maliyeti kalmaz.

**Glyph sunucusu olmadan etiketler.** Stilde `glyphs` adresi yoksa MapLibre yazıları sayfanın kendi fontlarıyla çizer. Font kalınlığını font adından okur. Bu yüzden değişken Fraunces fontu adı "Semibold" ile biten bir aile olarak kaydedilir ([`src/lib/fonts.ts`](src/lib/fonts.ts)).

**Renkler**, yöneten devletin adının özetinden (hash) üretilir. Böylece bir devlet zaman içinde rengini korur, sömürgeler de bağlı oldukları gücün tonunu alır.

**Wikipedia özetleri** önce REST özet servisinden alınır. Bulunamazsa aramaya düşer, sonra dil bağlantılarıyla arayüz diline geçilir. İstekler önbelleğe alınmış Promise'lerdir ve React 19'un `use()` kancasıyla bir Suspense sınırı içinde okunur.

**Yükleme.** Her dönem bir kez indirilip önbelleğe alınır ve komşu dönemler önceden çekilir. Bu sayede adım atmak ve oynatmak anında olur. Oynatma, mevcut dönem yüklenmeden bir sonrakine geçmez.

## Teknolojiler

React 19 ve React Compiler · TypeScript 7 · Vite 8 (Rolldown) · Tailwind CSS 4 · MapLibre GL JS 6 · Motion · Biome · Vitest · GitHub Actions ve GitHub Pages

## Kendi bilgisayarında çalıştırma

Node.js 22.12 veya daha yeni bir sürüm gerekir.

```bash
git clone https://github.com/BerkanAtik/epochmap.git
cd epochmap
npm install
npm run dev
```

| Komut           | Ne yapar                                                            |
| --------------- | ------------------------------------------------------------------- |
| `npm run dev`   | Geliştirme sunucusunu başlatır                                      |
| `npm run build` | Tip kontrolü yapar ve statik siteyi `dist/` klasörüne derler        |
| `npm test`      | Birim testlerini çalıştırır                                         |
| `npm run check` | Lint ve biçim kontrolü (Biome)                                      |
| `npm run data`  | `public/data/` içindeki harita verisini kaynaklardan yeniden üretir |

## Veri ve doğruluk

Sınırlar dünya ölçeğindeki bir harita için yaklaşık ve sadeleştirilmiştir. Tarihî sınırlar çoğu zaman değişken, tartışmalı ya da bilinmezdi. Birçok bölge bir devlet yerine kültür adıyla gösterilir. Sınır düzeltmelerini doğrudan [historical-basemaps](https://github.com/aourednik/historical-basemaps) projesine göndermek en iyisidir, böylece veriyi kullanan herkes faydalanır.

| Veri            | Kaynak                                                                                                              | Lisans    |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| Tarihî sınırlar | André Ourednik ve katkıcıların [historical-basemaps](https://github.com/aourednik/historical-basemaps) projesi      | GPL-3.0   |
| Kara parçaları  | [world-atlas](https://github.com/topojson/world-atlas) üzerinden [Natural Earth](https://www.naturalearthdata.com/) | Kamu malı |
| Özetler         | [Wikipedia](https://www.wikipedia.org/), canlı olarak çekilir                                                       | CC BY-SA  |

## Yol haritası

- Wikidata'dan savaşlar, antlaşmalar ve kuruluşlar; tarihlerinde kürede gösterilecek
- Dönemler arasında daha yumuşak şekil geçişleri
- Daha fazla arayüz dili
- Yakınlaştırınca daha keskin sınırlar için vektör karolar

## Katkı

Issue ve pull request'ler memnuniyetle karşılanır. Pull request açmadan önce `npm run check`, `npm run typecheck` ve `npm test` komutlarını çalıştırın.

## Lisans

Sınır verisi GPL-3.0 lisanslı olduğu için proje de [GPL-3.0-or-later](LICENSE) lisanslıdır.
