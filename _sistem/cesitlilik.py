#!/usr/bin/env python3
"""Çeşitlilik denetimi: bir günün soru dosyasını son seanslarla karşılaştırır (Kurallar.md → Çeşitlilik).

Kullanım:
  python3 -I _sistem/cesitlilik.py 2026-11-25

`/antrenman` soru dosyasını yazdıktan sonra çalıştırır. ❌ satırları düzeltilmeden not teslim edilmez
(çıkış kodu 1); ⚠️ satırları öneridir. Hiçbir dosyayı değiştirmez.

Bilerek tekrar edilen kelimeler (onarımdaki düzensiz fiiller, inatçı kart kelimeleri, "Yarın bağlamda"
kelimeleri) soru dosyasının üst düzeyindeki `izinli` listesine yalın biçimleriyle yazılır.
"""
import collections
import glob
import importlib.util
import json
import math
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEANS = 6          # yıpranma penceresi: son 6 seans
YIPRANMIS = 3      # bu kadar seansta geçen içerik kelimesi yıpranmıştır
KOPYA_SEANS = 10   # yakın kopya aranan seans sayısı
GUNLUK_AZAMI = 3   # bir içerik kelimesi bir günde en fazla bu kadar soruda geçer
BAS_AZAMI = 2      # aynı iki kelimeyle başlayan cümle sayısı
TUR_PAYI = 0.6     # bir bölümde tek soru türünün en yüksek payı (K3+)
GRAMER_ROL = ("odak", "on", "tekrar", "yoklama")
ALT_ROL = ("odak", "on", "tekrar", "yoklama")

DE_ISLEV = set("""der die das den dem des ein eine einen einem einer eines kein keine keinen und oder aber denn
ich du er sie es wir ihr mich dich ihn uns euch mein meine dein deine sein seine nicht auch sehr hier da dort heute
jetzt morgen wieder noch schon nur so ja nein doch in im an am um zu zum zur mit von für auf aus bei nach
wer was wo wie wann warum woher wohin viel viele ganz dann immer oft nie nichts etwas alle alles man
haben bin bist ist sind seid habe hast hat habt war hatte uhr
eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf
hangar turm tor feld tempelhof""".split())  # son satır: sahne adları, hikâye gereği her gün geçer
TR_ISLEV = set("""bir ve ama veya ya da de bu şu o ben sen biz siz onlar çok bugün şimdi burada orada değil var yok
ne kim nerede neden nasıl ne zaman mi mı mu mü için ile gibi daha en her hiç yine hâlâ hala çünkü""".split())


def yol(*p):
    return os.path.join(KOK, *p)


