#!/usr/bin/env python3
"""İlk kurulum ve ortam denetimi. Claude ilk açılışta ve /seviye başında çalıştırır; tekrar çalıştırmak zararsızdır.

  python3 -I _sistem/kurulum/baslat.py

- Kişisel klasörü (`_kisisel/`) ve not klasörlerini şablonlardan kurar (var olana dokunmaz).
- Eski düzende bir klasörse (ilerleme konu notlarında) taşımayı önerir.
- Ortamı denetler ve `_kisisel/ortam.json`'a yazar: Python sürümü, Almanca ses (macOS `say`) var mı.
Çıktının sonunda kullanıcıya iletilecek sade bir özet vardır.
"""
import datetime as dt
import json
import os
import platform
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import motor as M  # noqa: E402

KOK = M.KOK


def almanca_sesler():
    if not shutil.which("say"):
        return []
    try:
        cikti = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=20).stdout
    except (OSError, subprocess.TimeoutExpired):
        return []
    return [m.group(1).strip() for s in cikti.splitlines() if (m := re.match(r"^(.*?)\s+(de_[A-Z]{2})\s+#", s))]


def main():
    notlar = []
    if os.path.exists(os.path.join(KOK, "_sistem", "Profil.md")):
        print("⚠️ Bu klasör eski düzende (ilerleme konu notlarında). Önce: python3 -I _sistem/kurulum/tasi.py --yaz")
        sys.exit(2)
    olusan = M.kisisel_hazirla()
    if olusan:
        print("Kuruldu: " + ", ".join(olusan))

    sesler = almanca_sesler()
    kaliteli = [s for s in sesler if re.search(r"premium|enhanced|gelişmiş|erweitert", s, re.I)]
    ortam = {
        "tarih": dt.date.today().isoformat(),
        "sistem": platform.system(),
        "python": platform.python_version(),
        "ses": bool(sesler),
        "sesler": sesler,
        "kaliteli_ses": bool(kaliteli),
    }
    with open(os.path.join(KOK, "_kisisel", "ortam.json"), "w", encoding="utf-8") as f:
        json.dump(ortam, f, ensure_ascii=False, indent=1)

    if sys.version_info < (3, 9):
        notlar.append(f"Python {platform.python_version()} eski; 3.9 ya da üstü gerekiyor.")
    if not sesler:
        notlar.append("Bu bilgisayarda Almanca ses dosyası üretilemiyor (macOS dışı ya da Almanca ses yok). Dinleme "
                      "metinleri yazılı gelir; tek tek cümleleri kelime balonundaki 🗣 düğmesiyle tarayıcıda dinleyebilirsin.")
    elif not kaliteli:
        notlar.append("Almanca sesler var ama kaliteli (Premium) değil. Daha doğal ses için: Sistem Ayarları → "
                      "Erişilebilirlik → Konuşulan İçerik → Sistem sesi → Sesleri Yönet… → Almanca → Anna (Premium).")

    profil = M.alanlar(M.frontmatter_bol(open(os.path.join(KOK, "_kisisel", "Profil.md"), encoding="utf-8").read())[0] or [])
    durum = profil.get("seviye_tespiti") or "bekliyor"
    print(f"Sistem: {ortam['sistem']} · Python {ortam['python']} · Almanca ses: "
          + (f"{len(sesler)} ({'kaliteli var' if kaliteli else 'standart'})" if sesler else "yok"))
    print(f"Seviye tespiti: {durum}")
    for n in notlar:
        print("• " + n)
    print("\nSıradaki adım: " + ("/seviye (seviye tespiti)" if durum != "tamamlandi" else "/antrenman"))


if __name__ == "__main__":
    main()
