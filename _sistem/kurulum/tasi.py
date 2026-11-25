#!/usr/bin/env python3
"""Eski düzendeki bir vault'u motor + kişisel katman düzenine taşır (bir kez çalışır; tekrar çalıştırmak zararsız).

  python3 -I _sistem/kurulum/tasi.py          # kuru: ne taşınacak
  python3 -I _sistem/kurulum/tasi.py --yaz    # taşı

Ne yapar:
  - Konu notlarının frontmatter'ındaki kişisel alanları `_kisisel/ilerleme.json`'a alır, notlarda varsayılana çeker.
  - Profil, hikâye kaydı, ilerleme günlüğü, kart durumu, tıklamalar, sinyal, drill durumları, mini drill setleri,
    ses kayıtları ve yedekleri `_sistem/` altından `_kisisel/` altına taşır.
  - Kart destesini ikiye böler: çekirdek kelimeler ve temel cümleler motorda kalır, geri kalan kartlar kişisel olur.
  - Sözlükte motorda olmayan girişleri olduğu gibi bırakır (sözlük motorun parçası; kişisel ekler bundan sonra ayrı dosyaya).
"""
import glob
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import motor as M  # noqa: E402

K = M.K
KOK = M.KOK
TASINAN = [  # (eski, yeni) göreli yollar
    ("_sistem/Profil.md", "_kisisel/Profil.md"),
    ("_sistem/Tempelhof/Hikâye.md", "_kisisel/Hikâye.md"),
    ("_sistem/ilerleme.log", "_kisisel/ilerleme.log"),
    ("_sistem/kartlar/durum.json", "_kisisel/kartlar/durum.json"),
    ("_sistem/sozluk/tiklananlar.json", "_kisisel/sozluk/tiklananlar.json"),
    ("_sistem/sozluk/sinyal.json", "_kisisel/sozluk/sinyal.json"),
    ("_sistem/ses", "_kisisel/ses"),
    ("_sistem/yedek", "_kisisel/yedek"),
]


def motor_karti(k):
    return (k.get("deste") == "kelime" and k.get("kaynak") == "çekirdek") or (k.get("deste") == "cumle" and k.get("kaynak") == "temel")


def main():
    yaz = "--yaz" in sys.argv
    j = lambda p: os.path.join(KOK, p)
    plan = []

    # 1. konu ilerlemesi
    ilerleme = dict(K.ilerleme_oku())
    notlar = []
    for klasor in K.KONU_KLASORLERI:
        for d in sorted(glob.glob(j(klasor + "/*.md"))):
            satirlar, _ = M.frontmatter_bol(open(d, encoding="utf-8").read())
            if satirlar is None:
                continue
            fm = M.alanlar(satirlar)
            if fm.get("tur") not in K.KONU_TURLERI or not fm.get("id"):
                continue
            kisisel = {k: v for k, v in fm.items() if k in K.ILERLEME_ALANLARI}
            if kisisel != {k: v for k, v in M.varsayilanlar(fm).items() if k in fm} or any(
                    k in fm for k in K.ILERLEME_ALANLARI if k not in M.varsayilanlar(fm)):
                notlar.append((d, fm["id"], kisisel))
    plan.append(f"konu ilerlemesi: {len(notlar)} notun kişisel alanı _kisisel/ilerleme.json'a")

    # 2. dosyalar
    tasinacak = [(a, b) for a, b in TASINAN if a != b and os.path.exists(j(a))]
    for d in sorted(set(glob.glob(j("_sistem/drill/*.durum.json")) + glob.glob(j("_sistem/drill/mini-*.json")))):
        r = os.path.relpath(d, KOK)
        tasinacak.append((r, "_kisisel/drill/" + os.path.basename(d)))
    plan += [f"taşı: {a} → {b}" for a, b in tasinacak]

    # 3. deste
    deste_yolu = j("_sistem/kartlar/deste.json")
    deste = json.load(open(deste_yolu, encoding="utf-8"))["kartlar"]
    motor = [k for k in deste if motor_karti(k)]
    kisisel_kartlar = [k for k in deste if not motor_karti(k)]
    ad = M.alanlar(M.frontmatter_bol(open(j("_sistem/Profil.md" if os.path.exists(j("_sistem/Profil.md")) else "_kisisel/Profil.md"),
                                          encoding="utf-8").read())[0] or []).get("ad", "")
    if kisisel_kartlar:
        plan.append(f"deste: {len(motor)} kart motorda kalır, {len(kisisel_kartlar)} kart _kisisel/kartlar/deste.json'a")

    print("\n".join(plan) if plan else "Taşınacak bir şey yok: vault zaten yeni düzende.")
    if not yaz:
        print("\n(kuru çalışma; uygulamak için --yaz)")
        return

    for d, kid, kisisel in notlar:
        if kid not in ilerleme:
            K.ilerleme_yaz(kid, kisisel)
        M.konu_sifirla(d)
    for a, b in tasinacak:
        if os.path.realpath(j(a)) == os.path.realpath(j(b)):
            continue  # kaynak ve hedef aynıysa (asla silme)
        hedef = j(b)
        os.makedirs(os.path.dirname(hedef), exist_ok=True)
        if os.path.isdir(j(a)):
            shutil.copytree(j(a), hedef, dirs_exist_ok=True)
            shutil.rmtree(j(a))
        else:
            if os.path.exists(hedef) and b.endswith((".md", ".json")) and os.path.getsize(hedef) > 120:
                print(f"⚠️ {b} zaten var, {a} bırakıldı (elle bak)")
                continue
            os.replace(j(a), hedef)
    M.kisisel_hazirla()  # taşınmayanlar (boş deste, sözlük ekleri …) şablondan
    if kisisel_kartlar:
        kd = K.kisisel_deste()
        var = {k["id"] for k in kd["kartlar"]}
        kd["kartlar"] += [k for k in kisisel_kartlar if k["id"] not in var]
        K.kisisel_deste_yaz(kd)
        for k in motor:  # temel cümlelerdeki kullanıcı adı → {ad} (kart ekranı Profil'deki adı koyar)
            for alan in ("de", "tr"):
                if ad and ad in k.get(alan, ""):
                    k[alan] = k[alan].replace(ad, "{ad}")
        K.json_yaz(deste_yolu, {"kartlar": motor})
    print("\nTaşındı.")


if __name__ == "__main__":
    main()
