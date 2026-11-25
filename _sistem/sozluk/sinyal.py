"""Tıklama sinyali: hangi kelimelere bakıldı, hangilerine artık bakılmıyor, kartlarla nasıl örtüşüyor.

Kullanım (vault kökünden):  python3 -I _sistem/sozluk/sinyal.py [YYYY-MM-DD]
Okur:  _kisisel/sozluk/tiklananlar.json (sözlük ekranı yazar), deste (_sistem + _kisisel) + _kisisel/kartlar/durum.json,
       tamamlanan günlerin içeriği (05 Günlük/veri/<gün>.json, 08 Tempelhof/<gün> *.md)
Yazar: _kisisel/sozluk/sinyal.json (dashboard, /antrenman ve /analiz okur). Özel isim, artikel ve zamirler `ozel: true` işaretlenir, özete girmez.

Durumlar (güçlüden zayıfa; kart her zaman en güçlü sinyaldir):
  ogrenildi     kelimenin kartı öğrenildi (iki yön yeşil)
  kartta_takili kartın bir yönü kırmızı: tıklamasan da öğrenilmiş sayılmaz
  istek         balonda "⭐ Karta ekle" dendi, kartı yok: isim/fiil/sıfatsa /antrenman yalın biçimiyle ekler
  biliyor       son tıklamadan sonra balonda "✓ Biliyorum" dendi: sinyal sayılmaz, öne alınmaz
  bakmiyor     son tıklamadan sonra en az 2 tamamlanan günde metinde geçti ve tıklanmadı
  sik_bakiyor   en az 2 farklı günde ya da en az 3 kez tıklandı, son tıklama 7 gün içinde
  bakti         bir kez bakıldı, henüz bir şey söylemiyor
"""
import datetime
import glob
import json
import os
import re
import sys

V = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUGUN = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat()
KELIME = re.compile(r"[A-Za-zÄÖÜäöüß]+")


def oku(yol, varsayilan):
    try:
        return json.load(open(os.path.join(V, yol), encoding="utf-8"))
    except (OSError, ValueError):
        return varsayilan


def gun_ekle(iso, n):
    return (datetime.date.fromisoformat(iso) + datetime.timedelta(days=n)).isoformat()


def taban(s):
    s = re.sub(r"\s*\(.*?\)", "", str(s or "")).split(",")[0].strip()
    return re.sub(r"^(der|die|das)\s+", "", s, flags=re.I).lower()


def gun_metni(gun):
    """O günün antrenmanında ve günlüğünde geçen Almanca kelime biçimleri (Türkçe çeviri soruları hariç)."""
    parcalar = []
    veri = oku(f"05 Günlük/veri/{gun}.json", {})
    for b in veri.get("bolumler", []):
        parcalar.append(b.get("metin", ""))
        parcalar += [i.get("metin", "") for i in (b.get("pano") or {}).get("ilanlar", [])]
        for s in b.get("sorular", []):
            if s.get("tip") != "ceviri":
                parcalar.append(s.get("metin", ""))
            parcalar += s.get("secenekler", []) + s.get("kelimeler", [])
    for yol in glob.glob(os.path.join(V, "08 Tempelhof", f"{gun} *.md")):
        t = open(yol, encoding="utf-8").read()
        m = re.search(r"metin: `(.*?)`", t, flags=re.S)
        if m:
            parcalar.append(m.group(1))
    return {w.lower() for p in parcalar for w in KELIME.findall(str(p))}


tik = oku("_kisisel/sozluk/tiklananlar.json", {"kelimeler": {}}).get("kelimeler", {})
soz = oku("_sistem/sozluk/sozluk.json", {"kelimeler": {}}).get("kelimeler", {})
soz.update(oku("_kisisel/sozluk/sozluk.json", {"kelimeler": {}}).get("kelimeler", {}))
_kartlar = {k["id"]: k for k in oku("_sistem/kartlar/deste.json", {"kartlar": []})["kartlar"]}
for _k in oku("_kisisel/kartlar/deste.json", {"kartlar": []}).get("kartlar", []):
    _kartlar[_k["id"]] = {**_kartlar.get(_k["id"], {}), **_k}
