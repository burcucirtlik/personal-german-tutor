---
name: seviye
description: Zorunlu ilk adım. Kullanıcının seviye beyanını cümle merdiveniyle alır (A0–B1.2), beyana göre uyarlanabilir zor sorularla tavanını ve boşluklarını tespit eder (kabul görüşmesi, daraltma, doğrulama) ve müfredatı tam oradan başlatır. Hiç bilmeyen kullanıcı tespitsiz başlar. "seviye", "seviye tespiti", "seviyemi ölç", "başlayalım", "ilk gün" denince ya da Profil'de seviye_tespiti tamamlandi değilken kullanıcı ne isterse istesin kullan.
---

# Seviye tespiti

Kurallar: `_sistem/Kurallar.md` → **Seviye tespiti**. Her seferinde oradan oku. Sıra: `_sistem/Müfredat.md`.

**İş bölümü:** soruları sen yazarsın ve cevapları sen puanlarsın. Neyin sorulacağını, kanıt sayımını, tavanı ve sonucu **betik** hesaplar: `python3 -I _sistem/seviye/tespit.py <komut>`. Hiçbirini elle hesaplama, kendi betiğini yazma. Betik durup bir şey söylüyorsa (eksik puanlama, plana uymayan soru dosyası) onu düzelt ve yeniden çalıştır.

| Komut | Ne yapar |
|---|---|
| `durum` | Hangi adımdasın, sırada ne var |
| `plan <beyan> [--json]` | Tur 1 kontrol noktaları ve her soru için önerilen yan kanıtlar |
| `sifir --yaz` | Beyan A0: tespitsiz başlangıç |
| `denetle <gün>-seviye-<n>` | Yazdığın soru dosyası plana uyuyor mu |
| `puan <gün>-seviye-<n> [--yaz]` | `sonuc` → konu sayaçları (`_kisisel/ilerleme.json`) ve dosyadaki `tespit` nesnesi |
| `tur2 [--json]` | Tur 2: daraltma konuları ve tarama yuvaları |
| `tur3 [--json]` | Tur 3: erken bitiş var mı, birleşik soru yuvaları |
| `sonuc [--yaz] [--json]` | Geçen konular, odaklar, Profil |

`--yaz` olmadan hepsi kuru çalışır.

## 0. Hangi adımdasın?
1. `date +%F` ile bugünü al. `_kisisel/Profil.md` yoksa önce `python3 -I _sistem/kurulum/baslat.py` (kişisel klasörü kurar, ortamı denetler; uyarılarını kullanıcıya sade dille ilet). Sonra `python3 -I _sistem/seviye/tespit.py durum`.
2. Tur dosyası yoksa **temiz başlangıç kontrolü:** `_kisisel/ilerleme.json`'da konu varsa ya da `05 Günlük/` içinde antrenman notu varsa bu klasör başka birinin ilerlemesini taşıyor olabilir. Devam etmeden kullanıcıya sor.

| `durum` çıktısı | Yapılacak |
|---|---|
| Tanışma ve beyan | 1. Tanışma |
| `sifir --yaz` | 1.5 Sıfırdan başlangıç |
| Tur 1'i yaz | 2. Tur 1 |
| Tur *n* puanlanacak | Cevap dosyası doluysa 4. Puanlama; boşsa kullanıcıya notun hazır olduğunu söyle |
| `tur2` | 3. Tur 2 (Tur 1 puanlandıktan hemen sonra, aynı gün) |
| `tur3` | 5. Tur 3: erken bitişse 6. Sonuç; değilse ve bugün Tur 1'in günüyse "Yarın `/seviye` yaz, doğrulama turu hazır olacak" de ve dur |
| `sonuc --yaz` | 6. Sonuç |

