#!/usr/bin/env python3
"""Seviye tespitinin hesap betiği (Kurallar.md → Seviye tespiti). Claude soruları yazar ve cevapları
puanlar; neyin sorulacağını, kanıt sayımını, tavanı ve sonucu bu betik hesaplar.

Kullanım (hepsi kuru çalışır; dosyaya yazmak için --yaz):
  python3 -I _sistem/seviye/tespit.py durum                      # hangi adımdayız
  python3 -I _sistem/seviye/tespit.py plan A2.1 [--json]         # Tur 1 kontrol noktaları
  python3 -I _sistem/seviye/tespit.py sifir [--yaz]              # beyan A0: tespit yok, baştan başla
  python3 -I _sistem/seviye/tespit.py denetle <gün>-seviye-<n>   # soru dosyası plana uyuyor mu
  python3 -I _sistem/seviye/tespit.py puan <gün>-seviye-<n> [--yaz]   # sonuc → kanıt sayaçları
  python3 -I _sistem/seviye/tespit.py tur2 [--json]              # Tur 2'de sorulacak konular
  python3 -I _sistem/seviye/tespit.py tur3 [--json]              # Tur 3 ihtiyacı ve soru yuvaları
  python3 -I _sistem/seviye/tespit.py sonuc [--yaz] [--json]     # geçen konular, odaklar, Profil
  --gun YYYY-MM-DD   bugünün yerine kullanılacak tarih (test için)
  --zorla            tespit tamamlandıktan sonra da yaz

Sayaçlar her seferinde bütün tur dosyalarından baştan hesaplanır: aynı komutu iki kez
çalıştırmak sonucu değiştirmez.
"""
import datetime as dt
import glob
import json
import os
import re
import sys

BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [BURASI, os.path.dirname(BURASI)]
import ilerleme as I  # noqa: E402
import plan as P  # noqa: E402

HATLAR = ("fiil", "isim")
HAT_ADI = {"fiil": "🔧 fiil", "isim": "🧱 isim"}
YAKIN = 6          # tavana bu kadar sıra ya da daha yakın konu "yakın"dır
KANIT_YAKIN = 6    # yakın konunun geçmesi için gereken doğru kanıt
KANIT_UZAK = 3     # tavanın YAKIN'dan fazla altındaki konu için
TUT = 2            # bir konunun "tutuldu" sayılması için hatasız doğru kanıt
TUR2_MAKS = 4      # Tur 2'de hat başına en fazla konu
YUKARI_ADIM = (3, 6, 9, 12)  # hiç düşen yoksa en üst noktadan bu kadar yukarıdaki konular sorulur
TUR3_MAKS = 40     # Tur 3'te en fazla birleşik soru
ERKEN_BITIS = 2    # doğrulanacak konu sayısı bundan azsa ya da eşitse Tur 3 yapılmaz
TEKRAR_GUNLUK = 3  # tespitle geçen konuların ilk tekrarı: günde en fazla bu kadar konu
KELIME_GECME = 7 / 8
SEVIYE_NO = {"A1": 1, "A2": 2, "B1": 3}
TIPLER = {1: {"ceviri", "hata", "donustur", "yazma"}, 2: {"ceviri", "hata", "donustur"},
          3: {"ceviri", "hata", "donustur", "bosluk"}}


# ---------- müfredat ve tur dosyaları ----------
def mufredat():
    """({hat: {sira: ad}}, {konu id: (hat, sira, ad)})"""
    m = P.mufredat()
    konular = {ad.split(" ")[0]: (h, s, ad) for h in HATLAR for s, ad in m[h].items()}
    return m, konular


def turlar():
    liste = []
    for d in glob.glob(I.yol("05 Günlük", "veri", "*-seviye-[0-9].json")):
        mm = re.match(r"(\d{4}-\d{2}-\d{2})-seviye-(\d)$", os.path.basename(d)[:-5])
        if mm:
            liste.append({"ad": os.path.basename(d)[:-5], "gun": mm.group(1), "n": int(mm.group(2)), "yol": d,
                          "veri": json.load(open(d, encoding="utf-8"))})
    return sorted(liste, key=lambda t: (t["n"], t["gun"]))


def bos(c):
    if isinstance(c, list):
        return all(bos(x) for x in c)
    return c is None or str(c).strip() in ("", "?")


