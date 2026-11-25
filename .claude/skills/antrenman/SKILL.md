---
name: antrenman
description: Bugünün Almanca antrenman notunu 05 Günlük/ içinde oluşturur. Müfredattaki iki hattın (fiil, isim) odak konularını kademelerine göre sorar, sırası yaklaşan konuları yoklar, bitmiş konuları tekrar eder. "antrenman", "bugünkü antrenman", "çalışalım", "egzersiz ver" denince kullan.
---

# Günlük antrenman oluşturma

## 1. Durumu oku
1. `_sistem/Kurallar.md` (Müfredat, kademeler, yoklama, bileşim) ve `_sistem/Müfredat.md` (iki hattın sırası) dosyalarını oku.
2. `_kisisel/Profil.md` dosyasından `gunluk_dakika` ve `sinav_tarihi` değerlerini al. **Kapı:** `seviye_tespiti` `tamamlandi` değilse (boş, `bekliyor` ya da `devam`) antrenman, kart, günlük ya da Tempelhof notu **oluşturma**. Kullanıcıya seviye tespitinin zorunlu olduğunu söyle ve `.claude/skills/seviye/SKILL.md`'yi uygula (Kurallar → Seviye tespiti → Zorunlu).
3. Bugünün tarihini `date +%F` ile al. `05 Günlük/<bugün>.md` zaten varsa yeni not oluşturma:
   - Not `durum: bekliyor` ise kullanıcıya hazır olduğunu söyle.
   - Not `tamamlandi` ise ek bir antrenman isteyip istemediğini sor. İsterse `<bugün>-2.md` olarak oluştur.
4. Konuların durumunu topla: konu bilgisi (id, hat, sira, seviye, alt) notların frontmatter'ında, kullanıcının ilerlemesi (durum, kademe, yoklama, ustalik, sonraki_tekrar …) `_kisisel/ilerleme.json`'da; ikisi birleşince geçerli durum çıkar (ilerleme dosyasında olmayan konu varsayılandadır: kilitli). Hızlı yol: `python3 -I _sistem/ilerleme.py alt` ve `sinir` (6. adım) çoğu zaman yeter; tam liste için `cat _kisisel/ilerleme.json`.
5. Son 7 günün `06 Fehlerlog/` notlarındaki `sayac` ve `son_gorulme` değerlerine bak.
6. **Alt beceri durumu ve sınırlar** (elle tahmin etme, betik yazar):
   - `python3 -I _sistem/ilerleme.py alt` → her odak, ön ve onarım konusunun alt becerileri (kırmızı / yeşil / kanıt yok), penceresi ve son yapı hataları. Soruların dağılımını bu belirler (2. adım).
   - `python3 -I _sistem/ilerleme.py sinir` → üretim sınırı (sorulabilir yapılar) ve anlama sınırı (sadece metinlerde, sözlüklü). Kurallar → Üretim ve anlama sınırı.
   - Önceki `## Sonuç`'taki betik uyarılarını ve "Yarın bağlamda" kelimelerini de uygula.
7. **Kısa gün mü?** Kullanıcı "kısa" dediyse kısa antrenman yaz (Kurallar → Kısa gün). Dün antrenman yoksa (ve kullanıcı süre söylemediyse) normal antrenmanı yaz ama mesajda tek cümleyle kısa günün de mümkün olduğunu söyle; kullanıcı isterse aynı gün `kisa: true` notuyla değiştir.
8. **Mini drill:** `09 Drill/` içinde `durum: acik` mini drill varsa notun başına (özet bloğunun altına) bir satır: `> [!tip] 🎯 Açık mini drill: [[Mini <etiket>]] (~5 dk)`. `acilis` 2+ gün önceyse ve `_kisisel/drill/<set>.durum.json` hâlâ boşsa satırı "henüz başlamadın" diye güçlendir.

