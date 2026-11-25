---
ad: 
sinav: telc Deutsch B1
sinav_tarihi:
gunluk_dakika: 45
kart_adet: 10
baslangic:
seviye_tespiti: bekliyor
beyan:
kelime_baslangic: 1
cumle_baslangic: 1
---
# Profil

Bu değerleri istediğin zaman değiştirebilirsin, dashboard ve antrenmanlar bunlara göre ayarlanır.

- **sinav_tarihi:** Sınav tarihin belli olunca `2027-02-15` biçiminde yaz. Dashboard geri sayımı başlatır.
- **gunluk_dakika:** Günlük antrenman süresi (dakika).
- **kart_adet:** Her gün kelime ve cümle destelerinden kaçar kart geleceği.
- **ad:** Dashboard'daki selam ve örnek cümleler için.
- **seviye_tespiti:** `bekliyor`, `devam` veya `tamamlandi`. Claude kendisi günceller (`/seviye`).
- **beyan:** Seviye tespitinin başında kullanıcının kendi seviye beyanı (A0 … B1.2; A0 = sıfırdan, tespitsiz başlar). Sonuçta ölçülen seviyeyle karşılaştırılır.
- **kelime_baslangic / cumle_baslangic:** Kart destelerinin başladığı seviye. Seviye tespiti yazar; alttaki seviyeler 🧪 kontrol kartı olarak gelir.
