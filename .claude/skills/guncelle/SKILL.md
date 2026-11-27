---
name: guncelle
description: Personal German Tutor'ı yeni sürüme günceller (kurallar, ekranlar, ders notları); kullanıcının ilerlemesine ve notlarına dokunmaz. "güncelle", "yeni sürüm", "güncelleme var mı" denince kullan.
---

# Güncelleme

Motor (kurallar, müfredat, betikler, ekranlar, ders notları, desteler) yenilenir; kişisel katman (`_kisisel/`, `05 Günlük/`, `06 Fehlerlog/`, `07 Modelltests/`, `08 Tempelhof/`, `10 Analiz/`, `09 Drill/Mini *.md`) olduğu gibi kalır.

1. **Yöntemi seç:**
   - Klasör bir git deposuysa ve `git remote -v` herkese açık depoyu gösteriyorsa: `git status --porcelain` ile yerel motor değişikliklerine bak (genelde Claude'un doldurduğu ders notları ve `alt` listeleri). Yoksa `git pull --ff-only`. Varsa git yerine 2. yolu kullan (betik yerel ders notlarını korur), sonra `git status`'u kullanıcıya göster; commit isteyip istemediğini sor.
   - Değilse (zip ile indirilmişse) 2. yol.
2. `python3 -I _sistem/kurulum/guncelle.py` (kuru) → kullanıcıya sade bir özet: sürüm, kaç dosya değişiyor, öne çıkanlar (kurallar, ekranlar, yeni içerik). Onay alınca `--yaz`. İnternet yoksa ya da indirme başarısız olursa kullanıcıdan GitHub'dan zip'i indirmesini iste ve `--kaynak <zip yolu>` ile çalıştır.
3. Sonra: `python3 -I _sistem/kurulum/tasi.py` (kuru; yeni sürüm bir düzen değişikliği getirdiyse `--yaz`), `python3 -I _sistem/kurulum/baslat.py`, `python3 -I _sistem/seviye/test_tespit.py` (✓ olmalı). Bir şey bozulduysa yedeği (`_kisisel/yedek/guncelleme-…`) söyle.
4. Kullanıcıya: "Tarayıcı sekmesine dön ya da sayfayı yenile." Yeni sürümün önemli değişikliklerini sade bir dille anlat: kaynak `_sistem/surum.json` → `yenilikler` (betik kuru çalışmada `✦` ile yazar), yoksa git log. Kural değişikliği varsa kullanıcının kendi ilerlemesinde ne değişeceğini de söyle (ör. K4–K5'teki odak konusu bir sonraki kontrolde K3 kuralıyla bitebilir).
