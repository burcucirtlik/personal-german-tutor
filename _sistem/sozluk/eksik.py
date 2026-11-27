#!/usr/bin/env python3
"""Günün metinlerinde sözlükte olmayan Almanca kelime biçimlerini bulur ve eklemeyi kolaylaştırır.

  python3 -I _sistem/sozluk/eksik.py 2026-11-28                  # eksik biçimler + kök önerileri
  python3 -I _sistem/sozluk/eksik.py 2026-11-28 --taslak T.json  # doldurulacak JSON taslağını yazar
  python3 -I _sistem/sozluk/eksik.py --ekle T.json               # taslağı _kisisel/sozluk/sozluk.json'a ekler
  --dosya <yol>   ek metin (ör. yeni yazılan ders notu); birden fazla kez verilebilir

Taranan: soru dosyası (bölüm metinleri, pano ilanları, Türkçe çeviri soruları hariç soru metinleri, seçenekler,
kelime çipleri, kutula öğeleri, dinleme metinleri), o günün Tempelhof günlüğü, o gün eklenen kartlar ve
tıklanıp sözlükte bulunamayan kelimeler (`tiklananlar.json` → tr: null).
Ekleme sadece yeni anahtar ekler: motor sözlüğündeki ya da kişisel sözlükteki girişlere dokunmaz.
Taslakta `tr` boş bırakılan giriş eklenmez.
"""
import glob
import json
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KELIME = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")  # sozluk.js ile aynı
TURKCE = re.compile(r"[çğışİıÇŞĞ]")
GENIS = re.compile(r"[A-Za-zÄÖÜäöüßçğışİıÇŞĞ]+")
TR_ISLEV = {"bir", "bu", "ve", "ile", "mi", "mu", "da", "de", "ne", "ama", "sen", "ben", "su", "hangisi", "olan", "var", "yok",
            "kur", "yap", "sor", "yaz", "soru", "sahne", "ismi", "kelime", "cevap", "sonra", "once", "gibi", "icin", "erken"}
ALINTI = re.compile(r"[„\"“*]([^„\"“”*]+)[”\"“*]")


def almanca_parcalar(metin):
    """Türkçe bir yönerge içindeki Almanca parçalar: tırnak/yıldız içi ve iki noktadan sonrası (Türkçe değilse).
    Türkçe iz taşımayan metin olduğu gibi döner."""
    metin = str(metin or "")
    turkce = any(TURKCE.search(w) or w.lower() in TR_ISLEV for w in GENIS.findall(metin))
    if not turkce:
        return [metin]
    parca = ALINTI.findall(metin)
    if ":" in metin:
        son = metin.rsplit(":", 1)[1]
        if not any(TURKCE.search(w) or w.lower() in TR_ISLEV for w in GENIS.findall(son)):
            parca.append(son)
    return parca
EKLER = ("est", "st", "et", "en", "em", "er", "es", "e", "n", "s", "t")
UMLAUT = str.maketrans({"ä": "a", "ö": "o", "ü": "u"})


def yol(*p):
    return os.path.join(KOK, *p)


def oku(p, v):
    try:
        return json.load(open(yol(p), encoding="utf-8"))
    except (OSError, ValueError):
        return v


def sozluk():
    s = dict(oku("_sistem/sozluk/sozluk.json", {"kelimeler": {}}).get("kelimeler", {}))
    s.update(oku("_kisisel/sozluk/sozluk.json", {"kelimeler": {}}).get("kelimeler", {}))
    return s


def metinler(gun, ekler):
    p = []
    v = oku(f"05 Günlük/veri/{gun}.json", {})
    for b in v.get("bolumler", []):
        p.append(b.get("metin", ""))
        p += [i.get("metin", "") for i in (b.get("pano") or {}).get("ilanlar", [])]
        p += [s.get("metin", "") for s in (b.get("dinle") or {}).get("sesler", [])]
        for q in b.get("sorular", []):
            if q.get("tip") != "ceviri":
                p.append(q.get("metin", ""))
            p += [str(x) for x in q.get("secenekler", []) + q.get("kelimeler", []) + q.get("ogeler", [])]
    for t in glob.glob(yol("08 Tempelhof", f"{gun} *.md")):
        m = re.search(r"metin: `(.*?)`", open(t, encoding="utf-8").read(), re.S)
        if m:
            p.append(m.group(1))
    for k in oku("_kisisel/kartlar/deste.json", {"kartlar": []}).get("kartlar", []):
        if k.get("eklenme") == gun:
            p += [k.get("de", ""), k.get("ornek", "")]
    for d in ekler:
        p.append(open(d, encoding="utf-8").read())
    return p


