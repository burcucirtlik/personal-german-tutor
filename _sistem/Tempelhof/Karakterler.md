# Freie Republik Tempelhof: dünya ve karakterler

Bu dosya günlüklerin tutarlı kalması için Claude'un başvuru kaynağı. Okumak serbest, ama sürprizleri kaçırmamak için günlükleri okuduktan sonra bakmanı öneririm.

## Dünya
- **Ne oldu:** Bir yıl önce "die Langsamen" (yavaşlar) ortaya çıktı. Zombiler yavaş ama kalabalık, sesten ve ışıktan etkileniyorlar. Elektrik şebekesi, internet ve devlet çöktü.
- **Tempelhof:** Berlin'in eski havalimanı. Dev terminal binası ve hangarlar duvar gibi koruyor, önündeki **Tempelhofer Feld** tarla ve bahçe olarak kullanılıyor.
- **Freie Republik Tempelhof:** Yaklaşık 200 kişi. Her pazartesi Hangar 4'te **Versammlung** (meclis) toplanıyor, kararlar oyla alınıyor. Kuralları: kimseyi geride bırakma, yiyecek paylaşılır, herkes Almanca öğrenir ve öğretir.
- **Ton:** Karanlık, gerilimli, gizemli. Topluluk sıcak ve birbirine bağlı, ama dışarısı tehlikeli ve içeride de herkes doğruyu söylemiyor. Korku sesle, karanlıkla ve belirsizlikle kurulur: bir ses, sönen bir ışık, boş bir yatak, yarıda kesilen bir telsiz mesajı. Kan, vahşet ve ayrıntılı şiddet yok. Ana karakterler Sezon 1'de ölmez ama kaybolabilir, yaralanabilir, yalan söyleyebilir. Mizah tamamen gitmez: Mehmet ve Bernd gerginliği kısa bir espriyle kırabilir.
- **Para birimi:** Takas. En değerli şeyler tuz, pil, kahve ve çorap.
- **Sezon yayı:** Hikâyenin nereye gittiği `_sistem/Tempelhof/Sezon 1.md` dosyasında (spoiler). Her günlük oradaki sıradaki vuruşu yazar.

## Günlüğün yapısı
Her kayıt dört parçadan oluşur:
1. **İçeriden başla.** Sakin bir tanıtımla değil, bir anın ortasında aç: *Es ist drei Uhr. Das Funkgerät ist laut.* Yazar kendini tanıtacaksa bunu ikinci ya da üçüncü cümleye koy.
2. **Bir aksiyon anı.** Biri koşuyor, saklanıyor, bir şey arıyor, bir karar veriyor. Her günlükte en az bir somut tehlike ya da gerilim olur.
3. **Bir ipucu.** Sezon yayındaki sıradaki vuruşun parçası. Okur bazen bir şeyi karakterden önce fark eder; bu iyi.
4. **Son cümle bir hook.** Günlük her zaman açık bir soru, bir tehdit ya da bir keşifle biter. Kısa ve çarpıcı, tek cümle ya da iki kısa cümle. Hook'un cevabı sıradaki günlükte, sıradaki yazarın gözünden gelir.

**Hook türleri** (aynı türü üst üste iki gün kullanma): beklenmedik bir ses · kaybolan bir kişi ya da eşya · bulunan bir nesne (not, anahtar, fotoğraf) · yarıda kesilen bir mesaj · birinin yalanı ortaya çıkar · geri sayım (*Bis morgen um sechs.*) · bir karakterin ağzından kaçan cümle · ters köşe (*Marta ist nicht allein.*).

**Kısa cümle gerilimin dostudur.** A1'in kısa ana cümleleri gerilim için idealdir: *Dann ist es still. Ganz still.* Paragrafın sonunda tek kelimelik ya da üç kelimelik cümleler kullan. Seviye yükseldikçe uzun cümleler ritim için kullanılır, gerilim anında yine kısa cümleye dönülür.

## Karakterler
Günlükler bu sırayla döner. Sıradaki yazar: `_kisisel/Hikâye.md` dosyasındaki son kayda bakılarak seçilir.