## 1. Tanışma ve seviye beyanı (sohbette, 3 dk)
1. Kısa bir hoş geldin: kişisel Almanca öğretmeniyim; önce seviyeni ölçeceğiz ki ne bildiğin konuları tekrar etmeyelim ne de eksik bir konuyu atlayalım. Antrenmanlar ondan sonra başlar; ilk gün seviyene göre 35–90 dk (ara verebilirsin, cevaplar kaydedilir), ikinci gün 10–45 dk; hiç bilmiyorsan ölçüm yok, hemen başlarız. Soruları tarayıcı arayüzünde çözeceğini, açmak için `Almanca.html`'yi Chrome ya da Edge ile açmasını (ya da `Almanca.command`'a çift tıklamasını) söyle. Adını sor.
2. Kurallar → **Seviye beyanı: cümle merdiveni**'ndeki altı cümleyi Türkçeleriyle göster ve sor: "Sözlüksüz, yardımsız ve hatasız kurabileceğin **son** cümle hangisi? Hiç Almanca bilmiyorsan 0 yaz; biraz biliyor ama 1. cümleyi kuramıyorsan 'biraz' yaz. İki cümle arasında kaldıysan üsttekini söyle." Bantları ve konu adlarını gösterme. Cevabı aynı bölümdeki tabloyla beyana çevir (0 → A0, biraz → A1.1, 1 → A1.2 … 5 ya da 6 → B1.2).
3. AskUserQuestion varsa tek çağrıda, yoksa düz soru: **günde kaç dakika** (30 · 45 · 60) ve **sınav tarihi belli mi** (Henüz değil · Belli, tarihi yazacağım).
4. `_kisisel/Profil.md`'ye yaz: `ad`, `beyan` (ör. `A2.1`), `gunluk_dakika`, `sinav_tarihi`, `seviye_tespiti: devam`.

## 1.5 Sıfırdan başlangıç (beyan A0)
`python3 -I _sistem/seviye/tespit.py sifir --yaz` (Kurallar → Sıfırdan başlangıç). Tur, not ve soru dosyası yazılmaz. Kullanıcıya: iki hattın ilk konusu, "her şeyi baştan ve sırayla öğreneceğiz; bildiğin bir şey çıkarsa hızlı geçer", ve hemen `/antrenman` yazabileceği. Burada dur.

## 2. Tur 1 · Kabul görüşmesi
Planı al: `python3 -I _sistem/seviye/tespit.py plan <beyan> --json`.

Dosyalar: `05 Günlük/veri/<bugün>-seviye-1.json` ve `05 Günlük/<bugün> Seviye 1.md`. Soru dosyasının biçimi antrenman skill'indekiyle aynı (`.claude/skills/antrenman/SKILL.md` → 5), ek olarak her soruda `konu` ve `kanit` alanı olur:
```json
{"id": "2.3", "tip": "ceviri", "konu": "A1-10", "kanit": ["A1-11", "A1-07"], "metin": "Yarın erken kalkmak ve bir bilet almak zorundayım."}
```
- `konu`: sorunun ölçtüğü konu (plandaki nokta). `kanit`: doğru cevapta kullanıcının kendisinin üretmesi gereken diğer yapıların konuları (en fazla 3). Soruda hazır verilen yapıyı `kanit`'e yazma.
- **Yan kanıtlar plandan gelir:** her noktanın `kanit` alanında iki sorusu için önerilen konular var. Cümleyi o yapıları da ürettirecek biçimde kur. Doğal bir cümle çıkmıyorsa yan kanıtları sorular arasında değiştir ya da azalt; ama `plan.tarama` listesindeki her konu Tur 1'de en az bir kez üretilsin (kalanı Tur 2 taramasına düşer ve ilk günü uzatır).
- Bölümlerin `rol` alanı `tespit`, `konu` alanı `null`.
- JSON'a üst düzey `"plan"` alanı olarak plan çıktısını aynen koy (Tur 2 bunu okur).