def tur_kaniti(t, konular):
    """Bir turun kanıtları: ([(konu, 1 | 0 | None, etiket, soru id)], {kelime seviyesi: [puan]}, sorunlar).
    1 = yapı doğru, 0 = dilbilgisi hatası, None = yapı cevapta görünmüyor."""
    v, kanit, kelime, sorun = t["veri"], [], {}, []
    sonuc = v.get("sonuc") or {}
    cevap_yolu = t["yol"][:-5] + ".cevap.json"
    cevap = json.load(open(cevap_yolu, encoding="utf-8")) if os.path.exists(cevap_yolu) else None
    for b in v.get("bolumler", []):
        for q in b.get("sorular", []):
            qid, r, k0 = q["id"], sonuc.get(q["id"]), q.get("konu") or b.get("konu")
            if str(k0 or "").startswith("kelime-"):
                if r is None:
                    sorun.append(f"{qid}: puanlanmamış")
                else:
                    kelime.setdefault(int(k0.split("-")[1]), []).append(r.get("puan", 0) or 0)
                continue
            if q.get("tip") == "yazma":
                for k, d in ((r or {}).get("kanit") or {}).items():
                    if k not in konular:
                        sorun.append(f"{qid}: bilinmeyen konu {k}")
                    else:
                        kanit.append((k, 1 if d else 0, (r or {}).get("etiket") if not d else None, qid))
                continue
            if r is None:
                sorun.append(f"{qid}: puanlanmamış")
                continue
            acik = r.get("kanit") or {}
            bosmu = cevap is not None and bos(cevap.get(qid))
            for k in dict.fromkeys([k0] + list(q.get("kanit") or [])):
                if k not in konular:
                    sorun.append(f"{qid}: bilinmeyen konu {k}")
                    continue
                if k in acik:
                    d = acik[k]
                    d = None if d in (None, "yok", "") else (1 if d else 0)
                elif k == k0:
                    d = 1 if I.yapi(r) else (0 if I.yapi_hatasi(r) else None)
                elif (r.get("puan", 0) or 0) >= 1:
                    d = 1
                elif bosmu:
                    d = None
                else:
                    sorun.append(f"{qid}: puan 1'den küçük; `sonuc.kanit` içine {k} için 1, 0 ya da null yaz")
                    continue
                kanit.append((k, d, r.get("etiket") if d == 0 else None, qid))
    return kanit, kelime, sorun


def durum_hesapla(tur_listesi, konular):
    """Verilen turlardan konu başına toplam kanıt."""
    st = {k: {"d": 0, "s": 0, "gunler": set(), "hata": False, "etiket": None} for k in konular}
    kelime, sorun = {}, []
    for t in tur_listesi:
        kanit, kel, sr = tur_kaniti(t, konular)
        sorun += [f"{t['ad']} · {x}" for x in sr]
        for sev, puanlar in kel.items():
            kelime.setdefault(sev, []).extend(puanlar)
        for k, d, etiket, _ in kanit:
            x = st[k]
            x["s"] += 1
            x["gunler"].add(t["gun"])
            if d == 1:
                x["d"] += 1
            elif d == 0:
                x["hata"] = True
                x["etiket"] = x["etiket"] or etiket
    return st, kelime, sorun


def kid(m, h, s):
    return m[h][s].split(" ")[0]


def tuttu(x):
    return not x["hata"] and x["d"] >= TUT


def tavan(st, m, h):
    """Hatta hatasız tutulan en yüksek sıra (yoksa 0)."""
    return max((s for s in m[h] if tuttu(st[kid(m, h, s)])), default=0)


def gerek(s, tv):
    return KANIT_UZAK if tv - s > YAKIN else KANIT_YAKIN


def gecer(x, s, tv):
    return not x["hata"] and x["d"] >= gerek(s, tv) and len(x["gunler"]) >= 2


def bant_adi(h, s):
    for b in P.BEYANLAR:
        b0, b1 = P.BANTLAR[h][b]
        if b0 <= s <= b1:
            return b
    return "B1.2 üstü"


# ---------- Tur 1 planı ----------
def kanit_oner(plan, m):
    """Tur 1 sorularına yan kanıt önerir: beyan bandının altındaki, nokta olmayan her konu ilk gün
    en az bir kez üretilsin (yoksa ikinci gün kanıtı tek güne sıkışır ve konu geçemez)."""
    beyan = plan["beyan"]
    nokta = {(h, p["sira"]) for h in HATLAR for p in plan["hatlar"][h]}
    havuz = [(h, s) for h in HATLAR for s in sorted(m[h]) if s < P.BANTLAR[h][beyan][0] and (h, s) not in nokta]
    say = {x: 0 for x in havuz}
    for h in HATLAR:
        for p in plan["hatlar"][h]:
            p["kanit"] = []
            for _ in range(p["soru"]):
                uygun = sorted((x for x in havuz if say[x] < 2 and (x[0] != h or x[1] < p["sira"])),
                               key=lambda x: (say[x], x[1]))
                sec = [x for x in uygun if x[0] != h][:2] + [x for x in uygun if x[0] == h][:1]
                sec += [x for x in uygun if x not in sec][:3 - len(sec)]
                for x in sec:
                    say[x] += 1
                p["kanit"].append([kid(m, *x) for x in sec])
    plan["tarama"] = [kid(m, *x) for x in havuz]
    return plan


