---
name: kontrol
description: Bugünün (veya belirtilen günün) antrenman notundaki cevapları puanlar, hataları etiketler, Fehlerlog kartlarını ekler ve konu notlarındaki ilerleme verilerini Kurallar.md'ye göre günceller. "kontrol", "kontrol et", "bitirdim", "puanla" denince kullan.
---

# Antrenmanı puanlama ve ilerlemeyi güncelleme

## 1. Notu ve cevapları bul
- **Kapı:** `_kisisel/Profil.md` → `seviye_tespiti` `tamamlandi` değilse ve bekleyen not bir seviye tespiti notu değilse hiçbir şeyi puanlama; `/seviye`'ye yönlendir.
- Varsayılan olarak `05 Günlük/` içindeki en yeni `durum: bekliyor` notunu kullan.
- Notun frontmatter'ında `seans: seviye-tespiti-…` varsa bu bir seviye tespiti notudur: bu skill'i değil, `.claude/skills/seviye/SKILL.md` → Puanlama adımını uygula.
- Notun frontmatter'ında `veri:` alanı varsa **etkileşimli biçimdir**:
  - Sorular: `05 Günlük/veri/<gün>.json`
  - Cevaplar: `05 Günlük/veri/<gün>.cevap.json` (`{"1.1": "den", "4.2": ["kaufen", "ein"], ...}`; birden fazla boşluklu sorularda liste)
  - Cevap dosyası yoksa veya boşsa kullanıcı henüz arayüzde cevap yazmamıştır. Puanlamadan önce sor.
  - `_` ile başlayan anahtarlar soru değildir. `_anlik`: anında kontrol edilen sorular (`{"4.1": {"dogru": true, …}}`). Bu sorularda cevap kullanıcının **ilk ve kilitli** cevabıdır; anahtarla karşılaştırılmıştır. Puanı yine sen verirsin: anahtarın kabul etmediği ama doğru olan bir alternatifi 1 say ve `aciklama`'da belirt. Anında yanlış görüp bildiği hâlde aynı hatayı başka sorularda tekrar etmesi hata türünün güçlü kanıtıdır.
- **Dinleme ve dikte (o gün):** `_kisisel/ses/dinleme.json` → `sesler[<ses yolu>].gunler[<gün>]` kaç kez dinlendiğini, `_kisisel/ses/dikte.json` → `oturumlar` dikte sonuçlarını (`oran`, cümle cümle `yazilan` ve `hatalar`: `yazilan→doğru` ya da eksik kelime) tutar. Dikte puana girmez ama hatalarını etiketle (`umlaut`, `buyuk-harf`, `trennbar-onek`… gerçek hata türüyle) ve tekrar eden bir yazım/duyma hatasını Fehlerlog'a işle. Özete bir satır ekle: "Dikte: %82, en çok *ü/u*".
- `veri:` alanı yoksa **eski biçimdir**: cevaplar notun **Cevap:** satırlarında ya da doğrudan sorudaki boşlukta (`___` yerine) olabilir; ikisini de cevap say.
- Boş cevap yanlış sayılır. Yoklamada boş cevap dilbilgisi hatası sayılır (yoklamayı bozar).
- Aradaki sorular boş ama sonrakiler cevaplanmışsa kullanıcı bunları bilerek atlamıştır, sormadan devam et. Son bölümlerin hepsi boşsa, bitirip bitirmediğini sor.

