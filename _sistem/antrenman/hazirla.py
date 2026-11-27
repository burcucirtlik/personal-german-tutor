#!/usr/bin/env python3
"""Antrenman hazırlık özeti: /antrenman'ın ihtiyaç duyduğu bütün durumu tek çıktıda toplar.

  python3 -I _sistem/antrenman/hazirla.py              # bugün
  python3 -I _sistem/antrenman/hazirla.py 2026-11-28

Hiçbir dosyayı değiştirmez (tıklama sinyalini yeniler: _kisisel/sozluk/sinyal.json).
Kuralların kendisi `_sistem/Kurallar.md`'de kalır; bu betik sadece bugün geçerli satırları oradan canlı çıkarır,
böylece antrenman her seferinde bütün kural dosyasını okumak zorunda kalmaz.
"""
import collections
import datetime as dt
import glob
import importlib.util
import json
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
YAZARLAR = ["Mehmet", "Lena", "Kofi", "Dr. Ingrid", "Pavel", "Amira", "Bernd", "Yuki"]
HIZ = {"A1": 150, "A2": 165, "B1": 180}


def yol(*p):
    return os.path.join(KOK, *p)


def modul(ad, dosya):
    spec = importlib.util.spec_from_file_location(ad, dosya)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def oku(p, varsayilan=None):
    try:
        return open(yol(p), encoding="utf-8").read()
    except OSError:
        return varsayilan


def jsonoku(p, varsayilan):
    try:
        return json.load(open(yol(p), encoding="utf-8"))
    except (OSError, ValueError):
        return varsayilan


def fm(metin):
    m = re.match(r"---\n(.*?)\n---", metin or "", re.S)
    d = {}
    for s in (m.group(1).split("\n") if m else []):
        mm = re.match(r"^([a-z_]+):\s*(.*)$", s)
        if mm:
            d[mm.group(1)] = mm.group(2).strip()
    return d


def baslik(t):
    print(f"\n## {t}")