Bölümler, **bu sırayla** (yazma önce gelir ki sorulardaki yapılar serbest yazmayı etkilemesin):
1. **✍️ Kabul dilekçesi** (`yazma`; uzunluk ve talimat dili plandaki `yazma` alanından). Sahne: Tempelhof kapısında Dr. Ingrid yeni gelenlerden kısa bir *Aufnahmeantrag* istiyor. Leitpunkt'lar beyan bandındaki ve bir üst banttaki yapıları davet eder (Kurallar → Kontrol planı). B1 beyanında telc e-postası biçimi: hitap, 4 numaralı Leitpunkt, kapanış.
2. **🔧 Fiil hattı:** plandaki fiil noktaları, sıra numarasına göre (kolaydan zora), her noktaya plandaki kadar soru.
3. **🧱 İsim hattı:** aynı.
4. **🔤 Kelime taraması:** plandaki `kelime_seviyeleri`nin her birinden 8 kelime (çekirdek deste `_sistem/kartlar/deste.json`, seviyenin sıklık sırasına yayılmış), `ceviri` tipinde, `metin`: Türkçesi, `konu`: `"kelime-<seviye>"`. Talimat: isimleri artikelle yaz.

Soru yazma ilkeleri:
- Hepsi K4 düzeyinde, **ipucusuz**: `ceviri` ağırlıklı (en az yarısı), sonra `hata` ve `donustur`. `secmeli`, `dogruyanlis`, `eslestir`, ipuçlu `bosluk` ve `anahtar` yok. Taban noktalarında da K4.
- Bir noktanın iki sorusu konunun iki farklı yüzünü yoklar (ör. Akkusativ: eril artikel ve zamir; Perfekt: haben ve düzensiz Partizip).
- Soruda sadece `konu`'su ve beyan bandının **altındaki** yapılar geçer. Bant içi ya da üstü bir yapı kaçınılmazsa `kanit`'e yaz.
- Cümlelerin yarısı Tempelhof dünyasında geçer (Kurallar → Tempelhof evreni), sırlar ve Sezon yayı yok.
- Kelimeler soruyu zorlaştırmasın: konu dışı zor kelime varsa `ipucu` alanında Almancasını ver (ipucu yapıyı değil kelimeyi verir).
- Talimatlar plandaki dilde.

Yazınca: `python3 -I _sistem/seviye/tespit.py denetle <bugün>-seviye-1`. ✓ görmeden kullanıcıya haber verme.

Not (`05 Günlük/<bugün> Seviye 1.md`):
````markdown
---
tarih: <bugün>
tur: gunluk
seans: seviye-tespiti-1
durum: bekliyor
dakika: <gramer sorusu başına 1,5 dk + yazma 10–15 dk + kelime 3–5 dk>
puan:
veri: 05 Günlük/veri/<bugün>-seviye-1.json
konular: [<sorulan konular>]
cssclasses: [antrenman]
---
# Seviye tespiti · Tur 1 · Kabul görüşmesi

> [!quote] Tempelhof, kapı
> (2–3 cümlelik sahne: kapıya geliyorsun, Dr. Ingrid'in masası, Kartoffel seni kokluyor. Türkçe anlatım, Ingrid'in tek bir Almanca cümlesi.)

> [!tip] Nasıl çalışılır
> - Bu bir sınav değil, **nereden başlayacağını** bulmak için. Sözlük ve çeviri aracı kullanma.
> - **Bilmiyorsan tahmin etme, `?` yaz.** Şansla tutan cevap, bilmediğin bir konuyu "biliyor" gösterir.
> - Sorular beyanının biraz altından biraz üstüne kadar gidiyor. Zorlanman normal; zorlandığın yer tam aradığımız yer.
> - Cümleler bilerek uzun: her biri birkaç şeyi birden ölçüyor. Cevapların kendiliğinden kaydediliyor, ara verebilirsin.
> - Önce dilekçeyi yaz, sonra soruları. Bitince Claude Code'da `/seviye` yaz. Yaklaşık <dakika> dakika.

```dataviewjs
await dv.view("_sistem/alistirma", { gun: "<bugün>-seviye-1", ozet: true })
```

## 1. ✍️ Kabul dilekçesi
```dataviewjs
await dv.view("_sistem/alistirma", { gun: "<bugün>-seviye-1", bolum: 1 })
```
(diğer bölümler aynı biçimde; başlıklarda konu bağlantısı yok, sorulan konular gizli kalsın)
````

