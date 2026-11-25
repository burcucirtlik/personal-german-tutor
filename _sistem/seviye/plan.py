"""Seviye tespiti Tur 1'in kontrol noktalarını kullanıcının beyanına göre seçer.

Kullanım:
  python3 -I _sistem/seviye/plan.py A2.1          # tablo
  python3 -I _sistem/seviye/plan.py A2.1 --json   # /seviye skill'i için

Kurallar → Seviye tespiti → Beyana göre kontrol planı. Bantlar Müfredat'taki sıra numaralarıdır.
Her hat için: beyan bandında her 2 konuda bir nokta (bandın son konusu dahil), bandın altında
taban taraması için en fazla 2 nokta, bir üst bantta 2 nokta. Her noktaya 2 soru.
"""
import json
import os
import re
import sys

V = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BEYANLAR = ["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2"]
BANTLAR = {
    "fiil": {"A1.1": (1, 6), "A1.2": (7, 12), "A2.1": (13, 17), "A2.2": (18, 22), "B1.1": (23, 31), "B1.2": (32, 39)},
    "isim": {"A1.1": (1, 5), "A1.2": (6, 10), "A2.1": (11, 16), "A2.2": (17, 22), "B1.1": (23, 26), "B1.2": (27, 30)},
}
YAZMA = {
    "A1.1": ("3–4 cümle (20–30 kelime)", "Türkçe"),
    "A1.2": ("40–60 kelime", "Türkçe"),
    "A2.1": ("60–80 kelime", "Türkçe, Leitpunkt'lar Almanca"),
    "A2.2": ("80–100 kelime", "Almanca"),
    "B1.1": ("100–150 kelime, telc e-postası (4 Leitpunkt)", "Almanca"),
    "B1.2": ("100–150 kelime, telc e-postası (4 Leitpunkt)", "Almanca"),
}
# Çekirdek destenin seviyeleri (100'er kelime, sıklık sırası). Taranan en alt seviyenin altı geçilmiş sayılır;
# kart ekranı onları 🧪 kontrol kartı olarak yoklar (Kurallar → Seviye tespiti → Kelime taraması).
KELIME = {"A1.1": [1], "A1.2": [1, 2], "A2.1": [1, 2, 3], "A2.2": [2, 3, 4], "B1.1": [3, 4, 5], "B1.2": [4, 5, 6]}


def mufredat():
    """{hat: {sira: 'A1-11 Trennbare Verben'}}"""
    hatlar, hat = {"fiil": {}, "isim": {}}, None
    for satir in open(os.path.join(V, "_sistem", "Müfredat.md"), encoding="utf-8"):
        if satir.startswith("#"):
            hat = "fiil" if "Fiil hattı" in satir else "isim" if "İsim hattı" in satir else None if satir.startswith("## ") else hat
        m = re.match(r"\|\s*(\d+)\s*\|\s*\[\[(.+?)\]\]", satir)
        if hat and m:
            hatlar[hat][int(m.group(1))] = m.group(2)
    return hatlar


def noktalar(hat, beyan):
    b0, b1 = BANTLAR[hat][beyan]
    i = BEYANLAR.index(beyan)
    bant = sorted(set(range(b0, b1 + 1, 2)) | {b1})
    taban = sorted({max(1, round((b0 - 1) * k / 3)) for k in (1, 2)}) if b0 > 2 else ([1] if b0 == 2 else [])
    ust = []
    if i + 1 < len(BEYANLAR):
        n0, n1 = BANTLAR[hat][BEYANLAR[i + 1]]
        ust = [n for n in (n0, n0 + 2) if n <= n1]
    return [("taban", s) for s in taban] + [("bant", s) for s in bant] + [("ust", s) for s in ust]


def olustur(beyan):
    m = mufredat()
    return {
        "beyan": beyan,
        "yazma": {"uzunluk": YAZMA[beyan][0], "talimat": YAZMA[beyan][1]},
        "kelime_seviyeleri": KELIME[beyan],
        "hatlar": {h: [{"rol": r, "sira": s, "konu": m[h][s].split(" ")[0], "ad": m[h][s], "soru": 2}
                       for r, s in noktalar(h, beyan)] for h in ("fiil", "isim")},
    }


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in BEYANLAR:
        sys.exit("Beyan şunlardan biri olmalı: " + ", ".join(BEYANLAR))
    beyan = sys.argv[1]
    plan = olustur(beyan)
    if "--json" in sys.argv:
        print(json.dumps(plan, ensure_ascii=False, indent=1))
        return
    print(f"Beyan {beyan} · yazma: {plan['yazma']['uzunluk']} ({plan['yazma']['talimat']}) · kelime seviyeleri {KELIME[beyan]}")
    for h, ns in plan["hatlar"].items():
        print(f"\n{h} hattı ({len(ns)} nokta, {2 * len(ns)} soru)")
        for n in ns:
            print(f"  {n['rol']:<6}{n['sira']:>3}  {n['ad']}")


if __name__ == "__main__":
    main()