## 2. Her cevabı puanla
**Etkileşimli biçimde** sonuçları soru dosyasına (`<gün>.json`) üst düzey bir `sonuc` nesnesi olarak yaz. Ekran bunları her kartın altında yeşil, kırmızı veya sarı geri bildirim olarak gösterir ve cevap kutularını kilitler:
```json
"sonuc": {
  "1.1": {"puan": 1, "dogru": "den"},
  "1.2": {"puan": 0, "dogru": "b) einen", "aciklama": "der Topf eril → Akkusativ'de ein → einen.", "etiket": "akkusativ-artikel"},
  "1.3": {"puan": 0.5, "dogru": "Ich habe einen Bruder.", "aciklama": "Kısa açıklama", "etiket": "yazim"}
}
```
- `puan`: 1 doğru, 0.5 kısmen doğru, 0 yanlış veya boş
- `yapi` (gramer sorularında): **sadece sorunun ölçtüğü yapıya** bakar; doğru kurulduysa `1`, değilse `0`. Kademe puanı buna göre hesaplanır (Kurallar → Kademe geçişi). **Konuyla alakasız hata yapıyı bozmaz** (bu kural çok önemli): ismin küçük harfle yazılması, harf hatası, yanlış ya da bilinmeyen kelime, İngilizce kelime, kuralsız artikel ya da çoğul, noktalama. Bunlar genel etiket alır (`yazim`, `kelime-eksik`, `ingilizce-kelime`, `kalip-ifade`, `artikel-kelime`, `plural-kelime`), ham puanı düşürür ama betik genel etiketli cevabı **puanı ne olursa olsun** yapı doğru sayar. Yanlış fiil seçilmiş ama çekim kalıbı doğruysa da yapı doğrudur (*du liest* yerine *du siehst* istendi → kelime hatası). Sadece yapı cevapta **hiç görünmüyorsa** (boş, çevrilmemiş, yapı kurulmamış) açıkça `yapi: 0` yaz. Başka bir konunun yapısındaki hata da yapıyı bozmaz (Başka konunun hatası, aşağıda).
- `dogru`: doğru cevap. `aciklama`: yanlış ve kısmen doğru cevaplarda kısa Türkçe açıklama; doğru cevapta isteğe bağlı küçük bir not. `etiket`: hata etiketi (doğruysa yazma).
- Boş cevapta `aciklama` "Boş bırakıldı." diye başlasın.

**Eski biçimde** her **Cevap:** satırının altına boş bir satır bırakıp geri bildirim kutusu ekle: `> [!dogru] Doğru`, `> [!yanlis] Doğrusu: …` (altında açıklama ve `#hata/<etiket>`), `> [!kismen] Neredeyse: …`.

Değerlendirme ilkeleri:
- Büyük-küçük harf hatası (Almancada isimler büyük harfle başlar) ham puanda yarım puan düşer (`yazim`), kademeye hiç dokunmaz. Sadece noktalama veya umlaut yerine `ae/oe/ue` yazımı tam doğru sayılır.
- Çeviri sorularında alternatif doğru çevirileri kabul et.
- Yazma görevlerini `01 Sınav/Puanlama ipuçları.md` dosyasındaki telc kriterleriyle puanla: I Aufgabenbewältigung, II Kommunikative Gestaltung, III Formale Richtigkeit, her biri A/B/C/D. Altına düzeltilmiş bir versiyon ekle. Görev Tempelhof'tan gelse de ölçüt aynıdır: Leitpunkt'ların hepsi, hitap ve kapanış, doğru register (du/Sie). Düzeltilmiş versiyon da aynı sahnede kalır.
  - `aciklama`'nın başına her Leitpunkt için tek satır yaz: `1 ✓ sordun · 2 ✗ anlatman gerekiyordu, sordun · …`. Etiketler: `leitpunkt-eksik`, `leitpunkt-yanlis-eylem`, `hitap-kapanis` (eski `schreiben-format` yerine).
  - **Schreiben aşaması** (Kurallar → Schreiben basamakları): `01 Sınav/Teile/P-09 …` notunun `asama` alanına bak. Son iki görevde geçiş şartı sağlandıysa `asama +1` yap ve sonuç notunda söyle. Puanı notun `## Sonuç` tablosuna "Schreiben 15/45 · aşama 1 (I: B, II: C)" biçiminde yaz.
- Yazma görevindeki gramer hatalarını etiketle, ama Fehlerlog'daki satırına `(yazma)` ekle: bu hatalar hata etiketi kuralını tek başına tetiklemez.

