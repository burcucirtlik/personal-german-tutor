#!/usr/bin/env python3
"""Antrenman notunu soru dosyasından üretir ve dinleme seslerini oluşturur.

  python3 -I _sistem/antrenman/not_yaz.py 2026-11-28            # 05 Günlük/2026-11-28.md (kuru: ekrana yazar)
  python3 -I _sistem/antrenman/not_yaz.py 2026-11-28 --yaz      # dosyaya yazar (varsa üstüne yazmaz; --zorla)
  python3 -I _sistem/antrenman/not_yaz.py 2026-11-28 --ses      # eksik dinleme seslerini üretir (_sistem/ses.py)

Soru dosyası (`05 Günlük/veri/<gün>.json`) alıştırma ekranının alanlarına ek olarak şunları taşıyabilir
(ekran bunları yok sayar; antrenman skill'i → 5. adım):
  üst düzey  "not": {"dakika": 45, "kisa": false, "baslik": "Antrenman · 28 Kasım 2026",
                     "ust": [kutu, …],            # özetin altındaki kutular (mini drill hatırlatması …)
                     "tempelhof": "2026-11-28 Bernd"}
  bölüm      "not_baslik": "…"                    # yoksa rol ve konudan üretilir
             "kutu": {"tip": "tip", "baslik": "…", "metin": "satır\\nsatır"}   # ya da kutu listesi
             "ders": {"not": "A1-11 Trennbare Verben", "baslik": "ayrılabilen fiiller", "acik": true, "bolum": "Kartlar"}
             "dinle": {"baslik": "Her konuşmayı bir kez dinleyebilirsin", "hak": 1, "hiz": 150,
                       "sesler": [{"dosya": "2026-11-28-1.m4a", "metin": "…", "tercih": "Anna,Petra"}],
                       "metin_baslik": "Metinler (cevapladıktan sonra aç)"}
Kart bölümü ve Tempelhof satırı her zaman eklenir (kart adedi Profil → kart_adet).
"""
import datetime as dt
import glob
import json
import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
HAT = {"fiil": ("🔧", "Fiil"), "isim": ("🧱", "İsim")}


def yol(*p):
    return os.path.join(KOK, *p)


def fm(metin):
    m = re.match(r"---\n(.*?)\n---", metin or "", re.S)
    return {mm.group(1): mm.group(2).strip() for s in (m.group(1).split("\n") if m else [])
            for mm in [re.match(r"^([a-z_]+):\s*(.*)$", s)] if mm}


def konu_dosyalari():
    d = {}
    for klasor in ("03 Grammatik", "02 Wortschatz", "01 Sınav/Teile"):
        for p in glob.glob(yol(klasor, "*.md")):
            f = fm(open(p, encoding="utf-8").read())
            if f.get("id"):
                d[f["id"]] = {"dosya": os.path.basename(p)[:-3], "hat": f.get("hat"), "baslik": f.get("baslik")}
    return d


def kutu_yaz(k):
    if not k:
        return []
    out = []
    for x in (k if isinstance(k, list) else [k]):
        satirlar = str(x.get("metin", "")).split("\n") if x.get("metin") else []
        out += [f"> [!{x.get('tip', 'tip')}]{'-' if x.get('kapali') else ''} {x.get('baslik', '')}".rstrip()]
        out += [f"> {s}".rstrip() for s in satirlar]
        out.append("")
    return out


def dv(kod):
    return ["```dataviewjs", kod, "```", ""]


def js(v):
    return json.dumps(v, ensure_ascii=False)


def bolum_basligi(b, K):
    if b.get("not_baslik"):
        return b["not_baslik"]
    rol, k = b.get("rol"), K.get(b.get("konu") or "", {})
    if rol in ("odak", "on") and k:
        ikon, ad = HAT.get(k.get("hat"), ("🔧", ""))
        on = " · ön konu" if rol == "on" else ""
        return f"{ikon} {ad} hattı{on} · [[{k['dosya']}]] · K{b.get('kademe', '?')}"
    if rol == "yoklama":
        return "🔎 Yoklama"
    if rol == "tekrar":
        return "🔁 Tekrar"
    if rol == "kelime" and k:
        return f"🔤 Kelime · [[{k['dosya']}]]"
    if rol == "inatci":
        return "🧷 İnatçı kelimeler"
    if rol == "sesli":
        return "🗣 Sesli"
    return b.get("baslik", "")