# ---------- Tur 2 ve Tur 3 hedefleri ----------
def esit_aralik(aday, n):
    if len(aday) <= n:
        return aday
    return sorted({aday[round(j * (len(aday) - 1) / (n - 1))] for j in range(n)})


def tur2_hedef(plan, st, m, konular):
    """Her hatta tavan ile üstündeki ilk düşen nokta arasını daraltır; düşen yoksa yukarı çıkar.
    `tarama`: tavanın altında ilk gün hiç doğru kanıtı olmayan konulara birleşik sorularla birer kanıt."""
    sonuc, taranacak = {}, {}
    for h in HATLAR:
        noktalar = sorted(p["sira"] for p in plan["hatlar"][h])
        tv = max((s for s in noktalar if tuttu(st[kid(m, h, s)])), default=0)
        ustte = [s for s in noktalar if s > tv]
        b0, b1 = P.BANTLAR[h][plan["beyan"]]
        son = max(m[h])
        if ustte:
            ilk_dusen = min(ustte)
            aday = [s for s in range(tv + 1, ilk_dusen) if not st[kid(m, h, s)]["hata"]]
            yon = "asagi" if ilk_dusen < b0 else ("bant" if ilk_dusen <= b1 else "ust")
            aralik = [tv, ilk_dusen]
        else:
            ust = max(noktalar)
            aday = sorted({min(ust + j, son) for j in YUKARI_ADIM} - {ust}) if ust < son else []
            yon, aralik = "yukari", [ust, son]
        secilen = esit_aralik(aday, TUR2_MAKS)
        for s in range(1, tv + 1):
            x = st[kid(m, h, s)]
            if not x["hata"] and x["d"] == 0 and s not in secilen:
                taranacak[kid(m, h, s)] = 1
        sonuc[h] = {"tavan": tv, "aralik": aralik, "yon": yon,
                    "bosluklar": [m[h][s] for s in noktalar if s < tv and not tuttu(st[kid(m, h, s)])],
                    "konular": [{"sira": s, "konu": kid(m, h, s), "ad": m[h][s], "soru": 2} for s in secilen]}
    sonuc["tarama"] = paketle(taranacak, konular, sinir=None)[0]
    return sonuc


def paketle(ihtiyac, konular, sinir=TUR3_MAKS):
    """İhtiyaç listesini birleşik soru yuvalarına dağıtır: her yuva 1 konu + en fazla 3 kanıt, iki hattan karışık.
    Alt sıradaki konular önce dolar; TUR3_MAKS'a sığmayanlar tavana en yakın olanlardır."""
    kalan, yuvalar = dict(ihtiyac), []
    while sinir is None or len(yuvalar) < sinir:
        acik = {h: sorted((k for k, n in kalan.items() if n > 0 and konular[k][0] == h), key=lambda k: konular[k][1])
                for h in HATLAR}
        if not (acik["fiil"] or acik["isim"]):
            break
        hat = max(HATLAR, key=lambda h: sum(kalan[k] for k in acik[h]))
        diger = "isim" if hat == "fiil" else "fiil"
        sec = (acik[hat][:1] + acik[diger][:2] + acik[hat][1:2] + acik[hat][2:] + acik[diger][2:])[:4]
        for k in sec:
            kalan[k] -= 1
        yuvalar.append({"konu": sec[0], "kanit": sec[1:]})
    return yuvalar, {k: n for k, n in kalan.items() if n > 0}


def tur3_hedef(st, m, konular):
    hatlar, ihtiyac, ek = {}, {}, []
    for h in HATLAR:
        tv, son = tavan(st, m, h), max(m[h])
        aday = [s for s in m[h] if s <= tv and not st[kid(m, h, s)]["hata"]]
        for s in aday:
            x = st[kid(m, h, s)]
            n = max(gerek(s, tv) - x["d"], 0 if len(x["gunler"]) >= 2 else 1)
            if n:
                ihtiyac[kid(m, h, s)] = n
        # tavanın üstü: ilk düşen konuya kadar olan boşluğu daralt; hiç düşen yoksa iki nokta daha yukarı bak
        ustte = [s for s in m[h] if s > tv and st[kid(m, h, s)]["s"]]
        yukari = []
        if tv and ustte:
            yukari = esit_aralik([s for s in range(tv + 1, min(ustte))], TUR2_MAKS)
        elif tv and tv < son:
            yukari = sorted({min(tv + 2, son), min(tv + 4, son)})
            ek += [{"sira": s, "konu": kid(m, h, s), "ad": m[h][s], "soru": 2} for s in yukari]
        hatlar[h] = {"tavan": tv, "aday": len(aday), "yukari": yukari,
                     "bosluklar": [m[h][s] for s in m[h] if s < tv and st[kid(m, h, s)]["hata"]]}
    yuvalar, sigmayan = paketle(ihtiyac, konular)
    erken = sum(x["aday"] for x in hatlar.values()) <= ERKEN_BITIS and not ek
    return {"erken_bitis": erken, "hatlar": hatlar, "ihtiyac": ihtiyac, "yukari": ek, "sorular": yuvalar,
            "sigmayan": sigmayan}


