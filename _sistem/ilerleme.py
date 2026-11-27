#!/usr/bin/env python3
"""Puanlama betiği: bir günün sonuçlarından konu ilerlemesini hesaplar (Kurallar.md → Puanlama betiği).

Kullanım:
  python3 -I _sistem/ilerleme.py 2026-11-12          # kuru çalışma: ne değişeceğini yazar
  python3 -I _sistem/ilerleme.py 2026-11-12 --yaz    # kişisel ilerlemeyi (_kisisel/ilerleme.json) günceller
  --zorla   aynı gün daha önce yazıldıysa yine de yaz
  python3 -I _sistem/ilerleme.py alt                 # odak, ön ve onarım konularının alt beceri durumu ve son hataları
  python3 -I _sistem/ilerleme.py sinir               # üretim sınırı ve anlama sınırı (hangi yapı nerede geçebilir)

Girdi: 05 Günlük/veri/<gün>.json içindeki `bolumler` ve Claude'un yazdığı `sonuc`.
İlerleme `_kisisel/ilerleme.json`'a yazılır (kisisel.py); konu notları motor dosyasıdır, kullanımla değişmez.
"""
import datetime as dt
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kisisel as K  # noqa: E402

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENEL = {"yazim", "kelime-eksik", "ingilizce-kelime", "kalip-ifade", "artikel-kelime", "plural-kelime"}
PENCERE, PENCERE_GEC = 12, 10        # kademe geçişi: son 12 yapı sorusunda en az 10 doğru
ONARIM_PENCERE, ONARIM_GEC = 10, 8   # onarımdan çıkış: son 10 soruda en az 8 doğru
PENCERE_DUS = 8                      # düşüş için pencerede en az bu kadar soru olmalı
TAKILI = 2                           # pencerede aynı alt beceride bu kadar hata geçişi durdurur
DAR_ESIK = 8                         # dar onarım: dolu pencerede (K4+) en az bu kadar doğru
DAR_EN_FAZLA = 2                     # dar onarım: hatalar en fazla bu kadar alt beceride toplanmış olmalı
DAR_PENCERE, DAR_GEC = 6, 5          # dar onarımdan çıkış: dar alt becerilerin son 6 sorusunda en az 5 doğru
SEANS_TAVAN = 8                      # süre tavanı: odakta bu kadar seansı geçen konu ...
TAVAN_ORT = 70                       # ... son 3 seansın yapı ortalaması en az bu kadarsa odaktan çıkar
TAVAN_KADEME = 3                     # ... ve en az bu kademedeyse (üretim kanıtı)
BITIS_KADEME = 3                     # son kademe: geçilince konu biter (Kurallar → Kademeler)
YAYILIM_GUN = 14                     # bitmiş konu bu kadar gün her gün genele yayılır
TEKRAR_EN_AZ = 3                     # bitmiş konu ancak en az bu kadar tekrar sorusuyla onarıma düşer
ARALIK = {0: 1, 1: 3, 2: 7, 3: 14}  # adim → gün; 4+ → 30
TEIL_VARSAYILAN = {"Hören": "P-06", "Lesen": "P-01", "Schreiben": "P-09"}
LOG = K.yol("ilerleme.log")


def yol(*p):
    return os.path.join(KOK, *p)


def gun_ekle(g, n):
    return (dt.date.fromisoformat(g) + dt.timedelta(days=n)).isoformat()


def aralik(adim):
    return ARALIK.get(adim, 30)


# ---------- frontmatter + kişisel ilerleme ----------
class Not:
    """Bir notun alanları. Konu notlarında kişisel alanlar (K.ILERLEME_ALANLARI) `_kisisel/ilerleme.json`'dan gelir
    ve oraya yazılır; frontmatter'daki değerleri sadece varsayılandır. Diğer notlarda (Profil) her şey frontmatter'dır."""

    def __init__(self, dosya):
        self.dosya = dosya
        self.metin = open(dosya, encoding="utf-8").read()
        m = re.match(r"---\n(.*?)\n---\n?", self.metin, re.S)
        if not m:
            raise ValueError(f"frontmatter yok: {dosya}")
        self.satirlar = m.group(1).split("\n")
        self.govde = self.metin[m.end():]
        self.ilk = {}
        for s in self.satirlar:
            mm = re.match(r"^([a-z_]+):\s*(.*)$", s)
            if mm:
                self.ilk[mm.group(1)] = mm.group(2).split(" #")[0].strip()
        self.fm = dict(self.ilk)  # diskteki frontmatter
        self.konu = self.ilk.get("tur") in K.KONU_TURLERI and bool(self.ilk.get("id"))
        self.kok = K.vault_koku(dosya)
        if self.konu:
            self.ilk.update(K.ilerleme_oku(self.kok).get(self.ilk["id"], {}))
        self.yeni = dict(self.ilk)

    def __getitem__(self, k):
        return self.yeni.get(k, "")

    def __setitem__(self, k, v):
        self.yeni[k] = "" if v is None else str(v)

    def sil(self, k):
        self.yeni.pop(k, None)

    def sayi(self, k):
        try:
            return int(float(self.yeni.get(k) or 0))
        except ValueError:
            return 0

    def liste(self, k):
        v = self.yeni.get(k, "").strip()
        if not (v.startswith("[") and v.endswith("]")):
            return []
        try:  # tırnaklı liste: içinde virgül olabilir ("-ung, -heit, -keit → die")
            return [str(x) for x in json.loads(v)]
        except ValueError:
            return [x.strip().strip('"') for x in re.findall(r'\s*("[^"]*"|[^,\[\]]+)', v[1:-1]) if x.strip()]

    def degisen(self):
        anahtarlar = list(dict.fromkeys(list(self.ilk) + list(self.yeni)))
        return [(k, self.ilk.get(k), self.yeni.get(k)) for k in anahtarlar if self.ilk.get(k) != self.yeni.get(k)]

    def yaz(self):
        if self.konu:
            kisisel = {k: self.yeni[k] for k in K.ILERLEME_ALANLARI if k in self.yeni}
            if kisisel != {k: self.ilk[k] for k in K.ILERLEME_ALANLARI if k in self.ilk}:
                K.ilerleme_yaz(self.yeni["id"], kisisel, self.kok)
            # frontmatter'a sadece motor alanları (alt, onkosul …) yazılır; kişisel alanların varsayılanı olduğu gibi kalır
            hedef = {k: v for k, v in self.yeni.items() if k not in K.ILERLEME_ALANLARI}
            hedef.update({k: v for k, v in self.fm.items() if k in K.ILERLEME_ALANLARI})
        else:
            hedef = self.yeni
        if hedef == self.fm:
            return
        cikti, gorulen = [], set()
        for s in self.satirlar:
            mm = re.match(r"^([a-z_]+):", s)
            if mm and mm.group(1) in self.fm:
                k = mm.group(1)
                gorulen.add(k)
                if k not in hedef:
                    continue
                if hedef[k] != self.fm[k]:
                    yorum = re.search(r"\s+#.*$", s)
                    s = f"{k}: {hedef[k]}".rstrip() + (yorum.group(0) if yorum else "")
            cikti.append(s)
        for k, v in hedef.items():
            if k not in gorulen and k not in self.fm:
                cikti.append(f"{k}: {v}".rstrip())
        tmp = self.dosya + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write("---\n" + "\n".join(cikti) + "\n---\n" + self.govde)
        os.replace(tmp, self.dosya)


