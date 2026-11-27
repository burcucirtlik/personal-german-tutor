"""Kişisel katman: kullanıcının bütün ilerlemesi ve kayıtları `_kisisel/` klasöründe ve not klasörlerinde
(05 Günlük, 06 Fehlerlog, 07 Modelltests, 08 Tempelhof, 10 Analiz) durur. Motor dosyaları (kurallar, konu notları,
çekirdek desteler, sözlük, ekranlar) kullanımla değişmez; güncelleme bunları kişisel veriye dokunmadan yeniler.

  _kisisel/ilerleme.json        konu ilerlemesi: {"konular": {"A1-02": {"durum": "ogreniliyor", "kademe": "4", …}}}
                                Değerler frontmatter'daki gibi metindir. Konu notunun frontmatter'ı varsayılandır;
                                bu dosyadaki alanlar onun üstüne yazılır (ilerleme.py, tespit.py, dashboard).
  _kisisel/Profil.md            ad, sınav tarihi, seviye tespiti
  _kisisel/Hikâye.md            Tempelhof hikâye kaydı
  _kisisel/ilerleme.log         ilerleme.py'nin günlük kaydı
  _kisisel/kartlar/deste.json   kişisel kartlar ve çekirdek kartlara kişisel ekler (aynı id → alanlar üstüne yazılır)
  _kisisel/kartlar/durum.json   kart kaydırma durumu (ekran yazar)
  _kisisel/sozluk/sozluk.json   kişisel sözlük ekleri (Claude ekler; aynı kelime → bu kazanır)
  _kisisel/sozluk/tiklananlar.json, sinyal.json
  _kisisel/drill/               mini drill setleri ve bütün drill durumları
  _kisisel/ses/                 dinleme sayıları, dikte sonuçları
  _kisisel/yedek/<gün>/         arayüzün günlük JSON yedekleri
"""
import json
import os

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KISISEL = os.path.join(KOK, "_kisisel")
ILERLEME_YOLU = os.path.join(KISISEL, "ilerleme.json")
# Konu notlarında kullanıcıya ait (kullanımla değişen) alanlar. Geri kalanı (id, hat, sira, alt, onkosul …) motordur.
ILERLEME_ALANLARI = ("durum", "kademe", "seri", "yoklama", "ustalik", "temiz_gun", "adim", "son_calisma",
                     "sonraki_tekrar", "bitis", "pencere", "onarim_bas", "on", "yoklama_alt", "dar", "asama", "yayilim")
KONU_TURLERI = ("gramer", "kelime", "sinav")
KONU_KLASORLERI = ("03 Grammatik", "02 Wortschatz", "01 Sınav/Teile")


def yol(*p):
    return os.path.join(KISISEL, *p)


def kok(*p):
    return os.path.join(KOK, *p)


def json_oku(p, varsayilan):
    if not os.path.exists(p):
        return varsayilan
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def json_yaz(p, veri, indent=1):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=indent)
    os.replace(tmp, p)


# ---------- konu ilerlemesi ----------
_ilerleme = {}  # vault kökü → {konu id: {alan: metin}}


def vault_koku(dosya):
    """Bir dosyanın bağlı olduğu vault kökü (içinde _sistem olan ilk üst klasör). Testler geçici vault kullanır."""
    d = os.path.dirname(os.path.abspath(dosya))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "_sistem")):
            return d
        d = os.path.dirname(d)
    return KOK


def ilerleme_oku(kok=KOK):
    """{konu id: {alan: metin}} (önbellekli)."""
    if kok not in _ilerleme:
        _ilerleme[kok] = json_oku(os.path.join(kok, "_kisisel", "ilerleme.json"), {"konular": {}}).get("konular", {})
    return _ilerleme[kok]


def ilerleme_yaz(kid, alanlar, kok=KOK):
    """Bir konunun kişisel alanlarını (tamamını) yazar; boş sözlük konuyu siler."""
    p = os.path.join(kok, "_kisisel", "ilerleme.json")
    veri = json_oku(p, {"konular": {}})
    konular = veri.setdefault("konular", {})
    if alanlar:
        konular[kid] = {k: alanlar[k] for k in ILERLEME_ALANLARI if k in alanlar}
    else:
        konular.pop(kid, None)
    veri["konular"] = dict(sorted(konular.items()))
    json_yaz(p, veri)
    _ilerleme[kok] = veri["konular"]


# ---------- desteler ve sözlük (motor + kişisel) ----------
def deste_oku(v=KOK):
    """Çekirdek deste + kişisel kartlar. Kişisel dosyada aynı id varsa alanları çekirdeğin üstüne yazılır."""
    kartlar = {k["id"]: dict(k) for k in json_oku(os.path.join(v, "_sistem", "kartlar", "deste.json"), {"kartlar": []})["kartlar"]}
    for k in json_oku(os.path.join(v, "_kisisel", "kartlar", "deste.json"), {"kartlar": []}).get("kartlar", []):
        kartlar[k["id"]] = {**kartlar.get(k["id"], {}), **k}
    return list(kartlar.values())


def kisisel_deste():
    return json_oku(yol("kartlar", "deste.json"), {"kartlar": []})


def kisisel_deste_yaz(veri):
    json_yaz(yol("kartlar", "deste.json"), veri)


def sozluk_oku():
    s = dict(json_oku(kok("_sistem", "sozluk", "sozluk.json"), {"kelimeler": {}})["kelimeler"])
    s.update(json_oku(yol("sozluk", "sozluk.json"), {"kelimeler": {}}).get("kelimeler", {}))
    return s
