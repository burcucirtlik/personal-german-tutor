#!/usr/bin/env python3
"""Seviye tespitini sahte öğrencilerle uçtan uca dener (tespit.py'nin testi).

  python3 -I _sistem/seviye/test_tespit.py          # özet tablo; bir değişmez bozulursa çıkış kodu 1
  python3 -I _sistem/seviye/test_tespit.py -v       # her senaryonun sonuç raporu

Her senaryo geçici bir klasörde sıfırlanmış bir vault kurar, soru dosyalarını plana göre üretir,
sahte öğrencinin cevaplarını `sonuc` olarak yazar ve betiğin komutlarını sırayla çalıştırır.
Gerçek vault'a dokunmaz.

Sahte öğrenci: her hatta bir sınırı vardır; sınırın altındaki konuları hatasız üretir, sınırı ve üstünü
yanlış yapar. `bosluk` listesindeki konular sınırın altında olsa da yanlıştır.

Değişmezler:
  1. Öğrencinin bilmediği hiçbir konu `temiz` olmaz (yarım bilinen konu atlanmaz).
  2. Öğrencinin bildiği hiçbir konunun yoklaması bozulmaz.
  3. Her hattın odağı bilinmeyen ilk konudan yukarıda olamaz.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

BURASI = os.path.dirname(os.path.abspath(__file__))
SISTEM = os.path.dirname(BURASI)
KOK = os.path.dirname(SISTEM)
sys.path[:0] = [BURASI, SISTEM, os.path.join(SISTEM, "kurulum")]
import plan as P  # noqa: E402
import motor as M  # noqa: E402

GUN1, GUN2 = "2030-01-07", "2030-01-08"
HATLAR = ("fiil", "isim")
KONU_KLASORLERI = ["03 Grammatik", "02 Wortschatz", "01 Sınav/Teile"]


def taban_vault(hedef):
    for k in KONU_KLASORLERI:
        shutil.copytree(os.path.join(KOK, k), os.path.join(hedef, k))
        for f in os.listdir(os.path.join(hedef, k)):
            if f.endswith(".md"):
                M.konu_sifirla(os.path.join(hedef, k, f))
    for k in ["05 Günlük/veri", "06 Fehlerlog", "_sistem/seviye", "_sistem/kartlar", "_sistem/kurulum", "_sistem/Şablonlar"]:
        os.makedirs(os.path.join(hedef, k))
    for f in ["ilerleme.py", "kisisel.py", "Müfredat.md", "seviye/plan.py", "seviye/tespit.py", "kartlar/deste.json",
              "kurulum/motor.py", "Şablonlar/Profil.md", "Şablonlar/Hikâye.md"]:
        shutil.copy(os.path.join(SISTEM, f), os.path.join(hedef, "_sistem", f))
    M.kisisel_hazirla(hedef)
    profil = os.path.join(hedef, "_kisisel", "Profil.md")
    metin = open(profil, encoding="utf-8").read().replace("ad: ", "ad: Test", 1)
    open(profil, "w", encoding="utf-8").write(metin)


class Senaryo:
    def __init__(self, ad, beyan, fiil, isim, kelime=1, bosluk=()):
        self.ad, self.beyan, self.sinir, self.kelime, self.bosluk = ad, beyan, {"fiil": fiil, "isim": isim}, kelime, set(bosluk)
        self.m = P.mufredat()
        self.konu = {a.split(" ")[0]: (h, s) for h in HATLAR for s, a in self.m[h].items()}
        self.sayac = 0

    def kid(self, h, s):
        return self.m[h][s].split(" ")[0]

    def bilir(self, k):
        h, s = self.konu[k]
        return s < self.sinir[h] and k not in self.bosluk

    def betik(self, *args, gun=GUN1):
        r = subprocess.run([sys.executable, "-I", os.path.join(self.v, "_sistem", "seviye", "tespit.py"), *args, "--gun", gun],
                           capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(f"{self.ad}: tespit.py {' '.join(args)}\n{r.stdout}{r.stderr}")
        return r.stdout

    def yan_kanit(self, h, s):
        """Claude'un yazacağı birleşik cümlenin modeli: aynı hattan ve diğer hattan, beyan bandının altından birer yapı."""
        self.sayac += 1
        diger = "isim" if h == "fiil" else "fiil"
        kanit = []
        for hat, ust in ((h, min(s, P.BANTLAR[h][self.beyan][0])), (diger, P.BANTLAR[diger][self.beyan][0])):
            if ust > 1:
                kanit.append(self.kid(hat, 1 + self.sayac % (ust - 1)))
        return kanit

    def tur_yaz(self, n, gun, bolumler, ek=None):
        sonuc = {}
        for b in bolumler:
            for q in b["sorular"]:
                k0 = q.get("konu")
                if q["tip"] == "yazma":
                    sonuc[q["id"]] = {"puan": 1, "kanit": {k: 1 for k in q.pop("_dener") if self.bilir(k)}}
                elif str(k0).startswith("kelime-"):
                    sonuc[q["id"]] = {"puan": 1 if int(k0.split("-")[1]) < self.kelime or q.pop("_tutar", False) else 0}
                else:
                    kanit = {k: 1 if self.bilir(k) else 0 for k in [k0] + q.get("kanit", [])}
                    tam = all(kanit.values())
                    sonuc[q["id"]] = {"puan": 1 if tam else 0, "kanit": kanit, **({} if tam else {"etiket": "sim-hata"})}
                q.pop("_tutar", None)
        ad = f"{gun}-seviye-{n}"
        veri = {"tarih": gun, "bolumler": bolumler, **(ek or {})}
        yol = os.path.join(self.v, "05 Günlük", "veri", ad + ".json")
        json.dump(veri, open(yol, "w", encoding="utf-8"), ensure_ascii=False)
        self.betik("denetle", ad, gun=gun)
        veri["sonuc"] = sonuc
        json.dump(veri, open(yol, "w", encoding="utf-8"), ensure_ascii=False)
        self.betik("puan", ad, "--yaz", gun=gun)
        return sum(len(b["sorular"]) for b in bolumler)

    def bolum(self, no, sorular):
        return {"no": no, "baslik": f"Bölüm {no}", "konu": None, "rol": "tespit",
                "sorular": [dict(q, id=f"{no}.{i}") for i, q in enumerate(sorular, 1)]}

    def kos(self, taban):
        self.v = tempfile.mkdtemp(prefix="tespit-")
        try:
            shutil.copytree(taban, self.v, dirs_exist_ok=True)
            return self._kos()
        finally:
            shutil.rmtree(self.v, ignore_errors=True)

    def _kos(self):
        profil = os.path.join(self.v, "_kisisel", "Profil.md")
        metin = open(profil, encoding="utf-8").read().replace("beyan:", f"beyan: {self.beyan}")
        open(profil, "w", encoding="utf-8").write(metin)
        if self.beyan == "A0":
            self.betik("sifir", "--yaz")
            return self.oku({"sorular": [0, 0, 0]})
        plan = json.loads(self.betik("plan", self.beyan, "--json"))
        yazma = [self.kid(h, s) for h in HATLAR for s in range(P.BANTLAR[h][self.beyan][0], P.BANTLAR[h][self.beyan][0] + 2)]
        bolumler = [self.bolum(1, [{"tip": "yazma", "metin": "Aufnahmeantrag", "_dener": yazma}])]
        for no, h in ((2, "fiil"), (3, "isim")):
            bolumler.append(self.bolum(no, [{"tip": "ceviri", "konu": p["konu"], "kanit": p["kanit"][i], "metin": "…"}
                                            for p in plan["hatlar"][h] for i in range(p["soru"])]))
        bolumler.append(self.bolum(4, [{"tip": "ceviri", "konu": f"kelime-{sev}", "metin": "…", "_tutar": i < 4}
                                       for sev in plan["kelime_seviyeleri"] for i in range(8)]))
        sorular = [self.tur_yaz(1, GUN1, bolumler, {"plan": plan}), 0, 0]

        h2 = json.loads(self.betik("tur2", "--json"))
        b2 = [self.bolum(no, [{"tip": "ceviri", "konu": k["konu"], "kanit": self.yan_kanit(h, k["sira"]), "metin": "…"}
                              for k in h2[h]["konular"] for _ in range(k["soru"])]) for no, h in ((1, "fiil"), (2, "isim"))]
        b2.append(self.bolum(3, [{"tip": "ceviri", "konu": y["konu"], "kanit": y["kanit"], "metin": "…"} for y in h2["tarama"]]))
        b2 = [b for b in b2 if b["sorular"]]
        if b2:
            sorular[1] = self.tur_yaz(2, GUN1, b2)

        h3 = json.loads(self.betik("tur3", "--json", gun=GUN2))
        son_gun = GUN1
        if not h3["erken_bitis"]:
            b3 = [self.bolum(1, [{"tip": "ceviri", "konu": y["konu"], "kanit": y["kanit"], "metin": "…"} for y in h3["sorular"]]
                             + [{"tip": "ceviri", "konu": k["konu"], "metin": "…"} for k in h3["yukari"] for _ in range(k["soru"])])]
            sorular[2] = self.tur_yaz(3, GUN2, b3)
            son_gun = GUN2
        rapor = json.loads(self.betik("sonuc", "--yaz", "--json", gun=son_gun))
        rapor["sorular"] = sorular
        rapor["sigmayan"] = len(h3.get("sigmayan", {}))
        return self.oku(rapor)

    def oku(self, rapor):
        """Yazılan frontmatter'ı okur ve değişmezleri denetler."""
        import ilerleme as I
        hatalar, odak = [], {}
        durum = {}
        for f in os.listdir(os.path.join(self.v, "03 Grammatik")):
            n = I.Not(os.path.join(self.v, "03 Grammatik", f))
            durum[n["id"]] = n
        for k, n in durum.items():
            if n["durum"] == "temiz" and not self.bilir(k):
                hatalar.append(f"bilinmeyen konu temiz oldu: {k}")
            if self.beyan != "A0" and n["yoklama"].startswith("hata") and self.bilir(k):
                hatalar.append(f"bilinen konunun yoklaması bozuldu: {k}")
        for h in HATLAR:
            ilk_bilinmeyen = next((s for s in sorted(self.m[h]) if not self.bilir(self.kid(h, s))), None)
            odaklar = [s for s in sorted(self.m[h]) if durum[self.kid(h, s)]["durum"] == "ogreniliyor"]
            if len(odaklar) > 1:
                hatalar.append(f"{h}: birden fazla odak {odaklar}")
            odak[h] = odaklar[0] if odaklar else None
            if odak[h] and ilk_bilinmeyen and odak[h] > ilk_bilinmeyen:
                hatalar.append(f"{h}: odak {odak[h]} bilinmeyen ilk konunun ({ilk_bilinmeyen}) üstünde")
            if odak[h] is None and ilk_bilinmeyen:
                hatalar.append(f"{h}: odak yok ama bilinmeyen konu var ({ilk_bilinmeyen})")
        temiz = {h: sum(1 for s in self.m[h] if durum[self.kid(h, s)]["durum"] == "temiz") for h in HATLAR}
        if self.beyan != "A0" and rapor.get("kelime"):
            taranan = P.KELIME[self.beyan]
            beklenen = min(max(self.kelime, min(taranan)), max(taranan) + 1)
            if rapor["kelime"]["baslangic"] != beklenen:
                hatalar.append(f"kelime başlangıcı {rapor['kelime']['baslangic']}, beklenen {beklenen}")
        bilinen = {h: sum(1 for s in self.m[h] if self.bilir(self.kid(h, s))) for h in HATLAR}
        tekrar = sorted(n["sonraki_tekrar"] for n in durum.values() if n["durum"] == "temiz")
        return {"rapor": rapor, "hatalar": hatalar, "odak": odak, "temiz": temiz, "bilinen": bilinen,
                "odak_kademe": {h: durum[self.kid(h, odak[h])].sayi("kademe") if odak[h] else None for h in HATLAR},
                "tekrar_gun": len(set(tekrar))}