# ---------- yazma ----------
def profil():
    return I.Not(I.yol("_kisisel", "Profil.md"))


def json_yaz(yol, veri):
    tmp = yol + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
    os.replace(tmp, yol)


def sayaclari_yaz(notlar, st, konular):
    """Kanıtı olan gramer konularının `yoklama`, `kademe` ve `son_calisma` alanlarını (mutlak değerle) yazar."""
    for k, x in st.items():
        if not x["s"] or k not in notlar:
            continue
        n = notlar[k]
        if x["hata"]:
            n["yoklama"] = f"hata {x['d']}/{x['s']}"
            n["kademe"] = 2 if x["d"] * 3 >= x["s"] * 2 else 1
        else:
            n["yoklama"] = f"{x['d']}/{x['s']}/{len(x['gunler'])}"
        n["son_calisma"] = max(x["gunler"])


def degisenleri_yaz(notlar, yaz, ek=(), sessiz=False):
    degisen = [n for n in list(notlar.values()) + list(ek) if n.degisen()]
    if yaz:
        for n in degisen:
            n.yaz()
    if sessiz:
        return
    for n in degisen:
        ad = n["id"] or os.path.basename(n.dosya)
        print(f"  {ad}: " + " · ".join(f"{k} {a or '∅'} → {b if b is not None else 'silindi'}" for k, a, b in n.degisen()))
    print(f"\n{len(degisen)} not {'güncellendi' if yaz else 'değişecek (kuru çalışma; yazmak için --yaz)'}.")


def kapali_mi(zorla):
    if profil()["seviye_tespiti"] == "tamamlandi" and not zorla:
        sys.exit("Seviye tespiti zaten tamamlandı (Profil.md). Sayaçlar artık günlük antrenmandan ilerliyor; "
                 "yine de yazmak için --zorla.")


# ---------- komutlar ----------
def k_durum(_):
    p = profil()
    ts = turlar()
    print(f"Profil: seviye_tespiti={p['seviye_tespiti'] or '∅'} · beyan={p['beyan'] or '∅'}")
    for t in ts:
        v = t["veri"]
        print(f"  Tur {t['n']} · {t['gun']} · {'puanlandı' if v.get('tespit') else ('sonuc var, `puan` bekliyor' if v.get('sonuc') else 'cevap bekliyor')}")
    if p["seviye_tespiti"] == "tamamlandi":
        print("→ Tespit bitti: /antrenman.")
    elif not p["beyan"]:
        print("→ Tanışma ve beyan (skill adım 1).")
    elif p["beyan"] == "A0":
        print("→ `sifir --yaz`.")
    elif not ts:
        print(f"→ Tur 1'i yaz: `plan {p['beyan']} --json`.")
    elif not ts[-1]["veri"].get("tespit"):
        print(f"→ Tur {ts[-1]['n']} puanlanacak: cevaplar doluysa sonuc yaz, sonra `puan {ts[-1]['ad']} --yaz`.")
    elif ts[-1]["n"] == 1:
        print("→ `tur2 --json` ile Tur 2'yi yaz.")
    elif ts[-1]["n"] == 2:
        print("→ `tur3 --json`: erken bitiş varsa `sonuc`, yoksa ertesi gün Tur 3.")
    else:
        print("→ `sonuc --yaz`.")


def k_plan(a):
    beyan = a["args"][0] if a["args"] else ""
    if beyan == "A0":
        sys.exit("A0 (sıfırdan) için tur yok: `tespit.py sifir --yaz`.")
    if beyan not in P.BEYANLAR:
        sys.exit("Beyan şunlardan biri olmalı: A0, " + ", ".join(P.BEYANLAR))
    m, konular = mufredat()
    plan = kanit_oner(P.olustur(beyan), m)
    if a["json"]:
        print(json.dumps(plan, ensure_ascii=False, indent=1))
        return
    print(f"Beyan {beyan} · yazma: {plan['yazma']['uzunluk']} ({plan['yazma']['talimat']}) · kelime seviyeleri {plan['kelime_seviyeleri']}")
    for h in HATLAR:
        ns = plan["hatlar"][h]
        print(f"\n{HAT_ADI[h]} hattı ({len(ns)} nokta, {sum(n['soru'] for n in ns)} soru)")
        for n in ns:
            print(f"  {n['rol']:<6}{n['sira']:>3}  {n['ad']:<55} yan kanıt: " + " | ".join(", ".join(k) or "–" for k in n["kanit"]))
    print(f"\nTarama (bandın altında, nokta olmayan {len(plan['tarama'])} konu): her biri Tur 1'de en az bir kez üretilmeli.")