## 2. Ne sorulacağını seç
Kurallar → Günlük antrenmanın bileşimi tablosunu uygula. Sıra:
1. **Her hattın odak konusu:** hattın `sira` sırasındaki ilk `temiz` olmayan ve **onarımda olmayan** gramer konusu (`durum: zayif` olup `dar`, `bitis` ya da `yoklama: gecti` alanı olan konu onarımdadır, tekrar bölümünde çalışılır). Emin olmak için `ilerleme.py alt` ve `sinir` çıktısına bak: rol orada yazar.
   - `kademe` 1–5 ise: o kademenin soru türleriyle 8–14 soru (Kurallar → Kademeler). `pencere` doluyorsa (ör. `7/8`) bu kademenin ikinci günüdür: birinci günden zor yaz (farklı fiil ve isimler, daha uzun cümle, daha az ipucu).
   - **Dağılım alt beceri kanıtına göre** (Kurallar → Alt beceri kanıtı): kırmızı alt becerilere soruların **yarısı**, kanıtı olmayanlara en az birer soru, yeşillere toplam en fazla dörtte bir. K4–K5'te betiğin "Bitiş için kanıt gereken" dediği alt becerilerin hepsine soru yaz. Kırmızı alt beceriyi dünkü kalıpla sorma: farklı kelime, farklı tür.
   - **Kontrast (K3 ve üstü):** soruların en az dörtte biri odak yapısını karışan komşu yapıyla aynı soruda karşılaştırır ve `kontrast: "<konu id>"` alanı alır (Kurallar → Kademeler → Kontrast soruları). "Son yapı hataları" listesindeki aşırı genellemeler (*frägt, ich hilfe, zählest*) hangi kontrastın gerektiğini söyler.
   - **Artikel konusunda** ([[A1-04 Artikel und Genus]]) sadece kurala uyan isimler sorulur (insan isimleri, -ung/-heit/-keit/-ion, -e, -chen/-lein, günler-aylar-mevsimler); artikeli kuraldan çıkmayan isim (*der Tisch*) bu bölümde sorulmaz (Kurallar → Artikel: kural mı, kelime mi?).
   - `kademe: 0` ise konu yoklamadadır (aşağıda). Yoklaması bozulmuşsa (`yoklama: hata d/s`) konu öğretilmeye başlar: `d/s ≥ 2/3` ise K2, değilse K1. Bu durumda kontrol betiği kademeyi zaten yazmış olur; yazmamışsa bu kurala göre başlat.
   - **Kenar durumlar** (`alt` listesinde `kenar:` olanlar) K1–K3'te sorulmaz.
   - **Ön konu:** hatta `on: true` bir konu varsa ona ayrı bir bölüm: 4–6 soru, kendi kademesinin türleriyle, ders kutusu (`rol: "on"`, `kademe`). Başlık: `## 3. 🔧 Fiil hattı · ön konu · [[…]] · K1`. Kutuda: "Odak konusu son kademelerde; sıradaki konuya erken başlıyoruz. En fazla K2'ye kadar ilerler." Ön konu yapısı başka hiçbir soruda, metinde ya da günlükte geçmez.