def ilerleme_modulu():
    spec = importlib.util.spec_from_file_location("ilerleme", yol("_sistem", "ilerleme.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def sozluk_yukle():
    try:
        s = json.load(open(yol("_sistem", "sozluk", "sozluk.json"), encoding="utf-8"))["kelimeler"]
        if os.path.exists(yol("_kisisel", "sozluk", "sozluk.json")):  # kişisel ekler (Claude'un eklediği girişler)
            s.update(json.load(open(yol("_kisisel", "sozluk", "sozluk.json"), encoding="utf-8")).get("kelimeler", {}))
    except (OSError, ValueError, KeyError):
        return {}, set()
    kok, ozel = {}, set()
    for bicim, g in s.items():
        if "(isim)" in str(g.get("tr", "")):
            ozel.add(bicim)
        k = str(g.get("kok") or "").split(",")[0].strip().lower()
        k = re.sub(r"^(der|die|das)\s+", "", k)
        if k and " " not in k:
            kok[bicim] = k
    return kok, ozel


KOKLER, OZEL = sozluk_yukle()


def de_kelimeler(metin):
    return [KOKLER.get(w, w) for w in re.findall(r"[a-zäöüß]+", metin.lower())]


def tr_kelimeler(metin):
    ks = re.findall(r"[a-zçğıöşüâîû]+", metin.replace("İ", "i").replace("I", "ı").lower())
    return ["tr:" + (w[:4] + "…" if len(w) > 5 else w) for w in ks if w not in TR_ISLEV and w not in OZEL]


def icerik(kelimeler):
    return {w for w in kelimeler if w.startswith("tr:") or (len(w) > 2 and w not in DE_ISLEV and w not in OZEL)}


def soru_metni(q, r=None):
    """(dil, kelimeler). Çeviri sorusunun Almancası ancak puanlandıktan sonra (`dogru`) bilinir."""
    if q.get("tip") == "ceviri":
        if r and r.get("dogru"):
            return "de", de_kelimeler(str(r["dogru"]))
        return "tr", tr_kelimeler(str(q.get("metin", "")))
    parca = [str(q.get("metin", ""))]
    for alan in ("kelimeler", "ogeler"):  # cümle kurma çipleri, kutula öğeleri
        if q.get(alan):
            parca.append(" ".join(map(str, q[alan])))
    if q.get("tip") in ("donustur", "hata", "yaz") and r and r.get("dogru"):
        parca.append(str(r["dogru"]))
    return "de", de_kelimeler(" ".join(parca))


def gramer_sorulari(veri):
    for b in veri.get("bolumler", []):
        rol = b.get("rol")
        if rol in GRAMER_ROL or (rol is None and str(b.get("konu") or "").startswith(("A", "B"))):
            for q in b.get("sorular", []):
                if q.get("tip") != "yazma":
                    yield b, q


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("Kullanım: python3 -I _sistem/cesitlilik.py <gün>")
    gun = args[0]
    dosya = yol("05 Günlük", "veri", f"{gun}.json")
    if not os.path.exists(dosya):
        sys.exit(f"Soru dosyası yok: {dosya}")
    veri = json.load(open(dosya, encoding="utf-8"))
    izinli = {str(x).lower() for x in veri.get("izinli", [])}
    izinli |= {re.sub(r"^(der|die|das)\s+", "", x) for x in izinli}

    gecmis = []
    for d in sorted(glob.glob(yol("05 Günlük", "veri", "*.json")), reverse=True):
        ad = os.path.basename(d)
        if ad.endswith(".cevap.json") or not re.match(r"\d{4}-\d{2}-\d{2}\.json$", ad) or ad[:10] >= gun:
            continue
        gecmis.append((ad[:10], json.load(open(d, encoding="utf-8"))))
    gecmis = gecmis[:KOPYA_SEANS]

    ihlal, uyari = [], []
    bugun = []  # (bölüm, soru, dil, kelimeler)
    for b, q in gramer_sorulari(veri):
        dil, ks = soru_metni(q)
        bugun.append((b, q, dil, ks))

    # 1. Yıpranmış kelimeler: son SEANS seansın en az YIPRANMIS tanesinde geçenler
    gorulme = collections.Counter()
    for g, v in gecmis[:SEANS]:
        gunluk = set()
        for b, q in gramer_sorulari(v):
            r = (v.get("sonuc") or {}).get(q["id"])
            gunluk |= icerik(soru_metni(q, r)[1])
            if q.get("tip") == "ceviri":
                gunluk |= icerik(tr_kelimeler(str(q.get("metin", ""))))
        gorulme.update(gunluk)
    bugun_sayim = collections.Counter()
    for _, q, _, ks in bugun:
        bugun_sayim.update(icerik(ks))
    temiz = lambda w: w not in izinli and w.replace("tr:", "") not in izinli
    yipranmis = sorted((w for w in bugun_sayim if gorulme[w] >= YIPRANMIS and temiz(w)), key=lambda w: -gorulme[w])
    butce = max(3, math.floor(len(bugun_sayim) * 0.1))
    if yipranmis:
        satir = ", ".join(f"{w.replace('tr:', '')} ({gorulme[w]}/{min(SEANS, len(gecmis))})" for w in yipranmis)
        (ihlal if len(yipranmis) > butce else uyari).append(
            f"Yıpranmış kelime: {len(yipranmis)} (bütçe {butce}). Son {min(SEANS, len(gecmis))} seansın çoğunda geçti: {satir}")

    # 2. Aynı gün içinde tekrar
    cok = sorted(w for w, c in bugun_sayim.items() if c > GUNLUK_AZAMI and temiz(w))
    if cok:
        ihlal.append("Bugün " + str(GUNLUK_AZAMI) + "'ten fazla soruda geçen kelime: " + ", ".join(f"{w.replace('tr:', '')} ({bugun_sayim[w]})" for w in cok))

    # 3. Cümle başları
    bas = collections.defaultdict(list)
    for _, q, dil, ks in bugun:
        if len(ks) >= 3:
            bas[" ".join(k.replace("tr:", "") for k in ks[:2])].append(q["id"])
    for b_, ids in sorted(bas.items()):
        if len(ids) > BAS_AZAMI:
            ihlal.append(f"Aynı başlangıç {len(ids)} cümlede: „{b_} …“ ({', '.join(ids)})")

    # 4. Yakın kopyalar: içerik kelimeleri aynı, cümlenin geri kalanı da büyük ölçüde aynı
    def kopya_mi(a, b):
        ia, ib = icerik(a), icerik(b)
        if not ia or ia != ib or len(a) < 3:
            return False
        sa, sb = set(a), set(b)
        return len(sa & sb) / len(sa | sb) >= 0.6

    eski = []
    for g, v in gecmis:
        for b, q in gramer_sorulari(v):
            r = (v.get("sonuc") or {}).get(q["id"])
            eski.append((g, q["id"], soru_metni(q, r)[1]))
            if q.get("tip") == "ceviri":
                eski.append((g, q["id"], tr_kelimeler(str(q.get("metin", "")))))
    for i, (_, q, _, ks) in enumerate(bugun):
        for g, qid, eks in eski:
            if kopya_mi(ks, eks):
                goster = str(q.get("metin") or " / ".join(map(str, q.get("kelimeler") or [])) or q.get("talimat") or "")[:50]
                ihlal.append(f"Yakın kopya: {q['id']} „{goster}“ ≈ {g[5:]} soru {qid}")
                break
        for _, q2, _, ks2 in bugun[:i]:
            if kopya_mi(ks, ks2):
                ihlal.append(f"Bugün içinde yakın kopya: {q['id']} ≈ {q2['id']}")
                break

    # 5–8. Bölüm düzeyi: tür dağılımı, art arda aynı tür, alt beceri alanı, kontrast, anahtar sırası
    try:
        notlar = ilerleme_modulu().notlari_yukle()
    except Exception as e:  # konu notları okunamazsa alt beceri denetimi atlanır
        notlar = {}
        uyari.append(f"Konu notları okunamadı, alt beceri adları denetlenmedi ({e})")
    onceki = gecmis[0][1] if gecmis else {"bolumler": []}
    for b in veri.get("bolumler", []):
        rol, sorular = b.get("rol"), b.get("sorular", [])
        ad = f"Bölüm {b.get('no')} ({b.get('kisa') or b.get('baslik')})"
        tipler = [q.get("tip") for q in sorular]
        if rol in ("odak", "on") and len(sorular) >= 4:
            say = collections.Counter(tipler)
            kd = b.get("kademe") or 0
            if kd >= 3:
                t, c = say.most_common(1)[0]
                if c / len(sorular) > TUR_PAYI:
                    ihlal.append(f"{ad}: soruların %{round(100 * c / len(sorular))}'i `{t}` (en fazla %{round(TUR_PAYI * 100)})")
                n_k = sum(1 for q in sorular if q.get("kontrast"))
                if n_k < math.ceil(len(sorular) / 4):
                    uyari.append(f"{ad}: {n_k} kontrast sorusu var (K3+ için en az {math.ceil(len(sorular) / 4)}; karışan komşu konu yoksa geç)")
            elif kd == 2:
                cok_cumle = sum(1 for q in sorular if len(re.findall(r"[.?!](\s|$)", str(q.get("metin", "")))) >= 2 or "–" in str(q.get("metin", "")))
                if cok_cumle < len(sorular) / 3:
                    uyari.append(f"{ad}: K2 sorularının en az üçte biri mini diyalog ya da iki cümlelik bağlam olsun ({cok_cumle}/{len(sorular)})")
            for ob in onceki.get("bolumler", []):
                if ob.get("rol") == rol and ob.get("konu") == b.get("konu") and ob.get("kademe") == b.get("kademe") and kd != 2:
                    if collections.Counter(q.get("tip") for q in ob.get("sorular", [])) == say:
                        ihlal.append(f"{ad}: tür dağılımı bir önceki seansla aynı ({dict(say)})")
        if rol in GRAMER_ROL and (b.get("kademe") or 3) >= 3:
            seri, azami = 1, 1
            for x, y in zip(tipler, tipler[1:]):
                seri = seri + 1 if x == y else 1
                azami = max(azami, seri)
            if azami > 3 and len(set(tipler)) > 1:
                uyari.append(f"{ad}: aynı tür art arda {azami} kez; türleri karıştır")
        if rol in ALT_ROL:
            altsiz = [q["id"] for q in sorular if not q.get("alt")]
            if altsiz:
                ihlal.append(f"{ad}: {len(altsiz)} soruda `alt` alanı yok ({', '.join(altsiz[:6])}{' …' if len(altsiz) > 6 else ''}); alt beceri kanıtı sayılamaz")
            for q in sorular:
                konu = q.get("konu") or b.get("konu")
                if not q.get("alt"):
                    continue
                elif konu in notlar and notlar[konu].liste("alt") and q["alt"] not in notlar[konu].liste("alt"):
                    ihlal.append(f"{q['id']}: `alt` „{q['alt']}“ {konu} notunun alt listesinde yok (birebir aynı yazılmalı)")
        anahtarlar = [q.get("anahtar") for q in sorular if q.get("tip") == "eslestir" and isinstance(q.get("anahtar"), str)]
        if rol in ("odak", "on") and sum(1 for q in sorular if q.get("tip") == "kutula") > 1:
            ihlal.append(f"{ad}: birden fazla kutula kartı (bölüm başına en fazla bir; tanıma kanıtıdır)")
        if len(anahtarlar) >= 4 and (anahtarlar == sorted(anahtarlar) or anahtarlar == sorted(anahtarlar, reverse=True)):
            ihlal.append(f"{ad}: eşleştirme anahtarları sıralı ({', '.join(anahtarlar)}); soruları karıştır")
        dy = [q.get("anahtar") for q in sorular if q.get("tip") == "dogruyanlis"]
        if len(dy) >= 4 and (len(set(dy)) == 1 or all(x != y for x, y in zip(dy, dy[1:]))):
            uyari.append(f"{ad}: richtig/falsch düzeni tahmin edilebilir ({', '.join(map(str, dy))})")

    # Tekrar: bir konu sadece açık boşluklu mektupla (yer alanlı boşluklar) tekrar edilemez
    mektup, tek = collections.Counter(), collections.Counter()
    for b in veri.get("bolumler", []):
        if b.get("rol") == "tekrar":
            for q in b.get("sorular", []):
                konu = q.get("konu") or b.get("konu")
                (mektup if q.get("yer") is not None or q.get("tip") == "kutula" else tek)[konu] += 1
    for konu in sorted(k for k in mektup if not tek[k]):
        ihlal.append(f"Tekrar: {konu} sadece mektup boşluğuyla soruluyor ({mektup[konu]} soru); en az bir ipucusuz K4 sorusu (çeviri, dönüştürme) ekle")

    print(f"# Çeşitlilik · {gun} · {len(bugun)} gramer sorusu, son {len(gecmis)} seansla karşılaştırıldı\n")
    for s in ihlal:
        print("❌ " + s)
    for s in uyari:
        print("⚠️ " + s)
    if izinli:
        print("ℹ️ izinli: " + ", ".join(sorted(izinli)))
    if not ihlal:
        print("✅ Düzeltilmesi gereken ihlal yok.")
    sys.exit(1 if ihlal else 0)


if __name__ == "__main__":
    main()