def gun_ekle(g, n):
    return (dt.date.fromisoformat(g) + dt.timedelta(days=n)).isoformat()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    gun = args[0] if args else dt.date.today().isoformat()
    gd = dt.date.fromisoformat(gun)
    I = modul("ilerleme", yol("_sistem", "ilerleme.py"))
    kurallar = oku("_sistem/Kurallar.md", "")
    profil = fm(oku("_kisisel/Profil.md", ""))
    ortam = jsonoku("_kisisel/ortam.json", {})

    print(f"# Antrenman hazırlığı · {gun} · {GUNLER[gd.weekday()]}")

    # ---- kapı ve mevcut not
    if profil.get("seviye_tespiti") != "tamamlandi":
        print("\n⛔ Seviye tespiti tamamlanmadı: antrenman yazılmaz, /seviye uygulanır.")
        return
    var = sorted(glob.glob(yol("05 Günlük", f"{gun}*.md")))
    for v in var:
        print(f"⚠️ Not zaten var: {os.path.relpath(v, KOK)} (durum: {fm(open(v, encoding='utf-8').read()).get('durum')})")
    print(f"Profil: {profil.get('gunluk_dakika')} dk · kart_adet {profil.get('kart_adet')} · sınav {profil.get('sinav_tarihi')}"
          f" · ses üretimi {'var' if ortam.get('ses', True) else 'YOK (ses.py çalıştırma, dinle kutusunda metni aç)'}")
    dun = gun_ekle(gun, -1)
    dun_not = fm(oku(f"05 Günlük/{dun}.md", ""))
    if not dun_not:
        print("Dün antrenman yok: normal antrenman yaz, mesajda kısa günün de mümkün olduğunu söyle (Kurallar → Kısa gün).")

    # ---- müfredat: iki hat
    notlar = I.notlari_yukle()
    gr = sorted((n for n in notlar.values() if n["tur"] == "gramer"), key=lambda n: (n["hat"], n.sayi("sira")))
    baslik("Müfredat (iki hat)")
    for hat, ikon in (("fiil", "🔧"), ("isim", "🧱")):
        ks = [n for n in gr if n["hat"] == hat]
        kalan = [n for n in ks if n["durum"] != "temiz" and not I.onarimda(n)]
        odak = next((n for n in kalan if n["on"] != "true"), None)
        on = next((n for n in kalan if n["on"] == "true"), None)
        print(f"\n{ikon} {hat} hattı")
        if odak:
            kd = odak.sayi("kademe")
            ders_bos = "## Ders notu" in odak.metin and not re.search(r"## Ders notu\s*\n\s*\S", odak.metin)
            print(f"  ODAK: {odak['id']} {odak['baslik']} · K{kd} · pencere {odak['pencere'] or '–'} · durum {odak['durum']}"
                  + (" · DERS NOTU BOŞ (doldur)" if ders_bos else ""))
            if kd == 0:
                print(f"  (kademe 0: odak yoklamada, {odak['yoklama']})")
        if on:
            print(f"  ÖN KONU: {on['id']} {on['baslik']} · K{on.sayi('kademe')} · pencere {on['pencere'] or '–'}")
        # yoklama penceresi: kademe 0'daki odak + sıradaki 2 açık yoklama
        sonra = [n for n in kalan if n is not odak and n is not on]
        yk = ([odak] if odak and odak.sayi("kademe") == 0 else []) + \
             [n for n in sonra if not (n["yoklama"] or "").startswith("hata") and n["yoklama"] != "gecti"][:2]
        for n in yk:
            alt = [a for a in n.liste("alt") if not a.startswith("kenar:")]
            eksik = [a for a in alt if a not in n.liste("yoklama_alt")]
            soru = 6 if n is odak else 3
            print(f"  YOKLAMA ({soru} soru): {n['id']} {n['baslik']} · {n['yoklama'] or '0/0/0'}"
                  + (f" · eksik alt: {', '.join(eksik)}" if eksik else "") + ("" if alt else " · `alt` listesi YOK (önce yaz)"))

    # ---- tekrar
    baslik("Tekrar bölümü (toplam en fazla ~12 soru)")
    onarim = [n for n in gr if I.onarimda(n)]
    yayilim = [n for n in gr if I.yayilimda(n, gun)]
    vade = [n for n in gr if n["durum"] == "temiz" and n not in yayilim and n["sonraki_tekrar"] and n["sonraki_tekrar"] <= gun]
    for n in onarim:
        dar = f" · ESKİ DAR: {', '.join(n.liste('dar'))}" if n["dar"] else ""
        print(f"  ONARIM (3–6 soru): {n['id']} {n['baslik']} · pencere {n['pencere'] or '–'}{dar}")
    for n in yayilim:
        print(f"  YAYILIM (2–3 soru + arka planda): {n['id']} {n['baslik']} · {n['yayilim']} tarihine kadar")
    for n in vade:
        print(f"  VADESİ GELDİ (2–3 soru): {n['id']} {n['baslik']} · adım {n['adim']}")
    if not (onarim or yayilim or vade):
        print("  –")

    # ---- alt beceri raporu (kırmızılar, son hatalar)
    baslik("Alt beceri durumu (ilerleme.py alt)")
    I.alt_raporu()

    baslik("Sınırlar (ilerleme.py sinir)")
    I.sinir_raporu()

    # ---- kelime teması
    baslik("Kelime temaları")
    kel = sorted((n for n in notlar.values() if n["tur"] == "kelime"), key=lambda n: n["id"])
    aday = [n for n in kel if n["durum"] in ("zayif", "ogreniliyor", "yeni") and (not n["sonraki_tekrar"] or n["sonraki_tekrar"] <= gun)]
    for n in aday[:4]:
        print(f"  {n['id']} {n['baslik']} · {n['durum']} · ustalık {n['ustalik'] or 0} · sonraki {n['sonraki_tekrar'] or '–'}")
    if not aday:
        print("  vadesi gelen tema yok; sıradaki `yeni` ya da en zayıf temayı seç")

    # ---- beceri günü (Kurallar → Beceri günleri, canlı)
    baslik("Günün becerisi (Kurallar → Beceri günleri)")
    ad = GUNLER[gd.weekday()]
    for s in kurallar.split("\n"):
        if s.startswith("| ") and ad in s.split("|")[1]:
            print("  " + s)
    p09 = notlar.get("P-09")
    if p09:
        print(f"  Schreiben aşaması (P-09): {p09['asama'] or p09.fm.get('asama') or '?'}")
    if gd.weekday() == 6:
        print("  Pazar: kartlardan önce `## 🗣 Sesli` bölümü (rol sesli).")
    tum_teil = sorted(n for n in notlar if n.startswith("P-"))
    print("  Teile: " + " · ".join(f"{t} {notlar[t]['ustalik'] or '–'}" for t in tum_teil))

    # ---- kademe tanımları (canlı)
    m = re.search(r"### Kademeler\n(.*?)\n### ", kurallar, re.S)
    satirlar = [s for s in (m.group(1) if m else "").split("\n") if re.match(r"^\| \d \| ", s)]
    if satirlar:
        baslik("Kademe tanımları (Kurallar → Kademeler)")
        print("\n".join("  " + s for s in satirlar))

    # ---- önceki sonuç notu
    baslik("Önceki antrenmanın notları")
    onceki = None
    for p in sorted(glob.glob(yol("05 Günlük", "20*.md")), reverse=True):
        ad_ = os.path.basename(p)[:10]
        if ad_ < gun and fm(open(p, encoding="utf-8").read()).get("durum") == "tamamlandi":
            onceki = p
            break
    if onceki:
        t = open(onceki, encoding="utf-8").read()
        print(f"  ({os.path.basename(onceki)})")
        m = re.search(r"\*\*Yarın bağlamda:\*\*.*", t)
        if m:
            print("  " + m.group(0))
        m = re.search(r"> \[!note\]- Yarının antrenmanı için notlar\n((?:>.*\n?)+)", t)
        if m:
            print("\n".join("  " + s for s in m.group(1).rstrip().split("\n")))
        m = re.search(r"\*\*Hata türleri:\*\*.*", t)
        if m:
            print("  " + m.group(0))

    # ---- Fehlerlog: son 7 gün
    baslik("Hata türleri · son 7 gün")
    bas7 = gun_ekle(gun, -7)
    say = collections.Counter()
    for p in glob.glob(yol("06 Fehlerlog", "*.md")):
        for s in open(p, encoding="utf-8"):
            m = re.match(r"- (\d{4}-\d\d-\d\d):", s)
            if m and bas7 <= m.group(1) < gun:
                say[os.path.basename(p)[:-3]] += 1
    print("  " + (" · ".join(f"{e} {c}" for e, c in say.most_common(10)) or "–"))

    # ---- mini drill
    baslik("Mini drill")
    acik = False
    for p in sorted(glob.glob(yol("09 Drill", "Mini *.md"))):
        f = fm(open(p, encoding="utf-8").read())
        if f.get("durum") != "acik":
            continue
        acik = True
        d = jsonoku(f"_kisisel/drill/{f.get('set')}.durum.json", {})
        basladi = bool(d.get("gecmis") or (d.get("aktif") or {}).get("cevaplar"))
        eski = f.get("acilis", gun) <= gun_ekle(gun, -2)
        print(f"  AÇIK: [[{os.path.basename(p)[:-3]}]] · açılış {f.get('acilis')} · "
              + ("başlandı" if basladi else ("HİÇ BAŞLANMADI (2+ gün: satırı güçlendir)" if eski else "henüz başlanmadı")))
    if not acik:
        print("  açık mini drill yok")

    # ---- yıpranmış kelimeler (cesitlilik.py ile aynı hesap)
    baslik("Yıpranmış kelimeler · bugün kaçın (izinli değilse)")
    C = modul("cesitlilik", yol("_sistem", "cesitlilik.py"))
    gecmis = []
    for d in sorted(glob.glob(yol("05 Günlük", "veri", "*.json")), reverse=True):
        a = os.path.basename(d)
        if a.endswith(".cevap.json") or not re.match(r"\d{4}-\d{2}-\d{2}\.json$", a) or a[:10] >= gun:
            continue
        gecmis.append(json.load(open(d, encoding="utf-8")))
    gorulme = collections.Counter()
    for v in gecmis[:C.SEANS]:
        g = set()
        for b, q in C.gramer_sorulari(v):
            g |= C.icerik(C.soru_metni(q, (v.get("sonuc") or {}).get(q["id"]))[1])
        gorulme.update(w for w in g if not w.startswith("tr:"))
    yip = [f"{w} ({c})" for w, c in gorulme.most_common() if c >= C.YIPRANMIS]
    print("  " + (", ".join(yip[:40]) or "–"))

    # ---- tıklama sinyali ve kartlar
    baslik("Tıklama sinyali ve kartlar")
    subprocess.run([sys.executable, "-I", yol("_sistem", "sozluk", "sinyal.py"), gun], capture_output=True)
    sin = jsonoku("_kisisel/sozluk/sinyal.json", {}).get("kelimeler", {})
    for dur, ne in (("sik_bakiyor", "3–5 tanesini alıştırmalara/günlüğe koy"), ("istek", "isim/fiil/sıfatsa karta ekle"),
                    ("kartta_takili", "bağlam içinde geçir")):
        ws = [f"{k} ({v['sayi']})" + ("" if v.get("kart") else " · kartı yok") for k, v in sin.items() if v["durum"] == dur and not v.get("ozel")]
        if ws:
            print(f"  {dur} → {ne}: {', '.join(ws)}")
    tik = jsonoku("_kisisel/sozluk/tiklananlar.json", {}).get("kelimeler", {})
    yok = [k for k, v in tik.items() if v.get("tr") is None]
    if yok:
        print(f"  sözlükte olmayan tıklanmış kelime (Almancaysa ekle; eksik.py listeler): {', '.join(yok)}")
    isaretsiz = [k for k, v in tik.items() if "karta_eklendi" not in v]
    if isaretsiz:
        print(f"  `karta_eklendi` yazılacak: {len(isaretsiz)} kayıt")
    durum = jsonoku("_kisisel/kartlar/durum.json", {"kartlar": {}, "planlar": {}})
    deste = {k["id"]: k for k in jsonoku("_sistem/kartlar/deste.json", {"kartlar": []})["kartlar"]}
    for k in jsonoku("_kisisel/kartlar/deste.json", {"kartlar": []}).get("kartlar", []):
        deste[k["id"]] = {**deste.get(k["id"], {}), **k}
    inatci = [deste.get(i, {}).get("de", i) for i, s in durum.get("kartlar", {}).items()
              if (s.get("inatci") or {}).get("bas", "") >= gun_ekle(gun, -3)]
    if inatci:
        print(f"  İNATÇI kartlar (🧷 bölümü + kanca): {', '.join(inatci)}")
    sev = collections.defaultdict(lambda: [0, 0])
    for k in deste.values():
        if k.get("deste") == "kelime" and not k.get("arsiv"):
            sev[k.get("seviye")][1] += 1
            if durum["kartlar"].get(k["id"], {}).get("tamam"):
                sev[k.get("seviye")][0] += 1
    seviyeler = sorted(s for s in sev if isinstance(s, int))
    if seviyeler:
        en = seviyeler[-1]
        print("  Kelime destesi (öğrenilen/toplam): " + " · ".join(f"S{s} {sev[s][0]}/{sev[s][1]}" for s in seviyeler)
              + (f" → S{en}'in %30'u öğrenildi: sıradaki 100 kelimeyi ekle" if sev[en][1] and sev[en][0] / sev[en][1] >= 0.3 else ""))
    plan = durum.get("planlar", {}).get(dun, {}).get("cumle")
    if plan:
        ilk = sum(1 for p in plan if p.get("sonuc") == "sag" and not p.get("sol"))
        sol = sum(1 for p in plan if p.get("sol"))
        oneri = "seviye +1" if ilk == len(plan) else ("seviye −1" if sol > len(plan) / 2 else "seviye aynı")
        print(f"  Dünkü cümle kartları: {ilk}/{len(plan)} ilk seferde sağ, {sol} sola → {oneri}")
    ids = [int(k[2:]) for k in deste if re.match(r"[ck]-\d+$", k)]
    print(f"  Sıradaki id'ler: c-{max(int(k[2:]) for k in deste if k.startswith('c-')) + 1:04d} · "
          f"k-{max(int(k[2:]) for k in deste if k.startswith('k-')) + 1:04d}" if ids else "")

    # ---- Tempelhof
    baslik("Tempelhof günlüğü")
    bugunku = glob.glob(yol("08 Tempelhof", f"{gun} *.md"))
    if bugunku:
        print(f"  Bugünün günlüğü zaten var: {os.path.basename(bugunku[0])}")
    hik = oku("_kisisel/Hikâye.md", "")
    satir = [s for s in hik.split("\n") if re.match(r"^\| \d+ \| \d{4}-", s)]
    if satir:
        son = [x.strip() for x in satir[-1].split("|")[1:-1]]
        tag, yazar = int(son[0]), son[2]
        i = next((j for j, a in enumerate(YAZARLAR) if a.split()[-1] in yazar), -1)
        sira = YAZARLAR[(i + 1) % len(YAZARLAR)]
        hook = re.search(r"\*Hook: (.*?)\*", son[3])
        print(f"  Son kayıt: Tag {tag} · {yazar} · hook: {hook.group(1) if hook else '?'}")
        print(f"  Sıradaki: Tag {tag + 1} · yazar {sira}")
        sez = oku("_sistem/Tempelhof/Sezon 1.md", "")
        v = next((s for s in sez.split("\n") if re.match(rf"^\| {tag + 1} \| ", s)), None)
        print(f"  Vuruş (spoiler, kullanıcıya söyleme): {v or 'Sezon 1 tablosunda yok'}")
        sesler = oku("_sistem/Tempelhof/Karakterler.md", "")
        sv = next((s for s in sesler.split("\n") if s.startswith(f"| {sira.split()[-1]} ") or s.startswith(f"| {sira} ")), None)
        if sv:
            print(f"  Ses tercihi: {sv.split('|')[2].strip()}")
    else:
        print("  Hikâye kaydı boş: Tag 1'den başla (Sezon 1 → Akt 1).")
    odaklar = [n for n in gr if n["durum"] == "ogreniliyor" and n["on"] != "true"]
    seviye = min((n["seviye"] for n in odaklar if n["seviye"] in HIZ), default="A1")
    print(f"  Ses hızı: {HIZ[seviye]} (seviye {seviye}; A2 165, B1 180)")


if __name__ == "__main__":
    main()
