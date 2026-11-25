"""Bir ses dosyasını cümlelerine ayırır: her cümlenin metnini ve başlangıç/bitiş saniyesini yazar.

Arayüzdeki oynatıcı bu dosyayla "cümle cümle dinle" ve "dikte" modlarını açar.
Çıktı sesin yanına yazılır:  <ses adı>.cumleler.json  →  {"cumleler": [{"metin": "...", "bas": 0.0, "son": 2.4}, ...]}

Kullanım (vault kökünden):
  python3 -I _sistem/ses_cumle.py --ses "05 Günlük/ses/2026-11-12-1.m4a" --metin "Metin…"
  python3 -I _sistem/ses_cumle.py --toplu            # notlardaki seslerin eksik cümle dosyalarını üretir
  python3 -I _sistem/ses_cumle.py --toplu --yeniden  # hepsini baştan üretir

_sistem/ses.py yeni sesleri üretirken cümle aralarına kısa bir sessizlik koyar ve bunu kendisi çağırır.
Eşleme: ses sessizliklere bölünür, cümle sınırları "uzun sessizlik + metin uzunluğuna uygun süre"yi en iyi
karşılayan sessizliklere yerleştirilir (dinamik programlama). Eşleme zayıfsa dosyada "yaklasik": true olur.
"""
import argparse
import array
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import wave

V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORNEK = 8000  # Hz
PENCERE = 80  # 10 ms
SLNC = re.compile(r"\[\[slnc \d+\]\]")
SON = re.compile(r"[.!?…]+[\"“”»]?(?=\s+[„\"«A-ZÄÖÜ0-9])")
# "9. November", "3. Stock": sıra sayısından sonra gelen bu sözcüklerde cümle bitmez
SIRA_SONRASI = re.compile(r"\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Stock|Etage|Klasse|Mal|Platz|Tag|Woche|Monat|Jahr)\b")


def cumlelere_bol(metin):
    """Metni cümlelere böler; paragraf ve [[slnc]] işaretleri de sınırdır. Sıra numarası olan noktada bölmez (9. November)."""
    cumleler = []
    for parca in re.split(r"\n+|\[\[slnc \d+\]\]", metin):
        parca = re.sub(r"\s+", " ", parca).strip()
        if not parca:
            continue
        bas = 0
        for m in SON.finditer(parca):
            if m.group(0) == "." and m.start() > 0 and parca[m.start() - 1].isdigit() and SIRA_SONRASI.match(parca, m.end()):
                continue
            c = parca[bas : m.end()].strip()
            if c:
                cumleler.append(c)
            bas = m.end()
        c = parca[bas:].strip()
        if c:
            cumleler.append(c)
    return cumleler


def ses_metni(metin, ara_ms=450):
    """say için metin: cümle aralarına kısa sessizlik koyar, var olan [[slnc]] işaretlerini korur."""
    parcalar = re.split(r"(\[\[slnc \d+\]\])", metin)
    cikti = []
    for p in parcalar:
        if SLNC.fullmatch(p):
            cikti.append(" " + p + " ")
        else:
            satirlar = [f" [[slnc {ara_ms}]] ".join(cumlelere_bol(s)) for s in p.split("\n") if s.strip()]
            cikti.append(f" [[slnc {ara_ms + 300}]] ".join(satirlar))
    return "".join(cikti)


def ornekler(ses_yolu):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "s.wav")
        subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{ORNEK}", "-c", "1", ses_yolu, wav], check=True, capture_output=True)
        with wave.open(wav) as w:
            veri = array.array("h", w.readframes(w.getnframes()))
    if sys.byteorder != "little":
        veri.byteswap()
    return veri