def not_metni(gun, veri, profil, ses_var):
    K = konu_dosyalari()
    n = veri.get("not", {})
    gd = dt.date.fromisoformat(gun)
    konular = []
    for b in veri["bolumler"]:
        for k in [b.get("konu"), b.get("teil")] + [q.get("konu") for q in b.get("sorular", [])]:
            if k and k not in konular:
                konular.append(k)
    satir = ["---", f"tarih: {gun}", "tur: gunluk", "durum: bekliyor", f"dakika: {n.get('dakika', profil.get('gunluk_dakika', 45))}"]
    if n.get("kisa"):
        satir.append("kisa: true")
    satir += ["puan:", f"veri: 05 Günlük/veri/{gun}.json", f"konular: [{', '.join(konular)}]", "cssclasses: [antrenman]", "---",
              f"# {n.get('baslik') or f'Antrenman · {gd.day} {AYLAR[gd.month - 1]} {gd.year}'}", ""]
    satir += dv(f'await dv.view("_sistem/alistirma", {{ gun: "{gun}", ozet: true }})')
    satir += kutu_yaz(n.get("ust"))
    sesli = [b for b in veri["bolumler"] if b.get("rol") == "sesli"]
    for b in [b for b in veri["bolumler"] if b.get("rol") != "sesli"] + sesli:
        satir += [f"## {b['no']}. {bolum_basligi(b, K)}", ""]
        satir += kutu_yaz(b.get("kutu"))
        if b.get("ders"):
            d = b["ders"]
            arg = f'not: {js(d["not"])}, baslik: {js(d.get("baslik", ""))}'
            if d.get("acik"):
                arg += ", acik: true"
            if d.get("bolum"):
                arg += f", bolum: {js(d['bolum'])}"
            satir += dv(f'await dv.view("_sistem/ders", {{ {arg} }})')
        dn = b.get("dinle")
        if dn:
            if ses_var:
                hak = dn.get("hak")
                satir.append(f"> [!dinle] {dn.get('baslik', 'Dinle')}")
                satir += [f"> ![[{s['dosya']}{f'|dinleme:{hak}' if hak else ''}]]" for s in dn["sesler"]]
                satir.append("")
            else:
                satir.append("> [!dinle] Metni sesli oku ya da cümlelere tıklayıp 🗣 ile dinle")
                satir += [f"> {i}. {s['metin']}" if len(dn["sesler"]) > 1 else f"> {s['metin']}" for i, s in enumerate(dn["sesler"], 1)]
                satir.append("")
        satir += dv(f'await dv.view("_sistem/alistirma", {{ gun: "{gun}", bolum: {b["no"]} }})')
        if dn and ses_var and dn.get("metin_baslik", "Metinler (cevapladıktan sonra aç)"):
            satir.append(f"> [!note]- {dn.get('metin_baslik', 'Metinler (cevapladıktan sonra aç)')}")
            satir += [f"> {i}. {s['metin']}" if len(dn["sesler"]) > 1 else f"> {s['metin']}" for i, s in enumerate(dn["sesler"], 1)]
            satir.append("")
    adet = profil.get("kart_adet", "10")
    satir += ["## 🃏 Kartlar",
              "Kartı çevirmek için üstüne dokun. Biliyorsan **sağa**, bilmiyorsan **sola** at (ya da ✓ / ✗ düğmeleri, klavyede ← →). "
              "Sola attıkların bugün tekrar gelir.", ""]
    satir += dv(f'await dv.view("_sistem/kartlar", {{ gun: "{gun}", deste: "kelime", adet: {adet} }})')
    satir += dv(f'await dv.view("_sistem/kartlar", {{ gun: "{gun}", deste: "cumle", adet: {adet} }})')
    tp = n.get("tempelhof") or next((os.path.basename(p)[:-3] for p in glob.glob(yol("08 Tempelhof", f"{gun} *.md"))), None)
    if tp:
        ad = tp[len(gun) + 1:]
        satir += ["## 📓 Tempelhof günlüğü", f"Bugün [[{tp}|{ad}]] yazdı. Dinle, oku ve kağıda geçir (~10 dk).", ""]
    return "\n".join(satir).rstrip() + "\n"


def sesleri_uret(gun, veri):
    for b in veri["bolumler"]:
        dn = b.get("dinle") or {}
        for s in dn.get("sesler", []):
            hedef = yol("05 Günlük", "ses", s["dosya"])
            if os.path.exists(hedef):
                print(f"  var: {s['dosya']}")
                continue
            os.makedirs(os.path.dirname(hedef), exist_ok=True)
            k = [sys.executable, "-I", yol("_sistem", "ses.py"), "--tercih", s.get("tercih", "Anna,Petra"),
                 "--hiz", str(s.get("hiz") or dn.get("hiz") or 150), "--cikti", hedef, "--metin", s["metin"]]
            r = subprocess.run(k, capture_output=True, text=True)
            print(f"  {'✓' if r.returncode == 0 else '✗'} {s['dosya']} {r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr.strip()[-200:]}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    gun = args[0] if args else dt.date.today().isoformat()
    vp = yol("05 Günlük", "veri", f"{gun}.json")
    if not os.path.exists(vp):
        sys.exit(f"Soru dosyası yok: {vp}")
    veri = json.load(open(vp, encoding="utf-8"))
    profil = fm(open(yol("_kisisel", "Profil.md"), encoding="utf-8").read()) if os.path.exists(yol("_kisisel", "Profil.md")) else {}
    try:
        ses_var = json.load(open(yol("_kisisel", "ortam.json"), encoding="utf-8")).get("ses", True)
    except (OSError, ValueError):
        ses_var = True
    if "--ses" in sys.argv:
        if not ses_var:
            print("Bu bilgisayarda ses üretilemiyor (_kisisel/ortam.json → ses: false); dinleme metni notta açık verilir.")
        else:
            sesleri_uret(gun, veri)
    metin = not_metni(gun, veri, profil, ses_var)
    hedef = yol("05 Günlük", f"{gun}.md")
    if "--yaz" in sys.argv:
        if os.path.exists(hedef) and "--zorla" not in sys.argv:
            sys.exit(f"Not zaten var: {hedef} (üstüne yazmak için --zorla)")
        open(hedef, "w", encoding="utf-8").write(metin)
        print(f"Yazıldı: 05 Günlük/{gun}.md")
    elif "--ses" not in sys.argv:
        print(metin)


if __name__ == "__main__":
    main()