def notlari_yukle():
    notlar = {}
    for klasor in ("03 Grammatik", "02 Wortschatz", "01 Sınav/Teile"):
        for d in glob.glob(yol(klasor, "*.md")):
            n = Not(d)
            if n["id"]:
                notlar[n["id"]] = n
    return notlar


_ETIKET_KONU = None


def etiket_konu():
    """Önbellekli etiket → bağlı konu."""
    global _ETIKET_KONU
    if _ETIKET_KONU is None:
        _ETIKET_KONU = hata_konulari()
    return _ETIKET_KONU


def hata_konulari():
    """etiket → bağlı konu (06 Fehlerlog notlarındaki `konu` alanı)."""
    sonuc = {}
    for d in glob.glob(yol("06 Fehlerlog", "*.md")):
        t = open(d, encoding="utf-8").read()
        e = re.search(r"^etiket:\s*(\S+)", t, re.M)
        k = re.search(r"^konu:\s*(\S+)", t, re.M)
        if e and k:
            sonuc[e.group(1)] = k.group(1)
    return sonuc


def onarimda(n):
    """Onarımdaki konu: bitmiş konu (onarım) ya da dar onarım. Hattın odağı olamaz."""
    return n["durum"] == "zayif" and bool(n["dar"] or n["bitis"] or n["yoklama"] == "gecti")


def liste_yaz(xs):
    return "[" + ", ".join(f'"{a}"' for a in xs) + "]"


def gecmis_yukle(gun=None):
    """Puanlanmış günler, yeniden eskiye: [(gün, veri)]. `gun` verilirse ondan öncekiler."""
    cikti = []
    for d in glob.glob(yol("05 Günlük", "veri", "*.json")):
        ad = os.path.basename(d)
        if ad.endswith(".cevap.json") or not re.match(r"\d{4}-\d{2}-\d{2}\.json$", ad):
            continue
        g = ad[:10]
        if gun and g >= gun:
            continue
        v = json.load(open(d, encoding="utf-8"))
        if v.get("sonuc"):
            cikti.append((g, v))
    return sorted(cikti, key=lambda x: x[0], reverse=True)


def pencere_ozeti(w):
    """w: [(gün, alt, yapı)] → (doğru, soru, gün sayısı, takılan alt beceriler)."""
    hata = {}
    for _, alt, y in w:
        if not y and alt:
            hata[alt] = hata.get(alt, 0) + 1
    return sum(y for _, _, y in w), len(w), len({g for g, _, _ in w}), sorted(a for a, c in hata.items() if c >= TAKILI)


# ---------- puan yardımcıları ----------
def baska_konunun(r, konu):
    """Hata başka bir konunun mu? (Kurallar → Başka konunun hatası.) Etiketin bağlı konusu ölçülen konu değilse
    hata o konunun hanesine yazılmaz: Fehlerlog'a, hata etiketi kuralına ve mini drill'e gider."""
    e = (r or {}).get("etiket")
    if not konu or not e or e in GENEL:
        return False
    k = etiket_konu().get(e)
    return bool(k) and k != konu


def yapi(r, konu=None):
    """Ölçülen konunun yapısı doğru mu (1/0)? (Kurallar → Kademe geçişi: konuyla alakasız hata sayılmaz.)
    1) Hata başka konunun etiketini taşıyorsa → 1.  2) sonuc.yapi yazılmışsa o.
    3) Genel etiket (yazım, büyük harf, kelime, artikel/çoğul kelime bilgisi) → 1, puanı ne olursa olsun;
       yapı cevapta hiç görünmüyorsa /kontrol bunu `yapi: 0` ile açıkça yazar.  4) Tam puan → 1, değilse 0."""
    if r is None:
        return 0
    if baska_konunun(r, konu):
        return 1
    if "yapi" in r:
        return 1 if r["yapi"] else 0
    if r.get("etiket") in GENEL:
        return 1
    return 1 if (r.get("puan", 0) or 0) >= 1 else 0


def yapi_hatasi(r, konu=None):
    """Yoklamayı bozan dilbilgisi hatası mı? Genel etiketli ve yapısı görünmeyen cevap hata değildir."""
    if yapi(r, konu):
        return False
    return (r or {}).get("etiket") not in GENEL


def hata_etiketleri(r):
    """Cevaptaki yapı hatası etiketleri (genel etiketler hariç): `etiket` ve varsa `etiketler`.
    Hata, ölçülen konunun hanesine yazılmasa da (başka konunun hatası) etiketine sayılır."""
    r = r or {}
    es = [r.get("etiket")] + list(r.get("etiketler") or [])
    if (r.get("puan", 0) or 0) >= 1 and not r.get("etiketler"):
        return []
    return [e for e in dict.fromkeys(es) if e and e not in GENEL]