def orta(h, beyan):
    b0, b1 = P.BANTLAR[h][beyan]
    return (b0 + b1 + 1) // 2


SENARYOLAR = [Senaryo(f"doğru beyan {b}", b, orta("fiil", b), orta("isim", b), kelime=min(4, i + 2))
              for i, b in enumerate(P.BEYANLAR)] + [
    Senaryo("sıfır beyanı (A0)", "A0", 1, 1),
    Senaryo("A1.1 dedi, hiç bilmiyor", "A1.1", 1, 1),
    Senaryo("yüksek beyan: B1.1 dedi, A2.1", "B1.1", orta("fiil", "A2.1"), orta("isim", "A2.1"), kelime=3),
    Senaryo("yüksek beyan: A2.2 dedi, A1.2", "A2.2", orta("fiil", "A1.2"), orta("isim", "A1.2"), kelime=2),
    Senaryo("düşük beyan: A1.2 dedi, A2.2", "A1.2", orta("fiil", "A2.2"), orta("isim", "A2.2"), kelime=4),
    Senaryo("düşük beyan: A2.1 dedi, B1.2", "A2.1", orta("fiil", "B1.2"), orta("isim", "B1.2"), kelime=4),
    Senaryo("dengesiz: fiil A2.2, isim A1.2", "A2.1", 20, 8, kelime=3),
    Senaryo("her şeyi biliyor (B1.2)", "B1.2", 40, 31, kelime=4),
    Senaryo("A2.2 ama iki A1 boşluğu", "A2.2", 20, 19, kelime=3, bosluk=("A1-13", "A1-12")),
    Senaryo("B1.1 ama A2'de boşluk", "B1.1", 27, 25, kelime=4, bosluk=("A2-13", "A2-02")),
]