def k_sifir(a):
    kapali_mi(a["zorla"])
    m, _ = mufredat()
    notlar = I.notlari_yukle()
    for n in notlar.values():
        if n["tur"] == "gramer" and n["seviye"] == "A1":
            n["yoklama"], n["kademe"] = "hata (beyan)", 1
    for h in HATLAR:
        notlar[kid(m, h, 1)]["durum"] = "ogreniliyor"
    p = profil()
    p["beyan"], p["seviye_tespiti"], p["baslangic"] = "A0", "tamamlandi", a["gun"]
    p["kelime_baslangic"], p["cumle_baslangic"] = 1, 1
    print("# Sıfırdan başlangıç (beyan A0)\n")
    print("A1 konularının yoklaması kapatılır (hepsi K1'den öğretilir); A2 ve B1 konuları sırası gelince yoklanır.")
    print("Odak: " + " · ".join(f"{HAT_ADI[h]} {m[h][1]} K1" for h in HATLAR) + "\n")
    degisenleri_yaz(notlar, a["yaz"], [p])


def k_puan(a):
    kapali_mi(a["zorla"])
    if not a["args"]:
        sys.exit("Kullanım: tespit.py puan <gün>-seviye-<n> [--yaz]")
    m, konular = mufredat()
    ts = turlar()
    bu = next((t for t in ts if t["ad"] == a["args"][0]), None)
    if not bu:
        sys.exit(f"Tur dosyası yok: 05 Günlük/veri/{a['args'][0]}.json")
    if not bu["veri"].get("sonuc"):
        sys.exit("`sonuc` nesnesi yok: önce cevapları puanla.")
    kanit, kelime, sorun = tur_kaniti(bu, konular)
    if sorun:
        sys.exit("Eksik ya da hatalı puanlama, hiçbir şey yazılmadı:\n  " + "\n  ".join(sorun))
    tespit = {}
    for k, d, etiket, _ in kanit:
        x = tespit.setdefault(k, {"d": 0, "s": 0, "hata": False})
        x["s"] += 1
        x["d"] += d == 1
        if d == 0:
            x["hata"] = True
            if etiket:
                x.setdefault("etiket", etiket)
    if kelime:
        tespit["kelime"] = {str(s): sum(p) for s, p in sorted(kelime.items())}
    puanli = [t for t in ts if t["veri"].get("sonuc")]
    st, _, sorun = durum_hesapla(puanli, konular)
    if sorun:
        sys.exit("Önceki turlarda eksik puanlama:\n  " + "\n  ".join(sorun))
    print(f"# Tur {bu['n']} · {bu['gun']} · kanıt\n")
    for h in HATLAR:
        print(f"{HAT_ADI[h]} hattı · tavan (bütün turlar): {tavan(st, m, h)}")
        for s in sorted(m[h]):
            x = tespit.get(kid(m, h, s))
            if x:
                print(f"  {s:>2} {m[h][s]:<55} {x['d']}/{x['s']}{'  HATA' + (' · ' + x['etiket'] if x.get('etiket') else '') if x['hata'] else ''}")
    if kelime:
        print("Kelime: " + " · ".join(f"seviye {s}: {sum(p):g}/{len(p)}" for s, p in sorted(kelime.items())))
    print()
    notlar = I.notlari_yukle()
    sayaclari_yaz(notlar, st, konular)
    degisenleri_yaz(notlar, a["yaz"])
    if a["yaz"]:
        bu["veri"]["tespit"] = tespit
        json_yaz(bu["yol"], bu["veri"])


def onceki_durum(n, konular):
    """n. turdan önceki puanlanmış turların durumu."""
    ts = [t for t in turlar() if t["n"] < n]
    eksik = [t["ad"] for t in ts if not t["veri"].get("sonuc")]
    if eksik:
        sys.exit("Puanlanmamış tur var: " + ", ".join(eksik))
    return ts, durum_hesapla(ts, konular)


def tur1_plani(ts):
    t1 = next((t for t in ts if t["n"] == 1), None)
    if not t1:
        sys.exit("Tur 1 dosyası yok.")
    if not t1["veri"].get("plan"):
        sys.exit("Tur 1 dosyasında `plan` alanı yok (plan çıktısını aynen koy).")
    return t1["veri"]["plan"]