deste = [k for k in _kartlar.values() if k["deste"] == "kelime" and not k.get("arsiv")]
kart_durum = oku("_kisisel/kartlar/durum.json", {"kartlar": {}}).get("kartlar", {})
kart_taban = {taban(k["de"]): k for k in deste}

tamam = []
for yol in glob.glob(os.path.join(V, "05 Günlük", "*.md")):
    ad = os.path.basename(yol)[:10]
    if re.fullmatch(r"\d{4}-\d\d-\d\d", ad) and ad <= BUGUN and "durum: tamamlandi" in open(yol, encoding="utf-8").read():
        tamam.append(ad)
tamam = sorted(set(tamam))
metinler = {g: gun_metni(g) for g in tamam}

def ozel(e):
    """özel isim, artikel ya da zamir: analizde ve dashboard'da sayılmaz"""
    return str(e.get("karta_eklendi", "")).startswith("atlandı") or bool(re.search(r"\((isim|soyadı|.*artikel|.*zamir)", str(e.get("tr") or "")))


kelimeler, ozet = {}, {}
hafta_bas = gun_ekle(BUGUN, -6)
hafta_tik = 0
for w, e in tik.items():
    gunler = e.get("gunler") or {}
    tik_gunleri = sorted(gunler) if gunler else sorted({e.get("ilk"), e.get("son")} - {None})
    son = e.get("son") or (tik_gunleri[-1] if tik_gunleri else None)
    hafta_tik += sum(n for g, n in gunler.items() if g >= hafta_bas) if gunler else (e.get("sayi", 0) if (e.get("ilk") or "") >= hafta_bas else 0)
    kart = kart_taban.get(taban(e.get("kok") or (soz.get(w) or {}).get("kok"))) or kart_taban.get(w)
    kd = kart_durum.get(kart["id"], {}) if kart else {}
    yonler = [kd.get(y, {}).get("d") for y in ("de_tr", "tr_de")]
    maruz = [g for g in tamam if son and g > son and w in metinler[g]]
    if kart and all(d == "yesil" for d in yonler):
        durum = "ogrenildi"
    elif kart and "kirmizi" in yonler:
        durum = "kartta_takili"
    elif e.get("istek") and not kart:
        durum = "istek"
    elif e.get("biliyor") and e["biliyor"] >= (son or ""):
        durum = "biliyor"
    elif len(maruz) >= 2:
        durum = "bakmiyor"
    elif (len(tik_gunleri) >= 2 or e.get("sayi", 0) >= 3) and son and son >= gun_ekle(BUGUN, -7):
        durum = "sik_bakiyor"
    else:
        durum = "bakti"
    if not ozel(e):
        ozet[durum] = ozet.get(durum, 0) + 1
    kelimeler[w] = {
        "tr": e.get("tr"), "sayi": e.get("sayi", 0), "tik_gun": len(tik_gunleri), "ilk": e.get("ilk"), "son": son,
        "tiklamadan_gecti": maruz, "kart": kart["id"] if kart else None, "kart_de": kart["de"] if kart else None,
        "kart_seviye": kart.get("seviye") if kart else None, "durum": durum,
        "ozel": ozel(e),
    }

cikti = {
    "guncelleme": BUGUN,
    "aciklama": "sinyal.py üretir; elle düzenleme. Durumlar dosyanın başındaki açıklamada.",
    "ozet": ozet,
    "hafta": {"baslangic": hafta_bas, "tiklama": hafta_tik,
              "kelime": sum(1 for e in tik.values() if (e.get("son") or "") >= hafta_bas and not ozel(e))},
    "kelimeler": dict(sorted(kelimeler.items(), key=lambda x: (-x[1]["sayi"], x[0]))),
}
os.makedirs(os.path.join(V, "_kisisel", "sozluk"), exist_ok=True)
json.dump(cikti, open(os.path.join(V, "_kisisel/sozluk/sinyal.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({"ozet": ozet, "hafta": cikti["hafta"]}, ensure_ascii=False))