def main():
    ayrinti = "-v" in sys.argv
    taban = tempfile.mkdtemp(prefix="tespit-taban-")
    bozuk = 0
    try:
        taban_vault(taban)
        print(f"{'senaryo':<34}{'soru (T1+T2+T3)':<18}{'fiil: odak / bilinmeyen ilk · temiz':<38}{'isim':<28}tekrar yayılımı")
        for s in SENARYOLAR:
            r = s.kos(taban)
            q = r["rapor"]["sorular"]
            hucre = []
            for h in HATLAR:
                kd = r["odak_kademe"][h]
                hucre.append(f"{r['odak'][h] or '–'}{'' if kd is None else (' K' + str(kd) if kd else ' yokl.')} / {s.sinir[h] if s.sinir[h] <= max(s.m[h]) else 'son'}"
                             f" · {r['temiz'][h]}/{r['bilinen'][h]}")
            print(f"{s.ad:<34}{f'{q[0]}+{q[1]}+{q[2]} = {sum(q)}':<18}{hucre[0]:<38}{hucre[1]:<28}{r['tekrar_gun']} gün"
                  + (f" · sığmayan {r['rapor']['sigmayan']}" if r["rapor"].get("sigmayan") else ""))
            for h in r["hatalar"]:
                bozuk += 1
                print("   ✗ " + h)
            if ayrinti:
                print(json.dumps({k: v for k, v in r["rapor"].items() if k != "sorular"}, ensure_ascii=False, indent=1))
    finally:
        shutil.rmtree(taban, ignore_errors=True)
    print(f"\n{len(SENARYOLAR)} senaryo · {'değişmezlerin hepsi tuttu ✓' if not bozuk else str(bozuk) + ' DEĞİŞMEZ BOZULDU ✗'}")
    sys.exit(1 if bozuk else 0)


if __name__ == "__main__":
    main()