def oneri(w, s):
    """Sözlükte olmayan biçim için kök önerisi: (kök, türkçesi) ya da None."""
    lemma = {}
    for b, g in s.items():
        k = str(g.get("kok") or "").split(",")[0].strip()
        k = re.sub(r"^(der|die|das)\s+", "", k, flags=re.I).lower()
        if k:
            lemma.setdefault(k, g)
    adaylar = [w] + [w[: -len(e)] for e in EKLER if w.endswith(e) and len(w) - len(e) >= 3]
    for a in adaylar:
        for b in dict.fromkeys([a, a.translate(UMLAUT)]):
            for c in (b, b + "en", b + "n", b + "e"):
                if c in s and c != w:
                    return s[c].get("kok") or c, s[c].get("tr")
                if c in lemma and c != w:
                    return lemma[c].get("kok") or c, lemma[c].get("tr")
    return None


def main():
    if "--ekle" in sys.argv:
        t = json.load(open(sys.argv[sys.argv.index("--ekle") + 1], encoding="utf-8"))
        s = sozluk()
        p = yol("_kisisel", "sozluk", "sozluk.json")
        kis = oku("_kisisel/sozluk/sozluk.json", {"kelimeler": {}})
        kis.setdefault("kelimeler", {})
        eklenen = [k for k, g in t.items() if k.lower() == k and k not in s and str(g.get("tr", "")).strip()]
        for k in eklenen:
            kis["kelimeler"][k] = {x: y for x, y in t[k].items() if y not in ("", None)}
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + ".tmp"
        json.dump(kis, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        os.replace(tmp, p)
        atlanan = len(t) - len(eklenen)
        print(f"Eklendi: {len(eklenen)}" + (f" · atlandı {atlanan} (zaten var, büyük harfli anahtar ya da tr boş)" if atlanan else ""))
        return
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] not in ("--dosya", "--taslak")]
    if not args:
        sys.exit(__doc__)
    gun = args[0]
    ekler = [sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--dosya"]
    s = sozluk()
    bicim = {w.lower() for p in metinler(gun, ekler) for a in almanca_parcalar(p) for w in KELIME.findall(a)}
    eksik = sorted(w for w in bicim if w not in s and not TURKCE.search(w) and len(w) > 1)
    tik = oku("_kisisel/sozluk/tiklananlar.json", {"kelimeler": {}}).get("kelimeler", {})
    tiklanan = sorted(k for k, v in tik.items() if v.get("tr") is None and k not in s and not TURKCE.search(k))
    taslak = {}
    print(f"# Sözlük · {gun}: {len(bicim)} biçim, {len(eksik)} eksik" + (f", {len(tiklanan)} tıklanmış eksik" if tiklanan else ""))
    for w in eksik + [k for k in tiklanan if k not in eksik]:
        o = oneri(w, s)
        etiket = " (tıklandı; Türkçe bir arayüz kelimesiyse atla)" if w in tiklanan else ""
        if o:
            print(f"  {w}{etiket} → kök önerisi: {o[0]} ({o[1]})")
            taslak[w] = {"tr": "", "kok": o[0], "not": ""}
        else:
            print(f"  {w}{etiket} → yeni")
            taslak[w] = {"tr": "", "kok": "", "not": ""}
    if "--taslak" in sys.argv:
        hedef = sys.argv[sys.argv.index("--taslak") + 1]
        json.dump(taslak, open(hedef, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"Taslak: {hedef} · `tr` alanlarını doldur, sonra --ekle")


if __name__ == "__main__":
    main()