def sessizlikler(veri):
    rms = []
    for i in range(0, len(veri) - PENCERE + 1, PENCERE):
        s = 0
        for x in veri[i : i + PENCERE]:
            s += x * x
        rms.append(math.sqrt(s / PENCERE))
    if not rms:
        return [], 0, 0, 0
    sirali = sorted(rms)
    esik = max(40.0, 0.05 * sirali[int(len(sirali) * 0.95)])
    sessiz = [r < esik for r in rms]
    # konuşmanın başı ve sonu
    ilk = next((i for i, s in enumerate(sessiz) if not s), 0)
    son = len(sessiz) - next((i for i, s in enumerate(reversed(sessiz)) if not s), 0)
    araliklar = []
    i = ilk
    while i < son:
        if sessiz[i]:
            j = i
            while j < son and sessiz[j]:
                j += 1
            if j - i >= 8 and j < son:  # ≥ 80 ms, iç sessizlik
                araliklar.append((i / 100, j / 100))
            i = j
        else:
            i += 1
    return araliklar, ilk / 100, son / 100, len(rms) / 100


def hizala(ses_yolu, cumleler):
    veri = ornekler(ses_yolu)
    araliklar, bas, son, sure = sessizlikler(veri)
    n = len(cumleler)
    if n == 0:
        return [], True
    if n == 1:
        return [{"metin": cumleler[0], "bas": round(max(0, bas - 0.05), 2), "son": round(min(sure, son + 0.1), 2)}], False
    # adaylar: 0 = konuşma başı, 1..G = sessizlikler, G+1 = konuşma sonu
    noktalar = [(bas, bas, 0.0)] + [(a, b, b - a) for a, b in araliklar] + [(son, son, 0.0)]
    G = len(noktalar)
    konusma = max(0.1, (son - bas) - sum(b - a for a, b in araliklar))
    harf = [max(1, len(re.sub(r"\W", "", c))) for c in cumleler]
    hiz = konusma / sum(harf)  # saniye / harf

    def ceza(i, j, k):
        gercek = noktalar[j][0] - noktalar[i][1]
        # aradaki kısa sessizlikler (virgül) konuşma süresinden sayılmaz
        icteki = sum(noktalar[x][2] for x in range(i + 1, j))
        gercek = max(0.05, gercek - icteki)
        beklenen = max(0.2, harf[k] * hiz)
        return abs(math.log(gercek / beklenen)) * 1.2

    EKSI = -1e18
    dp = [[EKSI] * G for _ in range(n + 1)]
    geri = [[-1] * G for _ in range(n + 1)]
    dp[0][0] = 0.0
    for k in range(n):
        son_cumle = k == n - 1
        for i in range(G):
            if dp[k][i] == EKSI:
                continue
            for j in range(i + 1, G):
                if son_cumle and j != G - 1:
                    continue
                if not son_cumle and j == G - 1:
                    continue
                kazanc = min(noktalar[j][2], 1.2) * 2.0 - ceza(i, j, k)
                v = dp[k][i] + kazanc
                if v > dp[k + 1][j]:
                    dp[k + 1][j] = v
                    geri[k + 1][j] = i
    if dp[n][G - 1] == EKSI:
        # yeterli sessizlik yok: metin uzunluğuna göre orantılı böl
        toplam = sum(harf)
        t, sonuc = bas, []
        for c, h in zip(cumleler, harf):
            d = (son - bas) * h / toplam
            sonuc.append({"metin": c, "bas": round(t, 2), "son": round(t + d, 2)})
            t += d
        return sonuc, True
    sinirlar = [G - 1]
    for k in range(n, 0, -1):
        sinirlar.append(geri[k][sinirlar[-1]])
    sinirlar.reverse()
    sonuc = []
    cezalar = []
    for k in range(n):
        i, j = sinirlar[k], sinirlar[k + 1]
        b = noktalar[i][1] - (0.05 if i else 0.05)
        e = noktalar[j][0] + 0.12
        cezalar.append(ceza(i, j, k))
        sonuc.append({"metin": cumleler[k], "bas": round(max(0, b), 2), "son": round(min(sure, e), 2)})
    # sınırların çoğu kısa sessizliğe düştüyse ya da süreler metinle uyuşmuyorsa güvenme
    kisa = sum(1 for k in range(1, n) if noktalar[sinirlar[k]][2] < 0.18)
    yaklasik = kisa > max(1, n // 5) or (sum(cezalar) / n) > 0.55
    return sonuc, yaklasik


def yan_dosya(ses_yolu):
    return re.sub(r"\.[^./]+$", "", ses_yolu) + ".cumleler.json"


def yaz(ses_yolu, cumleler, baslik_sayisi=0):
    sonuc, yaklasik = hizala(ses_yolu, cumleler)
    for k in range(min(baslik_sayisi, len(sonuc))):
        sonuc[k]["baslik"] = True
    veri = {"ses": os.path.basename(ses_yolu), "cumleler": sonuc}
    if yaklasik:
        veri["yaklasik"] = True
    with open(yan_dosya(ses_yolu), "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
    return veri


# ---- toplu: notlardaki seslerin metnini bul ----
GOMME = re.compile(r"!\[\[([^\]|]+\.(?:m4a|mp3|wav))(?:\|[^\]]*)?\]\]")


def dosya_bul(ad):
    for kok, _, adlar in os.walk(V):
        if "/." in kok:
            continue
        if ad in adlar:
            return os.path.join(kok, ad)
    return None


def metinler():
    """(ses yolu, cümleler, başlık sayısı) üretir."""
    for kok, klasorler, adlar in os.walk(V):
        klasorler[:] = [k for k in klasorler if not k.startswith(".") and k != "_sistem"]
        for ad in adlar:
            if not ad.endswith(".md"):
                continue
            yol = os.path.join(kok, ad)
            t = open(yol, encoding="utf-8").read()
            for m in GOMME.finditer(t):
                ses = dosya_bul(os.path.basename(m.group(1)))
                if not ses or ses.endswith(".mp3"):
                    continue
                okuma = re.search(r'dv\.view\("_sistem/okuma",\s*\{(.*?)metin:\s*`(.*?)`', t, re.S)
                if okuma:
                    baslik = re.search(r"^# (.+)$", t, re.M)
                    tarih = re.search(r'tarih:\s*"([^"]+)"', okuma.group(1))
                    on = [x for x in [baslik and baslik.group(1).strip(), tarih and tarih.group(1).strip()] if x]
                    yield ses, on + cumlelere_bol(okuma.group(2)), len(on)
                    continue
                # Hören: sesten sonraki ilk "Metin" kutusu
                sonrasi = t[m.end() :]
                kutu = re.search(r"^> \[![\w-]+\][-+]?\s*Metin[^\n]*\n((?:>.*\n?)+)", sonrasi, re.M)
                if kutu and kutu.start() < 1500:
                    govde = "\n".join(re.sub(r"^>\s?", "", s) for s in kutu.group(1).splitlines())
                    yield ses, cumlelere_bol(govde), 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ses")
    p.add_argument("--metin")
    p.add_argument("--baslik", type=int, default=0, help="baştaki kaç cümle başlık (dikteye girmez)")
    p.add_argument("--toplu", action="store_true")
    p.add_argument("--yeniden", action="store_true")
    a = p.parse_args()
    if a.toplu:
        gorulen = set()
        for ses, cumleler, b in metinler():
            if ses in gorulen:
                continue
            gorulen.add(ses)
            if os.path.exists(yan_dosya(ses)) and not a.yeniden:
                continue
            v = yaz(ses, cumleler, b)
            print(("⚠️ yaklaşık " if v.get("yaklasik") else "✓ ") + os.path.relpath(ses, V), len(cumleler), "cümle")
        return
    if not a.ses or not a.metin:
        sys.exit("--ses ve --metin gerekli (ya da --toplu)")
    v = yaz(a.ses, cumlelere_bol(a.metin), a.baslik)
    print(("⚠️ yaklaşık eşleme: " if v.get("yaklasik") else "✓ ") + yan_dosya(a.ses), len(v["cumleler"]), "cümle")


if __name__ == "__main__":
    main()
