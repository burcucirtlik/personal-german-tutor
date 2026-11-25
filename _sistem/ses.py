"""Almanca ses dosyası üretir; bilgisayarda yüklü en doğal Almanca sesi seçer.

Kullanım:
  python3 -I _sistem/ses.py --tercih "Markus,Yannick" --hiz 150 --cikti "08 Tempelhof/ses/2026-10-23 Mehmet.m4a" --metin "Ich heiße Mehmet."
  python3 -I _sistem/ses.py --liste      # yüklü Almanca sesleri ve puanlarını gösterir

Sıralama: önce kalite (Premium > Gelişmiş/Enhanced > normal), sonra --tercih sırası.
Eğlence sesleri (Eddy, Grandma, Rocko…) hiç seçilmez.
"""
import argparse
import os
import re
import subprocess
import sys

EGLENCE = re.compile(r"Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bahh|Bells|Boing|Bubbles|Jester|Organ|Trinoids|Whisper|Zarvox", re.I)


def almanca_sesler():
    cikti = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
    sesler = []
    for satir in cikti.splitlines():
        m = re.match(r"^(.*?)\s+([a-z]{2}_[A-Z]{2})\s+#", satir)
        if m and m.group(2).startswith("de_") and not EGLENCE.search(m.group(1)):
            sesler.append(m.group(1).strip())
    return sesler


def kalite(ad):
    if re.search(r"premium", ad, re.I):
        return 2
    if re.search(r"enhanced|gelişmiş|erweitert|verbessert", ad, re.I):
        return 1
    return 0


def sec(tercihler):
    sesler = almanca_sesler()
    if not sesler:
        return "Anna"

    def tercih_sirasi(ad):
        for i, t in enumerate(tercihler):
            if t and t.lower() in ad.lower():
                return i
        return len(tercihler)

    return sorted(sesler, key=lambda ad: (-kalite(ad), tercih_sirasi(ad)))[0]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tercih", default="Anna")
    p.add_argument("--hiz", type=int, default=150)
    p.add_argument("--cikti")
    p.add_argument("--metin")
    p.add_argument("--liste", action="store_true")
    p.add_argument("--baslik", type=int, default=0, help="baştaki kaç cümle başlık/tarih (dikteye girmez)")
    p.add_argument("--cumlesiz", action="store_true", help="cümle dosyası yazma")
    a = p.parse_args()
    tercihler = [t.strip() for t in a.tercih.split(",") if t.strip()]
    if a.liste:
        for ad in almanca_sesler():
            print(f"{ad}  (kalite {kalite(ad)})")
        print("seçilecek:", sec(tercihler))
        return
    if not a.cikti or not a.metin:
        sys.exit("--cikti ve --metin gerekli")
    ses = sec(tercihler)
    # Cümle aralarına kısa sessizlik koy, sonra cümle dosyasını (<ad>.cumleler.json) yaz:
    # arayüzdeki oynatıcı bununla "cümle cümle dinle" ve "dikte" modlarını açar.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ses_cumle

    subprocess.run(["say", "-v", ses, "-r", str(a.hiz), "-o", a.cikti, "--file-format=m4af", "--data-format=aac", ses_cumle.ses_metni(a.metin)], check=True)
    print(ses)
    if not a.cumlesiz:
        v = ses_cumle.yaz(a.cikti, ses_cumle.cumlelere_bol(a.metin), a.baslik)
        print(("⚠️ cümle zamanlaması yaklaşık: " if v.get("yaklasik") else "cümleler: ") + str(len(v["cumleler"])))


if __name__ == "__main__":
    main()
