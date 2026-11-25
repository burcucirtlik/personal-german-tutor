#!/usr/bin/env python3
"""Motoru kişisel veri olmadan bir klasöre aktarır (herkese açık depo) ve denetler.

  python3 -I _sistem/kurulum/yayin.py                         # ~/Desktop/personal-german-tutor
  python3 -I _sistem/kurulum/yayin.py --hedef <klasör>
  python3 -I _sistem/kurulum/yayin.py --kuru                  # sadece ne aktarılacağını ve denetimi göster

Hedef klasör bir git deposuysa (.git) ona dokunulmaz; dosyalar eşitlenir (motordan kalkan dosya hedeften de silinir).
Commit ve push yapılmaz: hedefte `git status` ile bakıp elle commit edilir.
Denetim bir sorun bulursa çıkış kodu 1 ve hedefe hiçbir şey yazılmaz.
"""
import argparse
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import motor as M  # noqa: E402

K = M.K
KOK = M.KOK
BUYUK = 3_000_000  # bundan büyük dosya yayına girmez (ses, pdf …)
YASAK_UZANTI = (".pdf", ".mp3", ".m4a", ".wav", ".zip")
GITIGNORE = """# Kişisel veri: senin ilerlemen, notların ve kayıtların (yayına ve güncellemeye girmez)
_kisisel/
05 Günlük/
06 Fehlerlog/
07 Modelltests/
08 Tempelhof/
10 Analiz/
09 Drill/Mini *

# yerel
.obsidian/workspace*.json
.claude/settings.local.json
__pycache__/
*.pyc
*.tmp
.DS_Store
.trash/
"""


def motor_dosyalari():
    for kok, dizinler, dosyalar in os.walk(KOK):
        rel_kok = os.path.relpath(kok, KOK)
        rel_kok = "" if rel_kok == "." else rel_kok
        dizinler[:] = sorted(d for d in dizinler
                             if not M.kisisel_mi(os.path.join(rel_kok, d)) and not M.atlanir_mi(os.path.join(rel_kok, d)))
        for f in sorted(dosyalar):
            r = os.path.join(rel_kok, f)
            if not M.kisisel_mi(r) and not M.atlanir_mi(r):
                yield r.replace(os.sep, "/")


def denetle(dosyalar):
    sorun = []
    ad = ""
    profil = os.path.join(KOK, "_kisisel", "Profil.md")
    if os.path.exists(profil):
        ad = M.alanlar(M.frontmatter_bol(open(profil, encoding="utf-8").read())[0] or []).get("ad", "").strip()
    deste_ok = True
    for r in dosyalar:
        tam = os.path.join(KOK, r)
        if r.lower().endswith(YASAK_UZANTI):
            sorun.append(f"{r}: ses/pdf/zip dosyası (telif ya da kişisel olabilir)")
            continue
        if os.path.getsize(tam) > BUYUK:
            sorun.append(f"{r}: çok büyük ({os.path.getsize(tam) // 1000} KB)")
            continue
        if not r.endswith((".md", ".json", ".js", ".py", ".css", ".html", ".txt", ".command")):
            continue
        t = open(tam, encoding="utf-8", errors="ignore").read()
        if ad and len(ad) >= 3 and re.search(rf"\b{re.escape(ad)}\b", t):
            sorun.append(f"{r}: kullanıcının adı geçiyor ({ad})")
        if re.search(r"[\w.+-]+@(gmail|hotmail|yahoo|outlook|icloud)\.\w+", t):
            sorun.append(f"{r}: e-posta adresi")
        if r.endswith(".md") and r.split("/")[0] in ("03 Grammatik", "02 Wortschatz", "01 Sınav"):
            satirlar, _ = M.frontmatter_bol(t)
            fm = M.alanlar(satirlar or [])
            if fm.get("tur") in K.KONU_TURLERI and fm.get("id"):
                vs = M.varsayilanlar(fm)
                fark = [k for k in K.ILERLEME_ALANLARI if k in fm and fm[k] != vs.get(k, "")]
                if fark:
                    sorun.append(f"{r}: frontmatter'da kişisel ilerleme var ({', '.join(fark)})")
        if r == "_sistem/kartlar/deste.json":
            for k in json.loads(t)["kartlar"]:
                if not ((k.get("deste") == "kelime" and k.get("kaynak") == "çekirdek") or (k.get("deste") == "cumle" and k.get("kaynak") == "temel")):
                    deste_ok = False
    if not deste_ok:
        sorun.append("_sistem/kartlar/deste.json: çekirdek olmayan (kişisel) kart var")
    for zorunlu in ("README.md", "LICENSE.md", "CLAUDE.md", "Almanca.html", "_sistem/Şablonlar/Profil.md", "_sistem/kurulum/baslat.py"):
        if zorunlu not in dosyalar:
            sorun.append(f"{zorunlu}: eksik")
    return sorun


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hedef", default=os.path.expanduser("~/Desktop/personal-german-tutor"))
    ap.add_argument("--kuru", action="store_true")
    a = ap.parse_args()
    hedef = os.path.abspath(os.path.expanduser(a.hedef))
    if (hedef + os.sep).startswith(KOK + os.sep):
        sys.exit("Hedef bu klasörün içinde olamaz.")

    dosyalar = list(motor_dosyalari())
    sorun = denetle(dosyalar)
    boyut = sum(os.path.getsize(os.path.join(KOK, r)) for r in dosyalar)
    print(f"Motor: {len(dosyalar)} dosya, {boyut // 1000} KB")
    if sorun:
        print("❌ Denetim:\n  " + "\n  ".join(sorun))
        sys.exit(1)
    print("✓ Denetim: kişisel veri, ad, telifli dosya ve frontmatter ilerlemesi yok")
    if a.kuru:
        return

    os.makedirs(hedef, exist_ok=True)
    yeni = set(dosyalar) | {".gitignore"}
    silinen = 0
    for kok, dizinler, fs in os.walk(hedef, topdown=False):
        rel_kok = os.path.relpath(kok, hedef)
        if rel_kok.split(os.sep)[0] == ".git":
            continue
        for f in fs:
            r = os.path.normpath(os.path.join(rel_kok, f)).replace(os.sep, "/")
            if r not in yeni and not M.kisisel_mi(r):
                os.remove(os.path.join(kok, f))
                silinen += 1
        if rel_kok != "." and not os.listdir(kok):
            os.rmdir(kok)
    for r in dosyalar:
        h = os.path.join(hedef, r)
        os.makedirs(os.path.dirname(h), exist_ok=True)
        shutil.copy2(os.path.join(KOK, r), h)
    with open(os.path.join(hedef, ".gitignore"), "w", encoding="utf-8") as f:
        f.write(GITIGNORE)
    print(f"Aktarıldı: {hedef} ({len(dosyalar)} dosya{f', {silinen} eski dosya silindi' if silinen else ''})")
    print("Sıradaki: hedefte `git status`, sonra commit ve push (elle).")


if __name__ == "__main__":
    main()