def ustalik(n, seans):
    eski = n.sayi("ustalik")
    return seans if (not n["son_calisma"] and eski == 0) else round(0.6 * eski + 0.4 * seans)


class Hesap:
    def __init__(self, gun, notlar, kisa):
        self.gun = gun
        self.notlar = notlar
        self.kisa = kisa
        self.olaylar = []
        self.uyarilar = []
        self.gecmis = gecmis_yukle(gun)

    # --- kayan pencere ---
    def odak_penceresi(self, n, kademe, sorular, sonuc):
        """Bu kademede kesintisiz sorulan son PENCERE yapı sorusu (bugün dahil), yeniden eskiye."""
        kid = n["id"]
        w = [(self.gun, q.get("alt"), yapi(sonuc.get(q["id"]), kid)) for q in reversed(sorular)]
        for g, v in self.gecmis:
            if len(w) >= PENCERE:
                break
            bs = [b for b in v["bolumler"] if b.get("rol") in ("odak", "on") and b.get("konu") == n["id"]]
            if not bs:
                continue
            if any(b.get("kademe") != kademe for b in bs):
                break  # kademe o gün farklıydı: pencere burada başlar
            for b in reversed(bs):
                w += [(g, q.get("alt"), yapi(v["sonuc"].get(q["id"]), kid)) for q in reversed(b["sorular"])]
        return w[:PENCERE]

    def onarim_penceresi(self, n, sorular, sonuc):
        """Onarım başladığından beri sorulan son ONARIM_PENCERE tekrar sorusu (bugün dahil)."""
        bas, kid = n["onarim_bas"] or self.gun, n["id"]
        w = [(self.gun, q.get("alt"), yapi(sonuc.get(q["id"]), kid)) for q in reversed(sorular)]
        for g, v in self.gecmis:
            if len(w) >= ONARIM_PENCERE or g < bas:
                break
            for b in reversed(v["bolumler"]):
                if b.get("rol") != "tekrar":
                    continue
                w += [(g, q.get("alt"), yapi(v["sonuc"].get(q["id"]), kid)) for q in reversed(b["sorular"])
                      if (q.get("konu") or b.get("konu")) == n["id"]]
        return w[:ONARIM_PENCERE]

    def kapsanmayan_alt(self, n, sorular, sonuc):
        """K4–K5'te doğru kanıtı olmayan (kenar olmayan) alt beceriler. Konu ancak hepsi kapsanınca biter."""
        kid = n["id"]
        var = {q.get("alt") for q in sorular if q.get("alt") and yapi(sonuc.get(q["id"]), kid)}
        for _, v in self.gecmis:
            for b in v["bolumler"]:
                if b.get("rol") == "odak" and b.get("konu") == kid and (b.get("kademe") or 0) >= 4:
                    var |= {q.get("alt") for q in b["sorular"] if q.get("alt") and yapi(v["sonuc"].get(q["id"]), kid)}
        return [a for a in n.liste("alt") if not a.startswith("kenar:") and a not in var]

    def dar_adayi(self, n, w, sorular, sonuc):
        """Dar onarım şartları (Kurallar → Dar onarım). Sağlanıyorsa hatalı alt becerileri, yoksa (None, neden) döner."""
        wd, wn, wg, _ = pencere_ozeti(w)
        if wn < PENCERE or wd < DAR_ESIK or wg < 2:
            return None, f"pencere {wd}/{wn}, {wg} gün"
        hatalar = [alt for _, alt, y in w if not y]
        if not hatalar:
            return None, "hata yok"
        if any(a is None for a in hatalar):
            return None, "pencerede `alt` alanı olmayan hata var"
        hatali = sorted(set(hatalar))
        if len(hatali) > DAR_EN_FAZLA:
            return None, f"hatalar {len(hatali)} alt beceriye dağılmış"
        bilinmeyen = [a for a in hatali if a not in n.liste("alt")]
        if bilinmeyen:
            return None, f"alt listesinde olmayan alt beceri: {', '.join(bilinmeyen)}"
        eksik = [a for a in self.kapsanmayan_alt(n, sorular, sonuc) if a not in hatali]
        if eksik:
            return None, f"K4–K5'te kanıtı olmayan alt beceri: {', '.join(eksik)}"
        diger = next((k for k in self.hat(n) if k is not n and k["dar"]), None)
        if diger:
            return None, f"hatta zaten dar onarımda bir konu var ({diger['id']})"
        return hatali, ""

    def dar_penceresi(self, n, dar, sorular, sonuc):
        """Dar onarım başından beri dar alt becerilere sorulan son DAR_PENCERE soru (bugün dahil), yeniden eskiye."""
        bas, kid = n["onarim_bas"] or self.gun, n["id"]
        w = [(self.gun, q.get("alt"), yapi(sonuc.get(q["id"]), kid)) for q in reversed(sorular) if q.get("alt") in dar]
        for g, v in self.gecmis:
            if len(w) >= DAR_PENCERE or g < bas:
                break
            for b in reversed(v["bolumler"]):
                if b.get("rol") != "tekrar":
                    continue
                w += [(g, q.get("alt"), yapi(v["sonuc"].get(q["id"]), kid)) for q in reversed(b["sorular"])
                      if (q.get("konu") or b.get("konu")) == n["id"] and q.get("alt") in dar]
        return w[:DAR_PENCERE]

    def dar_tekrar(self, n, sorular, sonuc, kp, nn):
        dar = n.liste("dar")
        genis = [q["alt"] for q in sorular if q.get("alt") and q["alt"] not in dar and yapi_hatasi(sonuc.get(q["id"]), n["id"])]
        if genis:
            dar = dar + sorted(set(genis))
            n["dar"] = liste_yaz(dar)
            self.olay(n["id"], f"dar onarım genişledi: {', '.join(sorted(set(genis)))} de hatalı")
        w = self.dar_penceresi(n, dar, sorular, sonuc)
        wd, wn, wg, _ = pencere_ozeti(w)
        dogru_alt = {alt for _, alt, y in w if y}
        eksik = [a for a in dar if a not in dogru_alt]
        if not genis and wn >= DAR_PENCERE and wd >= DAR_GEC and wg >= 2 and not eksik:
            n["durum"], n["adim"], n["kademe"], n["bitis"] = "temiz", 1, 5, self.gun
            n["sonraki_tekrar"] = gun_ekle(self.gun, aralik(1))
            for alan in ("dar", "pencere", "onarim_bas"):
                n.sil(alan)
            self.olay(n["id"], f"dar onarım · yapı %{kp} ({nn} soru) · dar pencere {wd}/{wn} → BİTTİ")
            return
        n["pencere"], n["sonraki_tekrar"] = f"{wd}/{wn}", gun_ekle(self.gun, 1)
        ek = f" · doğru kanıtı olmayan: {', '.join(eksik)}" if eksik else ""
        self.olay(n["id"], f"dar onarım · yapı %{kp} ({nn} soru) · dar pencere {wd}/{wn}, {wg} gün (çıkış: {DAR_GEC}/{DAR_PENCERE}, 2 gün, her dar alt beceride doğru){ek}")
        if nn < 3:
            self.uyarilar.append(f"{n['id']}: dar onarımda {nn} soru sorulmuş (kural en az 3)")
        if not any(q.get("alt") and q["alt"] not in dar for q in sorular):
            self.uyarilar.append(f"{n['id']}: dar onarımda dar dışı kontrol sorusu yok (kural 1)")

    def odak_seanslari(self, n, sorular, sonuc):
        """Konunun odak seansları (bugün dahil), yeniden eskiye: [yapı yüzdesi]."""
        kid = n["id"]
        s = [round(100 * sum(yapi(sonuc.get(q["id"]), kid) for q in sorular) / len(sorular))]
        for _, v in self.gecmis:
            qs = [(q, v["sonuc"].get(q["id"])) for b in v["bolumler"] if b.get("rol") == "odak" and b.get("konu") == kid for q in b["sorular"]]
            if qs:
                s.append(round(100 * sum(yapi(r, kid) for _, r in qs) / len(qs)))
        return s

    def kirmizi_alt(self, n, sorular, sonuc):
        """Son 3 denemesinde yapı hatası olan (kenar olmayan) alt beceriler; odak ve tekrar soruları, bugün dahil."""
        kid, deneme = n["id"], {}
        for q in sorular:
            if q.get("alt"):
                deneme.setdefault(q["alt"], []).append(yapi(sonuc.get(q["id"]), kid))
        for _, v in self.gecmis:
            for b in v["bolumler"]:
                if b.get("rol") not in ("odak", "tekrar"):
                    continue
                for q in b["sorular"]:
                    if (q.get("konu") or b.get("konu")) == kid and q.get("alt") and q.get("tip") != "yazma":
                        deneme.setdefault(q["alt"], []).append(yapi(v["sonuc"].get(q["id"]), kid))
        return [a for a in n.liste("alt") if not a.startswith("kenar:") and 0 in deneme.get(a, [])[:3]]

    def bitir(self, n, metin):
        """Konu biter ve genele yayılır (Kurallar → Yayılım): YAYILIM_GUN boyunca her gün tekrarda ve arka planda."""
        n["durum"], n["kademe"], n["adim"], n["bitis"] = "temiz", BITIS_KADEME, 0, self.gun
        n["sonraki_tekrar"], n["yayilim"] = gun_ekle(self.gun, 1), gun_ekle(self.gun, YAYILIM_GUN)
        for alan in ("pencere", "on", "dar", "onarim_bas"):
            n.sil(alan)
        self.olay(n["id"], f"{metin} → BİTTİ, {n['yayilim']} tarihine kadar genele yayılıyor")
        self.odak_yap(n)

    def olay(self, kid, metin):
        self.olaylar.append((kid, metin))

    # --- hat yardımcıları ---
    def hat(self, n):
        ks = [x for x in self.notlar.values() if x["tur"] == "gramer" and x["hat"] == n["hat"]]
        return sorted(ks, key=lambda x: x.sayi("sira"))

    def sonraki(self, n):
        ks = self.hat(n)
        i = ks.index(n)
        return next((k for k in ks[i + 1:] if k["durum"] != "temiz" and not onarimda(k)), None)

    def on_konu(self, n):
        return next((k for k in self.hat(n) if k["on"] == "true" and k is not n), None)

    def odak_yap(self, n):
        """Hattın sıradaki konusunu odak yap (ön konu varsa o kaldığı yerden sürer)."""
        s = self.sonraki(n)
        if not s:
            self.olay(n["id"], f"{n['hat']} hattı bitti")
            return
        on = s["on"] == "true"
        s.sil("on")
        y = s["yoklama"] or "0/0/0"
        s["durum"] = "ogreniliyor"
        if not on and not y.startswith("hata") and y != "gecti":
            s["kademe"] = 0  # yoklamada başlar
        elif s.sayi("kademe") < 1:
            s["kademe"] = 1
        self.olay(s["id"], f"odak oldu (K{s.sayi('kademe')}{', ön konudan' if on else ''})")

    def on_kontrol(self, odak):
        """Odak K4+ → sıradaki (yoklaması bozuk) konu ön konu olur; odak K4 altı → ön konu durur."""
        mevcut = self.on_konu(odak)
        if odak["durum"] == "temiz" or onarimda(odak):
            return
        kd = odak.sayi("kademe")
        if kd >= BITIS_KADEME and not mevcut:
            s = self.sonraki(odak)
            if s and (s["yoklama"] or "").startswith("hata"):
                s["on"] = "true"
                s["durum"] = "ogreniliyor"
                s["kademe"] = min(2, max(1, s.sayi("kademe")))
                s["seri"] = 0
                self.olay(s["id"], f"ön konu olarak başladı (K{s.sayi('kademe')})")
        elif kd < BITIS_KADEME and mevcut:
            mevcut.sil("on")
            mevcut["durum"] = "beklemede"
            self.olay(mevcut["id"], f"ön konu durdu (odak K{BITIS_KADEME}'ün altına düştü), kademe korunur")

    # --- roller ---
    def odak(self, n, sorular, sonuc, on=False):
        nn = len(sorular)
        if not nn:
            return
        kp = round(100 * sum(yapi(sonuc.get(q["id"]), n["id"]) for q in sorular) / nn)
        ham = round(100 * sum((sonuc.get(q["id"]) or {}).get("puan", 0) or 0 for q in sorular) / nn)
        kd = max(1, n.sayi("kademe"))
        tavan = 2 if on else BITIS_KADEME
        w = self.odak_penceresi(n, kd, sorular, sonuc)
        wd, wn, wg, takili = pencere_ozeti(w)
        once = f"K{kd}"
        ad = "ön konu" if on else "odak"
        ek = f" · takılan alt beceri: {', '.join(takili)}" if takili else ""
        # takılan alt beceri geçişi durdurmaz: sorular o kalıba yönelir, konu bitince yayılımda öne çıkar
        gecti = wn >= PENCERE and wd >= PENCERE_GEC and wg >= 2
        seanslar = self.odak_seanslari(n, sorular, sonuc)
        tavan_doldu = (not on and not self.kisa and kd >= TAVAN_KADEME and len(seanslar) > SEANS_TAVAN
                       and sum(seanslar[:3]) / len(seanslar[:3]) >= TAVAN_ORT)
        n["ustalik"], n["son_calisma"], n["sonraki_tekrar"] = ustalik(n, ham), self.gun, gun_ekle(self.gun, 1)
        n["seri"] = 0  # eski alan; ilerlemeyi artık `pencere` gösterir
        hatasiz = kp == 100 and not self.kisa
        if (hatasiz or gecti) and kd >= BITIS_KADEME and not on:
            neden = "hatasız seans" if hatasiz else f"pencere {wd}/{wn}, {wg} gün"
            return self.bitir(n, f"odak · yapı %{kp} (ham %{ham}) · K{kd} · {neden}{ek}")
        elif hatasiz and kd < tavan:
            yeni, neden = kd + 1, "hatasız seans"
        elif gecti:
            yeni, neden = kd + 1, f"pencere {wd}/{wn}, {wg} gün"
        elif tavan_doldu:
            son3 = " · ".join(str(s) for s in reversed(seanslar[:3]))
            return self.bitir(n, f"odak · yapı %{kp} (ham %{ham}) · K{kd} · SÜRE TAVANI ({len(seanslar)} seans, son 3: {son3})")
        elif (wn >= PENCERE_DUS and wd / wn < 0.6) or (wn < PENCERE_DUS and kp < 60):
            yeni, neden = max(1, kd - 1), f"pencere {wd}/{wn} < %60"
            n["durum"] = "zayif"
        else:
            yeni, neden = kd, f"pencere {wd}/{wn}, {wg} gün (geçiş: {PENCERE_GEC}/{PENCERE}, 2 gün){ek}"
        if yeni > tavan:
            yeni, neden = tavan, neden + f" · ön konu en fazla K{tavan}"
        if yeni >= kd and n["durum"] in ("zayif", "beklemede", "kilitli"):
            n["durum"] = "ogreniliyor"
        n["kademe"] = yeni
        n["pencere"] = f"{wd}/{wn}" if yeni == kd else "0/0"
        self.olay(n["id"], f"{ad} · yapı %{kp} (ham %{ham}) · {once} → K{yeni} · {neden}")

    def yoklama(self, n, sorular, sonuc):
        y = n["yoklama"] or "0/0/0"
        if y.startswith("hata") or y == "gecti":
            self.uyarilar.append(f"{n['id']}: yoklaması zaten '{y}', yine de soru gelmiş; sayılmadı")
            return
        d, s, g = (int(x) for x in (y.split("/") + ["0", "0", "0"])[:3])
        hata = False
        kapsanan = set(n.liste("yoklama_alt"))
        for q in sorular:
            r = sonuc.get(q["id"])
            s += 1
            if yapi(r, n["id"]):
                d += 1
                if q.get("alt"):
                    kapsanan.add(q["alt"])
            elif yapi_hatasi(r, n["id"]):
                hata = True
        if n["son_calisma"] != self.gun:
            g += 1
        n["son_calisma"] = self.gun
        if hata:
            n["yoklama"] = f"hata {d}/{s}"
            n["kademe"] = 2 if d * 3 >= s * 2 else 1
            self.olay(n["id"], f"yoklama bozuldu ({d}/{s}) → başlangıç K{n['kademe']}")
            return
        alt = [a for a in n.liste("alt") if not a.startswith("kenar:")]
        eksik = [a for a in alt if a not in kapsanan]
        if kapsanan:
            n["yoklama_alt"] = "[" + ", ".join(f'"{a}"' for a in sorted(kapsanan)) + "]"
        if s >= 6 and g >= 2 and not eksik:
            odakti = n["durum"] == "ogreniliyor" and n.sayi("kademe") == 0
            n["durum"], n["kademe"], n["yoklama"], n["adim"] = "temiz", 5, "gecti", 1
            n["sonraki_tekrar"], n["bitis"] = gun_ekle(self.gun, 3), self.gun
            n["ustalik"] = max(n.sayi("ustalik"), round(100 * d / s))
            self.olay(n["id"], f"yoklama GEÇTİ ({d}/{s}, {g} gün)")
            if odakti:
                self.odak_yap(n)
        else:
            n["yoklama"] = f"{d}/{s}/{g}"
            not_ = f" · eksik alt beceri: {', '.join(eksik)}" if (s >= 6 and g >= 2 and eksik) else ""
            if not alt:
                self.uyarilar.append(f"{n['id']}: `alt` listesi yok; alt beceri kapsamı kontrol edilemedi")
            self.olay(n["id"], f"yoklama {d}/{s}/{g}{not_}")

    def tekrar(self, n, sorular, sonuc):
        nn = len(sorular)
        if n["durum"] not in ("temiz", "zayif") or (n["durum"] == "zayif" and not onarimda(n)):
            # tekrar bölümü sadece bitmiş, onarımdaki ve dar onarımdaki konular içindir
            self.uyarilar.append(f"{n['id']}: tekrar bölümünde soru var ama konu bitmemiş ve onarımda değil ({n['durum']}); sayılmadı")
            return
        kp = round(100 * sum(yapi(sonuc.get(q["id"]), n["id"]) for q in sorular) / nn)
        ham = round(100 * sum((sonuc.get(q["id"]) or {}).get("puan", 0) or 0 for q in sorular) / nn)
        n["ustalik"], n["son_calisma"] = ustalik(n, ham), self.gun
        if n["durum"] == "zayif" and n["dar"]:
            return self.dar_tekrar(n, sorular, sonuc, kp, nn)
        if n["durum"] == "zayif":  # onarım
            if not n["onarim_bas"]:
                n["onarim_bas"] = self.gun
            wd, wn, wg, takili = pencere_ozeti(self.onarim_penceresi(n, sorular, sonuc))
            n["seri"] = 0
            if wn >= ONARIM_PENCERE and wd >= ONARIM_GEC and wg >= 2 and not takili:
                n["durum"], n["adim"], n["kademe"] = "temiz", 1, 5
                n["sonraki_tekrar"] = gun_ekle(self.gun, aralik(1))
                n.sil("pencere")
                n.sil("onarim_bas")
                self.olay(n["id"], f"onarım · yapı %{kp} ({nn} soru) · pencere {wd}/{wn} → yeniden TEMİZ")
            else:
                n["pencere"], n["sonraki_tekrar"] = f"{wd}/{wn}", gun_ekle(self.gun, 1)
                ek = f" · takılan alt beceri: {', '.join(takili)}" if takili else ""
                self.olay(n["id"], f"onarım · yapı %{kp} ({nn} soru) · pencere {wd}/{wn}, {wg} gün (çıkış: {ONARIM_GEC}/{ONARIM_PENCERE}, 2 gün){ek}")
                if nn < 3:
                    self.uyarilar.append(f"{n['id']}: onarımda {nn} soru sorulmuş (kural en az 3)")
            return
        if kp >= 85:
            n["adim"] = n.sayi("adim") + 1
            n["sonraki_tekrar"] = gun_ekle(self.gun, aralik(n.sayi("adim")))
            self.olay(n["id"], f"tekrar · yapı %{kp} → adım {n['adim']}, sonraki {n['sonraki_tekrar']}")
        elif kp >= 60 or nn < TEKRAR_EN_AZ:
            # 3'ten az soruyla bitmiş konu onarıma düşmez (tek hata %50 demek): yarın yine sorulur
            n["sonraki_tekrar"] = gun_ekle(self.gun, 1)
            self.olay(n["id"], f"tekrar · yapı %{kp} ({nn} soru) → yarın yine")
        else:
            n["durum"], n["kademe"], n["seri"] = "zayif", 3, 0
            n["sonraki_tekrar"] = n["onarim_bas"] = gun_ekle(self.gun, 1)
            n["pencere"] = "0/0"
            self.olay(n["id"], f"tekrar · yapı %{kp} → ONARIMA girdi")

    def eski_usul(self, n, seans):
        """Kelime temaları ve sınav bölümleri (Kurallar → Kelime temaları ve sınav bölümleri)."""
        ilk_bugun = n["son_calisma"] != self.gun
        n["ustalik"], n["son_calisma"] = ustalik(n, seans), self.gun
        if n["durum"] == "kilitli":
            n["durum"] = "ogreniliyor"
        if seans >= 85:
            if ilk_bugun:
                n["temiz_gun"] = n.sayi("temiz_gun") + 1
            n["adim"] = n.sayi("adim") + 1
            n["sonraki_tekrar"] = gun_ekle(self.gun, aralik(n.sayi("adim")))
        elif seans >= 60:
            n["sonraki_tekrar"] = gun_ekle(self.gun, 1)
            if n["durum"] == "temiz" and seans < 70:
                n["durum"], n["temiz_gun"], n["adim"] = "zayif", 0, 0
            elif n["durum"] != "temiz":
                n["durum"] = "ogreniliyor"
        else:
            n["durum"], n["temiz_gun"], n["adim"] = "zayif", 0, 0
            n["sonraki_tekrar"] = gun_ekle(self.gun, 1)
        if n.sayi("temiz_gun") >= 3 and n.sayi("ustalik") >= 85:
            n["durum"] = "temiz"
        self.olay(n["id"], f"{n['tur']} · %{seans} → ustalık {n['ustalik']}, {n['durum']}, sonraki {n['sonraki_tekrar']}")

    def kelime_kilitleri(self):
        for n in self.notlar.values():
            if n["tur"] == "kelime" and n["durum"] == "kilitli":
                on = n.liste("onkosul")
                if on and all(o in self.notlar and self.notlar[o].sayi("ustalik") >= 70 for o in on):
                    n["durum"] = "yeni"
                    self.olay(n["id"], "kilit açıldı → yeni")

    def hata_kurali(self, veri_bugun, etiket_konu):
        """Kurallar → Hata etiketi kuralı (oranla) ve mini drill işareti."""
        def yapi_disi(tip):
            return tip == "yazma"

        bugun_etiketler = set()
        for b in veri_bugun["bolumler"]:
            for q in b["sorular"]:
                r = veri_bugun.get("sonuc", {}).get(q["id"]) or {}
                if not yapi_disi(q["tip"]):
                    bugun_etiketler.update(hata_etiketleri(r))
        bas = gun_ekle(self.gun, -6)
        sorular_konu, hatalar = {}, {}
        for d in sorted(glob.glob(yol("05 Günlük", "veri", "*.json"))):
            ad = os.path.basename(d)
            if ad.endswith(".cevap.json") or not re.match(r"\d{4}-\d{2}-\d{2}", ad):
                continue
            g = ad[:10]
            if not (bas <= g <= self.gun):
                continue
            v = json.load(open(d, encoding="utf-8"))
            for b in v["bolumler"]:
                for q in b["sorular"]:
                    if yapi_disi(q["tip"]):
                        continue
                    k = q.get("konu") or b.get("konu")
                    if k:
                        sorular_konu[k] = sorular_konu.get(k, 0) + 1
                    r = v.get("sonuc", {}).get(q["id"]) or {}
                    for e in hata_etiketleri(r):
                        hatalar.setdefault(e, []).append(k)
        for e in sorted(bugun_etiketler):
            konu = etiket_konu.get(e)
            liste = hatalar.get(e, [])
            if len(liste) >= 3:
                self.olay(konu or "-", f"etiket '{e}' 7 günde {len(liste)}. kez → MİNİ DRILL (kuyruk hata sayısına göre: {len(liste)})")
            if not konu or konu not in self.notlar:
                continue
            payda = sorular_konu.get(konu, 0) + sum(1 for k in liste if k != konu)
            oran = len(liste) / payda if payda else 0
            if len(liste) >= 3 and oran >= 0.25:
                n = self.notlar[konu]
                if n["durum"] == "temiz":
                    n["durum"], n["kademe"], n["seri"] = "zayif", 3, 0
                    n["sonraki_tekrar"] = n["onarim_bas"] = gun_ekle(self.gun, 1)
                    n["pencere"] = "0/0"
                    self.olay(konu, f"hata etiketi kuralı ('{e}' {len(liste)} hata, %{round(oran*100)}) → ONARIMA girdi")
                else:
                    self.olay(konu, f"hata etiketi kuralı ('{e}' {len(liste)} hata, %{round(oran*100)}) → konu zaten çalışılıyor; geçişi pencere ölçer")
            elif len(liste) >= 3:
                self.olay(konu, f"etiket '{e}' {len(liste)} hata ama oran %{round(oran*100)} < 25 → kural uygulanmadı")