def k_tur2(a):
    m, konular = mufredat()
    ts, (st, _, sorun) = onceki_durum(2, konular)
    if sorun:
        sys.exit("\n".join(sorun))
    h2 = tur2_hedef(tur1_plani(ts), st, m, konular)
    if a["json"]:
        print(json.dumps(h2, ensure_ascii=False, indent=1))
        return
    yon = {"asagi": "beyanın altında, aşağıda daraltılıyor", "bant": "beyan bandının içinde daraltılıyor",
           "ust": "bant tutuldu, üst noktada düştü", "yukari": "hiç düşen yok, yukarı çıkılıyor"}
    for h in HATLAR:
        x = h2[h]
        print(f"{HAT_ADI[h]} hattı · tavan {x['tavan']} · aralık {x['aralik'][0]}–{x['aralik'][1]} · {yon[x['yon']]}")
        for b in x["bosluklar"]:
            print(f"  boşluk (tavanın altında düştü): {b}")
        for kk in x["konular"]:
            print(f"  {kk['sira']:>2} {kk['ad']}  ({kk['soru']} soru)")
        if not x["konular"]:
            print("  daraltma sorusu yok")
    if h2["tarama"]:
        print(f"\nTarama · {len(h2['tarama'])} birleşik soru (ilk gün kanıtı olmayan konular):")
        for i, y in enumerate(h2["tarama"], 1):
            print(f"  {i:>2}. {y['konu']} + {', '.join(y['kanit']) or '–'}")


def k_tur3(a):
    m, konular = mufredat()
    ts, (st, _, sorun) = onceki_durum(3, konular)
    if sorun:
        sys.exit("\n".join(sorun))
    if not ts:
        sys.exit("Puanlanmış tur yok.")
    h3 = tur3_hedef(st, m, konular)
    h3["en_erken"] = I.gun_ekle(min(t["gun"] for t in ts), 1)
    if a["json"]:
        print(json.dumps(h3, ensure_ascii=False, indent=1))
        return
    for h in HATLAR:
        x = h3["hatlar"][h]
        print(f"{HAT_ADI[h]} hattı · tavan {x['tavan']} · doğrulanacak {x['aday']} konu"
              + (f" · boşluklar: {', '.join(x['bosluklar'])}" if x["bosluklar"] else ""))
    if h3["erken_bitis"]:
        print("\nERKEN BİTİŞ: doğrulanacak bir şey yok. Tur 3 yapılmaz → `sonuc --yaz`.")
        return
    print(f"\nEn erken {h3['en_erken']}. {len(h3['sorular'])} birleşik soru"
          + (f" + yukarı {len(h3['yukari'])} konu × 2 soru" if h3["yukari"] else "") + ":")
    for i, y in enumerate(h3["sorular"], 1):
        print(f"  {i:>2}. {y['konu']} + {', '.join(y['kanit']) or '–'}")
    for kk in h3["yukari"]:
        print(f"  yukarı: {kk['sira']} {kk['ad']} (2 soru)")
    if h3["sigmayan"]:
        print(f"\n⚠️ {TUR3_MAKS} soruya sığmadı, günlük yoklamada tamamlanacak: "
              + ", ".join(f"{k} ({n})" for k, n in h3["sigmayan"].items()))


