# Deneme sınavı (telc Übungstest)

telc, *Zertifikat Deutsch / telc Deutsch B1* için ücretsiz bir resmi deneme sınavı yayınlıyor: sınav kitapçığı (PDF, cevap anahtarı ve puanlama kriterleriyle) ve dinleme sesi (mp3). Telif telc'e ait olduğu için bu klasörde yok; kendin indirirsin.

## Nasıl kurulur
1. [telc.net → Zertifikat Deutsch / telc Deutsch B1](https://www.telc.net/sprachpruefungen/deutsch/zertifikat-deutsch-telc-deutsch-b1/) sayfasındaki **Übungstest** bölümünden PDF'i ve ses dosyasını indir.
2. `07 Modelltests/` klasörüne koy (istersen `07 Modelltests/telc Übungstest 1 Dateien/` gibi bir alt klasöre).
3. Claude Code'a **"deneme sınavı notunu hazırla"** yaz. Claude `_sistem/Şablonlar/Modelltest.md` şablonundan bir not açar, PDF'e ve sese bağlantı verir.

## Ne zaman çözmeli?
İki kez: **bir kez başta**, seviyeni görmek için (zor gelecek, sorun değil), **bir kez de** A2 konularının çoğu temiz olunca. Sınavdan önceki son dört haftada daha fazla deneme sınavı çözülür (Kurallar → Hız ve sınav takvimi).

- Süre tut, sözlük kullanma: Lesen ve Sprachbausteine 90 dk, Hören yaklaşık 30 dk, Schreiben 30 dk.
- Lesen, Sprachbausteine ve Hören'i kitapçıktaki cevap anahtarıyla kendin puanla; Schreiben'i Claude'a puanlat (telc kriterleri: [[Puanlama ipuçları]]).
- Puanları notun frontmatter'ına yaz. Dashboard yazılı (135/225) ve sözlü (45/75) barajlarını kendisi hesaplar.
