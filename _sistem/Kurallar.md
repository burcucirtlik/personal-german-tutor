# Öğrenme kuralları

Bu dosya sistemin "beyni". Claude her antrenmanı bu kurallara göre hazırlar ve puanlar. Bir kuralı değiştirmek istersen buradan değiştir, Claude yeni kurala uyar.

## Müfredat: iki hat ve kademeler (gramer)
Gramer konuları kilit açarak değil, **sabit bir sırayla** ilerler. Sıra: `_sistem/Müfredat.md`. İki hat paralel yürür:
- **Fiil hattı:** fiil çekimi, fiilin yeri, zamanlar
- **İsim hattı:** artikel, haller, zamirler, edatlar

Her hatta aynı anda **tek bir odak konusu** çalışılır: hattın `sira` sırasındaki ilk bitmemiş konu. Onarımdaki konular (bitmiş konunun onarımı ve dar onarım) odak sayılmaz; tekrar bölümünde çalışılır. Odak konusu bitmeden o hatta sonraki konu öğretilmez. Amaç: bir konu oturmadan üstüne yenisi gelmesin, ama bildiğin konuya da vakit harcanmasın.

### Konu durumları
| Durum | Anlamı |
|---|---|
| `kilitli` | Sırası gelmedi, hiç çalışılmadı |
| `beklemede` | Daha önce çalışıldı ama sırası gelmedi (ör. eski bir düzenden taşınan konu). Verisi korunur; sırası gelince odak olur. `kademe` > 0 ise o kademeden başlar |
| `ogreniliyor` | Hattın odak konusu, kademelerde ilerliyor (ya da kademe 0'da yoklamada) |
| `zayif` | Odakta kademe düştü, ya da bitmiş bir konu tekrarda bozuldu (onarım) |
| `temiz` | Bitti: 5 kademe geçildi ya da yoklamayla bildiği kanıtlandı. Sadece aralıklı tekrar |

### Konu notlarındaki alanlar
```yaml
id: A1-11
tur: gramer
seviye: A1
hat: fiil            # fiil / isim
sira: 6              # Müfredat.md'deki sıra
durum: kilitli
kademe: 0            # 0 = başlamadı, 1–5 = çalışılan kademe (odak değilse: başlayacağı kademe)
seri: 0              # eski alan, kullanılmıyor; hep 0
pencere: 9/12        # geçerli kademede son 12 yapı sorusunda doğru sayısı (onarımda son 10); ilerleme.py yazar
yoklama: 0/0/0       # doğru/soru/gün · "hata 4/6" = bozuldu · "gecti"
ustalik: 0           # 0–100, dashboard için
temiz_gun: 0
adim: 0              # tekrar aralığı basamağı (bitmiş konularda)
son_calisma:
sonraki_tekrar:
bitis:               # konunun bittiği gün
on: true             # sadece ön konuda (Ön konu bölümü); yoksa yazılmaz
onarim_bas:          # sadece onarımda: onarım penceresinin başladığı gün
dar: [...]           # sadece dar onarımda: hâlâ çalışılan alt beceriler
alt: [...]           # alt beceriler (Alt beceriler bölümü)
```
`onkosul` gramer konularında artık kullanılmaz; sıra Müfredat'ta.

### Kademeler
| K | Ad | Soru türleri | Ne ölçer |
|---|---|---|---|
| 1 | Tanıma | `secmeli`, `dogruyanlis`, `eslestir`, `kutula` | Doğru biçimi görünce tanıyor mu? Kısa cümle, tek kalıp |
| 2 | Üretme | `bosluk` (tek boşluk, ipuçlu): tek cümle, mini diyalog (soru – cevap) ya da iki cümlelik bağlam içinde | Biçimi kendisi yazabiliyor mu? |
| 3 | Cümle | `donustur`, `hata`, `yaz`, kontrast `secmeli` ya da `kutula` (en fazla bir kart) | Cümle içinde kurabiliyor, hatayı görebiliyor mu? İpucu azalır |
| 4 | Serbest | `ceviri`, çok boşluklu `bosluk`, ipucusuz `yaz`, kontrast `hata`; bitmiş konularla karışık | İpucusuz, Türkçeden Almancaya |
| 5 | Bağlam | Kısa metinde boşluklar, metin + soru, 2–3 cümle yazma | Gerçek metin içinde kullanabiliyor mu? |

- Aynı kademenin ikinci günü birinciden zordur: farklı fiil ve isimler, daha uzun cümle, daha az ipucu.
- **Tür rotasyonu:** K3 ve üstünde bir bölümde tek bir soru türü soruların %60'ını geçmez; tür dağılımı bir önceki seansla aynı olmaz; aynı tür art arda en fazla 3 kez gelir. K2'de soruların en az üçte biri mini diyalog ya da iki cümlelik bağlamdır. (Neden: bu kural olmazsa bir kademe seanslarca aynı karışımla gelir, ör. her gün "4 hata + 4 dönüştür + 3 yaz".) `_sistem/cesitlilik.py` denetler (Çeşitlilik, aşağıda).
- **Kontrast soruları (K3 ve üstü):** odak sorularının en az dörtte biri, odak yapısıyla **karışan komşu yapıyı** aynı soruda karşı karşıya getirir; soruya `kontrast: "<komşu konu id'si>"` yazılır. Düzenli ↔ düzensiz fiil (*Pavel fragt, aber Kofi fährt*), ich ↔ du/er (*ich helfe, du hilfst*), -st ↔ -est (*du weinst, du arbeitest*), kurallı ↔ kuralsız artikel. Neden: her kural kendi bloğunda çalışılınca hangi kuralın geçerli olduğuna hiç karar verilmiyor; *frägt, ich hilfe, zählest, weinest* gibi hatalar kuralı bilmemekten değil, aşırı genellemeden gelir. Kontrast sorusu odak konusunun kademe puanına sayılır; yapı ancak **iki taraf da** doğruysa doğrudur.
- Odak sorularında **sadece üretim sınırındaki yapılar** (o konu ve bitmiş konular) geçer. Sırası gelmemiş bir yapı (ör. Perfekt) soruda, örnek cümlede ve cümle kartında kullanılmaz; okuma, dinleme ve günlük metinleri için **Üretim ve anlama sınırı** bölümüne bak.
- Konu ilk kez öğretilirken (K1 ya da yoklamadan sonra K2) ders kutusu açık gelir. Kademe düşünce de açık gelir.

### Kademe geçişi (her `/kontrol` sonrası, odak konusu için)
**Kademe puanı = o günkü odak sorularında yapının doğruluğu × 100.** Kademe yapıyı ölçer, kelimeyi değil:
- Genel etiketli hatalar (`yazim`, `kelime-eksik`, `ingilizce-kelime`, `kalip-ifade`, `artikel-kelime`) kademe puanında **sayılmaz**: ölçülen yapı doğru kurulduysa soru 1 sayılır. Yapı cevapta hiç görünmüyorsa (ör. fiil yerine başka kelime yazıldı, yapı kurulmadı) soru 0 sayılır.
- Genel puan, `ustalik` ve beceri puanları **ham puandan** hesaplanır (yazım ve kelime hataları orada düşer). Böylece puan şişmez, ama kelime eksiği gramer ilerlemesini kilitlemez (yoksa yapıyı bilen öğrenci sadece kelime ve yazım hataları yüzünden bir kademede günlerce kalabilir).
- **Kenar durumlar** (konu notunun `alt` listesinde `kenar:` ile başlayanlar, ör. *du redest, er zeichnet*) K1–K3'te sorulmaz; K4, K5 ve tekrarda sorulur.
- Hesabı `python3 -I _sistem/ilerleme.py <gün>` yapar (Puanlama betiği, aşağıda).

**Kayan pencere.** Geçişe tek bir günün yüzdesi değil, o kademede sorulan **son 12 yapı sorusu** karar verir (bugün dahil, günler arasında birikir; kademe değişince pencere sıfırdan başlar):

| Durum | Ne olur |
|---|---|
| Bugün **hiç yapı hatası yok**, K1–K4 | Kademe doğrudan +1. Bildiğin kademede ikinci gün beklenmez. **Kısa gün** seanslarında bu satır uygulanmaz |
| Pencere dolu (12 soru), **en az 10 doğru**, en az **2 farklı gün**, takılan alt beceri yok | Kademe +1. K5'te konu **biter**: `temiz`, `adim: 2`, `bitis` = bugün, sonraki tekrar 7 gün sonra |
| Pencerede (en az 8 soru) doğruluk **%60'ın altında** | Kademe −1 (en az 1), durum `zayif`. Pencerede 8 soru yoksa bugünün puanına bakılır |
| Diğer durumlar | Kademe aynı; pencere birikmeye devam eder |

- **Takılan alt beceri:** pencerede aynı alt beceride **2 hata** varsa geçiş olmaz; ertesi günün soruları o alt beceriye yönelir (Alt beceri kanıtı). Pencere 10/12 olsa da *das Mädchen* iki kez yanlışsa konu ilerlemez.
- **Bitiş kapsamı:** konu K5'te ancak kenar olmayan **her alt becerisinden K4–K5'te en az bir doğru kanıt** varsa biter (yoklamadaki kuralın aynısı). Eksik alt beceriyi betik söyler.
- Neden: "üst üste iki seans ≥ 85" gibi seans eşikleri gürültülüdür. 8–11 soruluk bir seansta ≥ 85 en fazla bir hata demek; gerçek başarısı %85 olan biri bile bir günü ancak ~%60 ihtimalle geçer, iki günü üst üste ~%36. Ortalaması %84 olan bir öğrenci böyle bir kuralla haftalarca aynı kademede kalabilir. Pencere aynı kanıtı ister (12'de 10 = %83, iki gün), tek bir kötü gün birikmiş kanıtı silmez. Takılan alt beceri kuralı ise seans eşiğinden **sıkıdır**: yarım bilinen kalıp ortalamanın içinde kaybolamaz.
- `pencere` alanını (`9/12`) betik yazar; dashboard gösterir.

Konu bitince hattın sıradaki konusu odak olur (`ogreniliyor`). Ön konu varsa (aşağıda) odak o olur ve kaldığı kademeden devam eder.

### Ön konu: sıradaki konuya erken başlamak
Tek odak kuralı korunur, ama odak konusu son kademelerdeyken hattın vakti boşa gitmez:
- Odak konusu **K4'e ulaştığında**, hattın sıradaki konusu yoklaması bozulmuşsa (öğretilmesi gerekiyorsa) **ön konu** olarak K1'den başlar: `durum: ogreniliyor`, `on: true`. Yoklaması açık olan konu ön konu olmaz, yoklamada kalır.
- Ön konuya her gün **4–6 soru** ve ders kutusu gelir (antrenman JSON'unda `rol: "on"`). Kademe geçişi odaktaki gibidir, ama ön konu **en fazla K2'ye** kadar çıkar; K3'ten sonrası ancak odak olunca açılır.
- Odak konusu K4'ün altına düşerse ön konu durur: kademesi korunur, `on` alanı silinir, konu `beklemede` olur.
- Odak bitince ön konu odak olur (`on` silinir) ve kaldığı kademeden devam eder.
- Ön konunun yapıları sadece kendi bölümünde **sorulur**; diğer sorularda hâlâ sırası gelmemiş yapı sayılır. Metinlerde anlama sınırındaki her yapı gibi geçebilir (Üretim ve anlama sınırı).
- Neden: iki hatta 60'a yakın konu var; bir konunun bütün kademelerden geçmesi çoğu zaman 9–10 seans sürer, tek odakla bu tempo sınav takvimine sığmayabilir. Ön konu hiçbir kademeyi atlatmaz, sadece K1–K2'yi öne çeker.

### Dar onarım: kalan bir iki kalıp hattı durdurmasın
Odak konusu son kademelerde, ama hatalar bütün konuya değil bir iki kalıba sıkışmışsa konu odakta haftalarca bekleyip hattı durdurmaz: **sadece o kalıplarla** tekrar bölümüne geçer, hat sıradaki konuya ilerler. Konu bitmiş sayılmaz; yarım kalan kalıp her gün sorulur ve kanıtlanmadan konu bitmez. (Neden: hatalar birkaç kalıpta toplanmışken, ör. Artikel'de *-chen* ve *-heit*, konuyu odakta tutmak hattı fiilen durdurur; ön konu da K2'de tavan yapar.)

**Giriş** (hepsi birden, `ilerleme.py` karar verir):
- Konu odakta **K4 ya da K5**'te (ön konu ve kısa gün değil).
- Kayan pencere dolu (12 soru), en az **8 doğru**, en az **2 farklı gün**.
- Penceredeki yapı hatalarının hepsi **en fazla 2 alt beceride** toplanmış ve her hatalı sorunun `alt` alanı var (alanı olmayan bir hata varsa betik karar vermez).
- Kenar olmayan **diğer bütün alt becerilerin** K4–K5'te doğru kanıtı var (bitiş kapsamı, Kademe geçişi).
- Hatta başka bir dar onarım konusu yok (aynı anda hat başına en fazla bir tane).

**Ne olur:** konu `durum: zayif`, `dar: [hatalı alt beceriler]`, `kademe` aynı kalır; hattın sıradaki konusu odak olur (ön konu varsa o, kaldığı kademeden; ön konu bugün odak olduysa o günkü bölümünde K2 sınırı kalkar).

**Her gün:** tekrar bölümünde, onarımdaki konulardan önce: her dar alt beceriye **2 soru** (en az 4), artı başka bir alt beceriden **1 kontrol sorusu**. K4 düzeyinde, üretim (çeviri, dönüştürme, hata, ipucusuz cümle), her gün farklı kelime.

**Genişleme:** kontrol sorusunda ya da başka bir alt beceride yapı hatası çıkarsa o alt beceri de `dar` listesine eklenir; o gün çıkış olmaz.

**Çıkış:** dar alt becerilere dar onarım başından beri sorulan **son 6 soruda en az 5 doğru**, en az **2 farklı gün**, **her dar alt becerinin en az bir doğru kanıtı** ve o gün genişleme yok → konu biter: `temiz`, `kademe: 5`, `adim: 1`, `bitis` = bugün, sonraki tekrar 3 gün sonra.

- Dar onarım yarım bilinen konuyu atlatmaz: konunun bilinen kısmı K4–K5'te ipucusuz kanıtlanmış olmalı, bilinmeyen kısmı her gün sorulur ve kanıtlanmadan konu bitmez. Ertelenen tek şey, hattın o kalıp yüzünden beklemesidir.
- Dar onarımdaki konunun yapıları üretim sınırındadır (sorularda ve metinlerde kullanılabilir).
- Dashboard hattın altında "Dar onarım: …" satırını gösterir; `/analiz` onarımdaki konuları raporlarken dar onarımı ayrıca söyler.

### Alt beceriler
Her gramer konusunun notunda `alt` listesi olur: konunun yoklamada ve tekrarda kapsanması gereken 4–6 alt beceri. `kenar:` ile başlayanlar seyrek kalıplardır.
```yaml
alt: [ich-du-er çekimi, wir-ihr-sie çekimi, sıfat + sein (müde sein), isim + haben (Hunger haben), soru biçimi, "kenar: ihr seid / ihr habt karışması"]
```
- Liste yoksa `/antrenman` konu yoklamaya ya da odağa ilk girdiğinde yazar (sadece konu notunun frontmatter'ındaki `alt` satırı; liste herkes için geçerli genel içeriktir).
- **Her gramer sorusu** (odak, ön konu, yoklama, tekrar) ölçtüğü alt beceriyi `alt` alanıyla yazar; metin listedekiyle **birebir aynı** olmalı, yoksa kanıt sayılmaz (`cesitlilik.py` denetler).

### Alt beceri kanıtı: soruyu bilinmeyene yönelt
Konu kaba bir birim; hatalar birkaç alt beceride toplanır. Tipik olarak bir konunun hataları birkaç kalıpta toplanır (ör. Artikel'de *-chen → das* ve *-heit / -ung / -e → die*; düzenli fiillerde *wer + -t*, fazladan *-e-*, *frägt*); odak sorularının çoğu ise zaten tam doğrudur.
- `python3 -I _sistem/ilerleme.py alt` her odak, ön ve onarım konusu için alt becerilerin durumunu ve son yapı hatalarını yazar: **kırmızı** (son 3 denemede hata var) · **yeşil** (en az 3 deneme, son 3'ü doğru) · **kanıt yok** (3'ten az deneme).
- `/antrenman` bölümün sorularını buna göre dağıtır: **kırmızı alt becerilere soruların yarısı**, kanıtı olmayanlara en az birer soru, yeşillere toplam **en fazla dörtte bir**. Kırmızı yoksa sorular kanıtı olmayanlara ve kontrasta gider.
- Kırmızı alt beceri aynı kalıpla tekrar sorulmaz: farklı kelime, farklı tür, bir de kontrast (*das Mädchen ↔ die Frau*; *Wer wohnt? ↔ Du wohnst.*).
- Yeşil alt beceri unutulmaz: haftada en az bir kez kontrol sorusu alır.

### Yoklama: bildiğin konuyu yeniden öğretmemek
- **Yoklama penceresi:** her hatta odak konusu kademe 0'daysa o, ve sıradaki **2** konu (yoklaması bozulmamış olanlar). Bunlara her gün yoklama soruları gelir: **K4 düzeyinde, ipucusuz** (`ceviri`, `hata`, `donustur`). Kademe 0'daki odak için 6, sıradakiler için 3'er soru.
- **Geçer:** en az 6 soru, en az **2 farklı gün**, **hiç dilbilgisi hatası yok**, ve konunun kenar olmayan **her alt becerisinden en az 1 doğru kanıt** (Neden: 6 soru konuyu kapsamayabilir; ör. *sein / haben* yoklaması *müde sein* ve *ihr seid* hiç sorulmadan geçilir, konu sonra onarıma düşer). Alt becerileri kapsanmamış konu 6 soruyu geçse de yoklamada kalır; eksik alt beceriler sonraki günlerde sorulur. Genel etiketler bozmaz: küçük yazım hatası, bilinmeyen kelime, İngilizce kelime. Bu durumlarda yoklanan yapı doğruysa soru doğru sayılır, yapı görünmüyorsa soru sayılır ama doğru sayılmaz. Konu öğretilmeden biter: `temiz`, `kademe: 5`, `adim: 1`, sonraki tekrar 3 gün sonra.
- **Bozulur:** tek bir dilbilgisi hatası yeter (`yoklama: hata d/s`). Bozulan yoklama bir daha açılmaz: yarım bilinen konu araya kaynamaz. Başlangıç kademesi hemen `kademe` alanına yazılır: soruların en az 2/3'ü doğruysa **K2**, değilse **K1**. Durum değişmez; sırası gelince konu o kademeden öğretilmeye başlar.
- **Günlük antrenman kanıtı:** günlük antrenmanlarda (seviye tespiti hariç) bir konuda en az 2 dilbilgisi hatası görüldüyse, ya da kullanıcı "bunu anlamadım" dediyse yoklama baştan bozuk sayılır (`yoklama: hata (günlük)`).
- K1–K3 sorularına verilen doğru cevaplar bir konuyu atlatmaz; sadece kendi kademesini ilerletir.

### Bitmiş konuların tekrarı ve onarım
- Bitmiş konular aralıklı tekrarla gelir. **Aralıklar:** adim 0 → 1 gün · 1 → 3 · 2 → 7 · 3 → 14 · 4+ → 30.
- Tekrar soruları K4 düzeyinde, konular karışık, konunun farklı alt becerilerinden. Puan kademe puanı gibi yapı doğruluğuyla hesaplanır. Seans ≥ 85 → `adim +1`. 60–84 → adim aynı, yarın tekrar. < 60 → **onarım**: durum `zayif`, `kademe: 3`, `seri: 0`.
- **Onarım:** onarımdaki konu her gün **5–6 soruyla** tekrar bölümünde gelir (odak konusu değişmez); soruların yarısı kırmızı alt becerilerden (Alt beceri kanıtı). Çıkış kayan pencereyle: onarım başladığından beri sorulan **son 10 soruda en az 8 doğru**, en az **2 farklı gün** ve aynı alt beceride 2 hata yok → yeniden `temiz`, `adim: 1`. `onarim_bas` ve `pencere` alanlarını betik yazar. (Eskiden "iki seans üst üste ≥ 80" vardı: 5 soruda bu 4/5 demekti; düzensiz fiiller 60 · 80 · 80 · 60 ile çıkıp geri girdi.)
- **Hata etiketi kuralı (oranla):** bir hata etiketi bugün görüldüyse, son 7 günde bağlı konuyu ölçen sorularda bu etiketle **en az 3 hata** var **ve** hata oranı **≥ %25** ise bağlı konu **bitmişse onarıma girer**. Konu zaten odakta ya da onarımdaysa bir şey değişmez: geçişi pencere ölçer. Her gün sorulan konuda 3 hata tek başına yetmez; oran da yüksek olmalı.
  - Serbest yazmadaki (`yazma`, kağıda geçirilen günlük) hatalar etiket sayacına ve Fehlerlog'a yazılır, ama bu kuralı **tek başına tetiklemez** ve onarımı bozmaz (yoksa tekrarda 3/3 alıp onarımdan çıkan bir konu, aynı gün serbest yazmadaki tek bir *ich hilfe* ile geri döner).
  - Genel etiketler (`yazim`, `kalip-ifade`, `kelime-eksik`, `ingilizce-kelime`, `artikel-kelime`) bu kurala girmez ve yoklamayı bozmaz.
- **Aynı açıklama üçüncü kez işe yaramaz:** bir yapı etiketi son 7 günde 3. kez görüldüyse `/kontrol` o hataya özel bir **mini drill** açar (Drill'ler → Mini drill) ve açıklamayı değiştirir: düz kural yerine karşılaştırma çifti (*Ich habe Hunger. ↔ Ich bin müde.*) ve kısa bir "neden" (Türkçede *yorgunum* fiilsiz, Almancada *sein* ister).

### Artikel: kural mı, kelime mi?
İsmin cinsiyeti iki ayrı şeydir ve ayrı ölçülür (Neden: rastgele isimlerin cinsiyetinde yüksek doğruluk istemek, kuralı bilen öğrencinin isim hattını haftalarca kilitler).
- **Kural** (konunun kendisi, `artikel-genus`): der/die/das ↔ ein/eine kullanımı ve artikeli ele veren kalıplar: insan isimleri, *-ung / -heit / -keit / -ion → die*, *-e → die*, *-chen / -lein → das*, günler, aylar ve mevsimler *→ der*. A1-04'ün alt becerileri bunlardır; odak, yoklama ve tekrar soruları **sadece bu kalıplara uyan isimlerle** kurulur. Kurallı bir isimde artikel hatası her yerde `artikel-genus` etiketi alır ve yapı hatasıdır.
- **Kelime** (`artikel-kelime`, genel etiket): artikeli bir kuraldan çıkmayan isim (*der Tisch, das Buch, der Schlüssel*). Hangi soruda çıkarsa çıksın yapı hatası sayılmaz, yoklamayı bozmaz; ham puanda yarım puan düşer. `/kontrol` ismi artikeliyle "Yarın bağlamda" listesine yazar ve kartı varsa sözlükte işaretler: kuralsız isimlerin cinsiyeti **kartların işidir** (🇹🇷 → 🇩🇪 yönü artikeli ister, artikeller renklidir) ve sınava kadar kelimeyle birlikte öğrenilir.
- *-e → die* bir eğilimdir (*der Name, der Käse, das Ende*): bu istisnalar sorulmaz, karşılaşılırsa `artikel-kelime` sayılır.

### Üretim ve anlama sınırı
Sorulan ile okunan aynı sınıra bağlı değildir. Üretim dar tutulur ki yarım bilinen yapı araya kaynamasın; anlama geniş tutulur ki metinler gerçek dile benzesin ve sıradaki konular kulağa önceden yerleşsin. (Neden: tek sınırla bütün metinler şimdiki zaman + der/die/das ile yazılır, aynı birkaç kelime ve kalıp (*müde*, *Mädchen*, "Das ist …") her gün döner, daha önce çalışılmış konular metinlerde bile görünmez.)

| Sınır | İçinde ne var | Nerede geçer |
|---|---|---|
| **Üretim** | Bitmiş konular (onarımdakiler dahil) ve iki hattın odak konuları | Bütün sorular, örnek cümleler, ders notları, cümle kartları, Schreiben görevinin beklediği yapılar |
| **Ön konu** | `on: true` konu | Sadece kendi bölümünde |
| **Anlama** | Üretim sınırı + her hatta odaktan sonraki **3 konu** + daha önce çalışılmış (`beklemede`, ustalık ≥ 50) konular | **Sadece** Lesen ve Hören metinleri ile Tempelhof günlüğü |

- Listeyi `python3 -I _sistem/ilerleme.py sinir` yazar; elle tahmin etme.
- Anlama sınırındaki bir yapı metinde **en fazla her dört cümleden birinde** geçer ve tıklanabilir sözlükte biçimiyle açıklanır (*hat … gefunden* → "buldu", `not`: "geçmiş zaman, sonra öğreneceğiz"). Metnin geri kalanı üretim sınırındadır.
- Anlama sorusu bu cümlelerin **anlamını** sorabilir (richtig / falsch); yapısını sormaz. Boşluk, dönüştürme, hata bulma ve çeviri sorularında üretim sınırının dışına çıkılmaz. Günlüğün "Metinde dikkat et" kutusu sadece odak ve bitmiş konuları gösterir.
- Bu cümleler cümle destesine **eklenmez** (🇹🇷 → 🇩🇪 yönü üretimdir). Dikte ve "arkasından tekrar et" bunları içerebilir: duymak ve kopyalamak anlamadır.
- Yoklama kanıtı değişmez: metinde görmek bir konuyu ne atlatır ne bozar.
- İki sınırın da dışındaki yapı hiçbir yerde geçmez.

### Çeşitlilik
Tekrar edilen şey **yapı** olmalı, cümle değil. `/antrenman` soru dosyasını yazdıktan sonra `python3 -I _sistem/cesitlilik.py <gün>` çalıştırır; ❌ satırları düzeltilmeden not teslim edilmez.
- **Yıpranmış kelime:** son 6 seansın en az 3'ünde gramer sorularında geçen içerik kelimesi (isim, fiil, sıfat; Türkçe çeviri cümlelerindekiler dahil). Bir günde en fazla 3 tanesi (ya da içerik kelimelerinin %10'u) kullanılabilir.
- **Gün içi tekrar:** bir içerik kelimesi bir günde en fazla 3 soruda geçer.
- **Cümle başı:** aynı iki kelimeyle başlayan en fazla 2 cümle ("Das ist …").
- **Yakın kopya:** içerik kelimeleri son 10 seanstaki bir soruyla aynı olan ve geri kalanı da büyük ölçüde örtüşen cümle yazılmaz (*Ihr seid müde.* ↔ *Seid ihr müde?*).
- **Tür rotasyonu, kontrast, `alt` alanı, anahtar sırası:** yukarıdaki kurallar.
- **Bilerek tekrar** serbesttir ama açıkça yazılır: soru dosyasının üst düzeyinde `izinli: ["sprechen", "helfen"]` (yalın biçim). Buraya sadece hedefin kendisi olan kelimeler girer: onarımdaki düzensiz fiiller, inatçı kart kelimeleri, "Yarın bağlamda" ve sık bakılan kelimeler. İzinli kelime de her gün **farklı cümlede** gelir.
- Kişi ve sahne adları (*Lena, Hangar, Turm*) sayılmaz; yine de aynı kişi aynı işi iki gün üst üste yapmaz (*Mehmet kocht Suppe*).

### Ustalık
`ustalik` dashboard ve analiz için tutulur: ilk seans = seans puanı, sonra `round(0.6 × eski + 0.4 × seans)`. Yoklamayla biten konuda `ustalik = max(eski, yoklama yüzdesi)`. İlerlemeyi ustalık değil kademe belirler.

### Seviye kapısı
Bir hattın A2 konuları, o hattın A1 konuları bitince başlar (sıra zaten böyle). B1 için aynı kural A2 ile.

## Kelime temaları ve sınav bölümleri
Bunlar eski usulle ilerler.
- **Kilit açma:** `onkosul` listesindeki konuların ustalığı en az 70 olunca `kilitli` → `yeni`. Kontrol her `/kontrol` sonunda yapılır.
- **Puanlama:** seans puanı = doğru / soru × 100. Ustalık ilk seansta seans puanı, sonra `round(0.6 × eski + 0.4 × seans)`.

| Seans puanı | Ne olur |
|---|---|
| **≥ 85** | `temiz_gun +1` (aynı gün ikinci kez sayılmaz), `adim +1`, sonraki tekrar = bugün + aralık[adim] |
| **60–84** | `adim` aynı, sonraki tekrar = yarın, durum `ogreniliyor` |
| **< 60** | durum `zayif`, `temiz_gun = 0`, `adim = 0`, sonraki tekrar = yarın |

- `temiz_gun ≥ 3` ve `ustalik ≥ 85` → `temiz`. Temiz bir konu tekrarda 70'in altına düşerse `zayif`, `temiz_gun = 0`, `adim = 0`.

## Günlük antrenmanın bileşimi
Süre `_kisisel/Profil.md` içindeki `gunluk_dakika` değerinden gelir. Bir soru ortalama 1 dakika sayılır.

| Pay | İçerik |
|---|---|
| ~%30 | 🔧 **Fiil hattı:** odak konusu kendi kademesinde (8–14 soru; dağılımı alt beceri kanıtı belirler), ya da yoklama; ön konu varsa onun 4–6 sorusu bu payın içinde |
| ~%30 | 🧱 **İsim hattı:** aynı biçimde |
| ~%10 | 🔁 **Tekrar:** onarımdaki konular önce (konu başına 5–6 soru), sonra vadesi gelen bitmiş konular (K4, karışık) |
| ~%10 | 🔤 **Kelime:** sıradaki ya da zayıf kelime teması |
| ~%20 | **Beceri** (günlere göre, aşağıda). Metinler üretim sınırında yazılır, anlama sınırından yapılar sözlüklü geçebilir (Üretim ve anlama sınırı) |
| +10 dk | **Tempelhof günlüğü** (puanlanmaz) |

- Yoklama soruları ayrı bir bölümde gelir (`## 🔎 Yoklama`); hangi konuyu yokladığı her sorunun `konu` alanında yazar.
- Bir hatta odak yoksa (hat bittiyse) payı diğer hatta ve tekrara kayar.
- **Açık mini drill** varsa (Drill'ler → Mini drill) antrenman notunun başında bir satırla hatırlatılır; drill günlük süreye dahil değildir (~5 dk).

### Sorulardaki kelimeler
Gramer sorusu yapıyı ölçer; bilinmeyen kelime yüzünden düşmemeli.
- `ceviri`, `hata`, `yaz` ve `donustur` sorularındaki isim, fiil ve sıfatlar ya **açık kart seviyelerinden** (`kelime_baslangic` ile kart ekranının gösterdiği en yüksek seviye arası) gelir ya da `ipucu`'nda verilir (*nass = ıslak*). Tempelhof kurgu kelimeleri her zaman ipucunda.
- `/kontrol` `kelime-eksik` ile işaretlenen kelimeyi (isim, fiil ya da sıfatsa) yalın biçimiyle kart destesine ekler (`kaynak: "kontrol"`) ya da destede varsa `durum.json`'a dokunmadan sözlükte işaretler; ertesi gün alıştırmalardan birinde bağlam içinde tekrar geçer.

### Kısa gün
Vakit yoksa günü boş geçirmek yerine **kısa antrenman** (~15 dk): kullanıcı "kısa antrenman" derse ya da bir önceki gün boş geçtiyse `/antrenman` önce kısa günü önerir.
- İçerik: onarımdaki konu (5 soru), iki odak konusu (5'er soru), kartlar. Yoklama, beceri ve kelime teması yok. Tempelhof günlüğü yine yazılır (hikâye kopmasın), okuması isteğe bağlı.
- Notun frontmatter'ında `kisa: true`. Puanlama aynı, tek fark: odakta **hatasız seans satırı uygulanmaz** (5 soruyla kademe doğrudan atlanmaz); sorular pencereye normal sayılır.
- Kısa gün dashboard serisini sürdürür.

### Beceri günleri
Konuşma (Sprechen) günlük antrenmana dahil değil, ama sesli üretim tamamen ertelenmez: **Pazar** günü antrenmanın sonuna 5 dakikalık **🗣 Sesli** bölümü eklenir (puanlanmaz): günlüğün bir paragrafını "🗣 arkasından tekrar et" moduyla sesli tekrar ve 3 kısa soruya sesli cevap (*Wer bist du? Was machst du heute?*; seviye A2'ye gelince telc Sprechen Teil 1 soruları). Sözlü sınav için `04 Redemittel` notları duruyor; sınavdan önceki 8 haftada bir partnerle çalışılacak.

| Gün | Beceri | A1–A2'de | A2'nin %50'si temiz olunca |
|---|---|---|---|
| Pazartesi | 🎧 Hören · ayrıntı | Tek ses dosyası (yavaş), iki dinleme, richtig/falsch ve dikte → `P-07` | telc Hören Teil 2–3 |
| Perşembe | 🎧 Hören · Teil 1 biçimi | **5 kısa konuşma, her biri tek dinleme**, birer richtig/falsch → `P-06` | telc Hören Teil 1 |
| Salı | 📖 Lesen · ayrıntı | Kısa metin + **a/b/c** soruları → `P-02`; mini Sprachbausteine a/b/c → `P-04` | telc Lesen Teil 2, Sprachbausteine Teil 1 |
| Cumartesi | 📖 Lesen · pano | Durum ↔ ilan, **"uyan yok" (x)** seçeneğiyle → `P-03` (dönüşümlü: başlık eşleştirme → `P-01`); mini Sprachbausteine kelime havuzu → `P-05` | telc Lesen Teil 1 ve 3, Sprachbausteine Teil 2 |
| Çarşamba, Pazar | ✍️ Schreiben | 3–4 Leitpunkt'lu kısa mesaj (40–60 kelime), basamağına göre, Tempelhof'taki bir ihtiyaçtan → `P-09` | 4 Leitpunkt'lu e-posta, telc kriterleriyle |
| Cuma | ✍️ Schreiben · onarım | **Kendi cümlelerini düzelt** (son yazma görevinden 4–5 cümle) + **4 mikro Leitpunkt** (tek Leitpunkt → tek cümle) | aynısı, B1 Leitpunkt'larıyla |

Biçimlerin ayrıntısı: **Sınav biçimleri (mini)**, aşağıda. Süre değişmez: yeni biçimler eskilerin yerine gelir, üstüne değil.

Beceri alıştırmaları `01 Sınav/Teile` konularını besler: sonuçları **her zaman** ilgili Teil'in ustalığına yazılır (Hören → P-06…08, Lesen → P-01…03, Sprachbausteine → P-04…05, Schreiben → P-09), konu `kilitli` olsa bile. İlk sonuçla `kilitli` → `ogreniliyor`. (Neden: sonuçlar sadece Teil açıkken yazılırsa sınav bölümlerinin ustalığı aylarca boş kalır.) Teile'nin `onkosul` listesi artık sadece sınav formatına geçişi (aşağıdaki eşik) gösterir.

### Sınav biçimleri (mini)
telc B1'in soru biçimleri A1'den itibaren küçük ölçekte çalışılır: biçim sınav günü yeni olmasın, dil seviyesi müfredatın izin verdiği kadar olsun. (Neden: gerçek biçime geçiş ileri bir eşiği beklerse Sprachbausteine hiç çalışılmaz, Lesen hep richtig/falsch, Hören hep tek uzun ses olarak kalır.) Hepsi Tempelhof dünyasından, hepsi üretim sınırında (metinlerde anlama sınırı serbest).

| Biçim | Nasıl | Teil | Kanıt |
|---|---|---|---|
| **Mini Sprachbausteine · a/b/c** | 60–90 kelimelik mektup ya da not; metinde `{1}`…`{6}` numaralı 6 boşluk. Her boşluk **farklı bir bitmiş ya da odak konuyu** ölçer (fiil sonu, artikel, sein/haben, bağlaç, soru kelimesi). Sorular `secmeli`, `yer: n`, `konu`, `alt`. Çeldiriciler kullanıcının **gerçek hatalarından** (*sprechst, der Freiheit, weinest*) | `P-04` | tanıma |
| **Mini Sprachbausteine · kelime havuzu** | Aynı metin biçimi; 6 boşluk, 9 kelimelik havuz (`pano.tur: "kelime"`, harfler a–i), her kelime en fazla bir kez. Sorular `eslestir`, `yer: n` | `P-05` | tanıma |
| **Açık boşluklu mektup** | Aynı metin biçimi ama seçenek yok: kullanıcı yazar (`bosluk`, `yer: n`; fiil boşluğunda mastar `ipucu` olabilir). **Tekrar bölümünde** (`rol: tekrar`), her boşluk kendi `konu` ve `alt`'ıyla | – | **üretim** |
| **Kutula** | 6 öğe, 2–3 kutu (*der / die / das*, *ünlü değişir / değişmez*, *-st / -est*). Bir kart tek bir alt beceriyi ya da tek bir kontrastı ölçer | – | tanıma |
| **Lesen · ayrıntı a/b/c** | 80–120 kelimelik metin, 4–5 `secmeli` soru (metinden kelime kopyalanarak çözülemez: soru başka kelimelerle sorar) | `P-02` | – |
| **Lesen · pano ve "uyan yok"** | 5 durum, 6 ilan; durumlardan **biri hiçbir ilana uymaz** (`anahtar: "x"`, seçeneklerde `"x"`), bir ilan fazladan kalır | `P-03` | – |
| **Hören · Teil 1 biçimi** | 5 ayrı kısa ses (2–3 cümle, farklı konuşmacılar), her biri **tek dinleme** (`dinleme:1`), birer richtig/falsch. Genel anlam sorulur (kim, nerede, ne istiyor), ayrıntı değil | `P-06` | – |
| **Kendi cümlelerini düzelt** | Son yazma görevinde hatalı kurduğu 4–5 cümle, yazdığı gibi, `hata` sorusu olarak (`talimat`: "<gün> tarihinde sen yazdın"). Sadece üretim sınırındaki hatalar | – | genel puan |
| **Mikro Leitpunkt** | Tek cümlelik durum + tek Leitpunkt (isim öbeği: *özür · saat sorusu · yardım önerisi · teşekkür*); kullanıcı **tek cümle** yazar (`yaz`, kelime çipi yok). 4 soru, 4 farklı eylem | – | genel puan |

- **Tanıma kanıtı ilerletmez.** Mini Sprachbausteine (a/b/c, kelime havuzu) ve kutula doğru biçimi seçtirir, ürettirmez. Sprachbausteine bölümü `rol: beceri` ile yazılır: sonucu sadece Teil'in ustalığına gider; doğru cevap konunun kademesini, penceresini ya da tekrar adımını **değiştirmez** ve alt beceri kanıtı sayılmaz (Pedagoji: sadece zor sorudan gelen kanıt hızlandırır). **Yanlış** cevap ise gerçek bilgidir: hata etiketi alır, Fehlerlog'a yazılır ve hata etiketi kuralına sayılır (bitmiş konuyu onarıma sokabilir).
- **Kutula** odak, ön konu ve onarım bölümlerinde **bölüm başına en fazla bir kart** olur ve tek soru sayılır: yapı ancak **bütün öğeler** doğruysa doğrudur. K1'de tanıma türüdür; K3 ve üstünde sadece kontrast olarak kullanılır (`kontrast` alanıyla).
- **Açık boşluklu mektup** üretimdir ve tekrar puanına sayılır. Vadesi gelen bitmiş konuların tekrar soruları (onarım hariç) haftada en az iki gün bu biçimde gelir, ama bir günün tekrar sorularının **en fazla yarısı**; kalanı K4 çevirisi olarak kalır. Bir konunun tekrarı **sadece mektuptan oluşamaz**: her konuya en az bir ipucusuz K4 sorusu (çeviri, dönüştürme) da gelir, yoksa mastar ipuçlu iki boşlukla tekrar adımı atlanmış olur (`cesitlilik.py` denetler). Onarım soruları hep tek tek üretimdir (çeviri, dönüştürme, hata).
- **Schreiben onarım günü (Cuma)** tam görevin yerine gelir; iki bölümü de `rol: beceri`, `teil`'siz yazılır ("Yazı · kendi cümlelerin", "Yazı · tek Leitpunkt"). `P-09`'a ve Schreiben basamağına sadece Çarşamba ve Pazar günlerinin tam görevleri yazılır. Neden: altı tam görev 15–21 / 45 arasında kaldı; düzeltilmiş versiyonu okumak hatayı gidermiyor, kendi cümlesini kendisi düzeltmek ve eylemi tek cümlede denemek gideriyor.
- Süre hesabı: 6 boşluklu metin 4 soru, kutula 1 soru, 5 kısa ses 5 soru, mikro Leitpunkt 1'er soru sayılır.

### Schreiben basamakları
Altı serbest yazma görevi 15–21 / 45 arasında kaldı; tekrar eden sorun gramer değil, Leitpunkt'ı yanlış okumak (sorulacak yerde anlatmak, anlatılacak yerde sormak) ve hitap/kapanış. Bu yüzden Schreiben üç basamakta ilerler. Basamak `01 Sınav/Teile/P-09 …` notunun `asama` alanında.

| Aşama | Görev | Geçiş |
|---|---|---|
| **1 · Leitpunkt okuma** | Önce her Leitpunkt için tek seçim: *sor / anlat / öner / özür dile* (`secmeli`, anında kontrol). Sonra karışık verilmiş 5–6 cümlelik model mesajı sırala (`eslestir`), sonra kısa mesajı yaz | İki görevde I (Aufgabenbewältigung) ve II en az **B** |
| **2 · İskelet** | Hitap, giriş cümlesi, her Leitpunkt için cümle başı ve kapanış verilir (*Liebe …, / Ich schreibe dir, weil … / Kannst du …? / Viele Grüße*); kullanıcı doldurur ve tamamlar | İki görevde I, II ve III en az **B** |
| **3 · Serbest** | Bugünkü gibi tam görev, telc kriterleriyle | – |

- Her basamakta görev yine Tempelhof'tan ve telc biçiminde. Aşama 1–2'de de telc puanı yazılır ki ilerleme karşılaştırılabilsin.
- Puanlarken her Leitpunkt için "istenen eylem yapıldı mı" ayrıca işaretlenir (`schreiben-format` yerine daha net etiketler: `leitpunkt-eksik`, `leitpunkt-yanlis-eylem`, `hitap-kapanis`).

### Anında kontrol (ilk cevap kilidi)
- Tek doğru cevaplı sorularda (`bosluk`, `secmeli`, `dogruyanlis`, `eslestir`, `kutula`) soru dosyasında `anahtar` olur. Kullanıcı **Kontrol et** deyince ilk cevabı kilitlenir, hemen ✅/❌ ve doğrusunu görür; değiştiremez. Sonuç cevap dosyasının `_anlik` alanına yazılır.
- Kesin puanı yine `/kontrol` verir: anahtarın kabul etmediği doğru bir alternatif 1 sayılır. Puanlama, kademe ve yoklama kuralları değişmez; kilit sayesinde puan şişmez.
- Serbest üretim soruları (`hata`, `ceviri`, `yaz`, `donustur`, `yazma`) anında kontrol edilmez.

### Hören araçları
- **Dinleme hakkı:** ses kutusunun başlığı (`iki kez dinleyebilirsin`) ya da embed (`![[ses.m4a|dinleme:2]]`) o gün kaç kez baştan dinlenebileceğini söyler; arayüz uygular. Sınır dolana kadar ileri/geri sarma ve cümle araçları kapalıdır (sınavdaki gibi). Sayılar `_kisisel/ses/dinleme.json`.
- **Cümle araçları:** her sesin yanında `<ses adı>.cumleler.json` (cümle metni ve zamanı, `_sistem/ses.py` / `_sistem/ses_cumle.py` yazar). Arayüz: hız (0.75×, 0.9×, 1×), 📝 cümle cümle dinleme (metin bulanık, tıklayınca açılır), 🗣 arkasından tekrar et (her cümleden sonra tekrar için durur), ✍️ dikte (cümleyi dinle, yaz, kelime kelime karşılaştır).
- **Dikte** sonuçları `_kisisel/ses/dikte.json`. Puana girmez; hata türleri `/kontrol`'de etiketlenir, `/analiz` haftalık oranı raporlar. Günlüğü kağıda geçirmenin dijital karşılığıdır.

### Tempelhof evreni: hikâye her yerde
Hikâye sadece günlükte değil, antrenmanın tamamında yaşar. Amaç, alıştırmaları bir dünyanın parçası yapmak; dilbilgisi ölçüsü değişmez.
- **Cümleler:** odak, yoklama ve tekrar sorularının **yaklaşık yarısı** Tempelhof'ta geçer: karakterler (Kofi, Ingrid, Lena…), yerler (*der Turm, das Tor, Hangar 4, das Feld*), eşyalar (*das Funkgerät, die Taschenlampe, der Gelbe*). Diğer yarısı sınavın dünyasında kalır (doktor, kira, iş, alışveriş), çünkü telc kelimeleri oradan gelir. Tempelhof'un gündelik hayatı da bu kelimeleri taşıyabilir (Ingrid'in muayenehanesi, Markttag, nöbet çizelgesi).
- **Lesen:** Hangar 4'teki *Schwarzes Brett* (takas, kayıp ve meclis ilanları), Lena'nın yayın akışı, Kofi'nin taşıdığı mektuplar, kampın gazetesi *Tempelhofer Blatt*. B1'de telc Lesen formatı aynen korunur, sadece metinlerin dünyası değişir.
- **Hören:** Radio Tempelhof yayınları, telsiz kayıtları, Markttag anonsları. Konuşmacılar karakterlerin sesleriyle okunur (`Karakterler.md` → Sesler).
- **Schreiben:** görev hikâyedeki bir ihtiyaçtan çıkar ve telc biçimini korur: hitap, Leitpunkt'lar, kapanış, du/Sie seçimi. Ör. A1: "Kofi yarın kuleye gidiyor. Marta'ya kısa bir mesaj yaz: kendini tanıt, ne getirebileceğini söyle, saati sor." B1: *Schreiben Sie an die Versammlung: …* (4 Leitpunkt). Puanlama telc kriterleriyle aynen yapılır.
- **Hata soruları** karakterlerin notlarından gelebilir: "Pavel'in telsiz defterinde hatalar var."
- **Hikâye köprüsü:** her gün alıştırmalardan **biri** o günün günlüğüne bağlanan küçük bir ipucu taşır (bir ilan, bir telsiz kaydı, bir not). Günlükte karşılığı çıkar.
- **Spoiler yok:** alıştırmalar ancak yazılmış günlüklerdeki olayları ve bugünün köprüsünü kullanır. Sezon yayındaki gelecek vuruşlar sızdırılmaz.
- **Gerçek dünyaya dönüş:** sınavdan önceki son 4 hafta ve Modelltest günlerinde beceri görevleri gerçek hayattan gelir (sınavda Tempelhof yok). Günlük devam eder.
- Kurgu kelimeleri (*die Langsamen, das Funkgerät*) sözlükte olur ve gerekirse ipucunda verilir; soru kelimeyi değil yapıyı ölçer.

### Tempelhof günlüğü
- Her gün `08 Tempelhof/<tarih> <Ad>.md` notu yazılır. Dünya, karakterler, ton, günlüğün yapısı ve dil seviyesi kuralları: `_sistem/Tempelhof/Karakterler.md`. Süreklilik: `_kisisel/Hikâye.md`. Yol haritası: `_sistem/Tempelhof/Sezon 1.md` (her gün bir vuruş).
- **Ton karanlık, gerilimli ve gizemli.** Her günlük bir anın ortasında başlar, bir aksiyon anı ve bir ipucu içerir, **son cümlesi bir hook'tur** (Karakterler.md → Günlüğün yapısı). Kan ve vahşet yok.
- Yazarlar sırayla döner. Kayıt iki paragraf olur ve müfredata uygun yazılır: üretim sınırındaki yapılarla, en fazla her dört cümleden birinde anlama sınırından bir yapıyla (Üretim ve anlama sınırı; Karakterler.md → Dil seviyesi kuralları). Odak konularından örnekler içerir.
- Sözlük, "metinde dikkat et" kutusu, 3 richtig/falsch sorusu (cevapları katlanmış) ve sesli versiyonu olur.
- Kullanıcı kağıda geçirdiği metnin fotoğrafını paylaşırsa yazım hataları kontrol edilir. Hatalar `06 Fehlerlog`'a `yazim` etiketiyle değil, gerçek hata türüyle işlenir.

### Kartlar (kelime ve cümle desteleri)
- İki deste var: **kelime** ve **cümle**. Çekirdek kartlar (sıklık sıralı kelimeler ve temel cümleler) motorda: `_sistem/kartlar/deste.json` (değişmez). Sonradan eklenen bütün kartlar (antrenman, kontrol, tıklama istekleri) ve çekirdek kartlara kişisel ekler (aynı `id`, sadece değişen alanlar) `_kisisel/kartlar/deste.json`'a yazılır; ekranlar ikisini birleştirir. Temel cümlelerde `{ad}` kullanıcının adıyla gösterilir. Kullanıcının kaydırmaları `_kisisel/kartlar/durum.json` dosyasına ekrandan yazılır.
- Her kartın iki yönü var: **🇩🇪 → 🇹🇷** ve **🇹🇷 → 🇩🇪**. Sağa atılan yön **yeşil**, sola atılan yön **kırmızı** olur.
- Kart, **iki yönü de yeşil** olunca **öğrenilmiş** sayılır ve hatırlatma aralıklarıyla geri gelir: **2, 5, 12, 30, 60 gün** sonra (🧠 hatırlatma). Hatırlatmada sağa atılırsa bir sonraki aralığa geçer. Sola atılırsa o yön kırmızı olur, kart yeniden öğrenilir ve aralıklar baştan başlar.
- Sola atılan kart aynı turda kuyruğun sonuna döner. Bir kart bir turda en fazla **3 kez** gelir; sonra tur biter ve kart ertesi gün ilk sırada gelir (karıştırılmaz, %40 kırmızı sınırına sayılmaz).
- **Tarihler gerçek günden:** kaydırma ve hatırlatma tarihleri her zaman bugünün tarihiyle yazılır; eski bir antrenman notu açılsa da. **Kartlar sayfası** (`Kartlar.md`) antrenman notundan bağımsızdır: antrenman olmayan günde de hatırlatmalar oradan yapılır.
- **Hatırlatmalar önce:** vadesi gelen hatırlatmalara (en eski vade önce) her gün en az 2 yer ayrılır (vadesi gelen daha azsa o kadar); kalan yerler aşağıdaki karışımla dolar. Yoksa 2/5/12/30/60 aralıkları kayar.
- Kartların üstündeki **↻ Yenile** düğmesi (ve tur sonundaki "Yeni tur başlat") o gün henüz görülmemiş kartlardan yeni bir tur getirir.
- Her gün her desteden `Profil.md` → `kart_adet` kadar kart gelir (varsayılan 10). **Günlük karışım:** en fazla %40 takılan (kırmızı) kart, en az %40 yeni kart; kalan yerler hatırlatmalara, sonra ikinci yönü açılan kartlara gider. Kelime destesinde yeni kartlar **sıklık sırasıyla** gelir (en çok kullanılan önce); cümle destesinde yarısı en son eklenenlerden, yarısı en uzun bekleyenlerden. Sıra karıştırılır. Bir gün bir kartın tek yönü gelir.
- **Önce tanı, sonra üret:** yeni kart her zaman 🇩🇪 → 🇹🇷 gelir. 🇹🇷 → 🇩🇪 yönü, Almanca → Türkçe yönü yeşil olunca açılır. Türkçe → Almanca kelime kartlarında **💡 ipucu** düğmesi ilk ve son harfleri gösterir (*die M _ _ _ e*).
- **İnatçı kart:** öğrenilmeden **5 kez** sola atılan kart **3 gün dinlenir** (`durum.json` → `kartlar[id].inatci`). `/antrenman` dinlenen kartların kelimelerini o günün alıştırmalarına bağlam içinde koyar ve karta hafıza kancası ekler. 3 gün sonra kart normal kırmızı kart olarak döner.
- **Kartın arkası:** Türkçesi/Almancası, örnek cümle ve Türkçesi (🔊 ile), zor kelimelerde 💡 hafıza kancası. Artikeller renkli: **der** mavi, **die** kırmızı, **das** yeşil.
- Günün kartları ekran ilk açıldığında seçilir ve o gün için sabit kalır.
- **Cümle kartlarında seviye var** (`seviye`: 1 = 3–5 kelimelik basit cümle, 2 = 5–8 kelime ve tek dilbilgisi konusu, 3 = 8+ kelime, yan cümle veya iki cümle). Bir seviyenin kartlarının %70'i öğrenilmeden üst seviyenin kartları gelmez; o gün yeterli kart yoksa bir üst seviyeden tamamlanır. Hatırlatmalar her seviyeden gelir.
- **Kelime destesi = çekirdek kelime listesi**. B1 çerçevesinde, günlük hayatta en çok duyulan ve kullanılan **isim, fiil ve sıfatlar**, sıklık sırasıyla. Her kartta `sira` (sıklık sırası) ve `seviye` var. Her seviye **100 kelime**: yaklaşık 45 isim, 35 fiil, 20 sıfat.
  - **Sadece yalın biçim:** isim artikeliyle (*der Tisch*; çoğul yok), fiil mastar (*fahren*; çekim, Perfekt yok), sıfat yalın (*groß*). Edat, bağlaç, zarf, kalıp ifade (*einen Termin vereinbaren*), çekimli biçim kelime kartı olmaz.
  - **Örnek cümle** sadece şimdiki zaman ve basit yapıyla (*Der Tisch ist neu.*); Türkçesi yanında.
  - Kelimede seviye eşiği **%50**: bir seviyenin yarısı öğrenilince sıradaki seviye açılır.
  - Seviyeler şu an 1–3 (300 kelime: 1 = en temel günlük kelimeler, 2 = ev, iş, alışveriş, yemek, 3 = Almanya'da günlük hayat: kira, resmi daire, sağlık, iş). Kullanıcı en yüksek seviyeye yaklaşınca Claude aynı kurallarla sıradaki 100 kelimeyi ekler (B1 temaları: Arbeit, Wohnen, Gesundheit, Behörden, Reisen, Medien, Umwelt).
  - Liste dışından kart eklenmez. Tıklanan kelimeler ve günlüğün sözlüğü desteye eklenmez; çekirdek listede olmayan önemli bir isim, fiil ya da sıfat varsa sıradaki seviyeye yazılır.
- **Tıklama sinyali:** sözlükte bir kelimeye tıklamak "buna baktım" demek. `_kisisel/sozluk/tiklananlar.json` her kelime için ilk ve son tıklamayı, toplam sayıyı ve gün gün tıklamaları (`gunler`) tutar. `_sistem/sozluk/sinyal.py` bunlardan `sinyal.json` üretir (her `/kontrol` sonunda çalışır). Durumlar, güçlüden zayıfa:
  | Durum | Ne zaman | Anlamı |
  |---|---|---|
  | `ogrenildi` | Kelimenin kartı iki yönde yeşil | Öğrenildi. **En güçlü sinyal karttır** |
  | `kartta_takili` | Kartın bir yönü kırmızı | Tıklamasan da öğrenilmiş sayılmaz |
  | `istek` | Balonda **⭐ Karta ekle** dendi, kartı yok | Kullanıcı istiyor: isim, fiil ya da sıfatsa `/antrenman` yalın biçimiyle desteye ekler (seviyesi ne olursa olsun); değilse alıştırmaya koyar |
  | `biliyor` | Son tıklamadan sonra balonda **✓ Biliyorum** dendi | Tıklama sinyal sayılmaz, kartı öne alınmaz, alıştırmaya konmaz |
  | `bakmiyor` | Son tıklamadan sonra en az 2 tamamlanan günde metinde geçti, tıklanmadı | Tanıyor olabilir (zayıf sinyal). Kartı varsa kart karar verir |
  | `sik_bakiyor` | En az 2 farklı günde ya da en az 3 kez tıklandı, son 7 gün içinde | Takılıyor: daha sık gelmeli |
  | `bakti` | Bir kez bakıldı | Henüz bir şey söylemiyor |
- **Tıklama ne değiştirir?**
  - **Kartlar:** Kart ekranı son 7 günde tıklanan kelimelerin kartlarını öne alır (🔍 tıkladın rozeti). ⭐ ile istenen kelimenin kartı en öne geçer, ✓ Biliyorum denen öne alınmaz. Kart üst seviyede olsa bile gelebilir, ama tıklamayla öne alınan kart **günde toplam en fazla 3** (↻ Yenile turları dahil).
  - **Deste:** `sik_bakiyor` bir isim, fiil ya da sıfat çekirdek listede yoksa `/antrenman` onu yalın biçimiyle desteye ekler (`kaynak: "tıklandı"`).
  - **Alıştırmalar:** `/antrenman` sık bakılan kelimelerden 3–5 tanesini o günün alıştırmalarına, okuma metnine ya da günlüğe koyar (zarflar ve edatlar dahil).
  - **Analiz:** `/analiz` tıklamaları raporlar. Tıklama öğrenmenin kanıtı değildir, sadece işarettir.
- **Cümle destesine ekleme:** ders notu örnekleri, günlükten 2–3 cümle ve `/kontrol`'de yanlış yapılan cümlelerin doğru hali. Cümleler müfredata uyar: sırası gelmemiş yapı içeren cümle eklenmez.


## Seviye tespiti (yeni başlayan kullanıcı)
Yeni bir kullanıcının iki hattaki **tavanını** (hatasız üretebildiği en yüksek konu) ve altındaki **boşlukları** iki günde bulur, ilk antrenmanı tam oradan başlatır: bildiğiyle vakit kaybetmesin, yarım bildiği araya kaynamasın. Komut: `/seviye` (`.claude/skills/seviye/SKILL.md`).

**Zorunlu.** `Profil.md` → `seviye_tespiti` `tamamlandi` olmadan hiçbir antrenman, kart turu, drill önerisi ya da analiz üretilmez. `/antrenman`, `/kontrol` ve `/analiz` bu durumda iş yapmaz, kullanıcıyı `/seviye`'ye yönlendirir; kart ve drill ekranları da kapalıdır. Tespit yarım kaldıysa (`devam`) kaldığı yerden sürer.

**İlkeler:**
1. **Sadece zor kanıt sayılır:** sorular K4 düzeyinde ve ipucusuz (`ceviri` ağırlıklı, `hata`, `donustur`), artı serbest yazma. Seçmeli ve tanıma sorusu yok. (İlk tespit her konuya 2 kolay soru sormuş, yarım bilinen konular "biliniyor" sayılmıştı.)
2. **Kanıt yoklama sayaçlarına yazılır.** Tespit ayrı bir puan sistemi değil, yoklamanın hızlandırılmış hâli: konu ancak **hiç dilbilgisi hatası olmadan**, **iki farklı günde** ve yeterli sayıda doğru kanıtla geçer (Kanıt eşiği). Yetişmeyen kanıt kaybolmaz, günlük yoklamada sayılmaya devam eder.
3. **Beyandan başlar ve uyarlanır:** her konuyu sormaz. Beyan edilen bandın etrafına kontrol noktaları koyar, tavanı bulur, sonra sadece gereken yeri daraltır. Birleşik cümleler tek soruda birkaç konuya kanıt toplar.
4. **Hesabı betik yapar:** `_sistem/seviye/tespit.py`. Claude soruları yazar ve cevapları puanlar; neyin sorulacağını, kanıt sayımını, tavanı ve sonucu betik hesaplar. Aynı cevaplar her kullanıcıda aynı sonucu verir. `_sistem/seviye/test_tespit.py` sahte öğrencilerle üç değişmezi dener (bilinmeyen konu `temiz` olmaz · bilinen konunun yoklaması bozulmaz · odak bilinmeyen ilk konunun üstüne çıkmaz); bu bölümdeki bir kural ya da betik değişince çalıştırılır.

### Akış
| Adım | Ne zaman | İçerik | Süre |
|---|---|---|---|
| 0 · Tanışma ve beyan | Sohbette | Ad, sınav tarihi, günlük dakika ve **seviye beyanı** (A0 … B1.2) | 3 dk |
| 1 · Kabul görüşmesi (Tur 1) | 1. gün | Kontrol noktaları (her soruda bandın altından yan kanıtlar) + serbest yazma + kelime taraması | A1 ~30 dk · A2 ~50 dk · B1 ~65 dk |
| 2 · Daraltma (Tur 2) | 1. gün, Tur 1 puanlanınca | Tavanın üstündeki aralık + ilk gün kanıtı eksik konuların taraması | 5–25 dk |
| 3 · Doğrulama (Tur 3) | En erken ertesi gün | Tavanın altındaki konulara birleşik sorular | 10–45 dk |

Beyan **A0** ise tur yoktur (Sıfırdan başlangıç). Cevaplar kendiliğinden kaydedildiği için bir tur bölünerek de çözülebilir.

Hikâye çerçevesi: kullanıcı Tempelhof kapısına gelen yeni biridir. Tur 1 Dr. Ingrid'le kabul görüşmesi, Tur 2 Pavel'in telsiz sınavı, Tur 3 Versammlung'un son soruları. Bu sahneler Sezon 1 Tag 1'den önce geçer; yayın sırlarından hiçbir şey içermez.

### Seviye beyanı: cümle merdiveni
Beyan gramer terimiyle sorulmaz (*Akkusativ*, *Perfekt* kelimelerini bilmeyen yanlış beyan eder). Kullanıcıya şu altı cümle gösterilir ve sorulur: **"Sözlüksüz, yardımsız ve hatasız kurabileceğin son cümle hangisi?"** Okuyup anlamak yetmez; Türkçesini görünce Almancasını kendisi yazabilmeli.

| # | Cümle | Türkçesi |
|---|---|---|
| 1 | *Ich bin müde und habe keinen Hunger. Wann stehst du auf?* | Yorgunum ve aç değilim. Sen ne zaman kalkıyorsun? |
| 2 | *Ich bin heute um sieben Uhr aufgestanden, aber ich muss noch einkaufen.* | Bugün saat yedide kalktım ama daha alışveriş yapmam gerekiyor. |
| 3 | *Gestern konnte ich meiner Schwester nicht helfen, weil ich bis zum Abend im Büro bleiben musste.* | Dün kız kardeşime yardım edemedim çünkü akşama kadar ofiste kalmak zorundaydım. |
| 4 | *Wenn ich mehr Zeit hätte, würde ich mich um einen besseren Job bewerben.* | Daha çok vaktim olsaydı daha iyi bir işe başvururdum. |
| 5 | *Als ich klein war, wohnten wir wegen der Arbeit meines Vaters in einem Dorf, obwohl meine Mutter die Stadt liebte.* | Küçükken babamın işi yüzünden bir köyde oturuyorduk, annem şehri sevdiği hâlde. |
| 6 | *Das Haus, in dem ich wohne, wird gerade renoviert.* | Oturduğum ev şu an yenileniyor. |

| Cevap | Beyan | Fiil hattı bandı | İsim hattı bandı |
|---|---|---|---|
| Hiç Almanca bilmiyorum (ya da sadece birkaç kelime) | **A0** | – | – |
| Biraz biliyorum ama 1. cümleyi tam kuramam | **A1.1** | 1–6 | 1–5 |
| 1 | **A1.2** | 7–12 | 6–10 |
| 2 | **A2.1** | 13–17 | 11–16 |
| 3 | **A2.2** | 18–22 | 17–22 |
| 4 | **B1.1** | 23–31 | 23–26 |
| 5 ya da 6 | **B1.2** | 32–39 | 27–30 |

- Bantlar Müfredat'taki sıra numaralarıdır: beyan "tavanım bu bandın içinde" demektir. Beyan `Profil.md` → `beyan` alanına yazılır ve sonuçta ölçülen seviyeyle karşılaştırılır.
- **İki cümle arasında kalan üsttekini söyler.** Yüksek beyanın bedeli zor geçen bir ilk gündür ve tespit yine tam yerine iner. Düşük beyanda tavanın üstündeki konuların ikinci gün kanıtı eksik kalır ve günlük yoklamada tamamlanır (test: iki bant düşük beyanda hat başına 3–4 konu, üç bantta 6–11 konu).

### Sıfırdan başlangıç (beyan A0)
Hiç bilmeyen birine 30 dakika ipucusuz çeviri sormak hem bir şey ölçmez hem de kötü bir karşılamadır. Beyan A0 ise tur yapılmaz; `python3 -I _sistem/seviye/tespit.py sifir --yaz`:
- **A1** gramer konularının yoklaması kapatılır: `yoklama: hata (beyan)`, `kademe: 1`. Hepsi sırası gelince K1'den öğretilir; her gün bilmediği konulardan K4 yoklama sorusu gelmez. A2 ve B1 konuları açık kalır, sırası gelince yoklanır (o zamana kadar başka yerden öğrenmiş olabilir).
- Her hattın ilk konusu odak olur (`ogreniliyor`, K1). `kelime_baslangic: 1`, `cumle_baslangic: 1`, `seviye_tespiti: tamamlandi`.
- İlk `/antrenman` aynı gün yazılabilir.
- Biraz bildiği hâlde A0 diyen biri hiçbir konuyu atlamaz, sadece hızlı geçer: yapı hatasız seans kademeyi doğrudan atlatır (Kademe geçişi → 100 satırı).

### Kontrol planı (Tur 1)
Noktaları ve yan kanıtları `python3 -I _sistem/seviye/tespit.py plan <beyan>` seçer (Claude elle seçmez). Her hatta üç tür nokta:
- **Bant:** beyan bandında her 2 konuda bir, bandın son konusu dahil.
- **Taban:** bandın altında en fazla 2 nokta. Beyan yüksekse ya da aşağıda bir boşluk varsa burada düşer.
- **Üst:** bir üst bantta 2 nokta. Beyan düşükse burada da tutar.

Her noktaya 2 soru. Plan her soru için **yan kanıt** da önerir: beyan bandının altındaki, nokta olmayan konulardan en fazla 3 tanesi; soru bunları da ürettirecek biçimde kurulur. Amaç, bandın altındaki her konunun ilk gün en az bir kez üretilmesi (`plan.tarama` listesi): ikinci gün kanıtı ancak ilk gün kanıtı olan konuyu geçirir. Claude doğal bir cümle için yan kanıtları sorular arasında değiştirebilir; Tur 1'de hiç üretilmeyen konu Tur 2 taramasına kalır.

Beyana göre değişen diğer şeyler:
| Beyan | Serbest yazma | Talimat dili | Kelime taraması |
|---|---|---|---|
| A1.1 | 3–4 cümle (20–30 kelime) | Türkçe | seviye 1 |
| A1.2 | 40–60 kelime | Türkçe | seviye 1–2 |
| A2.1 | 60–80 kelime | Türkçe, Leitpunkt'lar Almanca | seviye 1–3 |
| A2.2 | 80–100 kelime | Almanca | seviye 2–4 |
| B1.1 | 100–150 kelime, telc e-postası (4 Leitpunkt) | Almanca | seviye 3–5 |
| B1.2 | 100–150 kelime, telc e-postası (4 Leitpunkt) | Almanca | seviye 4–6 |

- Sorularda sadece sorunun `konu`'su ve beyan bandının **altındaki** yapılar geçer; daha üst bir yapı kaçınılmazsa `kanit` listesine yazılır.
- **Serbest yazma** (`yazma`, uzunluk beyana göre, Tempelhof'a kabul dilekçesi): Leitpunkt'lar beyan bandındaki ve bir üst banttaki yapıları davet eder. A1: kimsin, ne iş yapıyorsun, ne seversin. A2: bu yıl ne yaşadın (Perfekt), neden Tempelhof (*weil*), burada ne yapabilirsin (Modalverben). B1: geçmişini anlat (Präteritum), neden kabul edilmelisin (*obwohl, damit*), ne yapmak isterdin (Konjunktiv II), eski şehrin nasıldı (Relativsatz, Komparativ). A2.2 ve üstünde telc kriterleriyle puanlanır ve `P-09` ustalığının ilk değeri olur.
- **Kelime taraması:** beyana göre seçilen seviyelerden 8'er kelime, Türkçe → Almanca (isimler artikelle). Bir seviye ≥ 7/8 ise geçti (artikel hatası yarım puan). Taranmayan üst seviyeler geçilmemiş sayılır; taranan en alt seviyenin **altındakiler geçilmiş** sayılır ve kart ekranı onları 🧪 kontrol kartı olarak yoklar (bilinmeyen çıkan kart normal öğrenmeye döner). Çekirdek destede 6 seviye (600 kelime) var; üstü gerekirse `/antrenman` ekler.

### Kanıt sayımı
- Her sorunun `konu` alanı (ölçtüğü konu) ve `kanit` listesi (doğru cevapta kullanıcının **kendisinin üretmesi gereken** diğer yapıların konuları, en fazla 3) olur. Soruda hazır verilen yapı kanıt sayılmaz.
- Claude puanlarken konu konu karar verir ve `sonuc[id].kanit` nesnesine yazar: `1` yapı doğru · `0` dilbilgisi hatası · `null` yapı cevapta görünmüyor (kullanıcı başka yoldan söyledi). Tam puanlı soruda yazmak gerekmez (hepsi 1 sayılır); puanı 1'den küçük ve `kanit` listesi olan soruda **zorunludur**, yoksa betik durur. Boş ya da `?` cevap sorunun `konu`'sunda hatadır, yan kanıtlarda bir şey göstermez.
- Sayım: `1` → doğru +1, soru +1 · `0` → konu **bozulur** (`yoklama: hata d/s`, başlangıç kademesi: doğruların oranı ≥ 2/3 ise K2, değilse K1) · `null` → sadece soru +1. Eşik **doğru kanıt** sayısına bakar.
- Genel etiketler (`yazim`, `kelime-eksik`, `ingilizce-kelime`, `kalip-ifade`, `artikel-kelime`) hata sayılmaz (Kurallar → Yoklama).
- Serbest yazmada doğru kurulan her farklı yapı konusuna 1 kanıt (`sonuc[id].kanit`, metin başına konu başına en fazla 1), yanlış kurulan yapı hatadır. Metinde hiç kullanılmayan yapı bir şey göstermez.
- Sayaçlar her `puan` çalıştırmasında bütün tur dosyalarından baştan hesaplanır; komutu iki kez çalıştırmak sonucu değiştirmez.

### Tavan ve boşluklar
- **Tutuldu:** konuda en az 2 doğru kanıt var ve hiç dilbilgisi hatası yok.
- **Tavan** = hatta tutulan en yüksek sıradaki konu. **Ölçülen seviye** = tavanın bir üstündeki konunun bandı.
- **Boşluk** = tavanın altında hatası olan konu. Boşluk tavanı düşürmez: o konu K1/K2'den öğretilir, etrafındaki konular kendi kanıtlarıyla geçer. (Eski kuralda sınır ilk hataydı; A1'de tek boşluğu olan bir B1 öğrencisi A1 ölçülür, üstündeki bütün konuları haftalarca yoklamada beklerdi.)
- Tavanın üstünde hatası çıkan noktaların kanıtı ve başlangıç kademesi saklanır.

### Daraltma ve tarama (Tur 2)
`python3 -I _sistem/seviye/tespit.py tur2` hesaplar:
- **Daraltma:** tavan ile üstündeki ilk düşen nokta arasındaki konular (hat başına en fazla 4, eşit aralıklı), konu başına 2 soru. Aralık boşsa o hatta daraltma sorusu olmaz.
- **Yukarı çıkma:** hatta hiç düşen nokta yoksa (beyan düşük) en üst noktanın 3, 6, 9 ve 12 sıra yukarısındaki konular, 2'şer soru.
- **Tarama:** tavanın altında ilk gün hiç doğru kanıtı olmayan her konuya **bir** kanıt, birleşik cümlelerle (bir cümle 4 konuya kadar). Tavanın üstüne tarama yapılmaz: bilinmeyen bölgede birleşik cümle hatanın kime ait olduğunu gizler.

### Kanıt eşiği
| Konu | Gereken doğru kanıt |
|---|---|
| Tavana 6 sıra ya da daha yakın, ya da tavanın üstünde | **6** |
| Tavanın 6 sıradan fazla altında | **3** |

Hepsinde ayrıca: en az **2 farklı gün** ve **hiç dilbilgisi hatası yok**.
- Neden iki eşik: B1.2 düzeyindeki bir kullanıcının altında 60'tan fazla konu var; hepsine 6 kanıt yaklaşık 380 kanıt eder, iki günde toplanamaz ve kullanıcı A1 konularından yoklamayla başlardı. Tavanın çok altındaki bir konuyu üç ayrı zor cümlede, iki ayrı günde hatasız üreten ve çok daha ileri yapıları da hatasız kuran biri o konuyu yarım bilmiyordur. Eşik düşse de kanıtın türü değişmez: ipucusuz üretim.
- Alt beceri kapsamı (Kurallar → Yoklama) tespitte aranmaz; ilk tekrar soruları farklı alt becerilerden gelir.
- Eşiğe yetişmeyen konu `kilitli` kalır, sayaçları korunur; sırası gelince günlük yoklama kaldığı yerden sürer.

### Doğrulama (Tur 3, en erken ertesi gün)
`python3 -I _sistem/seviye/tespit.py tur3` hesaplar:
- Tavanın altındaki (tavan dahil) hatasız her konu için eksik kanıt = eşik − doğru kanıt, en az 1 (ikinci gün kanıtı). Betik bunları **birleşik soru yuvalarına** dağıtır: her yuva 1 konu + en fazla 3 yan kanıt, iki hattan karışık (*Gestern habe ich meinem Bruder erzählt, dass ich keine Zeit hatte.* → Perfekt, Dativ, dass, Präteritum sein/haben). Claude yuvaları cümleye çevirir; son 6–8 kanıt kısa bir bağlam metninin boşlukları olabilir.
- En fazla **40 soru**. Sığmayan kanıtlar tavana en yakın konularındır ve günlük yoklamada tamamlanır; odak yine tavanın yakınında kalır.
- Tavanın üstü: ilk düşen konuya kadar olan boşluk varsa daraltılır (en fazla 4 konu, 2'şer soru); hiç düşen yoksa 2 ve 4 sıra yukarıya bakılır.
- Tur 3'te hata çıkan konu geçmez, boşluk olur.
- **Erken bitiş:** iki hatta doğrulanacak toplam konu 2 ya da daha azsa ve yukarı bakılacak yer yoksa Tur 3 yapılmaz, Sonuç hemen yazılır.

### Sonuç
`python3 -I _sistem/seviye/tespit.py sonuc --yaz` (Tur 3 puanlanınca; erken bitişte Tur 2'den sonra):
- **Gramer:** eşiği geçen konular `temiz` (`kademe: 5`, `yoklama: gecti`, `adim: 1`, `bitis`, `ustalik` = kanıt yüzdesi). Her hattın odak konusu = sıradaki ilk `temiz` olmayan konu → `ogreniliyor`: yoklaması bozuksa (boşluk ya da tavanın üstü) yazılan kademeden, değilse `kademe: 0` (yoklamada devam). Diğer konular `kilitli` kalır; sayaçları ve başlangıç kademeleri korunur.
- **İlk tekrar kademeli:** geçen konuların `sonraki_tekrar` tarihi 3. günden başlar ve **günde en fazla 3 konuya** yayılır, en az kanıtla geçen önce. (Hepsi aynı güne yazılsaydı B1 öğrencisinin 3. gününde 60 konu vadesi gelirdi.)
- **Kelime:** `Profil.md` → `kelime_baslangic` = geçilmeyen ilk seviye. Kart ekranı alt seviyelerin kartlarını **🧪 kontrol kartı** olarak (Türkçe → Almanca) arada bir gösterir: sağa atılan kart doğrudan öğrenilmiş sayılır, sola atılan normal kırmızı kart olur. Bütün seviyeler geçtiyse Claude sıradaki 100 kelimeyi ekler. Alt seviyenin kelime temaları (`02 Wortschatz`) `temiz`, `adim: 1` olur (ilk tekrarları günde bir tema); tekrarda düşerse eski usulle zayıflar.
- **Cümle destesi:** `cumle_baslangic` = iki hattın **ölçülen** seviyesinin düşüğü (A1 → 1, A2 → 2, B1 → 3).
- **Beceri:** sınav formatına geçiş eşiği aynı (A2'nin %50'si temiz).
- **Beyan ve ölçülen:** yan yana gösterilir, boşluklar ayrıca: *Beyanın A2.2 · fiil hattı A2.2 · isim hattı A2.1 · boşluklar: Imperativ, Possessivartikel*. Fark bir banttan büyükse bir cümleyle nedenini söyle (ör. "Dativ'i tanıyorsun ama üretirken artikel karışıyor").
- `Profil.md` → `seviye_tespiti: tamamlandi`, `baslangic` = son tur günü. İlk `/antrenman` Tempelhof'u Tag 1'den başlatır.
- Tespit seansları dashboard'daki ortalamaya girmez (`seans: seviye-tespiti-…`).

**Güvenlik ağı:** tespitle geçen her konu en geç birkaç hafta içinde tekrar sorusuyla gelir. Orada ya da günlük antrenmanda bozulursa onarıma girer (Kurallar → Bitmiş konuların tekrarı). Böylece şansla geçen bir konu yakalanır.

## Hata kayıtları
- Her yanlış cevaba bir **hata etiketi** verilir. Örnekler: `akkusativ-artikel`, `weil-fiil-sonda`, `trennbar-onek`.
- Her etiketin `06 Fehlerlog/` içinde bir notu olur. Notta `konu`, `sayac`, `son_gorulme` alanları ve `## Son görülmeler` satırları bulunur (`- <tarih>: soru <id> (<kısa not>)`; yazma görevlerinden gelenlerde `(yazma)` ibaresi olur, hata etiketi kuralı bunları tek başına saymaz).
- Yanlış cümlelerin doğru hali **cümle destesine** gider (kart ekranında görünür). Fehlerlog notlarına `::` kartı eklenmez: onları gösteren bir ekran yok. Eski kartlar notlarda kayıt olarak kalır.

## Drill'ler (temel konular)
- Günlük antrenmandan ayrı, tek bir konuda 100 soruluk setler: `09 Drill/`. Sorular `_sistem/drill/<set>.json` (mini drill'ler `_kisisel/drill/`), ilerleme `_kisisel/drill/<set>.durum.json` (ekran yazar).
- Sıra: **Akkusativ → Dativ → Akkusativ + Dativ karışık**. Düzensiz Partizip hataları günlük antrenmanda inatçı olduğu için araya bir **Partizip** drill'i girer; Partizip drill'i fiil hattında Perfekt odak olana kadar **bekler**; Akkusativ drill'i isim hattında Akkusativ'e yaklaşırken önerilir.
- Satır vurgulu tablolar: soruların `cins` kodları `tablo.vurgu_satir` ile tablodaki satıra bağlanır (Partizip'te fiil grubu). Artikel setlerinde `cins` sütunu vurgular (m, f, n, pl).
- Her sorunun bir `kategori`si var (ör. `zamir`, `ein`, `nomakk`). Havuz 100'den büyük olabilir (Akkusativ: 200). **Yeni tur** 100 soru seçer: önceki turun yanlışları mutlaka gelir, hata oranı yüksek kategorilerden daha çok soru, önce görülmemiş sorular. Bir kategori zayıf kalırsa Claude o kategoriye yeni sorular ekleyebilir.
- Süre: bir soru en fazla 30 sn sayılır, hedef için **medyan** kullanılır.
- Bir set, tam bir turda **%90 doğru ve medyan ≤ 6 sn** olunca tamamlanmış sayılır. Ekran bunu gösterir; kullanıcı isteyince Claude sıradaki seti aynı yapıda üretir (üstte kural tablosu, kolaydan zora 5 bölüm, her soruda kısa Türkçe açıklama ve cümlenin Türkçesi `tr` alanında). Her boşluk için dilbilgisi olarak doğru diğer biçimler `alternatifler` alanına yazılır (ör. ipucu *kein* iken *einen*): ekran bunları sarı "kabul" olarak doğru sayar..
- `/antrenman` drill ilerlemesine bakar: drill'i tamamlanan konunun günlük tekrar sorularını azaltabilir.

### Mini drill (inatçı hata türü)
- Bir yapı etiketi son 7 günde 3. kez görüldüğünde `/kontrol` o hataya özel **30 soruluk** bir set açar: `_kisisel/drill/mini-<etiket>.json` ve `09 Drill/Mini <etiket>.md` (`tur: drill`, `set: mini-<etiket>`, `etiket: <etiket>`, `durum: acik`). Aynı anda en fazla **bir** açık mini drill olur; yenisi gerekirse sıraya yazılır (`sira` notu). **Kuyruk son 7 gündeki hata sayısına göre sıralanır** (çok hata veren önce; eşitlikte odak konusunun etiketi önce). Açık drill en az bir tam tur yapıldıysa ve kuyrukta ondan daha çok hata veren bir etiket varsa, açık drill `durum: ertelendi` olur ve o etiketin drill'i açılır; ertelenen drill ilerlemesini korur ve kuyruğa döner. (Neden: kuyruk açılış sırasıyla ilerlerse en çok hata veren etiket arkada bekleyebilir.)
- Yapı: üstte kontrast tablosu (karıştırılan iki biçim yan yana), 3 bölüm × 10 soru: **ayırt et** (`secmeli`: hangisi?) → **üret** (tek boşluk) → **cümle** (çok boşluk ya da kısa çeviri cevabı `alternatifler` ile). Sorular sadece bitmiş ve odak konularının yapılarını kullanır.
- Biter: tam bir turda **%90** (süre şartı yok). Bitince not `durum: tamamlandi`; etiketin bağlı konusu sonraki 7 gün tekrar bölümünde o alt beceriden 2 soru alır.
- Mini drill 2 gün içinde hiç açılmadıysa antrenman notunun başında hatırlatılır; 7 gün açılmadıysa `/analiz` bunu söyler.

## Hız ve sınav takvimi
Sınav `Profil.md` → `sinav_tarihi`. B1 müfredatı **prova gününde** (sınavdan 4 hafta önce) bitmeli; son 4 hafta Modelltest ve gerçek dünya görevleri.
- **Gereken hız** = (hedef bitişe kalan gün × son 28 günün katılım oranı) ÷ en uzun hattaki kalan konu sayısı → "konu başına seans bütçesi".
- **Gözlenen hız** = son 28 günde tamamlanan seans ÷ son 28 günde biten konu (yoklamayla ve öğretimle biten, sonradan onarıma girenler dahil).
- Dashboard ikisini yan yana gösterir; `/analiz` her hafta yazar. Gözlenen hız bütçeyi **iki hafta üst üste** aşarsa `/analiz` somut bir ayar önerir (sırasıyla: kısa günlerle katılımı artırmak, `gunluk_dakika`, kademe başına soru sayısı); kademe atlatmak ya da yarım bilinen konuyu geçirmek seçenek değildir.

## Puanlama betiği
Kademe, yoklama, tekrar, onarım, ön konu, kelime teması ve Teile geçişlerini **`python3 -I _sistem/ilerleme.py <gün>`** hesaplar (her `/kontrol`'de Claude'un elle yazdığı betik yerine). Claude önce `sonuc` nesnesini (puan, etiket, gerekirse `yapi`) soru dosyasına yazar, sonra betiği çalıştırır:
- `--kuru` (varsayılan): ne değişeceğini tablo olarak yazar, dosyaya dokunmaz. `--yaz`: kişisel ilerlemeyi (`_kisisel/ilerleme.json`) günceller ve `_kisisel/ilerleme.log` dosyasına bir satır ekler.
- `sonuc[id].yapi`: yapı doğruysa 1, değilse 0. Yazılmazsa betik puandan ve etiketten çıkarır (genel etiketli kısmi cevap → yapı doğru).
- Betik kurallarla çelişen bir şey görürse (ör. bilinmeyen konu id'si) durur ve söyler; Claude elle karar verir ve nedenini sonuç notuna yazar.
- `python3 -I _sistem/ilerleme.py alt`: alt beceri durumu, son yapı hataları ve dar onarımdaki konuların dar alt becerileri (Alt beceri kanıtı, Dar onarım). `python3 -I _sistem/ilerleme.py sinir`: üretim ve anlama sınırı.
- `python3 -I _sistem/cesitlilik.py <gün>`: soru dosyasının çeşitlilik denetimi (Çeşitlilik). Hiçbir dosyayı değiştirmez.
