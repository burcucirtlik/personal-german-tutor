#!/usr/bin/env python3
"""Motoru yeni sürüme günceller; kişisel katmana (`_kisisel/` ve not klasörleri) dokunmaz.

  python3 -I _sistem/kurulum/guncelle.py                     # kuru: GitHub'daki son sürümle neler değişecek
  python3 -I _sistem/kurulum/guncelle.py --yaz               # uygula
  python3 -I _sistem/kurulum/guncelle.py --kaynak <klasör|zip> [--yaz]   # indirilmiş bir sürümden

Kaynak verilmezse `_sistem/surum.json` → `depo` deposunun `dal` dalı zip olarak indirilir.
Korunanlar: kişisel klasörler ve dosyalar (motor.KISISEL_*). Konu notlarında yerelde doldurulmuş `## Ders notu`
bölümü ve `alt` listesi, yeni sürümde boşsa korunur. Motordan kaldırılan dosyalar silinir.
Önce yerel motor dosyaları `_kisisel/yedek/guncelleme-<tarih>/` altına yedeklenir.
"""
import argparse
import datetime as dt
import io
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import motor as M  # noqa: E402

KOK = M.KOK


def kaynak_hazirla(kaynak, gecici):
    if kaynak and os.path.isdir(kaynak):
        return os.path.abspath(kaynak)
    if kaynak:
        veri = open(kaynak, "rb").read()
    else:
        s = json.load(open(os.path.join(KOK, "_sistem", "surum.json"), encoding="utf-8"))
        url = f"{s['depo'].rstrip('/')}/archive/refs/heads/{s.get('dal', 'main')}.zip"
        print("İndiriliyor:", url)
        with urllib.request.urlopen(url, timeout=60) as r:
            veri = r.read()
    with zipfile.ZipFile(io.BytesIO(veri)) as z:
        z.extractall(gecici)
    icerik = [os.path.join(gecici, d) for d in os.listdir(gecici)]
    kok = icerik[0] if len(icerik) == 1 and os.path.isdir(icerik[0]) else gecici
    if not os.path.exists(os.path.join(kok, "_sistem", "Kurallar.md")):
        sys.exit("Kaynak bir Personal German Tutor sürümü gibi görünmüyor (_sistem/Kurallar.md yok).")
    return kok


def dosyalar(kok):
    for k, ds, fs in os.walk(kok):
        r0 = os.path.relpath(k, kok)
        r0 = "" if r0 == "." else r0
        ds[:] = [d for d in ds if not M.kisisel_mi(os.path.join(r0, d)) and not M.atlanir_mi(os.path.join(r0, d))]
        for f in fs:
            r = os.path.join(r0, f).replace(os.sep, "/")
            if not M.kisisel_mi(r) and not M.atlanir_mi(r):
                yield r


def bolum(metin, baslik):
    m = re.search(rf"^## {re.escape(baslik)}\n(.*?)(?=^## |\Z)", metin, re.S | re.M)
    return m.group(1) if m else None


def konu_birlestir(yerel, yeni):
    """Yeni sürümün notu; yerelde dolu ama yenide boş olan Ders notu ve alt listesi korunur."""
    sonuc = yeni
    yd, nd = bolum(yerel, "Ders notu"), bolum(yeni, "Ders notu")
    if yd and len(yd.strip()) > 80 and nd is not None and len(nd.strip()) < 80:
        sonuc = sonuc.replace("## Ders notu\n" + nd, "## Ders notu\n" + yd, 1)
    ya = re.search(r"^alt:.*$", yerel.split("\n---\n", 1)[0], re.M)
    if ya and not re.search(r"^alt:", sonuc.split("\n---\n", 1)[0], re.M):
        sonuc = sonuc.replace("\n---\n", "\n" + ya.group(0) + "\n---\n", 1)
    return sonuc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kaynak")
    ap.add_argument("--yaz", action="store_true")
    a = ap.parse_args()
    if os.path.exists(os.path.join(KOK, "_sistem", "Profil.md")):
        sys.exit("Önce eski düzenden taşı: python3 -I _sistem/kurulum/tasi.py --yaz")
    with tempfile.TemporaryDirectory() as gecici:
        kaynak = kaynak_hazirla(a.kaynak, gecici)
        yeni = set(dosyalar(kaynak))
        eski = set(dosyalar(KOK))
        eklenen, degisen, korunan = sorted(yeni - eski), [], []
        for r in sorted(yeni & eski):
            y, n = open(os.path.join(KOK, r), "rb").read(), open(os.path.join(kaynak, r), "rb").read()
            if y != n:
                degisen.append(r)
        silinen = sorted(eski - yeni)
        try:
            sv = json.load(open(os.path.join(kaynak, "_sistem", "surum.json"), encoding="utf-8"))["surum"]
            ev = json.load(open(os.path.join(KOK, "_sistem", "surum.json"), encoding="utf-8"))["surum"]
        except (OSError, ValueError, KeyError):
            sv = ev = "?"
        print(f"Sürüm: {ev} → {sv}")
        print(f"{len(eklenen)} yeni, {len(degisen)} değişen, {len(silinen)} kaldırılan motor dosyası")
        for baslik, liste in (("yeni", eklenen), ("değişen", degisen), ("kaldırılan", silinen)):
            for r in liste[:40]:
                print(f"  {baslik}: {r}")
            if len(liste) > 40:
                print(f"  … ve {len(liste) - 40} {baslik} dosya daha")
        if not a.yaz:
            print("\n(kuru çalışma; uygulamak için --yaz). Kişisel klasörlere dokunulmaz.")
            return
        yedek = os.path.join(KOK, "_kisisel", "yedek", "guncelleme-" + dt.datetime.now().strftime("%Y-%m-%d-%H%M"))
        for r in degisen + silinen:
            h = os.path.join(yedek, r)
            os.makedirs(os.path.dirname(h), exist_ok=True)
            shutil.copy2(os.path.join(KOK, r), h)
        for r in eklenen + degisen:
            hedef = os.path.join(KOK, r)
            os.makedirs(os.path.dirname(hedef), exist_ok=True)
            if r in degisen and r.endswith(".md") and r.split("/")[0] in ("03 Grammatik", "02 Wortschatz", "01 Sınav"):
                metin = konu_birlestir(open(hedef, encoding="utf-8").read(), open(os.path.join(kaynak, r), encoding="utf-8").read())
                if metin != open(os.path.join(kaynak, r), encoding="utf-8").read():
                    korunan.append(r)
                open(hedef, "w", encoding="utf-8").write(metin)
            else:
                shutil.copy2(os.path.join(kaynak, r), hedef)
        for r in silinen:
            os.remove(os.path.join(KOK, r))
        M.kisisel_hazirla()
        print(f"\nGüncellendi ({sv}). Yedek: {os.path.relpath(yedek, KOK)}")
        if korunan:
            print("Yerel ders notu / alt listesi korunan konular: " + ", ".join(os.path.basename(r)[:6] for r in korunan))


if __name__ == "__main__":
    main()