### Yeni biçimler (Kurallar → Sınav biçimleri)
- **`kutula`:** cevap, öğelerle aynı sırada kutu adları listesidir. `puan` = doğru öğe ÷ öğe sayısı (bir ondalık); yapı ancak hepsi doğruysa doğrudur (`yapi` yazma, betik çıkarır: tam puan → 1). `dogru` alanına yanlış öğeleri doğru kutularıyla yaz (*fragen → değişmez*), açıklamada iki kutudan birer örnek ver.
- **Mini Sprachbausteine** (`rol: beceri`, `teil: P-04 / P-05`): boşluk başına 1 puan. Doğru cevap konuyu ilerletmez (tanıma). **Yanlış** cevaba boşluğun `konu`'suna göre gerçek hata etiketini ver ve Fehlerlog'a yaz; seçtiği çeldiricinin neden olmadığını tek cümleyle açıkla.
- **Açık boşluklu mektup** (`rol: tekrar`, `yer` alanlı `bosluk`): diğer tekrar soruları gibi puanlanır; anahtarın kabul etmediği ama metne uyan doğru kelime 1 sayılır.
- **Pano "uyan yok":** anahtarı `x` olan durumda bir ilan seçildiyse açıklamada o ilanın hangi ayrıntıda uymadığını yaz (gün, saat, kişi).
- **Kendi cümlelerini düzelt** (`hata`, `rol: beceri`): hatanın gerçek etiketini ver, Fehlerlog satırına `(yazma)` ekle (hata etiketi kuralını tek başına tetiklemez). Hatayı bu kez düzelttiyse açıklamada söyle: "<gün> tarihinde *…* yazmıştın, bugün düzelttin."
- **Mikro Leitpunkt** (`yaz`, `rol: beceri`): istenen eylem yapıldıysa 0,5; cümle anlaşılır ve üretim sınırındaki yapılar doğruysa 0,5 daha. Eylem yanlışsa `leitpunkt-yanlis-eylem`. `dogru` alanına aynı eylemi yapan bir model cümle yaz.
- Schreiben onarım günü bölümleri `P-09`'a ve Schreiben basamağına yazılmaz; `## Sonuç`'ta tek satırla özetle ("Yazı onarımı: 4/5 kendi cümlen düzeldi · Leitpunkt eylemi 3/4").