| # | Kişi | Görev | Kişiliği ve yazış tarzı |
|---|---|---|---|
| 1 | **Mehmet Yılmaz**, 52 | Aşçı. Eskiden Neukölln'de dönerciydi. | Sıcak, esprili, hep yemekten bahseder. Kısa cümleler kurar, sonunda bir soru sorar. |
| 2 | **Lena Vogel**, 16 | "Radio Tempelhof"u yönetiyor | Punk, enerjik, ünlem işaretlerini sever. Müzik ve radyo sinyalleri ona sorulur. |
| 3 | **Kofi Mensah**, 29 | Koşucu ve keşifçi, mahalleler arası mesaj taşıyor | Eski maraton koşucusu. Sakin, gözlemci, rakamları ve yolları anlatır. |
| 4 | **Dr. Ingrid Hoffmann**, 67 | Kamp doktoru, aslında emekli veteriner | Sert ama şefkatli, düzenli, listeler yazar. Herkese "Sie" der. |
| 5 | **Pavel Novák**, 41 | Kuledeki gözcü, eskiden hava trafik kontrolörüydü | Çek. Yalnız, düşünceli, gökyüzünü ve ışıkları anlatır. Hafif hüzünlü. |
| 6 | **Amira Haddad**, 38 | Mühendis; güneş panelleri ve elektrik onda | Suriyeli. Pratik, kararlı, çözüm odaklı. Teknik kelimeleri basit anlatır. |
| 7 | **Bernd Schulze**, 58 | Zırhlı sarı BVG otobüsü "Der Gelbe"nin şoförü | Eski otobüs şoförü, Berlinli ağzıyla konuşur, şikâyetçi ama cesur. |
| 8 | **Yuki Tanaka**, 35 | Mimar. Hangarlarda sera ve duvar inşa ediyor. | Japon. Sakin, ayrıntıcı, bitkileri ve yapıları sever. |

**Ortak karakterler:** *Kartoffel* (kampın köpeği, her yerde dolaşır) ve *Oma Gerda* (84 yaşında, en yaşlı üye, örgü örer ve herkese akıl verir).

## Sesler
Her karakterin günlüğü kendi sesiyle okunur. `_sistem/ses.py` yüklü sesler arasından en kalitelisini (Premium > Gelişmiş > normal) ve bu sırayı tercih eder:

| Karakter | Ses tercihi |
|---|---|
| Mehmet | Markus, Yannick |
| Lena | Petra, Anna |
| Kofi | Yannick, Markus |
| Dr. Ingrid | Anna, Helena |
| Pavel | Markus, Martin |
| Amira | Petra, Helena |
| Bernd | Markus, Yannick |
| Yuki | Anna, Petra |

Hız: A1 `150`, A2 `165`, B1 `180`.

## Dil seviyesi kuralları
Günlük müfredata göre yazılır (`_sistem/Müfredat.md`, `_sistem/Kurallar.md` → Müfredat):
- **Gövde üretim sınırında:** bitmiş (`temiz`) konular ve iki hattın **odak** konuları. Cümlelerin en az dörtte üçü sadece bu yapılarla kurulur.
- **Anlama sınırı** (Kurallar → Üretim ve anlama sınırı; liste: `python3 -I _sistem/ilerleme.py sinir`): her dört cümleden **en fazla birinde** sıradaki ya da daha önce çalışılmış bir yapı geçebilir (bir Akkusativ nesnesi, bir modal fiil, bir ayrılabilen fiil, tek bir Perfekt cümlesi). Her biri tıklanabilir sözlükte biçimiyle açıklanır ve katlanmış sözlükte "ileride öğreneceğiz" notuyla yer alır; richtig/falsch soruları bu cümlenin anlamını sorabilir, yapısını sormaz.
- **Temel her zaman serbest:** şimdiki zamanda kısa ana cümleler, fiil 2. sırada, der/die/das, basit sorular. Hikâye **şimdiki zamanla** anlatılır; dünü anlatmak gerekirse *gestern* + şimdiki zaman, ya da en fazla 1–2 kalıp (*war, hatte*) sözlükte "kalıp" diye açıklanarak.
- İki sınırın da **dışındaki** yapılar (ör. yan cümleler *weil, dass, wenn*, Wo?/Wohin? edatları, Konjunktiv) sırası yaklaşana kadar metinde **yoktur**.
- **Kelime çeşitliliği:** son günlüklerde yıpranan kelimeleri ve sahneleri tekrar etme (aynı kişi aynı işi iki gün üst üste yapmaz); açık kart seviyelerinden az kullanılmış kelimeleri seç (Kurallar → Çeşitlilik).
- **Kalıp istisnası:** sık yer ve zaman ifadeleri (*in Berlin, im Turm, am Tor, am Sonntag, um 8 Uhr*) okuma metinlerinde kelime gibi kullanılabilir ve sözlükte "kalıp" diye açıklanır. Alıştırmalarda sorulmaz.
- Uzunluk: A1 yaklaşık 120–170 kelime. A2 hattına geçilince 170–220, B1'de 220–280.
- Odak konularından **2–3 doğal örnek** metne yerleştirilir ve sözlüğün altında "Metinde dikkat et" kutusunda gösterilir. Kutuda sadece odak ve bitmiş konular yer alır.
- Kelime temasındaki yeni kelimelerden de birkaçı metinde kullanılır.