Kullanıcıya: notun yolu, süre, `?` kuralı, bitince `/seviye`.

## 3. Tur 2 · Daraltma ve tarama (Tur 1 puanlandıktan hemen sonra)
- `python3 -I _sistem/seviye/tespit.py tur2 --json`:
  - `fiil.konular`, `isim.konular`: daraltma (ya da yukarı çıkma) konuları, her birine `soru` kadar soru; `konu` alanı o konu. Yan kanıt ekleme.
  - `tarama`: birleşik soru yuvaları (`konu` + `kanit`). Her yuva bir `ceviri` cümlesi: listedeki yapıların hepsini kullanıcı kendisi üretmeli. Bir yuva doğal bir cümleye sığmıyorsa ikiye böl; her tarama konusu en az bir kez üretilmeli.
  - `yon` ve `bosluklar` senin mesajın için (beyanın altında mı, bandın içinde mi, yukarı mı çıkılıyor).
- Dosyalar: `05 Günlük/veri/<bugün>-seviye-2.json`, `05 Günlük/<bugün> Seviye 2.md` (`seans: seviye-tespiti-2`, `dakika`: daraltma sorusu 1,5 dk, tarama cümlesi 2 dk). Sahne: Pavel kulede telsizle birkaç soru daha soruyor. Bölümler: 🔧 daraltma, 🧱 daraltma, 📡 tarama (olanlar). Kelime ve yazma yok.
- Hiç daraltma konusu ve tarama yuvası yoksa Tur 2 yazılmaz; doğrudan 5'e geç.
- `denetle <bugün>-seviye-2` ✓ olmalı.
- Kullanıcıya: Tur 1'den kısa bir izlenim (beyanına göre aşağıda mı, yerinde mi, yukarıda mı; kesin sonuç vermeden), Tur 2'nin yolu ve süresi.

## 4. Puanlama (her tur)
1. Cevaplar: `05 Günlük/veri/<gün>-seviye-<n>.cevap.json`. Boş ya da `?` cevap o sorunun `konu`'sunda hatadır.
2. Her soruya `sonuc` yaz (biçim ve değerlendirme ilkeleri: `.claude/skills/kontrol/SKILL.md` → 2). Açıklamalar öğretici olsun, ama "bu konu geçti/kaldı" deme; sonuç en sonda.
3. **Konu konu kanıt:** puanı 1'den küçük olan ve `kanit` listesi bulunan her soruda `sonuc[id].kanit` nesnesini yaz: sorunun `konu`'su ve `kanit` listesindeki her konu için `1` (yapı doğru kuruldu), `0` (dilbilgisi hatası) ya da `null` (yapı cevapta görünmüyor). Genel etiketli hatalar (`yazim`, `kelime-eksik`, `ingilizce-kelime`, `kalip-ifade`) yapıyı bozmaz: yapı doğruysa `1`.
   ```json
   "2.3": {"puan": 0.5, "dogru": "Morgen muss ich früh aufstehen und ein Ticket kaufen.", "aciklama": "…", "etiket": "trennbar-onek",
           "kanit": {"A1-10": 1, "A1-11": 0, "A1-07": 1}}
   ```
   Serbest yazmayı yapı yapı oku: doğru kurulan her farklı yapının konusuna `1`, yanlış kurulana `0` (`sonuc[<yazma id>].kanit`). Metinde olmayan yapıyı yazma.