def k_denetle(a):
    if not a["args"]:
        sys.exit("Kullanım: tespit.py denetle <gün>-seviye-<n>")
    m, konular = mufredat()
    bu = next((t for t in turlar() if t["ad"] == a["args"][0]), None)
    if not bu:
        sys.exit(f"Tur dosyası yok: {a['args'][0]}")
    v, n, sorun, uyari = bu["veri"], bu["n"], [], []
    say, kelime, gramer, ceviri, yazma_bolum = {}, {}, 0, 0, None
    for i, b in enumerate(v.get("bolumler", [])):
        if b.get("rol") != "tespit":
            sorun.append(f"bölüm {b.get('no')}: rol `tespit` olmalı")
        for q in b.get("sorular", []):
            tip, k0, kn = q.get("tip"), q.get("konu"), list(q.get("kanit") or [])
            if tip not in TIPLER.get(n, TIPLER[3]):
                sorun.append(f"{q['id']}: `{tip}` Tur {n}'de kullanılmaz")
            if "anahtar" in q:
                sorun.append(f"{q['id']}: `anahtar` olmaz (anında kontrol cevabı gösterir)")
            if tip == "yazma":
                yazma_bolum = i
                continue
            if str(k0 or "").startswith("kelime-"):
                kelime[int(k0.split("-")[1])] = kelime.get(int(k0.split("-")[1]), 0) + 1
                continue
            gramer += 1
            ceviri += tip == "ceviri"
            if len(kn) > 3:
                sorun.append(f"{q['id']}: en fazla 3 kanıt")
            for k in [k0] + kn:
                if k not in konular:
                    sorun.append(f"{q['id']}: bilinmeyen konu {k}")
                else:
                    say.setdefault(k, {"konu": 0, "toplam": 0})
                    say[k]["toplam"] += 1
            if k0 in say:
                say[k0]["konu"] += 1
    if n == 1:
        plan = v.get("plan")
        if not plan:
            sorun.append("`plan` alanı yok")
        else:
            for h in HATLAR:
                for p in plan["hatlar"][h]:
                    if say.get(p["konu"], {}).get("konu", 0) < p["soru"]:
                        sorun.append(f"{p['ad']}: {p['soru']} soru gerekli, {say.get(p['konu'], {}).get('konu', 0)} var")
            for sev in plan["kelime_seviyeleri"]:
                if kelime.get(sev, 0) != 8:
                    sorun.append(f"kelime seviyesi {sev}: 8 kelime gerekli, {kelime.get(sev, 0)} var")
            for k in plan.get("tarama", []):
                if not say.get(k, {}).get("toplam"):
                    uyari.append(f"{konular[k][2]}: Tur 1'de hiç üretilmiyor (Tur 2 taramasına kalır)")
        if yazma_bolum != 0:
            sorun.append("yazma görevi ilk bölüm olmalı")
    else:
        ts, (st, _, sr) = onceki_durum(n, konular)
        sorun += sr
        if n == 2:
            h2 = tur2_hedef(tur1_plani(ts), st, m, konular)
            hedef = [kk for h in HATLAR for kk in h2[h]["konular"]]
            for k in {k for y in h2["tarama"] for k in [y["konu"]] + y["kanit"]}:
                if not say.get(k, {}).get("toplam"):
                    sorun.append(f"{konular[k][2]}: taramada en az 1 kanıt gerekli")
        else:
            h3 = tur3_hedef(st, m, konular)
            hedef = h3["yukari"]
            for k, gereken in h3["ihtiyac"].items():
                var = say.get(k, {}).get("toplam", 0)
                if var < gereken and k not in h3["sigmayan"]:
                    sorun.append(f"{konular[k][2]}: {gereken} kanıt gerekli, {var} var")
                elif var < gereken:
                    uyari.append(f"{konular[k][2]}: {gereken} kanıt gerekli, {var} var (yuvalara sığmamıştı)")
            if len([1 for b in v["bolumler"] for _ in b["sorular"]]) > TUR3_MAKS + 12:
                uyari.append("soru sayısı çok yüksek")
        for kk in hedef:
            if say.get(kk["konu"], {}).get("konu", 0) < kk["soru"]:
                sorun.append(f"{kk['ad']}: {kk['soru']} soru gerekli, {say.get(kk['konu'], {}).get('konu', 0)} var")
    if gramer and ceviri * 2 < gramer:
        uyari.append(f"çeviri soruları yarıdan az ({ceviri}/{gramer})")
    for u in uyari:
        print("⚠️ " + u)
    if sorun:
        sys.exit("Soru dosyası plana uymuyor:\n  " + "\n  ".join(sorun))
    print(f"✓ Tur {n} dosyası plana uyuyor ({gramer} gramer sorusu, {sum(kelime.values())} kelime).")