### Hata etiketleri
- Etiket kısa, küçük harfli, tireli ve **tekrar kullanılabilir** olmalı: `akkusativ-artikel`, `weil-fiil-sonda`, `perfekt-sein-haben`, `trennbar-onek`, `adjektiv-endung`, `dativ-praeposition`.
- Önce `06 Fehlerlog/` içindeki mevcut etiketlere bak, uygun olan varsa onu kullan. Yeni etiket ancak gerçekten yeni bir hata türüyse açılır.
- **Artikel hatası iki etikete ayrılır** (Kurallar → Artikel: kural mı, kelime mi?): isim bir kurala uyuyorsa (insan ismi, *-ung / -heit / -keit / -ion*, *-e*, *-chen / -lein*, gün-ay-mevsim) `artikel-genus` (yapı hatası, `yapi: 0`). Artikel kuraldan çıkmıyorsa (*der Tisch, das Buch*; *der Name* gibi istisnalar dahil) `artikel-kelime`: genel etiket, `puan: 0.5`, ölçülen yapı doğruysa `yapi: 1`; ismi artikeliyle "Yarın bağlamda" listesine yaz. Açıklamada her zaman kuralı ya da "bunu kartla öğreniyoruz" bilgisini ver.
- **Başka konunun hatası** (Kurallar → Başka konunun hatası): `yapi` sadece sorunun ölçtüğü konuyu (bölümün ya da sorunun `konu`'su) gösterir. Hata başka bir konunun yapısındaysa (odak düzenli fiillerken *tragt*, Modalverben sorusunda *der Frau*) `etiket` o hatanın gerçek etiketi olur ve ölçülen konu için `yapi: 1` yaz (yazmasan da betik etiketin bağlı konusundan çıkarır). Puan yine düşer, hata Fehlerlog'a, hata etiketi kuralına ve cümle kartına gider. Cevapta hem ölçülen konunun hem başka konunun hatası varsa ölçülen konununki `etiket`'e (`yapi: 0`), diğeri `etiketler: ["…"]` listesine yazılır; ikisini de Fehlerlog'a işle.
- **Çoğul hatası da iki etikete ayrılır** (Kurallar → Çoğul: kural mı, kelime mi?): kalıba uyan isimde (*-e → -n*, *-in → -innen*, *-ung → -en*, *-chen / -er* değişmez, yabancı *-s*, çoğulda *die*) `plural-endung` ya da `plural-artikel` (yapı hatası). Çoğulu kuraldan çıkmayan isimde (*Tische, Häuser, Stühle, Jahre*) `plural-kelime`: genel etiket, `puan: 0.5`, yapı doğru sayılır; ismi çoğuluyla "Yarın bağlamda" listesine yaz.
- **Kontrast sorusu** (`kontrast` alanı olan): `yapi` sadece odak tarafına bakar; komşu taraftaki hata komşu konunun etiketini alır (yukarıdaki kural). Etiket hatanın olduğu tarafa göre verilir (*frägt* → düzensiz fiil kuralının aşırı genellemesi: `praesens-vokalwechsel`), açıklama iki biçimi yan yana gösterir (*er fragt ↔ er fährt*).

## 3. Fehlerlog'u güncelle
Her hata etiketi için `06 Fehlerlog/<etiket>.md`:
- Not yoksa `_sistem/Şablonlar/Hata.md` şablonundan oluştur.
- `sayac` alanını hata sayısı kadar artır, `son_gorulme` alanını bugünün tarihi yap.
- `## Son görülmeler` bölümüne `- <tarih>: soru <id> (<kısa not>)` satırı ekle; yazma görevinden geliyorsa notun sonuna `(yazma)`. Fehlerlog'a artık `::` kartı **eklenmez** (gösteren ekran yok); yanlış cümlenin doğru hali aşağıdaki gibi cümle destesine gider.

### Mini drill (aynı hata üçüncü kez)
`ilerleme.py` çıktısında "MİNİ DRILL önerisi" satırı varsa (Kurallar → Drill'ler → Mini drill):
1. `09 Drill/` içinde `durum: acik` bir mini drill var mı bak. Varsa yeni etiketi o notun `sira` alanına ekle ve **kuyruğu son 7 gündeki hata sayısına göre sırala** (betik çıktısındaki "kuyruk hata sayısına göre: N"; çok olan önce, eşitlikte odak konusunun etiketi önce). Açık drill en az bir tam tur yapıldıysa (`<set>.durum.json` → `gecmis`) ve kuyruğun başındaki etiket ondan daha çok hata veriyorsa: açık drill'i `durum: ertelendi` yap (ilerlemesi kalır, etiketi kuyruğa döner) ve baştaki etiketin setini aç (2–3. adımlar). Değilse set açma.
2. Yoksa `_kisisel/drill/mini-<etiket>.json` setini üret (30 soru, 3 bölüm: ayırt et → üret → cümle; üstte kontrast tablosu; `hedef: {"yuzde": 90, "sure": null}`; her soruda `tr`, kısa Türkçe `aciklama`, gerekiyorsa `alternatifler`). Biçim için `_sistem/Şablonlar/mini-drill.json` örneğine bak. Sadece bitmiş ve odak konuların yapıları.
3. `09 Drill/Mini <etiket>.md` notunu yaz (`tur: drill`, `set`, `etiket`, `durum: acik`, `acilis: <bugün>`; kısa Türkçe açıklama ve `dv.view("_sistem/drill", { set: "mini-<etiket>" })`).
4. O etiketin `aciklama`'larında bugünden itibaren kontrast çifti kullan (Kurallar → Aynı açıklama üçüncü kez işe yaramaz).
- Açık mini drill'in `_kisisel/drill/<set>.durum.json` dosyasında `tamamlandi` alanı varsa notu `durum: tamamlandi` yap ve sıradaki etiket varsa onun setini aç.

### Eksik kelimeler
`kelime-eksik` etiketli her cevaptaki eksik kelime isim, fiil ya da sıfatsa ve kart destelerinde (`_sistem/kartlar/deste.json`, `_kisisel/kartlar/deste.json`) yoksa `_kisisel/kartlar/deste.json`'a yalın biçimiyle ekle (`kaynak: "kontrol"`, uygun `seviye`, `sira` kaldığı yerden; Kurallar → Kartlar biçimi). Destede zaten varsa ekleme; ertesi günün `/antrenman`'ına not düş (sonuç notunda "Yarın bağlamda: *nass, krank*").

### Cümle kartları
Yanlış veya kısmen doğru cevaplardan, doğru cümlesi tam bir cümle olanları (en fazla 5 tane) cümle destesine ekle: `_kisisel/kartlar/deste.json`, `"deste": "cumle"`, `de`: doğru Almanca cümle, `tr`: Türkçe karşılığı, `kaynak`: konu id'si. Aynı cümle zaten varsa ekleme. `durum.json` dosyasına dokunma. Cümle kartına `seviye` yaz (1: 3–5 kelime, 2: 5–8, 3: 8+).

## 4. Konu notlarını güncelle
**Hesabı betik yapar.** `sonuc` yazıldıktan sonra:
```bash
python3 -I _sistem/ilerleme.py <gün>          # kuru: ne değişecek
python3 -I _sistem/ilerleme.py <gün> --yaz    # _kisisel/ilerleme.json ve _kisisel/ilerleme.log
```
Kuru çıktıyı oku ve aşağıdaki tabloyla karşılaştır; mantıklıysa `--yaz` ile uygula. Betik bir şeyi yanlış yapıyorsa (ya da durup uyarı veriyorsa) elle düzelt ve nedenini `## Sonuç`'a bir satırla yaz. Betik uyarılarını (ör. "onarımda 3 soru sorulmuş", "`alt` listesi yok") kullanıcıya değil, ertesi günün `/antrenman`'ına not olarak düş. Ders notu, Fehlerlog, kartlar ve sözlük hâlâ senin işin.

Betiğin uyguladığı kurallar (`_sistem/Kurallar.md` → **Müfredat**, **Kelime temaları ve sınav bölümleri**). Bölümün `rol` alanı neyin nasıl puanlanacağını söyler:

| `rol` | Ne yapılır |
|---|---|
| `odak` | Kademe puanı = bölümde **yapı** doğruluğu (`yapi`). Kademeler 1–3; geçişi **kayan pencere** belirler (`pencere`, `kademe`, `durum`): o kademedeki son 12 yapı sorusunda en az 10 doğru, en az 2 gün ya da yapı hatasız seans → kademe +1, **K3'te konu biter** (`temiz`, `bitis`, `yayilim` = 14 gün sonra; Kurallar → Yayılım); pencere %60'ın altındaysa −1. Takılan alt beceri geçişi durdurmaz. **Süre tavanı:** odakta 8 seansı geçen, K3'te ve son 3 seans ortalaması ≥ %70 olan konu da biter. Konu bitince hattın sıradaki konusu (ön konu varsa o) odak olur; odak K3'e ulaşınca sıradaki yoklaması bozuk konu ön konu olur. `ustalik` ham puandan. |
| `on` | Ön konu: odak gibi, ama en fazla K2. |
| `yoklama` | Her soru kendi `konu`'suna: `yoklama: d/s/g`. Yapı hatası (genel etiketler hariç) → `yoklama: hata d/s`, başlangıç kademesi (d/s ≥ 2/3 → 2, değilse 1). Geçer: s ≥ 6, g ≥ 2, hata yok ve `alt` listesindeki kenar olmayan alt becerilerin hepsi `yoklama_alt`'ta. |
| `tekrar` | Dar onarımdaki konu (`dar` alanı): dar alt becerilerin son 6 sorusunda en az 5 doğru, 2 gün, her dar alt beceride doğru → biter (`temiz`, `adim: 1`); başka bir alt beceride yapı hatası → `dar` listesine eklenir. Diğerleri: konu başına yapı puanı. Bitmiş konu: ≥ 85 → `adim +1`; 60–84 → yarın; < 60 → onarım (o gün 3'ten az soru sorulduysa onarım yok, yarın yine). Onarımdaki konu: onarım başından beri son 10 soruda en az 8 doğru, en az 2 gün, aynı alt beceride 2 hata yok → yeniden `temiz`, `adim: 1` (`onarim_bas`, `pencere`). |
| `kelime`, `beceri` | Eski puanlama ve kilit açma. `beceri` bölümleri ilgili Teil'e (`teil` alanı ya da başlıktaki Hören/Lesen/Schreiben) yazılır; `teil`'siz ve başlığında bu kelimeler geçmeyen bölüm (Schreiben hazırlığı, onarım günü) hiçbir konuya yazılmaz. Sprachbausteine bölümündeki soruların `konu` alanı sadece hata etiketi kuralı içindir. |
| `inatci`, `sesli` | Konu güncellenmez (`sesli` genel puana da girmez). |

Odak konusu bittiyse (betik "BİTTİ, … genele yayılıyor" yazar) `## Sonuç`'ta bunu açıkça söyle: yeni odak hangisi, takılan kalıplar varsa hangileri (yayılımda öne çıkar), konu 14 gün boyunca her gün tekrar bölümünde gelecek. Ardından betik hata etiketi kuralını oranla uygular (bitmiş konu onarıma girer; odaktaki ve onarımdaki konuda bir şey değişmez, pencere ölçer) ve mini drill önerir. Betik "takılan alt beceri" ya da "kanıtı olmayan alt beceri" yazdıysa bunu `## Sonuç`'a ertesi günün `/antrenman`'ı için not düş.

`rol` alanı olmayan eski notlarda konuların sadece `ustalik` ve `son_calisma` alanları güncellenir; `kademe`, `durum` ve müfredat değişmez.

Hesaplamaları elle yapma: `_sistem/ilerleme.py` her zaman kullanılır. Tarihleri `date +%F` ile al.

### Tıklama sinyali
Konu notlarından sonra `python3 -I _sistem/sozluk/sinyal.py <bugün>` çalıştır (`_kisisel/sozluk/sinyal.json` güncellenir; dashboard ve `/antrenman` okur). Bugün `bakmiyor` ya da `ogrenildi` durumuna geçen kelimeleri kullanıcıya bildirirken kısaca an. `istek` (balonda "⭐ Karta ekle") ve `biliyor` ("✓ Biliyorum") durumları kullanıcının kendi işaretleridir: `istek` kelimelerinin kartı ertesi gün `/antrenman`'da eklenir.

## 5. Antrenman notunu kapat
- Frontmatter'da `durum: tamamlandi` yap ve `puan` alanına genel yüzdeyi yaz (tam sayı).
- Etkileşimli biçimde özet kartı ve soru kartları sonucu `sonuc` nesnesinden kendileri gösterir; kullanıcı tarayıcı sekmesine dönünce kendiliğinden görünür.
- Notun sonuna (Tempelhof günlüğü bölümünden önce) bir özet ekle:

```markdown
## Sonuç

> [!sonuc] Genel puan: 78%
> 34 / 44 doğru · 🔧 fiil hattı K3'e geçti · 🧱 isim hattı K2'de

| Konu | Rol | Puan | Kademe | Durum | Sonraki |
|---|---|---|---|---|---|
| [[A1-11 Trennbare Verben]] | 🔧 odak | 9/10 | K2 (pencere 11/12) → **K3** | öğreniliyor | yarın |
| [[A1-10 Modalverben]] | 🔎 yoklama | 3/3 | yoklama 6/6, 2 gün → **bitti** | temiz | 2026-11-04 |

> [!ders] Bugünün dersi
> (en sık yapılan hata türü hakkında 2–3 cümlelik Türkçe açıklama ve bir doğru örnek)

**Müfredat:** 🔧 fiil hattı K3'e geçti · 🧱 isim hattında [[A1-05 Plural der Nomen]] K2'de, pencere 7/8 (takılan: *-er + Umlaut*) · Biten konular: [[A1-10 Modalverben]]
```

- Frontmatter'da `cssclasses: [antrenman]` yoksa ekle.

## 6. Kullanıcıya bildir
Kısa bir mesaj yaz:
- Genel puan
- Her hattın kademe değişimi (geçti, aynı kaldı, düştü), penceresi ("son 12 soruda 9 doğru, 10 olunca geçiyorsun") ve takılan alt beceri varsa hangisi
- Yoklama sonuçları: hangi konu bitti, hangisinin yoklaması bozuldu (bozulduysa neyin oturmadığı)
- Tekrardaki konular, onarıma giren varsa
- En önemli hata türü ve tek cümlelik ipucu
- "Dashboard güncellendi, arayüzde Dashboard'a bakabilirsin."
