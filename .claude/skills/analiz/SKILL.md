---
name: analiz
description: Son 7 günün haftalık gelişim analizini 10 Analiz/ içine yazar (rakamlar, oturan konular, hata türleri, alışkanlıklar, gelecek haftanın ölçülebilir planı). "analiz", "haftalık analiz", "bu hafta nasıldı", "gelişimim" denince kullan.
---

# Haftalık analiz

Dashboard'daki **📊 Bu hafta** kartı rakamları her gün canlı gösterir (`_sistem/dashboard/view.js`). Bu komut haftanın **yorumunu ve planını** yazar.

## 1. Haftayı belirle
- **Kapı:** `_kisisel/Profil.md` → `seviye_tespiti` `tamamlandi` değilse analiz yazma; seviye tespitinin önce bitmesi gerektiğini söyle ve `/seviye`'ye yönlendir.
- Bitiş: bugün (`date +%F`). Başlangıç: bir önceki analizin `bitis` gününün ertesi günü (hiçbir gün iki kez sayılmasın); ilk analizde 6 gün önce. Hafta numarası: `10 Analiz/` içindeki son notun `hafta` değeri + 1 (ilk not: 1).
- Bir önceki analiz notunu oku: geçen haftanın planındaki hedefler tuttu mu?

## 2. Verileri bir Python betiğiyle topla (elle hesaplama)
- `05 Günlük/*.md`: tamamlanan günler ve `puan`. Seviye tespiti seanslarını ortalamadan ayrı tut.
- `05 Günlük/veri/<gün>.json` içindeki `sonuc`: bölüm bazında puan. Bölümün `konu`'su yoksa başlığından beceri (Hören, Lesen, Schreiben); `W-` ile başlayan konu Kelime, gerisi Gramer.
- Konu bazında seans puanlarının sırası (ör. 1/6 → 5/6). Konu durumu (`_kisisel/ilerleme.json` + frontmatter varsayılanı; `ilerleme.py alt`): durum sayıları, A1/A2 gramer ortalaması (geçen haftanın notundaki değerle karşılaştır).
- **Müfredat ilerlemesi**: her hattın hafta başı ve sonu odak konusu ve kademesi, bu hafta biten konular (kademeyle mi, yoklamayla mı, dar onarımdan mı), bozulan yoklamalar, onarıma ve dar onarıma girenler (dar onarımda hangi kalıplar kaldı; 2 haftadan uzun sürüyorsa söyle). Bölümlerin `rol` alanı (odak, yoklama, tekrar) puanı ayırmaya yarar.
- `06 Fehlerlog/*.md` → "Son görülmeler" satırları: bu haftaki hata türleri ve günlere dağılımı. Azalan ve artan türleri ayır.
- `_kisisel/drill/<set>.durum.json`: turlar, doğruluk, medyan süre.
- `_kisisel/kartlar/durum.json`: bu hafta öğrenilen kartlar (`tamam` tarihi), günlük planlarda sağ/sol oranı, açılmayan günler.
- `08 Tempelhof/`: yazılan günlükler; kullanıcı kağıda geçirdiği metni gönderdi mi.
- **Tıklama sinyali:** önce `python3 -I _sistem/sozluk/sinyal.py <bitiş>` çalıştır, sonra `_kisisel/sozluk/sinyal.json` ve `tiklananlar.json` dosyalarını oku.
  - Bu hafta kaç kelimeye bakıldı (özel isimler ve artikeller hariç), en çok bakılanlar, hangi gün en çok tıklandı (`gunler`). "⭐ Karta ekle" (`istek`) ve "✓ Biliyorum" (`biliyor`) işaretleri kaç tane.
- **Hören ve dikte:** `_kisisel/ses/dinleme.json` (ses başına gün gün dinleme sayısı) ve `_kisisel/ses/dikte.json` (dikte oturumları, `oran`, cümle cümle `hatalar`). Haftalık dikte ortalaması, en sık duyma/yazım hatası türleri (ü/u, büyük harf, ayrılabilir önek…), sesleri kaç kez dinlediği. Anında kontrol: cevap dosyalarındaki `_anlik` alanından anında doğru oranı.
  - Bu hafta `bakmiyor` durumuna geçenler (tıklamadan okunuyor), kartı öğrenilenler (`ogrenildi`), sık bakılıp kartı kırmızı olanlar (`kartta_takili`: en zor kelimeler).
  - Tıklama ile kart arasındaki uyumsuzluk: tıklamayı bırakmış ama kartı kırmızı kelime. Kartlar asıl ölçüdür.

## 3. Görsel analizi yaz (az okuma, çok görsel)
Analiz **görsel** olur: uzun paragraf yok. Rakamlar bir veri dosyasına yazılır, notu `_sistem/analiz/view.js` grafiklerle çizer (günlük puan sütunları, kademe şeritleri, beceri ve hata çubukları, kart noktaları, kelime çipleri, plan ve hedef kartları, tablo görünümü). Örnek: `10 Analiz/veri/2026-11-10 Hafta 3.json`.