4. `python3 -I _sistem/seviye/tespit.py puan <gün>-seviye-<n>` (kuru çıktıyı oku), sonra `--yaz`. Betik konu notlarının `yoklama`, `kademe` ve `son_calisma` alanlarını ve dosyadaki `tespit` nesnesini yazar.
5. Hatalar için `06 Fehlerlog/` notlarını güncelle (kontrol skill'i → 3). Cümle kartı ekleme.
6. Yazma görevini telc kriterleriyle puanla (Tur 1; A2.2 ve üstü beyanlarda) ve `P-09` notunun `ustalik` alanına ilk değer olarak yaz.
7. Notu kapat: `durum: tamamlandi`, `puan` = genel yüzde. Notun sonuna kısa bir `## Sonuç` kutusu: kaç soru, en belirgin 2 hata türü ve kısa açıklaması. Konu adı ve seviye yorumu yazma (en sona kadar).

## 5. Tur 3 · Doğrulama (en erken ertesi gün)
- `python3 -I _sistem/seviye/tespit.py tur3 --json`. `erken_bitis: true` ise Tur 3 yok → 6. Sonuç. Bugün `en_erken`'den önceyse dur ("yarın `/seviye`").
- `sorular`: birleşik soru yuvaları. Her yuva bir `ceviri` cümlesi: `konu` + `kanit` listesindeki yapıların hepsini ürettirir. Aynı konu dizisi arka arkaya gelirse farklı kelimeler, farklı cümle yapısı kullan. Bir yuva doğal bir cümleye sığmıyorsa böl ya da yuvalar arasında konu değiştir; `denetle` her konunun ihtiyacını sayar.
- İstersen son 6–8 kanıtı kısa bir bağlam metnine çevir (`bosluk`, ipucusuz; Tempelhof Versammlung'unun duyurusu ya da bir mektup): her boşluğun konusu sorunun `kanit` listesine.
- `yukari`: tavanın üstünde sorulacak konular, 2'şer soru, yan kanıtsız.
- `sigmayan` doluysa bir şey yapma: o kanıtlar günlük yoklamada tamamlanır.
- Dosyalar: `05 Günlük/veri/<bugün>-seviye-3.json`, `05 Günlük/<bugün> Seviye 3.md` (`seans: seviye-tespiti-3`, `dakika`: cümle başına ~1,5 dk). Sahne: Versammlung yeni geleni dinliyor; son sorular.
- `denetle <bugün>-seviye-3` ✓ olmalı.

## 6. Sonuç (Tur 3 puanlandıktan sonra; erken bitişte Tur 2'den sonra)
1. `python3 -I _sistem/seviye/tespit.py sonuc` (kuru), sonra `--yaz`. Betik geçen konuları, odakları, kademeli ilk tekrar tarihlerini, kelime temalarını (`_kisisel/ilerleme.json`) ve `_kisisel/Profil.md`'yi yazar. "bu seviye destede yok" uyarısı varsa antrenman skill'i → 6.2'ye göre sıradaki 100 kelimeyi ekle.
2. Son tur notunun (`Seviye 3`, erken bitişte `Seviye 2`) sonuna bir **Sonuç** bölümü yaz (`sonuc --json` çıktısından):
   ````markdown
   ## Sonuç: buradan başlıyorsun

   > [!sonuc] Beyanın A2.2 · ölçülen: 🔧 fiil A2.2 · 🧱 isim A2.1
   > 🔧 Fiil hattı: [[A1-13 Imperativ]] · K1 (boşluk) — 🧱 İsim hattı: [[A2-02 Wechselpräpositionen]] · K2
   > 31 konu tespitle geçti · 2 boşluk · 3 konu yoklamada devam ediyor · Kelime kartları seviye 3'ten

   | Hat | Geçen konu | Tavan | Boşluklar | Başlangıç |
   |---|---|---|---|---|

   > [!ders] Seni en çok zorlayan iki şey
   > (iki hata türü, kısa Türkçe açıklama ve doğru örnek)
   ````
3. Kullanıcıya: beyan ve ölçülen seviye (fark bir banttan büyükse nedeni tek cümleyle), iki hattın başlangıç konusu ve kademesi, kaç konunun geçtiği, boşluklar ("ileri konuları biliyorsun ama şu ikisi eksik; önce onları kapatacağız"), yoklamada devam edenler, kelime seviyesi, Schreiben puanı (telc A/B/C/D), en önemli iki hata türü. "Yarından itibaren `/antrenman`; Tempelhof günlüğü Tag 1'den başlıyor." Hikâyeden bir şey açık etme.
