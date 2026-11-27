---
name: antrenman
description: Bugünün Almanca antrenman notunu 05 Günlük/ içinde oluşturur. Müfredattaki iki hattın (fiil, isim) odak konularını kademelerine göre sorar, sırası yaklaşan konuları yoklar, bitmiş konuları tekrar eder. "antrenman", "bugünkü antrenman", "çalışalım", "egzersiz ver" denince kullan.
---

# Günlük antrenman oluşturma

## 0. Akış (hızlı yol)
1. **Durum:** `python3 -I _sistem/antrenman/hazirla.py` (tarih vermezsen bugün). Tek çıktıda: kapı, mevcut not, iki hattın odağı ve ön konusu, yoklama penceresi, tekrar listesi (onarım, yayılım, vadesi gelen), alt beceri raporu, sınırlar, kelime teması, günün becerisi, kademe tanımları, önceki notun "yarın" notları, son 7 günün hata türleri, mini drill, yıpranmış kelimeler, tıklama sinyali, kartlar ve Tempelhof'un sıradaki yazarı ve vuruşu. **`Kurallar.md` ve `Müfredat.md`'yi baştan okuma:** betik bugün geçerli satırları oradan canlı çıkarır. Bir kuralın ayrıntısı gerekirse sadece o bölümü Grep ile aç.
2. **Köprü ve günlük:** günün hikâye köprüsünü seç (vuruştan küçük bir ipucu: ilan, telsiz kaydı, not) ve Tempelhof günlüğünü hemen **arka planda bir alt-ajana** ver (7. adım). Sen bu arada soruları yazarsın.
3. **Sorular:** soru dosyasını yaz (2–5. adımlar); `cesitlilik.py` ❌ kalmayana kadar düzelt. Yazmadan önce çıktıdaki yıpranmış kelimelerden uzak dur: düzeltme turu azalır.
4. **Not ve ses:** `python3 -I _sistem/antrenman/not_yaz.py <bugün> --ses --yaz` (5. adım). Notu elle yazma.
5. **Sözlük ve kartlar:** alt-ajan bitince `python3 -I _sistem/sozluk/eksik.py <bugün>` (günlüğü de tarar), sonra kartlar (6. adım) ve kullanıcıya bildir (8. adım).

## 1. Durumu oku
`hazirla.py` çıktısını kullan; elle toplama. Çıktıya göre:
1. **Kapı:** "⛔ Seviye tespiti tamamlanmadı" yazıyorsa antrenman, kart, günlük ya da Tempelhof notu **oluşturma**. Kullanıcıya seviye tespitinin zorunlu olduğunu söyle ve `.claude/skills/seviye/SKILL.md`'yi uygula (Kurallar → Seviye tespiti → Zorunlu).
2. **Not zaten varsa** yeni not oluşturma: `durum: bekliyor` ise kullanıcıya hazır olduğunu söyle; `tamamlandi` ise ek bir antrenman isteyip istemediğini sor, isterse `<bugün>-2` olarak oluştur.
3. **Önceki notun "yarın" notları**, "Yarın bağlamda" kelimeleri ve betik uyarıları bugün uygulanır.
4. **Kısa gün mü?** Kullanıcı "kısa" dediyse kısa antrenman yaz (Kurallar → Kısa gün). Çıktı "Dün antrenman yok" diyorsa (ve kullanıcı süre söylemediyse) normal antrenmanı yaz ama mesajda tek cümleyle kısa günün de mümkün olduğunu söyle; kullanıcı isterse aynı gün `kisa: true` notuyla değiştir.
5. **Mini drill:** açık mini drill varsa notun başına (`not.ust`) bir kutu: `🎯 Açık mini drill: [[Mini <etiket>]] (~5 dk)`. Çıktı "HİÇ BAŞLANMADI (2+ gün)" diyorsa kutuyu `warning` yap ve "henüz başlamadın" diye güçlendir.

## 2. Ne sorulacağını seç
Kurallar → Günlük antrenmanın bileşimi tablosunu uygula. Sıra:
1. **Her hattın odak konusu:** hattın `sira` sırasındaki ilk `temiz` olmayan ve **onarımda olmayan** gramer konusu (`durum: zayif` olup `dar`, `bitis` ya da `yoklama: gecti` alanı olan konu onarımdadır, tekrar bölümünde çalışılır). Emin olmak için `ilerleme.py alt` ve `sinir` çıktısına bak: rol orada yazar.
   - `kademe` 1–3 ise: o kademenin soru türleriyle 8–14 soru (Kurallar → Kademeler). K3 son kademedir: geçilince konu biter ve genele yayılır. `pencere` doluyorsa (ör. `7/8`) bu kademenin ikinci günüdür: birinci günden zor yaz (farklı fiil ve isimler, daha uzun cümle, daha az ipucu).
   - **Dağılım alt beceri kanıtına göre** (Kurallar → Alt beceri kanıtı): kırmızı alt becerilere soruların **yarısı**, kanıtı olmayanlara en az birer soru, yeşillere toplam en fazla dörtte bir. Kırmızı alt beceriyi dünkü kalıpla sorma: farklı kelime, farklı tür.
   - **Kontrast (K3):** soruların en az dörtte biri odak yapısını karışan komşu yapıyla aynı soruda karşılaştırır ve `kontrast: "<konu id>"` alanı alır (Kurallar → Kademeler → Kontrast soruları). "Son yapı hataları" listesindeki aşırı genellemeler (*frägt, ich hilfe, zählest*) hangi kontrastın gerektiğini söyler.
   - **Artikel konusunda** ([[A1-04 Artikel und Genus]]) sadece kurala uyan isimler sorulur (insan isimleri, -ung/-heit/-keit/-ion, -e, -chen/-lein, günler-aylar-mevsimler); artikeli kuraldan çıkmayan isim (*der Tisch*) bu bölümde sorulmaz (Kurallar → Artikel: kural mı, kelime mi?).
   - `kademe: 0` ise konu yoklamadadır (aşağıda). Yoklaması bozulmuşsa (`yoklama: hata d/s`) konu öğretilmeye başlar: `d/s ≥ 2/3` ise K2, değilse K1. Bu durumda kontrol betiği kademeyi zaten yazmış olur; yazmamışsa bu kurala göre başlat.
   - **Kenar durumlar** (`alt` listesinde `kenar:` olanlar) odakta sorulmaz; yayılımda ve tekrarda sorulur.
   - **Ön konu:** hatta `on: true` bir konu varsa ona ayrı bir bölüm: 4–6 soru, kendi kademesinin türleriyle, ders kutusu (`rol: "on"`, `kademe`). Başlık: `## 3. 🔧 Fiil hattı · ön konu · [[…]] · K1`. Kutuda: "Odak konusu son kademede; sıradaki konuya erken başlıyoruz. En fazla K2'ye kadar ilerler." Ön konu yapısı başka hiçbir soruda, metinde ya da günlükte geçmez.
