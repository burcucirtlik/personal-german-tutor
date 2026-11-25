"""Almanca.html'yi üretir: sablon.html içine app.css, vendor/marked.min.js ve app.js gömülür.

    python3 -I _sistem/web/derle.py

Neden tek dosya: macOS, Finder'dan açılan bir HTML'nin Masaüstü/Belgeler klasöründeki yan dosyaları
(<script src>, <link href>) okumasına izin vermiyor; sayfa boş açılıyordu. app.js, app.css ya da
sablon.html değişince bunu yeniden çalıştır. Notlar ve view.js görünümleri ise klasör izniyle okunur, gömülmez.
"""

import os
import re

BURASI = os.path.dirname(os.path.abspath(__file__))
KOK = os.path.realpath(os.path.join(BURASI, "..", ".."))
HEDEF = os.path.join(KOK, "Almanca.html")


def oku(ad):
    with open(os.path.join(BURASI, ad), encoding="utf-8") as f:
        return f.read()


def main():
    sablon = oku("sablon.html")

    def gom(m):
        ad = m.group(1)
        icerik = oku(ad)
        # Gömülü kod sayfanın etiketini erken kapatmasın
        if ad.endswith(".css"):
            return re.sub(r"</(style)", r"<\\/\1", icerik, flags=re.I)
        return re.sub(r"</(script)", r"<\\/\1", icerik, flags=re.I)

    sonuc, adet = re.subn(r"/\*@@([\w./-]+)@@\*/", gom, sablon)
    if adet != 3:
        raise SystemExit(f"sablon.html'de 3 yer tutucu bekleniyordu, {adet} bulundu")
    gecici = HEDEF + ".yeni"
    with open(gecici, "w", encoding="utf-8") as f:
        f.write(sonuc)
    os.replace(gecici, HEDEF)
    print(f"Almanca.html üretildi ({len(sonuc) // 1024} KB)")


if __name__ == "__main__":
    main()