2. **Yoklama:** her hatta yoklama penceresindeki konulara (kademe 0'daki odak + sıradaki 2 konu, `yoklama` alanı `hata` ya da `gecti` olmayanlar) K4 düzeyinde ipucusuz soru: odak için 6, sıradakiler için 3'er. Hepsi tek bir `## 🔎 Yoklama` bölümünde; her soruya `konu` ve ölçtüğü `alt` beceri alanı yaz (konu notundaki metinle birebir aynı). Konunun `alt` listesi yoksa önce frontmatter'a yaz (Kurallar → Alt beceriler). Soruları `yoklama_alt`'ta henüz olmayan alt becerilere yönelt. Yoklama soruları bitmiş konular dışında başka yapı içermesin, yoksa hata kimin olduğu anlaşılmaz.
3. **Tekrar** (vadesi gelen bitmiş konuların sorularının en fazla yarısı **açık boşluklu mektup** olarak gelebilir, haftada en az iki gün; aşağıda "Sınav biçimleri"): en önce **dar onarımdaki** konu (`dar` alanı olan; Kurallar → Dar onarım): her dar alt beceriye 2 soru (en az 4) ve başka bir alt beceriden 1 kontrol sorusu, K4 üretim, her soruya `konu` ve `alt`; bölümün kutusunda hangi kalıpların kaldığını ve çıkış şartını (son 6 soruda 5 doğru, 2 gün) yaz. Sonra onarımdaki konular (`durum: zayif` ve `kademe: 3` olan bitmiş konular): **konu başına 5–6 soru**, yarısı `ilerleme.py alt` çıktısındaki kırmızı alt becerilerden; hatalı fiil ya da isim başka bir cümlede ve başka bir türde gelir. Sonra `sonraki_tekrar` tarihi gelmiş `temiz` konular (konu başına 2–3 soru, farklı alt becerilerden). K4, karışık. Her soruya `konu` ve `alt`.
4. **Kelime:** sıradaki ya da zayıf kelime teması (kelime temaları eski usulle ilerler).
5. **Beceri:** günün becerisi `date +%u` ile (Kurallar → Beceri günleri). Metinler üretim sınırında yazılır; her dört cümleden en fazla birinde anlama sınırından bir yapı geçebilir ve sözlükte açıklanır. Sorular bu cümlelerin anlamını sorabilir, yapısını sormaz. Bölüme `teil` alanı yaz (Lesen: `P-01`…`P-03`, Hören: `P-06`…`P-08`, Schreiben: `P-09`): sonuç o Teil'e yazılır.
   - **Günün biçimi** Kurallar → Beceri günleri tablosundan (Pazartesi Hören ayrıntı `P-07` · Perşembe Hören Teil 1 biçimi `P-06` · Salı Lesen a/b/c `P-02` + mini Sprachbausteine a/b/c `P-04` · Cumartesi pano ve "uyan yok" `P-03` (dönüşümlü başlık eşleştirme `P-01`) + mini Sprachbausteine kelime havuzu `P-05` · Çarşamba ve Pazar Schreiben tam görev `P-09` · Cuma Schreiben onarım günü). Nasıl yazılacağı: 4. adım → Sınav biçimleri.
   - **Lesen eşlemesi** (bölüm yanlış Teil'e yazılırsa betik aynı Teil'i aynı gün iki kez sayar): başlık eşleştirme → `P-01` · metin + ayrıntı soruları (a/b/c) → `P-02` · ilan panosu, durum ↔ ilan → `P-03`. Aynı gün aynı `teil` ile **iki bölüm yazma**.
   - **Schreiben:** `P-09` notunun `asama` alanına göre (Kurallar → Schreiben basamakları). Aşama 1: önce her Leitpunkt için `secmeli` (*sor / anlat / öner / özür dile*, `anahtar`'lı), sonra karışık model mesajını sıralama (`eslestir`), sonra kısa `yazma`. Aşama 1'de her Leitpunkt'ın **tek bir savunulabilir eylemi** olsun (ör. "gelemiyorsun, çünkü çalışıyorsun" hem *anlat* hem *özür dile*, "söyle: uygun mu?" hem *sor* hem *öner* okunabilir; böyle bir soruda iki cevap da doğru sayılmak zorunda kalır ve soru bir şey ölçmez). telc'teki gibi kısa isim öbeği yaz (*özür · yeni zaman önerisi · yemekle ilgili soru · ne getirdiğin*) ya da cümleyi tek eyleme bağla; bir noktada iki eylem ipucu karışmasın. Hazırlık bölümleri (`secmeli`, `eslestir`) `teil`'siz ve başlığında "Schreiben" geçmeden yazılır ("Yazı · 1. adım …"), `P-09`'a sadece `yazma` bölümü yazılır. Sıralanan örnek mesaj başka bir kişinin benzer görevi olsun; `yazma` açıklamasında "kendi adınla imzala" de. Aşama 2: `yazma` görevinin `metin`'ine iskeleti koy (hitap, giriş, her Leitpunkt için cümle başı, kapanış). Aşama 3: tam görev.
6. **Pazar:** antrenmanın sonuna (kartlardan önce) `## 🗣 Sesli` bölümü (`rol: "sesli"`, puanlanmaz, ~5 dk): günlüğün bir paragrafını "🗣 arkasından tekrar et" ile sesli tekrar talimatı ve 3 kısa soru (`yaz` değil, düz metin: "Sesli cevap ver, yazma"). A2'den sonra telc Sprechen Teil 1 soruları.
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

### Dinleme sesi oluşturma
**Önce `_kisisel/ortam.json` → `ses`'e bak** (`baslat.py` yazar). `false` ise bu bilgisayarda ses dosyası üretilemez (macOS dışı): `ses.py` çalıştırma, embed koyma. Dinleme bölümünün metnini katlanmış kutu yerine açık bir `> [!dinle] Metni sesli oku ya da cümlelere tıklayıp 🗣 ile dinle` kutusunda ver; soruları aynı kalır. Tempelhof günlüğünde de ses satırı olmaz.
```bash
mkdir -p "05 Günlük/ses"
python3 -I _sistem/ses.py --tercih "Anna,Petra" --hiz 150 --cikti "05 Günlük/ses/<bugün>-1.m4a" --metin "Metin buraya"
```
- Betik yüklü en doğal Almanca sesi seçer. Diyalog varsa her konuşmacı için ayrı dosya üret ve farklı ses tercihi ver (ör. kadın: "Anna,Petra", erkek: "Markus,Yannick").
- A1 için hız `150`, A2 için `165`, B1 için `180`
- Notta `![[<bugün>-1.m4a]]` ile göm. Metnin kendisini `> [!note]- Metin (cevapladıktan sonra aç)` şeklinde katlanmış kutuya koy.
- **Dinleme hakkı:** kaç kez dinlenebileceğini kutunun başlığına yaz (`> [!dinle] Dinle (iki kez dinleyebilirsin)`) ya da embed'e ekle: `![[<bugün>-1.m4a|dinleme:2]]`. Arayüz bugün için bu sınırı uygular; telc Teil 1 formatında `dinleme:1`. Sınır dolunca cümle cümle dinleme ve dikte açılır.
- **Cümle dosyası:** `ses.py` cümle aralarına kısa sessizlik koyar ve `<ses adı>.cumleler.json` yazar (her cümlenin metni ve zamanı). Arayüz bununla "📝 Cümle cümle", "🗣 Arkasından tekrar et" ve "✍️ Dikte" modlarını açar. Çıktıda "⚠️ yaklaşık" görürsen metni sadeleştirip yeniden üret. Metni `--metin`'e notta göründüğü gibi ver: dikte cevabı bu metinle karşılaştırılır.

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

**b) Not:** `05 Günlük/<bugün>.md`. Örnek: `05 Günlük/2026-10-24.md`
````markdown
---
tarih: 2026-10-25
tur: gunluk
durum: bekliyor
dakika: 45
puan:
veri: 05 Günlük/veri/2026-10-25.json
konular: [A1-07, A1-14, W-A1-02]
cssclasses: [antrenman]
---
# Antrenman · 25 Ekim 2026

```dataviewjs
await dv.view("_sistem/alistirma", { gun: "2026-10-25", ozet: true })
```

## 1. 🔧 Fiil hattı · [[A1-11 Trennbare Verben]] · K2

> [!tip] Kademe 2 · Üretme (2. gün)
> Dün K2'de %90 aldın. Bugün de ≥85 olursa K3'e (cümle kurma) geçiyorsun.

```dataviewjs
await dv.view("_sistem/ders", { not: "A1-11 Trennbare Verben", baslik: "ayrılabilen fiiller" })
```

```dataviewjs
await dv.view("_sistem/alistirma", { gun: "2026-10-25", bolum: 1 })
```
````
- Odak bölümleri: başlıkta hat, konu bağlantısı ve kademe; altında kademenin ne ölçtüğünü ve geçiş şartını söyleyen tek satırlık kutu; ders kutusu; alıştırma bloğu.
- Yoklama bölümü: `## 🔎 Yoklama` ve altında "Sırası yaklaşan konular. Hepsini iki ayrı günde hatasız yaparsan bu konuları öğretmeden geçeriz; tek bir hata olursa sırası gelince adım adım öğreneceğiz." gibi kısa bir açıklama. Ders kutusu yok.
- Tekrar bölümü: `## 🔁 Tekrar`, ders kutusu yok.
- Beceri bölümlerinin başlığı konu bağlantısı içermez: `## 9. 📖 Lesen · Schwarzes Brett`
- `konular` listesine bu notta geçen tüm konu id'lerini yaz.

## 6. Sözlük ve kartlar
0. **Tıklanabilir sözlüğü güncelle.** Motor sözlüğü `_sistem/sozluk/sozluk.json` salt okunurdur; eklemeleri `_kisisel/sozluk/sozluk.json`'a (`kelimeler` nesnesi) yaz. Bir kelime ikisinde de yoksa eksiktir:
   - Bugünkü günlükte, alıştırmalarda (Türkçe çeviri soruları hariç), yeni yazılan ders notlarının Almanca örneklerinde ve yeni kartlarda geçen **her Almanca kelime biçimi** sözlükte olmalı. (Sayfanın her yerindeki tıklamaları tarayıcı arayüzü `_sistem/web/app.js` ve Obsidian'da `.obsidian/plugins/almanca-yardimci` eklentisi sözlüğe sorar; sözlükte olmayan kelime Türkçe bir cümlenin içindeyse balon çıkmaz.) Eksikleri bir betikle bul ve ekle. Anahtar küçük harfli kelime biçimi; değer `{"tr": "Türkçesi (bu biçimin anlamı)", "kok": "sözlük biçimi, isimlerde artikel ve çoğulla", "not": "kısa dilbilgisi notu (isteğe bağlı)"}`. Örnek: `"stehe": {"tr": "kalkıyorum", "kok": "aufstehen", "not": "stehe … auf"}`.
   - `_kisisel/sozluk/tiklananlar.json` içinde `tr: null` olan kelimeler sözlükte yoktu: sözlüğe ekle.
   - Mevcut sözlük girişlerini ve `tiklananlar.json` dosyasının yapısını bozma; sadece ekle.
1. **Tıklama sinyali** (Kurallar → Kartlar → Tıklama sinyali): önce `python3 -I _sistem/sozluk/sinyal.py <bugün>` çalıştır, `_kisisel/sozluk/sinyal.json` dosyasını oku.
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
4. Antrenman notunda Tempelhof bölümünden **önce** şunu ekle (`adet`: Profil'deki `kart_adet`):
   ````markdown
   ## 🃏 Kartlar
   Kartı çevirmek için üstüne dokun. Biliyorsan **sağa**, bilmiyorsan **sola** at (ya da ✓ / ✗ düğmeleri, klavyede ← →). Sola attıkların bugün tekrar gelir.

   ```dataviewjs
   await dv.view("_sistem/kartlar", { gun: "<bugün>", deste: "kelime", adet: 10 })
   ```

   ```dataviewjs
   await dv.view("_sistem/kartlar", { gun: "<bugün>", deste: "cumle", adet: 10 })
   ```
   ````

## 7. Tempelhof günlüğü
`08 Tempelhof/<bugün> *.md` yoksa yeni bir kayıt yaz:
1. `_sistem/Tempelhof/Karakterler.md` (dünya, karakterler, **dil seviyesi kuralları**) ve `_kisisel/Hikâye.md` (son kayıtlar, açık meraklar) dosyalarını oku.
2. Yazar: Hikâye kaydındaki son yazardan sonraki karakter. Vuruş: `_sistem/Tempelhof/Sezon 1.md` içinde Tag numarasına denk gelen satır (son Tag + 1). Vault yeni başladıysa Tag 1'den, Akt 1 tablosundaki vuruş ve tohumlarla başla.
3. İki paragraf yaz, Karakterler.md → **Günlüğün yapısı**na göre: bir anın ortasında başla, bir aksiyon anı ve vuruşun ipucunu ver, **son cümle hook olsun** (bir önceki günlüğün hook türünü tekrarlama). Bir önceki günlüğün hook'unu bu yazarın gözünden cevapla ya da derinleştir. Ton karanlık ve gerilimli; kan ve vahşet yok. Karakterler.md → Dil seviyesi kurallarına uy: metnin gövdesi üretim sınırında ve şimdiki zamanla; her dört cümleden en fazla birinde anlama sınırından bir yapı (`ilerleme.py sinir`), sözlükte biçimiyle açıklanmış. Odak konularından 2–3 örnek yerleştir. Son günlüklerde yıpranan kelimeleri (*müde, Suppe, warten*) eş anlamlılarıyla ve yeni sahnelerle değiştir. Telif hakkı olan metinlerden alıntı yapma.
4. Biçim: `08 Tempelhof/2026-10-24 Lena.md` örneğindeki gibi. Frontmatter (`tur: tagebuch`, `tarih`, `tag`, `yazar`, `seviye`, `cssclasses: [antrenman]`), `[!dinle]` ses kutusu, metin **okuma bloğunda** (`await dv.view("_sistem/okuma", { tarih: "…", kaynak: "Tag N", metin: `…` })`; paragraflar boş satırla ayrılır, metinde ters tırnak ` kullanma), katlanmış sözlük, "Metinde dikkat et" kutusu, katlanmış 3 richtig/falsch sorusu ve "Kağıda geçir" adımları.
5. Sesi oluştur: `python3 -I _sistem/ses.py --tercih "<Karakterler.md → Sesler tablosu>" --hiz <seviyeye göre> --cikti "08 Tempelhof/ses/<bugün> <Ad>.m4a" --metin "…"`. Başlığı ve tarihi de okut, paragraflar arasına `[[slnc 900]]` koy, `--baslik 2` ver (başlık ve tarih dikteye girmez).
6. `Hikâye.md` kayıt tablosuna bir satır ekle (olay sütununun sonunda hook'u da yaz: *Hook: …*) ve açık merakları güncelle.
7. Antrenman notunun **sonuna** şunu ekle:
   ```markdown
   ## 📓 Tempelhof günlüğü
   Bugün [[<bugün> <Ad>|<Ad>]] yazdı. Dinle, oku ve kağıda geçir (~10 dk).
   ```

## 8. Kullanıcıya bildir
Notu oluşturduktan sonra kısa bir mesaj yaz:
- Notun yolu: `05 Günlük/<bugün>.md`
- İki hattın odak konusu ve kademesi, penceresi (ör. "son 12 soruda 8 doğru; 10 olunca K5") ve bugün hangi alt becerilere ağırlık verildiği
- Yoklamadaki konular (ve şu ana kadarki yoklama durumları), tekrar edilen konular, varsa ön konu ve açık mini drill
- Günün becerisi ve bugünün günlük yazarı (hikâyeyi ve hook'u açık etmeden tek, merak uyandıran cümle; Sezon yayından hiçbir şey söyleme)
- Tahmini süre