2. **Yoklama:** her hatta yoklama penceresindeki konulara (kademe 0'daki odak + sıradaki 2 konu, `yoklama` alanı `hata` ya da `gecti` olmayanlar) K4 düzeyinde ipucusuz soru: odak için 6, sıradakiler için 3'er. Hepsi tek bir `## 🔎 Yoklama` bölümünde; her soruya `konu` ve ölçtüğü `alt` beceri alanı yaz (konu notundaki metinle birebir aynı). Konunun `alt` listesi yoksa önce frontmatter'a yaz (Kurallar → Alt beceriler). Soruları `yoklama_alt`'ta henüz olmayan alt becerilere yönelt. Yoklama soruları bitmiş konular dışında başka yapı içermesin, yoksa hata kimin olduğu anlaşılmaz.
3. **Tekrar** (vadesi gelen bitmiş konuların sorularının en fazla yarısı **açık boşluklu mektup** olarak gelebilir, haftada en az iki gün; aşağıda "Sınav biçimleri"): en önce onarımdaki konular (`durum: zayif` olan bitmiş konular; eski kayıtta `dar` alanı varsa sadece o alt becerilerden): **konu başına 3–6 soru** (tekrar bölümü toplam en fazla ~12 soru, Kurallar → Bitmiş konuların tekrarı), yarısı `ilerleme.py alt` çıktısındaki kırmızı alt becerilerden; hatalı fiil ya da isim başka bir cümlede ve başka bir türde gelir. Sonra **yayılımdaki** konular (`yayilim` tarihi bugün ya da sonra; `ilerleme.py alt` "yayılım" yazar): konu başına 2–3 soru, önce kırmızı alt beceriler ve kenar durumlar. Sonra `sonraki_tekrar` tarihi gelmiş diğer `temiz` konular (konu başına 2–3 soru, farklı alt becerilerden). K4, karışık. Her soruya `konu` ve `alt`.
   - **Yayılım arka planda** (Kurallar → Yayılım): yayılımdaki konuların yapısını odak, kelime ve beceri sorularının, okuma ve dinleme metinlerinin ve günlüğün cümlelerinde doğal biçimde kullan (ayrılabilen fiil bittiyse *Kofi steht früh auf*, çoğul bittiyse *zwei Decken*). Bu cümlelerdeki hatalar o sorunun konusuna yazılmaz.
4. **Kelime:** sıradaki ya da zayıf kelime teması (kelime temaları eski usulle ilerler).
5. **Beceri:** günün becerisi `date +%u` ile (Kurallar → Beceri günleri). Metinler üretim sınırında yazılır; her dört cümleden en fazla birinde anlama sınırından bir yapı geçebilir ve sözlükte açıklanır. Sorular bu cümlelerin anlamını sorabilir, yapısını sormaz. Bölüme `teil` alanı yaz (Lesen: `P-01`…`P-03`, Hören: `P-06`…`P-08`, Schreiben: `P-09`): sonuç o Teil'e yazılır.
   - **Günün biçimi** Kurallar → Beceri günleri tablosundan (Pazartesi Hören ayrıntı `P-07` · Perşembe Hören Teil 1 biçimi `P-06` · Salı Lesen a/b/c `P-02` + mini Sprachbausteine a/b/c `P-04` · Cumartesi pano ve "uyan yok" `P-03` (dönüşümlü başlık eşleştirme `P-01`) + mini Sprachbausteine kelime havuzu `P-05` · Çarşamba ve Pazar Schreiben tam görev `P-09` · Cuma Schreiben onarım günü). Nasıl yazılacağı: 4. adım → Sınav biçimleri.
   - **Lesen eşlemesi** (bölüm yanlış Teil'e yazılırsa betik aynı Teil'i aynı gün iki kez sayar): başlık eşleştirme → `P-01` · metin + ayrıntı soruları (a/b/c) → `P-02` · ilan panosu, durum ↔ ilan → `P-03`. Aynı gün aynı `teil` ile **iki bölüm yazma**.
   - **Schreiben:** `P-09` notunun `asama` alanına göre (Kurallar → Schreiben basamakları). Aşama 1: önce her Leitpunkt için `secmeli` (*sor / anlat / öner / özür dile*, `anahtar`'lı), sonra karışık model mesajını sıralama (`eslestir`), sonra kısa `yazma`. Aşama 1'de her Leitpunkt'ın **tek bir savunulabilir eylemi** olsun (ör. "gelemiyorsun, çünkü çalışıyorsun" hem *anlat* hem *özür dile*, "söyle: uygun mu?" hem *sor* hem *öner* okunabilir; böyle bir soruda iki cevap da doğru sayılmak zorunda kalır ve soru bir şey ölçmez). telc'teki gibi kısa isim öbeği yaz (*özür · yeni zaman önerisi · yemekle ilgili soru · ne getirdiğin*) ya da cümleyi tek eyleme bağla; bir noktada iki eylem ipucu karışmasın. Hazırlık bölümleri (`secmeli`, `eslestir`) `teil`'siz ve başlığında "Schreiben" geçmeden yazılır ("Yazı · 1. adım …"), `P-09`'a sadece `yazma` bölümü yazılır. Sıralanan örnek mesaj başka bir kişinin benzer görevi olsun; `yazma` açıklamasında "kendi adınla imzala" de. Aşama 2: `yazma` görevinin `metin`'ine iskeleti koy (hitap, giriş, her Leitpunkt için cümle başı, kapanış). Aşama 3: tam görev.
6. **Pazar:** antrenmanın sonuna (kartlardan önce) `## 🗣 Sesli` bölümü (`rol: "sesli"`, puanlanmaz, ~5 dk): günlüğün bir paragrafını "🗣 arkasından tekrar et" ile sesli tekrar talimatı ve 3 kısa soru (`yaz` değil, düz metin: "Sesli cevap ver, yazma"). A2'den sonra telc Sprechen Teil 1 soruları.
- **Çoğul her yerde** (Kurallar → Çoğul: kural mı, kelime mi?): A1-05 bittikten sonra ayrı çoğul bölümü açılmaz; her antrenmanda en az 3 soruda (odak, tekrar, kelime, okuma; hangi bölüm olursa olsun) bir isim çoğul geçsin, önceki günün "Yarın bağlamda" çoğullarını da koy. Çoğulu kuraldan çıkmayan bir ismin çoğulunu soruyorsan `ipucu`'na tekilini yaz.
- **Kelimeler:** `ceviri`, `hata`, `yaz`, `donustur` sorularında isim, fiil ve sıfatlar açık kart seviyelerinden olsun; değilse `ipucu`'nda Türkçesiyle ver (Kurallar → Sorulardaki kelimeler). Önceki günün "Yarın bağlamda" kelimelerini 2–3 soruya koy.
- Soru sayısı ≈ `gunluk_dakika`. Yazma görevi 10 soru, dinleme metni 5 soru, 6 boşluklu Sprachbausteine metni 4 soru, kutula 1 soru sayılır. Tempelhof günlüğü bu süreye dahil değil. **Kısa günde** ~15: onarım 5, iki odak 5'er, kartlar; frontmatter'a `kisa: true`.
- **Hikâye her yerde** (Kurallar → Tempelhof evreni): soruların yaklaşık yarısı Tempelhof'ta geçer; Lesen, Hören ve Schreiben görevleri Tempelhof dünyasından gelir. Önce bugünkü günlüğün vuruşunu belirle (7. adım, 1–2), sonra alıştırmalardan birine o vuruşa bağlanan bir **hikâye köprüsü** koy (ilan, telsiz kaydı, not). Alıştırmalar yazılmamış bir olayı açık etmez.
- **Altın kural (iki sınır):** üretim sınırının dışındaki bir yapı hiçbir soruda, örnekte, ders notunda ya da cümle kartında geçmez. Okuma ve dinleme metinleri ile günlükte anlama sınırındaki yapılar seyrek ve sözlüklü geçebilir; iki sınırın da dışındaki yapı hiçbir yerde geçmez (`ilerleme.py sinir`). Şüphedeysen daha basit kur.
- **Çeşitlilik** (Kurallar → Çeşitlilik): yazarken son seansların kelimelerinden ve kalıplarından uzak dur; aynı kişi aynı işi iki gün üst üste yapmasın. Bilerek tekrar ettiğin hedef kelimeleri (onarımdaki fiiller, inatçı kelimeler, "Yarın bağlamda", sık bakılanlar) soru dosyasının `izinli` listesine yaz. Dosyayı yazınca denetle (5. adım).

## 3. Ders notları
Bir odak konusu kademe 1 ya da 2'de ilk kez öğretilecekse **ya da** `## Ders notu` bölümü hâlâ boşsa (yoklamadaki konular için ders notu yazılmaz):
1. Konu notunun `## Ders notu` bölümünü doldur:
   - Türkçe kısa açıklama (en fazla 10 satır)
   - Kural tablosu
   - 4–6 Almanca örnek cümle (Türkçe çevirisiyle)
   - "Türklerin sık yaptığı hata" kutusu: `> [!warning]`
2. Antrenman notunda dersi ders kutusuyla göster (callout + embed kullanma; canlı önizlemede tıklayınca ham markdown açılıyor):
   ```dataviewjs
   await dv.view("_sistem/ders", { not: "<konu dosyası>", baslik: "<kısa ad>", acik: true })
   ```
   Ders notu ilk gösterildiğinde, yeni bir kademenin ilk gününde ve kademe düştükten sonraki gün `acik: true`; diğer günlerde `acik` yazılmaz (kapalı gelir). Kelime teması için `bolum: "Kartlar"` ekle; kartlar tablo olarak gösterilir.
3. Ders notu tüm konuyu anlatır, ama soruları kademeye göre sınırla: K1–K2'de konunun sadece en temel kalıbı (ör. ayrılabilen fiillerde önce *aufstehen, einkaufen, anrufen* gibi sık 4–5 fiil, sadece ana cümlede).

Yeni kelime teması açılıyorsa, tema notunun `## Kartlar` bölümüne 10–15 kart ekle:
`der Tisch, -e::masa` (artikel ve çoğul ekiyle birlikte)

## 4. Alıştırma türleri
Sorular etkileşimli kartlarda gösterilir (`_sistem/alistirma/view.js`). Her türün kendi kartı ve rengi var. Bir konu içinde türleri karıştır (Kurallar → Kademeler → Tür rotasyonu): K3 ve üstünde tek tür bölümün %60'ını geçmez, dağılım dünküyle aynı olmaz, aynı tür art arda en fazla 3 kez gelir; K2'de boşlukların en az üçte biri mini diyalog (*Wo wohnst du? – Ich ___ in Hangar 2.*) ya da iki cümlelik bağlam içindedir.

| `tip` | Kart | Alanlar |
|---|---|---|
| `bosluk` | Metindeki her `___` bir yazı kutusu olur. Birden fazla boşluk olabilir. | `metin`, `ipucu`, `anahtar` |
| `secmeli` | Seçenek düğmeleri (a, b, c) | `metin` (`___` görsel boşluk olur), `secenekler`, `anahtar` |
| `hata` | Hatalı cümle ve düzeltme satırı ("cümleyi kopyala" düğmesiyle) | `metin` |
| `ceviri` | Türkçe cümle → Almanca satır | `metin` (Türkçe), `ipucu` |
| `yaz` | Cümle kurma: tıklanabilir kelime çipleri ve yazı satırı | `talimat`, `kelimeler`, `ipucu` |
| `donustur` | Cümleyi dönüştür (Perfekt'e çevir gibi) | `talimat`, `metin` |
| `dogruyanlis` | richtig / falsch düğmeleri | `metin`, `anahtar` |
| `eslestir` | Harf düğmeleri (ilan panosuyla birlikte) | `metin`, `secenekler` (harfler), `anahtar` |
| `yazma` | Geniş yazı alanı ve kelime sayacı (Schreiben) | `talimat`, `metin` (görev ve Leitpunkt'lar) |
| `kutula` | Her öğe bir satır, yanında kutu düğmeleri | `metin` (isteğe bağlı yönerge), `ogeler` (6 kelime), `kutular` (2–3 kutu adı), `anahtar` (öğelerle aynı sırada kutu adları) |

**Numaralı boşluk:** bölüm `metin`'inde `{1}`, `{2}`… yazarsan ekranda numaralı boşluk rozeti olur; `yer: 1` alanı olan sorunun cevabı seçildikçe ya da yazıldıkça metindeki rozet dolar. `secmeli`, `eslestir` ve `bosluk` sorularında çalışır.

### Sınav biçimleri (mini)
Kurallar → Sınav biçimleri (mini). Hepsi mevcut kartlarla yazılır:

**Mini Sprachbausteine · a/b/c** (Salı, `P-04`). 6 boşluğun her biri farklı bir konuyu ölçsün; çeldiricileri `ilerleme.py alt` çıktısındaki gerçek hatalardan seç.
```json
{"no": 7, "baslik": "Sprachbausteine · Kofis Zettel", "kisa": "Bausteine", "konu": null, "rol": "beceri", "teil": "P-04",
 "aciklama": "Kofi kuleye bir not bırakıyor. Her boşluk için doğru kelimeyi seç.",
 "metin": "Hallo Marta,\nich {1} heute im Turm. Pavel {2} sehr leise, und {3} Mädchen schläft schon.\n{4} kommt morgen? Ich warte, {5} ich habe viel Zeit. {6} du auch müde?\nBis morgen, Kofi",
 "sorular": [
  {"id": "7.1", "tip": "secmeli", "yer": 1, "konu": "A1-01", "alt": "ich-du-er çekimi (sein, haben)", "secenekler": ["bin", "bist", "ist"], "anahtar": "bin"},
  {"id": "7.2", "tip": "secmeli", "yer": 2, "konu": "A1-03", "alt": "e → i (sprechen, helfen, geben)", "secenekler": ["sprecht", "spricht", "sprechst"], "anahtar": "spricht"},
  {"id": "7.3", "tip": "secmeli", "yer": 3, "konu": "A1-04", "alt": "-chen, -lein → das", "secenekler": ["die", "der", "das"], "anahtar": "das"}
 ]}
```
**Kelime havuzu** (Cumartesi, `P-05`): aynı metin biçimi; `"pano": {"baslik": "Wörter", "tur": "kelime", "ilanlar": [{"harf": "a", "metin": "aber"}, …9 kelime]}`, sorular `{"tip": "eslestir", "yer": 1, "secenekler": ["a","b",…,"i"], "anahtar": "d", "konu": …, "alt": …}`. Üç kelime fazladan kalır; doğru harfler sıralı olmasın.

**Açık boşluklu mektup** (tekrar bölümünde, üretim): metin bölümün `metin`'inde, sorular `{"tip": "bosluk", "metin": "___", "yer": 1, "konu": "A1-03", "alt": "…", "anahtar": "spricht", "ipucu": "sprechen"}`. Bölüm `rol: "tekrar"`; tekrar bölümü iki parça olabilir (mektup + tek tek sorular), ikisi de `rol: "tekrar"`. Her boşluğun tek bir doğru cevabı olsun; birden fazlası mümkünse `anahtar`'a liste yaz. Mektupta boşluğu olan her konuya aynı gün en az bir ipucusuz K4 sorusu (çeviri ya da dönüştürme) da yaz: konu sadece mektupla tekrar edilmez.

**Kutula** (odak, ön konu ya da onarım bölümünde en fazla bir kart; K3+'ta `kontrast` ile):
```json
{"id": "1.4", "tip": "kutula", "metin": "du ve er ile ünlü değişir mi?", "ogeler": ["fragen", "fahren", "machen", "schlafen", "sagen", "helfen"],
 "kutular": ["değişir", "değişmez"], "anahtar": ["değişmez", "değişir", "değişmez", "değişir", "değişmez", "değişir"],
 "alt": "du -st (sagst, wohnst)", "kontrast": "A1-03"}
```

**Lesen · ayrıntı a/b/c** (Salı, `P-02`): bölüm `metin`'i + 4–5 `secmeli`. Soru metindeki cümleyi başka kelimelerle sorsun; çeldiriciler metinde geçen ama soruya uymayan bilgiler olsun.

**Lesen · pano ve "uyan yok"** (Cumartesi, `P-03`): 6 ilan, 5 durum. Durumlardan biri hiçbir ilana uymaz: `secenekler` listesinin sonuna `"x"` ekle (bütün sorularda), o sorunun `anahtar`'ı `"x"`. Bir ilan da fazladan kalır. "x" her hafta farklı sırada gelsin.

**Hören · Teil 1 biçimi** (Perşembe, `P-06`): 5 kısa metin (2–3 cümle), her biri ayrı ses dosyası ve farklı konuşmacı (`<bugün>-1.m4a` … `-5.m4a`, Karakterler.md → Sesler). Notta tek `> [!dinle] Her konuşmayı bir kez dinleyebilirsin` kutusunda beş embed: `![[<bugün>-1.m4a|dinleme:1]]`. Her sese bir `dogruyanlis`; genel anlamı sor (kim konuşuyor, nerede, ne istiyor).

**Schreiben onarım günü** (Cuma; tam görev yerine, iki bölüm de `rol: "beceri"`, `teil`'siz, başlıkta "Schreiben" geçmeden):
- "Yazı · kendi cümlelerin": son `yazma` görevinin cevabından (`<gün>.cevap.json`) ve `sonuc` açıklamasından hatalı 4–5 cümleyi **yazdığı gibi** al: `{"tip": "hata", "talimat": "<gün> tarihinde sen yazdın", "metin": "<onun cümlesi>"}`. Sadece üretim sınırındaki hataları seç; bir cümlede tek hata kalsın (gerekirse diğerlerini düzeltip ver).
- "Yazı · tek Leitpunkt": 4 `yaz` sorusu, kelime çipi yok: `{"tip": "yaz", "talimat": "Tek cümle yaz", "metin": "Ingrid'le randevun var ama gelemiyorsun. → özür"}`. Dört farklı eylem (sor, anlat, öner, özür dile, rica et, teşekkür et); Leitpunkt telc'teki gibi kısa isim öbeği.

- **Schreiben görevi Tempelhof'tan:** durum bir karakterin ihtiyacıdır (Marta'ya mesaj, meclise başvuru, Kofi'nin taşıyacağı mektup, Ingrid'e randevu iptali). Görev metninde kime, neden yazıldığı tek cümleyle anlatılır; Leitpunkt'lar telc'teki gibi numaralı. Sınava son 4 hafta kala ve Modelltest günlerinde gerçek hayattan bir görev ver.
- **Lesen ve Hören:** pano ilanları Hangar 4'ün *Schwarzes Brett*'inden, dinleme metinleri Radio Tempelhof'tan ya da telsizden. Bölüm `aciklama`'sı kısa bir sahne cümlesiyle başlayabilir ("Hangar 4'teki panoda yeni ilanlar var.").

- **`anahtar` (anında kontrol):** `bosluk`, `secmeli`, `dogruyanlis`, `eslestir` ve `kutula` sorularına **her zaman** doğru cevabı yaz. Kullanıcı "Kontrol et" deyince ilk cevabı kilitlenir ve hemen ✅/❌ görür (Kurallar → Anında kontrol). Biçim:
  - `secmeli`: doğru seçeneğin metni aynen (`"a) kostet"`) · `dogruyanlis`: `"richtig"` / `"falsch"` · `eslestir`: harf (`"c"`)
  - **Cevap sırası karışık olmalı** (Neden: anahtar a, b, c, d, e sırasıyla gelirse cevap okumadan tahmin edilir). `eslestir` bölümünde soruların doğru harfleri panodaki sırayı izlemez: önce ilanları yaz, sonra soruları karıştır ki anahtar dizisi (ör. `d, a, f, b, c`) ne artan ne azalan olsun; fazla ilan her seferinde farklı bir harfte dursun (hep sonda değil). `secmeli`'de doğru seçenek a, b, c arasında dengeli dağılsın, `dogruyanlis`'te richtig / falsch dönüşümlü bir düzen izlemesin. Dosyayı yazdıktan sonra bir bölümün anahtarları sıralı çıkıyorsa yeniden karıştır.
  - `bosluk`: tek boşlukta metin (`"Bett"`) ya da kabul edilen alternatifler listesi (`["billig", "günstig"]`); birden fazla boşlukta her boşluğa bir öğe (`["stehe", "auf"]`, alternatifli boşluk iç liste: `["den", ["einen", "keinen"]]`). Büyük/küçük harf önemlidir, sondaki noktalama sayılmaz. Gerçekten tek bir doğru yoksa (serbest cevap) `anahtar` yazma: soru eskisi gibi /kontrol'de puanlanır.
- `talimat` alanını sadece türün adı yetmiyorsa yaz ("Perfekt'e çevir", "„Morgen" ile başla" gibi). "Boşluğu doldur" gibi genel talimatlar yazılmaz; kartın rozeti bunu zaten söylüyor.
- Bölüm düzeyinde: `aciklama` (kısa Türkçe yönerge), `pano` (ilan panosu: `baslik`, `ilanlar: [{harf, metin}]`), `metin` (mektup veya not, satırlar `\n` ile).
- Dinleme bölümünde ses dosyası notta, bölümün dataviewjs bloğunun **üstünde** `> [!dinle]` kutusuyla verilir.
- Konuşma (Sprechen) alıştırması **yazılmaz**.

### Dinleme sesi
Sesi elle üretme: dinleme bölümüne `dinle` alanını yaz, `not_yaz.py --ses` her sesi `_sistem/ses.py` ile üretir ve notta kutusunu kurar (5. adım). Bu bilgisayarda ses yoksa (`_kisisel/ortam.json` → `ses: false`) betik ses üretmez ve metni açık bir `[!dinle]` kutusunda verir; soruları aynı kalır.
- `dinle.sesler[]`: her ses dosyası için `dosya` (`<bugün>-1.m4a`), `metin` (notta göründüğü gibi: dikte bu metinle karşılaştırılır) ve `tercih`. Diyalogda her konuşmacı ayrı dosya ve farklı ses (kadın: "Anna,Petra", erkek: "Markus,Yannick"; karakter sesleri: Karakterler.md → Sesler).
- `dinle.hiz`: A1 `150`, A2 `165`, B1 `180` (`hazirla.py` söyler).
- `dinle.hak`: kaç kez dinlenebileceği (telc Teil 1 biçiminde `1`, ayrıntı dinlemesinde `2`); `dinle.baslik` kutunun başlığı ("Her konuşmayı bir kez dinleyebilirsin"). Sınır dolunca arayüz cümle cümle dinleme ve dikteyi açar.
- Metinler notta katlanmış "Metinler (cevapladıktan sonra aç)" kutusuna girer (`dinle.metin_baslik` ile değiştirilebilir).
- `ses.py` çıktısında "⚠️ yaklaşık" görürsen metni sadeleştirip sesi sil ve `--ses`'i yeniden çalıştır.

## 5. Notun biçimi
İki dosya yazılır.

**a) Sorular:** `05 Günlük/veri/<bugün>.json`
```json
{
  "tarih": "2026-10-25",
  "baslik": "Antrenman · 25 Ekim",
  "izinli": ["sprechen", "helfen"],
  "bolumler": [
    {"no": 1, "baslik": "Fiil hattı · Düzenli fiiller · K3", "kisa": "Präsens K3", "konu": "A1-02", "rol": "odak", "kademe": 3, "sorular": [
      {"id": "1.1", "tip": "hata", "metin": "Wer wohnst in Hangar 2?", "alt": "wer / was öznesi → -t (Wer wohnt?)"},
      {"id": "1.2", "tip": "donustur", "talimat": "Özneyi „du“ yap", "metin": "Ich frage, und Kofi fährt.", "alt": "du -st (sagst, wohnst)", "kontrast": "A1-03"}
    ]},
    {"no": 3, "baslik": "🔎 Yoklama", "kisa": "Yoklama", "konu": null, "rol": "yoklama", "sorular": [
      {"id": "3.1", "tip": "ceviri", "konu": "A1-10", "alt": "müssen", "metin": "Bugün çalışmak zorundayım."}
    ]},
    {"no": 4, "baslik": "🔁 Tekrar", "kisa": "Tekrar", "konu": null, "rol": "tekrar", "sorular": [
      {"id": "4.1", "tip": "hata", "konu": "A1-04", "alt": "-ung, -heit, -keit, -ion → die", "metin": "Der Zeitung ist neu."}
    ]}
  ]
}
```
- `kisa`: özet kartındaki çip için 1–2 kelimelik ad. `konu`: konu id'si (beceri, yoklama ve tekrar bölümlerinde `null`).
- `rol`: `odak` (+ `kademe`), `on` (ön konu, + `kademe`), `yoklama`, `tekrar`, `kelime`, `beceri` (+ `teil`; Sprachbausteine bölümleri dahil), `inatci` ya da `sesli`. `/kontrol` ve `_sistem/ilerleme.py` puanlamayı buna göre yapar.
- Yoklama ve tekrar bölümlerinde her sorunun kendi `konu` alanı olur. **Bütün gramer sorularında** (odak, ön konu, yoklama, tekrar) `alt` alanı zorunludur ve konu notunun `alt` listesindeki metinle birebir aynıdır. Kontrast sorusunda ayrıca `kontrast: "<komşu konu id>"`.
- `izinli` (üst düzey, isteğe bağlı): bilerek tekrar edilen hedef kelimelerin yalın biçimleri (Kurallar → Çeşitlilik).
- **Denetim:** dosyayı yazınca `python3 -I _sistem/cesitlilik.py <bugün>` çalıştır. ❌ satırlarını (yıpranmış kelime, yakın kopya, aynı cümle başı, tür dağılımı, eksik ya da yanlış `alt`, sıralı anahtar) düzeltip yeniden çalıştır; ⚠️ satırlarını mümkünse uygula. Not ancak ❌ kalmayınca teslim edilir.
- Soru `id`'leri `bölüm.sıra` biçiminde.
- Cevapları ve doğruları bu dosyaya **yazma**. Kullanıcının cevapları `05 Günlük/veri/<bugün>.cevap.json` dosyasına ekrandan otomatik kaydedilir; sonuçları `/kontrol` ekler.

**b) Not:** `05 Günlük/<bugün>.md` **elle yazılmaz**: `python3 -I _sistem/antrenman/not_yaz.py <bugün> --ses --yaz` soru dosyasından üretir (önce `--yaz`'sız çalıştırıp çıktıya bakabilirsin). Frontmatter (`konular` dahil), özet bloğu, bölüm başlıkları, ders ve alıştırma blokları, dinleme kutuları, 🃏 Kartlar ve 📓 Tempelhof bölümü otomatik gelir. Senin işin soru dosyasına şu alanları yazmak (alıştırma ekranı bunları yok sayar):
```json
"not": {"dakika": 45, "kisa": false, "tempelhof": "2026-11-28 Bernd",
        "ust": [{"tip": "warning", "baslik": "🎯 Açık mini drill: [[Mini artikel-genus]] (~5 dk) · henüz başlamadın", "metin": "…"}]},
"bolumler": [
  {"no": 1, "rol": "odak", "konu": "A1-11", "kademe": 2, …,
   "kutu": {"tip": "tip", "baslik": "Kademe 2 · Üretme (2. gün)", "metin": "Dün K2'de %90 aldın. Bugün de hatasızsa K3'e (cümle kurma) geçiyorsun."},
   "ders": {"not": "A1-11 Trennbare Verben", "baslik": "ayrılabilen fiiller", "acik": true}},
  {"no": 8, "rol": "beceri", "teil": "P-06", "not_baslik": "🎧 Hören · Radio Tempelhof",
   "kutu": {"tip": "tip", "baslik": "Sınavdaki gibi: Hören Teil 1", "metin": "Beş kısa konuşma, her biri **bir kez**."},
   "dinle": {"baslik": "Her konuşmayı bir kez dinleyebilirsin", "hak": 1, "hiz": 150,
             "sesler": [{"dosya": "2026-11-28-1.m4a", "metin": "Hallo, hier ist …", "tercih": "Anna,Petra"}]}}
]
```
- **Başlıklar:** `not_baslik` yazmazsan betik rol ve konudan üretir: odak `🔧 Fiil hattı · [[konu]] · K2`, ön konu `· ön konu ·`, `🔎 Yoklama`, `🔁 Tekrar`, `🔤 Kelime · [[tema]]`, `🧷 İnatçı kelimeler`, `🗣 Sesli` (Pazar, kartlardan önce). Beceri bölümlerinde `not_baslik` yaz (konu bağlantısı yok): `📖 Lesen · Schwarzes Brett`.
- **Kutu** (`kutu`, tek nesne ya da liste): odak bölümünde kademenin ne ölçtüğünü ve geçiş şartını söyleyen kısa kutu; yoklamada "Sırası yaklaşan konular. Hepsini iki ayrı günde hatasız yaparsan bu konuları öğretmeden geçeriz; tek bir hata olursa sırası gelince adım adım öğreneceğiz."; tekrar bölümünde onarım ve yayılımdaki kalıplar. `kapali: true` katlanmış kutu yapar.
- **Ders** (`ders`): 3. adımdaki kurala göre `acik`; kelime temasında `"bolum": "Kartlar"`. Yoklama ve tekrar bölümlerinde ders kutusu yok.
- `not.tempelhof`: günlük henüz yazılmadıysa beklenen dosya adı (`<bugün> <yazarın kısa adı>`); yazılmışsa betik kendisi bulur.

## 6. Sözlük ve kartlar
0. **Tıklanabilir sözlüğü güncelle** (günlük yazıldıktan sonra): `python3 -I _sistem/sozluk/eksik.py <bugün> --taslak <scratchpad>/sozluk.json` bugünkü alıştırmalarda (Türkçe çeviri soruları hariç), dinleme metinlerinde, Tempelhof günlüğünde ve bugün eklenen kartlarda sözlükte olmayan **her Almanca kelime biçimini** listeler, kökü bilinenlere `kok` önerir ve tıklanıp bulunamayan kelimeleri (`tr: null`) ekler. Yeni ders notu yazdıysan `--dosya "03 Grammatik/<konu>.md"` ekle. Taslakta `tr` (bu biçimin anlamı) ve gerekirse `not` alanlarını doldur, Türkçe arayüz kelimelerini sil, sonra `python3 -I _sistem/sozluk/eksik.py --ekle <taslak>` (sadece yeni anahtarlar `_kisisel/sozluk/sozluk.json`'a eklenir; motor sözlüğü salt okunur). Giriş biçimi: `"stehe": {"tr": "kalkıyorum", "kok": "aufstehen", "not": "stehe … auf"}`; `kok` sözlük biçimidir, isimlerde artikel ve çoğulla.
1. **Tıklama sinyali** (Kurallar → Kartlar → Tıklama sinyali): `hazirla.py` sinyali yeniler ve `sik_bakiyor`, `istek`, `kartta_takili` kelimelerini listeler.
   - `sik_bakiyor` olan kelimelerden 3–5 tanesini bugünkü alıştırmalara, okuma metnine ya da Tempelhof günlüğüne doğal biçimde koy. Zarf ve edatlar da olabilir (*zuerst, schon, oben*). Müfredat kuralı geçerli: kelime sırası gelmemiş bir yapı gerektiriyorsa koyma.
   - **Kartlar her zaman `_kisisel/kartlar/deste.json`'a eklenir** (çekirdek deste `_sistem/kartlar/deste.json` salt okunur; var olan kartı ararken ikisine de bak).
   - `istek` durumundaki kelimeler (kullanıcı balonda "⭐ Karta ekle" dedi): isim, fiil ya da sıfatsa yalın biçimiyle desteye ekle (`kaynak: "istek"`), seviyesi ne olursa olsun; değilse (edat, zarf, kalıp) kart yapma, bugünkü alıştırmalardan birine koy. `biliyor` durumundakileri alıştırmaya koyma.
   - `sik_bakiyor` bir isim, fiil ya da sıfat çekirdek destede yoksa (`kart: null`) yalın biçimiyle desteye ekle: `kaynak: "tıklandı"`, uygun `seviye`, `sira` en büyük sıradan devam. Arşivde varsa arşivden çıkar (geçmişi korunur). Kart ekranı onu kendiliğinden öne alır.
   - `karta_eklendi` alanı olmayan kayıtlara `"karta_eklendi": "<bugün>"` yaz (karta çevrilmese de "bakıldı" işareti).
2. **Kelime destesi:** çekirdek liste (motorda 6 seviye, 600 kelime). Her gün kart eklenmez. Ekranın gösterdiği seviye en yüksek seviyeye yaklaşınca (en yüksek seviyenin %30'u öğrenildiyse) sıradaki 100 kelimeyi `_kisisel/kartlar/deste.json`'a ekle:
   - Biçim: `{"id": "k-0400", "deste": "kelime", "de": "der Tisch", "tr": "masa", "kaynak": "çekirdek", "eklenme": "<bugün>", "seviye": 4, "sira": 301, "ornek": "Der Tisch ist neu.", "ornek_tr": "Masa yeni.", "kanca": "…"}`. Kelime id'leri `k-` ile başlar ve sıradaki numarayı alır. `sira` sıklık sırasıdır, kaldığı yerden devam eder.
   - Yaklaşık 45 isim, 35 fiil, 20 sıfat; B1 çerçevesinde günlük hayatta en sık kullanılanlar. **Sadece yalın biçim:** isim artikeliyle ve çoğulsuz, fiil mastar, sıfat yalın. Edat, bağlaç, zarf, kalıp ifade ve çekimli biçim yok.
   - Örnek cümle şimdiki zamanda ve basit (3–6 kelime). Zor kelimelere `kanca`: kelimenin parçaları, aynı kökten kelimeler ya da zıt anlamlısı.
   - Arşivdeki bir kartın kelimesi listeye girerse yeni kart açma: o kartın `arsiv` alanını sil, alanlarını yeni biçime çevir (öğrenme geçmişi korunur). Yeni id'ler iki destedeki en büyük numaradan devam eder.
3. **Cümle destesi** (`"deste": "cumle"`, `_kisisel/kartlar/deste.json` → `kartlar` dizisinin sonuna; mevcut kartları ve `durum.json` dosyasını değiştirme): bugünkü ders notlarından ve günlükten 3–5 kısa cümle. Biçim: `{"id": "c-0150", "deste": "cumle", "de": "…", "tr": "…", "kaynak": "A1-04", "seviye": 1, "eklenme": "<bugün>"}`. Seviye: 1 = 3–5 kelime, tek basit yapı · 2 = 5–8 kelime, tek dilbilgisi konusu · 3 = 8+ kelime. Cümleler müfredata uyar: sırası gelmemiş yapı yok. Aynı `de` değeri varsa ekleme.
   - `durum.json` dosyasına bak: bir önceki günün cümle kartlarının hepsi ilk seferde sağa atıldıysa seviyeyi bir kademe artır; yarısından fazlası sola atıldıysa bir kademe azalt.
3b. **İnatçı kartlar:** `durum.json` içinde `inatci.bas` son 3 gün içinde olan kartlar dinleniyor demektir (5 kez sola atıldılar). Her biri için:
   - Bugünkü antrenmana bu kelimeleri bağlam içinde soran kısa bir bölüm ekle: `## 🧷 İnatçı kelimeler` (bölüm `konu`: `null`, `kisa`: "İnatçı"). Her kelimeye 1–2 soru: boşluk doldurma (Türkçe ipucuyla), `yaz` (kelimeyle cümle kur) ya da `eslestir`. Her gün farklı cümle ve farklı tür.
   - Kartında `kanca` yoksa ekle, `ornek` cümlesini gerekirse daha basit biriyle değiştir. `de`/`tr` alanlarına ve `durum.json`'a dokunma. Kart çekirdek destedeyse değişikliği `_kisisel/kartlar/deste.json`'a aynı `id` ve sadece değişen alanlarla yaz (`{"id": "k-0123", "kanca": "…"}`).
4. 🃏 Kartlar bölümünü `not_yaz.py` ekler (`adet`: Profil → `kart_adet`).

## 7. Tempelhof günlüğü (arka planda, alt-ajan)
`08 Tempelhof/<bugün> *.md` yoksa günlüğü **sen yazma**: soruları yazmaya başlamadan önce `Agent` aracıyla (`subagent_type: "general-purpose"`, arka planda) bir alt-ajana ver ve sorulara geç. Alt-ajanın brifingi kendi kendine yetmeli; `hazirla.py` çıktısından şunları kopyala:
- tarih, Tag numarası, yazar ve ses tercihi, ses hızı; sezon vuruşu ve önceki hook (spoiler: sadece ajana);
- günün **köprüsü** (alıştırmalardaki ipucu; günlükte karşılığı çıkmalı) ve odak konularından 2–3 örnek yapı;
- üretim ve anlama sınırı listeleri, yıpranmış kelimeler, `sik_bakiyor` kelimelerden 1–2'si;
- görev: aşağıdaki 1–6. adımlar; **sözlüğe ve kart destesine dokunma** (onları sen yaparsın, eşzamanlı yazma çakışır); dönüşte dosya adını, hook'u ve günlükte kullandığı köprü cümlesini tek paragrafta bildir.

Alt-ajanın adımları:
1. `_sistem/Tempelhof/Karakterler.md` (dünya, karakterler, **dil seviyesi kuralları**) ve `_kisisel/Hikâye.md` (son kayıtlar, açık meraklar) dosyalarını oku; biçim için son günlüğe bak.
2. İki paragraf yaz, Karakterler.md → **Günlüğün yapısı**na göre: bir anın ortasında başla, bir aksiyon anı ve vuruşun ipucunu ver, **son cümle hook olsun** (bir önceki günlüğün hook türünü tekrarlama). Bir önceki hook'u bu yazarın gözünden cevapla ya da derinleştir. Ton karanlık ve gerilimli; kan ve vahşet yok. Gövde üretim sınırında ve şimdiki zamanla; her dört cümleden en fazla birinde anlama sınırından bir yapı. Odak konularından 2–3 örnek. Yıpranmış kelimeleri eş anlamlılarıyla ve yeni sahnelerle değiştir. Telif hakkı olan metinden alıntı yok.
3. Biçim: frontmatter (`tur: tagebuch`, `tarih`, `tag`, `yazar`, `seviye`, `cssclasses: [antrenman]`), `[!dinle]` ses kutusu, metin **okuma bloğunda** (`await dv.view("_sistem/okuma", { tarih: "…", kaynak: "Tag N", metin: `…` })`; paragraflar boş satırla ayrılır, metinde ters tırnak yok), katlanmış sözlük, "Metinde dikkat et" kutusu, katlanmış 3 richtig/falsch sorusu ve "Kağıda geçir" adımları.
4. Ses (`_kisisel/ortam.json` → `ses` `true` ise): `python3 -I _sistem/ses.py --tercih "<tercih>" --hiz <hız> --cikti "08 Tempelhof/ses/<bugün> <Ad>.m4a" --baslik 2 --metin "…"` (başlık ve tarih de okunur, paragraflar arasında `[[slnc 900]]`).
5. `_kisisel/Hikâye.md` kayıt tablosuna bir satır ekle (olay sütununun sonunda *Hook: …*) ve açık merakları güncelle.

Sen: alt-ajan bitince günlüğü hızla gözden geçir (köprü var mı, sınır dışı yapı yok mu), sonra sözlük (`eksik.py` günlüğü de tarar) ve günlükten 1–2 cümle kartı. Notun Tempelhof satırını `not_yaz.py` yazar.

## 8. Kullanıcıya bildir
Notu oluşturduktan sonra kısa bir mesaj yaz:
- Notun yolu: `05 Günlük/<bugün>.md`
- İki hattın odak konusu ve kademesi, penceresi (ör. "son 12 soruda 8 doğru; 10 olunca K3", K3'te "10 olunca konu biter") ve bugün hangi alt becerilere ağırlık verildiği
- Yoklamadaki konular (ve şu ana kadarki yoklama durumları), tekrar edilen konular, varsa ön konu ve açık mini drill
- Günün becerisi ve bugünün günlük yazarı (hikâyeyi ve hook'u açık etmeden tek, merak uyandıran cümle; Sezon yayından hiçbir şey söyleme)
- Tahmini süre