# ---------- raporlar: alt beceri ve sınırlar ----------
def yayilimda(n, bugun=None):
    return n["durum"] == "temiz" and n["yayilim"] >= (bugun or dt.date.today().isoformat())


def konu_rolu(n):
    if yayilimda(n):
        return f"yayılım ({n['yayilim']} tarihine kadar)"
    if n["on"] == "true":
        return "ön konu"
    if n["durum"] == "zayif" and n["dar"]:
        return "dar onarım"
    if onarimda(n):
        return "onarım"
    return "odak"


def aktif_konular(notlar):
    ks = [n for n in notlar.values() if n["tur"] == "gramer" and
          ((n["durum"] in ("ogreniliyor", "zayif") and n.sayi("kademe") >= 1) or yayilimda(n))]
    return sorted(ks, key=lambda n: (n["hat"], n.sayi("sira")))


def alt_raporu():
    """Odak, ön ve onarım konularında alt beceri kanıtı ve son yapı hataları (Kurallar → Alt beceri kanıtı)."""
    notlar, gecmis = notlari_yukle(), gecmis_yukle()[:14]
    print("# Alt beceri durumu (son 14 seans)\n")
    for n in aktif_konular(notlar):
        kid, deneme, hatalar, kapsam = n["id"], {}, [], set()
        for g, v in gecmis:  # yeniden eskiye
            for b in v["bolumler"]:
                if b.get("rol") not in ("odak", "on", "tekrar", "yoklama"):
                    continue  # beceri bölümlerindeki tanıma soruları (Sprachbausteine a/b/c) üretim kanıtı değildir
                for q in b["sorular"]:
                    if (q.get("konu") or b.get("konu")) != kid or q.get("tip") == "yazma":
                        continue
                    r = v["sonuc"].get(q["id"]) or {}
                    y = yapi(r, kid)
                    if q.get("alt"):
                        deneme.setdefault(q["alt"], []).append(y)
                        if y and b.get("rol") == "odak" and (b.get("kademe") or 0) >= 4:
                            kapsam.add(q["alt"])
                    if not y and r.get("etiket") not in GENEL and len(hatalar) < 12:
                        hatalar.append(f"  {g[5:]} {q['id']:<5} [{r.get('etiket', '?')}] {str(q.get('metin') or q.get('talimat') or '')[:48]} → {str(r.get('dogru', ''))[:48]}")
        print(f"## {kid} {n['baslik']} · {konu_rolu(n)} · K{n.sayi('kademe')} · pencere {n['pencere'] or '–'}")
        if n["dar"]:
            print(f"  Dar alt beceriler: {', '.join(n.liste('dar'))} → her biri için 2 soru (en az 3), artı 1 kontrol sorusu başka bir alt beceriden")
        alts = n.liste("alt")
        if not alts:
            print("  ⚠️ `alt` listesi yok: önce frontmatter'a yaz")
        kirmizi, yok = [], []
        for a in alts:
            d = deneme.get(a, [])
            son = "".join("✓" if y else "✗" for y in d[:6]) or "–"
            if 0 in d[:3]:
                durum = "✗ kırmızı  "
                kirmizi.append(a)
            elif len(d) >= 3:
                durum = "✓ yeşil    "
            else:
                durum = "· kanıt yok"
                if not a.startswith("kenar:"):
                    yok.append(a)
            print(f"  {durum} {a:<46} son (yeni → eski): {son}")
        if yayilimda(n):
            print("  → Yayılım: tekrar bölümünde 2–3 soru (önce kırmızı alt beceriler ve kenar durumlar); odak, kelime, okuma ve günlük cümlelerinde de doğal biçimde kullan.")
        if hatalar:
            print("  Son yapı hataları:")
            print("\n".join(hatalar))
        print(f"  → Dağılım: kırmızıya soruların yarısı ({len(kirmizi)} alt beceri), kanıtı olmayanlara en az birer soru ({len(yok)}), yeşillere toplam en fazla dörtte bir.\n")


