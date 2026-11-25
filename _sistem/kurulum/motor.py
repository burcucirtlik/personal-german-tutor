"""Motor ile kişisel katmanın sınırı: hangi dosya kime ait, konu notlarının varsayılan alanları, kişisel klasörün ilk hâli.
tasi.py (eski düzenden geçiş), baslat.py (ilk kurulum), yayin.py (herkese açık depo) ve test_tespit.py kullanır."""
import fnmatch
import json
import os
import re
import shutil
import sys

SISTEM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KOK = os.path.dirname(SISTEM)
sys.path.insert(0, SISTEM)
import kisisel as K  # noqa: E402

# Tamamen kişisel olan yerler (motorun parçası değil; yayına girmez, güncelleme dokunmaz)
KISISEL_KLASORLER = ["_kisisel", "05 Günlük", "06 Fehlerlog", "07 Modelltests", "08 Tempelhof", "10 Analiz"]
KISISEL_DESENLER = ["09 Drill/Mini *.md"]
# Hiçbir zaman yayına girmeyenler (yerel ayarlar, önbellek)
ATLA_ADLAR = {".DS_Store", ".git", ".trash", "__pycache__", "workspace.json", "workspace-mobile.json", "settings.local.json",
              "Başlıksız.canvas", "node_modules"}
ATLA_DESENLER = ["*.tmp", "*.pyc", ".obsidian/plugins/dataview/*"]

GRAMER_VARSAYILAN = {"durum": "kilitli", "kademe": "0", "seri": "0", "yoklama": "0/0/0", "ustalik": "0", "temiz_gun": "0",
                     "adim": "0", "son_calisma": "", "sonraki_tekrar": "", "bitis": ""}
DIGER_VARSAYILAN = {"ustalik": "0", "temiz_gun": "0", "adim": "0", "son_calisma": "", "sonraki_tekrar": ""}
SINAV_EK = {"asama": "1"}  # P-09 Schreiben basamağı

# Kişisel klasörün ilk hâli: dosya → şablon (motor içinde)
ILK_DOSYALAR = {
    "Profil.md": "_sistem/Şablonlar/Profil.md",
    "Hikâye.md": "_sistem/Şablonlar/Hikâye.md",
}
ILK_JSON = {
    "ilerleme.json": {"konular": {}},
    "kartlar/deste.json": {"kartlar": []},
    "kartlar/durum.json": {"kartlar": {}, "planlar": {}},
    "sozluk/sozluk.json": {"kelimeler": {}},
    "sozluk/tiklananlar.json": {"kelimeler": {}},
}


def kisisel_mi(goreli):
    goreli = goreli.replace(os.sep, "/")
    if any(goreli == k or goreli.startswith(k + "/") for k in KISISEL_KLASORLER):
        return True
    return any(fnmatch.fnmatch(goreli, d) for d in KISISEL_DESENLER)


def atlanir_mi(goreli):
    goreli = goreli.replace(os.sep, "/")
    if any(p in ATLA_ADLAR for p in goreli.split("/")):
        return True
    return any(fnmatch.fnmatch(goreli, d) for d in ATLA_DESENLER)


def frontmatter_bol(metin):
    m = re.match(r"---\n(.*?)\n---\n", metin, re.S)
    return (m.group(1).split("\n"), metin[m.end():]) if m else (None, metin)


def alanlar(satirlar):
    return {s.split(":", 1)[0]: s.split(":", 1)[1].split(" #")[0].strip()
            for s in satirlar if re.match(r"^[a-z_]+:", s)}


def varsayilanlar(fm):
    """Bir konu notunun kişisel alanlarının motor varsayılanı (yeni kullanıcı için)."""
    tur = fm.get("tur", "")
    if tur == "gramer":
        return dict(GRAMER_VARSAYILAN)
    onkosul = fm.get("onkosul", "")
    v = dict(DIGER_VARSAYILAN, durum="yeni" if onkosul in ("", "[]") else "kilitli")
    if "asama" in fm:
        v.update(SINAV_EK)
    return v


def konu_sifirla(yol):
    """Konu notunun kişisel alanlarını varsayılana çeker (sadece frontmatter). Önceki kişisel değerleri döndürür."""
    metin = open(yol, encoding="utf-8").read()
    satirlar, govde = frontmatter_bol(metin)
    if satirlar is None:
        return None
    fm = alanlar(satirlar)
    if fm.get("tur") not in K.KONU_TURLERI or not fm.get("id"):
        return None
    eski = {k: v for k, v in fm.items() if k in K.ILERLEME_ALANLARI}
    vs = varsayilanlar(fm)
    yeni = []
    for s in satirlar:
        ad = s.split(":", 1)[0]
        if ad in K.ILERLEME_ALANLARI and ad not in vs:
            continue  # sadece ilerleme sırasında yazılan alan (pencere, dar, on …)
        yeni.append(f"{ad}: {vs[ad]}".rstrip() if ad in vs else s)
    open(yol, "w", encoding="utf-8").write("---\n" + "\n".join(yeni) + "\n---\n" + govde)
    return fm["id"], eski


def kisisel_hazirla(kok=KOK):
    """Kişisel klasörü ve not klasörlerini eksikse şablonlardan oluşturur (var olana dokunmaz)."""
    olusan = []
    for k in KISISEL_KLASORLER:
        if not os.path.isdir(os.path.join(kok, k)):
            os.makedirs(os.path.join(kok, k))
            olusan.append(k + "/")
    for ad, sablon in ILK_DOSYALAR.items():
        hedef = os.path.join(kok, "_kisisel", ad)
        if not os.path.exists(hedef):
            shutil.copy(os.path.join(kok, sablon), hedef)
            olusan.append("_kisisel/" + ad)
    for ad, veri in ILK_JSON.items():
        hedef = os.path.join(kok, "_kisisel", ad)
        if not os.path.exists(hedef):
            os.makedirs(os.path.dirname(hedef), exist_ok=True)
            with open(hedef, "w", encoding="utf-8") as f:
                json.dump(veri, f, ensure_ascii=False, indent=1)
            olusan.append("_kisisel/" + ad)
    return olusan