def k_sonuc(a):
    kapali_mi(a["zorla"])
    m, konular = mufredat()
    ts = turlar()
    if not ts or any(not t["veri"].get("sonuc") for t in ts):
        sys.exit("Puanlanmamış tur var ya da hiç tur yok.")
    st, kelime, sorun = durum_hesapla(ts, konular)
    if sorun:
        sys.exit("\n".join(sorun))
    bugun = a["gun"]
    notlar = I.notlari_yukle()
    sayaclari_yaz(notlar, st, konular)

    rapor = {"beyan": profil()["beyan"], "hatlar": {}}
    gecenler = []
    for h in HATLAR:
        tv, son = tavan(st, m, h), max(m[h])
        gecen = [s for s in sorted(m[h]) if gecer(st[kid(m, h, s)], s, tv)]
        gecenler += [(st[kid(m, h, s)]["d"], s, kid(m, h, s)) for s in gecen]
        odak = next((s for s in sorted(m[h]) if s not in gecen), None)
        rapor["hatlar"][h] = {
            "tavan": tv, "olculen": bant_adi(h, tv + 1) if tv < son else "B1.2 üstü",
            "gecen": len(gecen),
            "bosluklar": [m[h][s] for s in m[h] if s < tv and st[kid(m, h, s)]["hata"]],
            "yoklamada": [m[h][s] for s in m[h] if s <= tv and s not in gecen and not st[kid(m, h, s)]["hata"]],
            "odak": m[h][odak] if odak else None,
        }
        if odak:
            n = notlar[kid(m, h, odak)]
            n["durum"] = "ogreniliyor"
            n["kademe"] = max(1, n.sayi("kademe")) if (n["yoklama"] or "").startswith("hata") else 0
            rapor["hatlar"][h]["odak_kademe"] = n.sayi("kademe")
            rapor["hatlar"][h]["odak_seviye"] = n["seviye"]
    # geçen konular: ilk tekrar kademeli, en az kanıtlı olan önce
    for i, (_, _, k) in enumerate(sorted(gecenler)):
        n, x = notlar[k], st[k]
        n["durum"], n["kademe"], n["seri"], n["yoklama"], n["adim"] = "temiz", 5, 0, "gecti", 1
        n["sonraki_tekrar"], n["bitis"] = I.gun_ekle(bugun, 3 + i // TEKRAR_GUNLUK), bugun
        n["ustalik"] = round(100 * x["d"] / x["s"])

    # kelime: taranan en alt seviyenin altı geçilmiş sayılır (kontrol kartlarıyla yoklanır)
    kb = min(kelime) if kelime else 1
    for sev in sorted(kelime):
        if sum(kelime[sev]) / len(kelime[sev]) >= KELIME_GECME and sev == kb:
            kb = sev + 1
    deste = I.K.deste_oku(I.KOK)
    en_yuksek = max((int(k.get("seviye") or 0) for k in deste if k.get("deste") == "kelime"), default=0)
    rapor["kelime"] = {"baslangic": kb, "tarama": {str(s): f"{sum(p):g}/{len(p)}" for s, p in sorted(kelime.items())},
                       "eklenecek": kb > en_yuksek}
    i = 0
    for n in sorted((x for x in notlar.values() if x["tur"] == "kelime"), key=lambda x: x["id"]):
        sev = SEVIYE_NO.get(n["seviye"], 9)
        if sev < kb and sev <= 2:
            n["durum"], n["adim"], n["ustalik"] = "temiz", 1, 85
            n["sonraki_tekrar"] = I.gun_ekle(bugun, 3 + i)
            i += 1
    I.Hesap(bugun, notlar, False).kelime_kilitleri()

    p = profil()
    # cümle kartları ölçülen seviyeden başlar (odak alttaki bir boşluk olabilir)
    cb = min(SEVIYE_NO.get(x["olculen"][:2], 3) for x in rapor["hatlar"].values())
    p["kelime_baslangic"], p["cumle_baslangic"] = kb, cb
    p["seviye_tespiti"], p["baslangic"] = "tamamlandi", bugun
    rapor["cumle_baslangic"] = cb

    if a["json"]:
        print(json.dumps(rapor, ensure_ascii=False, indent=1))
    else:
        print(f"# Seviye tespiti sonucu · beyan {rapor['beyan'] or '∅'}\n")
        for h in HATLAR:
            x = rapor["hatlar"][h]
            print(f"{HAT_ADI[h]} hattı · ölçülen {x['olculen']} · {x['gecen']} konu geçti · tavan {x['tavan']}")
            print(f"  odak: {x['odak'] or 'hat bitti'}" + (f" · {'K' + str(x['odak_kademe']) if x.get('odak_kademe') else 'yoklamada'}" if x["odak"] else ""))
            if x["bosluklar"]:
                print("  boşluklar (tavanın altında, öğretilecek): " + ", ".join(x["bosluklar"]))
            if x["yoklamada"]:
                print("  yoklamada devam: " + ", ".join(x["yoklamada"]))
        print("Kelime taraması: " + " · ".join(f"seviye {s}: {v}" for s, v in rapor["kelime"]["tarama"].items())
              + f" → kelime_baslangic {kb}"
              + (" · ⚠️ bu seviye destede yok: sıradaki 100 kelimeyi ekle" if rapor["kelime"]["eklenecek"] else ""))
        print(f"Cümle kartları: cumle_baslangic {rapor['cumle_baslangic']}\n")
    degisenleri_yaz(notlar, a["yaz"], [p], sessiz=a["json"])


KOMUTLAR = {"durum": k_durum, "plan": k_plan, "sifir": k_sifir, "denetle": k_denetle, "puan": k_puan,
            "tur2": k_tur2, "tur3": k_tur3, "sonuc": k_sonuc}


def main():
    argv = sys.argv[1:]
    if not os.path.exists(I.yol("_kisisel", "Profil.md")):  # ilk çalıştırma: kişisel klasörü şablonlardan kur
        sys.path.insert(0, os.path.join(os.path.dirname(BURASI), "kurulum"))
        import motor
        motor.kisisel_hazirla(I.KOK)
    gun = dt.date.today().isoformat()
    if "--gun" in argv:
        i = argv.index("--gun")
        gun = argv[i + 1]
        del argv[i:i + 2]
    args = [x for x in argv if not x.startswith("--")]
    if not args or args[0] not in KOMUTLAR:
        sys.exit(__doc__)
    KOMUTLAR[args[0]]({"args": args[1:], "yaz": "--yaz" in argv, "json": "--json" in argv,
                       "zorla": "--zorla" in argv, "gun": gun})


if __name__ == "__main__":
    main()