**a) Veri dosyası:** `10 Analiz/veri/<bitiş> Hafta <n>.json`
```json
{
  "hafta": 3, "baslangic": "2026-11-05", "bitis": "2026-11-10",
  "ortalama": {"bu": 82, "gecen": 78},
  "ozet": "En fazla 2 kısa cümle: en büyük ilerleme + asıl takılan yer.",
  "kutucuklar": [{"etiket": "Antrenman günü", "deger": "4 / 6", "alt": "6 Kasım boş"}],
  "sinav": {"tarih": "2027-09-01", "varsayim": "gün belli değil, ayın 1'i alındı", "baslangic": "2026-10-23", "prova": "2027-08-04",
            "kutucuklar": [["Sınava", "295 gün", "≈ 42 hafta"], ["Gereken hız", "~1 konu / hafta", "her hatta · bu hafta 0"]],
            "hatlar": [{"ad": "🔧 Fiil", "gereken": 0.9, "kalan": 34, "bu_hafta": 0,
                        "asamalar": [{"ad": "A1", "bitis": "2027-01-03", "konu": 7}, {"ad": "A2", "bitis": "…", "konu": 10}, {"ad": "B1", "bitis": "2027-08-04", "konu": 17}],
                        "konular": [{"id": "A1-01", "ad": "…", "seviye": "A1", "durum": "zayif", "kademe": 3, "dosya": "<dosya adı>"}]}],
            "not": "tek cümle: yetişiyor mu, darboğaz hangi hat"},
  "gunler": [{"tarih": "2026-11-05", "puan": 74}, {"tarih": "2026-11-06", "durum": "bos"}, {"tarih": "2026-11-10", "durum": "devam"}],
  "bulgu": {"baslik": "En önemli bulgu: …", "maddeler": ["en fazla 1–2 kısa satır"],
            "ornekler": [["yazdığı", "doğrusu", "3–5 kelimelik kural"]]},
  "hatlar": [{"ikon": "🔧", "ad": "Fiil hattı", "konu": "<konu notunun dosya adı>", "kisa": "Düzenli fiiller",
              "bas": 3, "son": 3, "seanslar": [73, 91, 82, 91], "not": "tek kısa cümle"}],
  "onarim": [{"konu": "<dosya adı>", "kisa": "sein / haben", "seanslar": [67, 67, 50, 83], "etiket": "pencere 6/10"}],
  "biten": [{"konu": "<dosya adı>", "kisa": "Sorular"}],
  "beceriler": [{"ad": "🎧 Hören", "bu": 92, "gecen": 67, "soru": 12}, {"ad": "✍️ Schreiben", "bu": 47, "gecen": 42, "etiket": "21/45", "soru": 1}],
  "hatalar": [{"ad": "Düzenli fiil sonu", "bu": 7, "gecen": 2, "ornek": ["beginnet", "beginnt"]}],
  "kartlar": {"ogrenilen": {"kelime": 5, "cumle": 6}, "gecen": 19, "deste": {"ogrenilen": 22, "toplam": 100, "seviye": 1},
              "gunler": [{"tarih": "2026-11-05", "kelime": 9, "cumle": 10}, {"tarih": "2026-11-06", "kelime": null, "cumle": null}]},
  "kelimeler": {"tiklama": {"kelime": 93, "sayi": 183}, "zor": ["leise"], "okuyorsun": ["wieder"], "ogrenildi": ["werden"]},
  "plan": [{"hedef": "geçen haftanın hedefi", "sonuc": "evet | yarim | hayir", "not": "kısa kanıt"}],
  "hedefler": [{"ikon": "🔧", "baslik": "Fiil K3 → K4", "olcu": "son 12 soruda 10 doğru (şu an 8/12)", "ipucu": "tek kısa cümle"}]
}
```
- `sinav` (Profil'de `sinav_tarihi` varsa; yoksa yazma ve hedeflere "sınav tarihini yaz" koy): bir betikle hesapla.
  - `prova` = sınav − 4 hafta (son 4 hafta Modelltest ve gerçek hayat görevleri, Kurallar → Tempelhof evreni). Öğrenme süresi = analiz bitişinden `prova`'ya kadar olan hafta sayısı.
  - Her hat için `kalan` = durumu `temiz` ya da `zayif` olmayan gramer konuları (onarımdakiler öğretilmeden döner). `gereken` = kalan ÷ öğrenme haftası (bir ondalık). `bu_hafta` = bu hafta temiz olan konu sayısı.
  - `asamalar`: hattın kalan konularını A1, A2, B1 sırasıyla `gereken` hızla dağıt; her seviyenin bittiği tarih ve konu sayısı. Son aşama `prova` gününde biter.
  - `konular`: hattın bütün gramer konuları `sira`'ya göre (harita her konuyu bir kare olarak çizer: temiz / onarımda / şu an / sırada).
  - `not`: yetişiyor mu (son haftaların ortalama bitirme hızı `gereken`'in altındaysa açıkça söyle), darboğaz hangi hat. Puanı şişirme, panik de yaratma.
  - **Seans bütçesi** (Kurallar → Hız ve sınav takvimi): `sinav.kutucuklar`'a iki kutu ekle: `["Konu başına bütçe", "5,5 seans", "katılım %70"]` ve `["Gözlenen", "9 seans / konu", "son 28 gün"]`. Gözlenen bütçeyi aşıyorsa `sinav.not`'ta söyle. Bu durum geçen haftanın notunda da varsa (iki hafta üst üste) `hedefler`'e somut bir ayar koy: önce kısa günlerle katılım, sonra `gunluk_dakika`, sonra kademe başına soru. Kademe atlatmak ya da yarım bilinen konuyu geçirmek önerilmez.
- **Yeni kuralların izi:** bu hafta ön konu başladı mı ve kaç kademe ilerledi; mini drill açıldı mı, tamamlandı mı (7 gün açılmadıysa söyle); Schreiben aşaması (`P-09` → `asama`) değişti mi; kısa gün sayısı; `_kisisel/ilerleme.log` satırları (betik uyarıları dahil). Bunları `bulgu`, `beceriler` ya da `hedefler` içinde kısa tut.
  - `sinav_tarihi` sadece ay olarak verildiyse ayın 1'ini kullan ve `varsayim` alanına yaz.
- `gunler`: başlangıçtan bitişe her gün bir öğe; tamamlanan gün `puan`, boş gün `"durum": "bos"`, bitmemiş gün `"durum": "devam"`.
- `hatlar[].bas/son`: hafta başı ve sonu kademe (1–3; K3 son kademe); konu bu hafta bittiyse `"bitti": true` (çip "bitti · genele yayılıyor" olur); `seanslar`: o haftaki odak kademe puanları sırayla. `onarim`: onarımdaki konuların tekrar seans puanları; `etiket` alanına konu notundaki `pencere` değerini yaz ("pencere 6/10": çıkış 10 soruda 8 doğru, Kurallar → onarım). Kademe hedeflerinde de pencereyi kullan: eski "üst üste iki gün" kuralı kullanılmıyor. Üst düzeyde `"onarim_esik": 80` yaz (Kurallar → onarım; yazılmazsa ekran eski eşik 85'i kullanır). Konu hafta içinde temize döndüyse `"sonuc": "temiz"`, temiz olup geri döndüyse `"sonuc": "onarimda"` ve kısa bir `"etiket"` (çipte görünür).
- `beceriler[].bu/gecen`: doğru yüzdesi (0–100). Schreiben için puan/45'in yüzdesi ve `etiket: "21/45"`.
- `hatalar`: Fehlerlog "Son görülmeler"den, bu haftaya göre çoktan aza; en fazla 6 satır, her birine gerçek bir `ornek` (kullanıcının yazdığı → doğrusu). Örnekleri cevap dosyalarından al, uydurma.
- `kartlar.gunler[].kelime/cumle`: o gün sağda biten kart sayısı (10 üzerinden), açılmadıysa `null`.
- `kelimeler`: `zor` = kartı kırmızı (tercihen çok da tıklanan), `okuyorsun` = bu hafta `bakmiyor`'a geçenler, `ogrenildi` = bu hafta kartı yeşile dönenler. Her listede en fazla 10 kelime; isimler artikeliyle.
- `plan`: geçen haftanın hedefleri ve tuttu mu. `hedefler`: gelecek haftanın 5–8 **ölçülebilir** hedefi (`olcu` kısa ve sayılı).
- Metin alanları kısa: `ozet` ≤ 2 cümle, `not` ve `ipucu` tek satır. Açıklamayı grafik ve örnek çiftleri taşır.

**b) Not:** `10 Analiz/<bitiş> Hafta <n>.md`
```markdown
---
tur: analiz
hafta: 3
baslangic: 2026-11-05
bitis: 2026-11-10
ortalama: 82
veri: 10 Analiz/veri/2026-11-10 Hafta 3.json
cssclasses: [ad-wide]
---
# 📊 Hafta 3 · 5 – 10 Kasım 2026

```dataviewjs
await dv.view("_sistem/analiz", { veri: "10 Analiz/veri/2026-11-10 Hafta 3.json" })
```
```
Notun gövdesine başka metin yazma. Kurallar: Türkçe, Almanca örnekler aynen. Cesaret kırma ama rakamı şişirme. Telif hakkı olan metin kullanma. Yazdıktan sonra JSON'u `python3 -I -c "import json; json.load(open('…'))"` ile doğrula.

## 4. Kullanıcıya bildir
Kısa bir mesaj: notun yolu, haftanın 3 ana bulgusu (birer cümle) ve gelecek haftanın en önemli 2 hedefi. Notu tarayıcıda açınca grafiklerin göründüğünü söyle. "Rakamları her gün dashboard'daki 📊 Bu hafta kartından izleyebilirsin."