def sinir_raporu():
    """Üretim sınırı (sorulabilir) ve anlama sınırı (metinlerde sözlüklü geçebilir). Kurallar → Üretim ve anlama sınırı."""
    notlar = notlari_yukle()
    gr = sorted((n for n in notlar.values() if n["tur"] == "gramer"), key=lambda n: (n["hat"], n.sayi("sira")))
    uretim, anlama, on = [], [], []
    for hat in ("fiil", "isim"):
        ks = [n for n in gr if n["hat"] == hat]
        bitmis = [n for n in ks if n["durum"] == "temiz" or onarimda(n)]
        kalan = [n for n in ks if n not in bitmis]
        odak = next((n for n in kalan if n["on"] != "true"), None)
        uretim += bitmis + ([odak] if odak else [])
        on += [n for n in kalan if n["on"] == "true"]
        sonra = [n for n in kalan if n is not odak]
        anlama += [n for i, n in enumerate(sonra) if i < 3 or (n["durum"] == "beklemede" and n.sayi("ustalik") >= 50)]
    yaz = lambda ks: "\n".join(f"  {n['id']:<6} {n['hat']:<5} {n['baslik']}" for n in ks) or "  –"
    print("# Üretim sınırı: sorularda, örneklerde ve cümle kartlarında kullanılabilir\n" + yaz(uretim))
    print("\n# Ön konu: sadece kendi bölümünde sorulur\n" + yaz(on))
    print("\n# Anlama sınırı: sadece okuma, dinleme ve günlük metinlerinde; sözlükte açıklanır, yapısı sorulmaz\n" + yaz([n for n in anlama if n not in on] ))
    print("\nBunların dışındaki yapılar hiçbir yerde geçmez.")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args and args[0] == "alt":
        return alt_raporu()
    if args and args[0] == "sinir":
        return sinir_raporu()
    gun = args[0] if args else dt.date.today().isoformat()
    yaz, zorla = "--yaz" in sys.argv, "--zorla" in sys.argv
    veri_yolu = yol("05 Günlük", "veri", f"{gun}.json")
    if not os.path.exists(veri_yolu):
        sys.exit(f"Soru dosyası yok: {veri_yolu}")
    veri = json.load(open(veri_yolu, encoding="utf-8"))
    sonuc = veri.get("sonuc")
    if not sonuc:
        sys.exit("`sonuc` nesnesi yok: önce cevapları puanla.")
    not_yolu = yol("05 Günlük", f"{gun}.md")
    kisa = bool(os.path.exists(not_yolu) and re.search(r"^kisa:\s*true", open(not_yolu, encoding="utf-8").read(), re.M))
    if yaz and not zorla and os.path.exists(LOG) and any(l.startswith(gun + " ") for l in open(LOG, encoding="utf-8")):
        sys.exit(f"{gun} zaten yazılmış (_kisisel/ilerleme.log). Yeniden yazmak için --zorla.")

    notlar = notlari_yukle()
    h = Hesap(gun, notlar, kisa)
    bilinmeyen = set()

    def konu_notu(k):
        if k not in notlar:
            bilinmeyen.add(k)
            return None
        return notlar[k]

    odaklar = []
    for b in veri["bolumler"]:
        rol, sorular = b.get("rol"), b["sorular"]
        if rol in ("odak", "on"):
            n = konu_notu(b.get("konu"))
            if n:
                # ön konu bugün odak olduysa (odak bitti ya da dar onarıma girdi) artık K2 sınırı yok
                h.odak(n, sorular, sonuc, on=(rol == "on" and n["on"] == "true"))
                if rol == "odak":
                    odaklar.append(n)
        elif rol in ("yoklama", "tekrar"):
            grup = {}
            for q in sorular:
                grup.setdefault(q.get("konu") or b.get("konu"), []).append(q)
            for k, qs in grup.items():
                n = konu_notu(k)
                if n:
                    (h.yoklama if rol == "yoklama" else h.tekrar)(n, qs, sonuc)
        elif rol == "kelime":
            n = konu_notu(b.get("konu"))
            if n and sorular:
                h.eski_usul(n, round(100 * sum((sonuc.get(q["id"]) or {}).get("puan", 0) or 0 for q in sorular) / len(sorular)))
        elif rol == "beceri":
            teil = b.get("teil") or next((v for k, v in TEIL_VARSAYILAN.items() if k in str(b.get("baslik", ""))), None)
            n = konu_notu(teil) if teil else None
            if n and sorular:
                h.eski_usul(n, round(100 * sum((sonuc.get(q["id"]) or {}).get("puan", 0) or 0 for q in sorular) / len(sorular)))
    for o in odaklar:
        h.on_kontrol(o)
    h.hata_kurali(veri, hata_konulari())
    h.kelime_kilitleri()

    if bilinmeyen:
        sys.exit(f"Bilinmeyen konu id'leri: {', '.join(sorted(map(str, bilinmeyen)))}. Hiçbir şey yazılmadı.")

    print(f"# İlerleme · {gun}{' · kısa gün' if kisa else ''} · {'YAZILIYOR' if yaz else 'kuru çalışma'}\n")
    for kid, m in h.olaylar:
        print(f"- {kid}: {m}")
    print()
    degisen = [n for n in notlar.values() if n.degisen()]
    for n in degisen:
        print(f"{n['id']}: " + " · ".join(f"{k} {a or '∅'} → {b if b is not None else 'silindi'}" for k, a, b in n.degisen()))
    for u in h.uyarilar:
        print("⚠️ " + u)
    if yaz:
        for n in degisen:
            n.yaz()
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{gun} {dt.datetime.now().isoformat(timespec='seconds')} " + "; ".join(f"{k}: {m}" for k, m in h.olaylar) + "\n")
        print(f"\n{len(degisen)} not güncellendi.")


if __name__ == "__main__":
    main()
