"""Almanca Vault arayüzünü her tarayıcıda açan küçük yerel sunucu.

Almanca.command buna çift tıklayınca çalıştırır:  python3 -I _sistem/web/sunucu.py
Sadece bu bilgisayardan (127.0.0.1) erişilir. Arayüz notları /api/* uçlarından okur ve cevapları yazar;
Chrome/Edge'de Almanca.html'yi doğrudan açmakla aynı işi görür, klasör izni istemez.
"""

import json
import mimetypes
import os
import re
import shutil
import socket
import sys
import tempfile
import threading
import unicodedata
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KOK = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PORT = 8765
ATLA = {".obsidian", ".claude", ".git", ".trash", "node_modules", "__pycache__"}
STATIK = ("Almanca.html", "_sistem/web/")
# Arayüz sadece cevap/durum dosyaları (.json) ve notlar (.md) yazar; kod ya da ses dosyalarının üstüne yazılamaz
YAZILABILIR = (".json", ".md")
# /api/sil sadece eski günlük yedek klasörlerini siler
YEDEK_GUN = re.compile(r"^_kisisel/yedek/\d{4}-\d{2}-\d{2}$")
mimetypes.add_type("audio/mp4", ".m4a")


def guvenli_yol(goreli):
    if goreli is None or "\x00" in goreli:
        raise PermissionError("geçersiz yol")
    tam = os.path.realpath(os.path.join(KOK, goreli.lstrip("/")))
    if tam != KOK and not tam.startswith(KOK + os.sep):
        raise PermissionError("vault dışı yol")
    parcalar = os.path.relpath(tam, KOK).split(os.sep)
    if any(p in ATLA for p in parcalar):
        raise PermissionError("gizli klasör")
    return tam


def listele():
    sonuc = []
    for dizin, klasorler, adlar in os.walk(KOK):
        klasorler[:] = [k for k in klasorler if k not in ATLA]
        for ad in adlar:
            if ad.startswith("."):
                continue
            tam = os.path.join(dizin, ad)
            try:
                st = os.stat(tam)
            except OSError:
                continue
            yol = unicodedata.normalize("NFC", os.path.relpath(tam, KOK).replace(os.sep, "/"))
            sonuc.append({"path": yol, "mtime": int(st.st_mtime * 1000), "size": st.st_size})
    return sonuc


class Isleyici(BaseHTTPRequestHandler):
    server_version = "AlmancaVault/1"

    def log_message(self, *a):
        pass

    def gonder(self, kod, govde=b"", tur="text/plain; charset=utf-8"):
        if isinstance(govde, str):
            govde = govde.encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", tur)
        self.send_header("Content-Length", str(len(govde)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(govde)

    def json(self, veri):
        self.gonder(200, json.dumps(veri, ensure_ascii=False), "application/json; charset=utf-8")

    def izinli(self):
        # Başka sitelerin bu sunucuya yazmasını engelle: sadece kendi adresimiz ve özel başlık
        host = self.headers.get("Host", "")
        if host not in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"):
            self.gonder(403, "host")
            return False
        return True

    def api_izinli(self):
        if not self.izinli():
            return False
        if self.headers.get("X-Almanca") != "1":
            self.gonder(403, "başlık eksik")
            return False
        return True

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        yol = urllib.parse.unquote(u.path)
        q = urllib.parse.parse_qs(u.query)
        p = q.get("p", [None])[0]
        try:
            if yol.startswith("/api/"):
                if not self.api_izinli():
                    return
                uc = yol[5:]
                if uc == "ping":
                    return self.json({"almanca": True})
                if uc == "list":
                    return self.json(listele())
                if uc == "exists":
                    return self.json({"var": os.path.exists(guvenli_yol(p))})
                if uc == "read":
                    tam = guvenli_yol(p)
                    if not os.path.isfile(tam):
                        return self.gonder(404, "yok: " + p)
                    with open(tam, "rb") as f:
                        veri = f.read()
                    tur = mimetypes.guess_type(tam)[0] or "application/octet-stream"
                    if tur.startswith("text/") or tam.endswith((".md", ".json", ".js", ".css")):
                        tur = (tur if tur.startswith("text/") else "text/plain") + "; charset=utf-8"
                    return self.gonder(200, veri, tur)
                return self.gonder(404, "bilinmeyen uç")
            if not self.izinli():
                return
            if yol == "/":
                self.send_response(302)
                self.send_header("Location", "/Almanca.html")
                self.end_headers()
                return
            goreli = yol.lstrip("/")
            if not goreli.startswith(STATIK):
                return self.gonder(404, "yok")
            tam = guvenli_yol(goreli)
            if not os.path.isfile(tam):
                return self.gonder(404, "yok")
            with open(tam, "rb") as f:
                veri = f.read()
            tur = mimetypes.guess_type(tam)[0] or "application/octet-stream"
            if tur.startswith("text/") or tur == "application/javascript":
                tur += "; charset=utf-8"
            self.gonder(200, veri, tur)
        except PermissionError as e:
            self.gonder(403, str(e))
        except Exception as e:  # noqa: BLE001
            self.gonder(500, str(e))

    def do_POST(self):
        u = urllib.parse.urlsplit(self.path)
        yol = urllib.parse.unquote(u.path)
        p = urllib.parse.parse_qs(u.query).get("p", [None])[0]
        try:
            if not self.api_izinli():
                return
            if yol == "/api/write":
                tam = guvenli_yol(p)
                if not tam.lower().endswith(YAZILABILIR):
                    raise PermissionError("bu dosya türü yazılamaz")
                uzunluk = int(self.headers.get("Content-Length", "0"))
                veri = self.rfile.read(uzunluk)
                os.makedirs(os.path.dirname(tam), exist_ok=True)
                fd, gecici = tempfile.mkstemp(dir=os.path.dirname(tam), prefix=".yaziliyor-")
                with os.fdopen(fd, "wb") as f:
                    f.write(veri)
                os.replace(gecici, tam)
                return self.json({"mtime": int(os.stat(tam).st_mtime * 1000)})
            if yol == "/api/mkdir":
                os.makedirs(guvenli_yol(p), exist_ok=True)
                return self.json({"tamam": True})
            if yol == "/api/sil":
                if not p or not YEDEK_GUN.match(p):
                    raise PermissionError("sadece _kisisel/yedek/<gün> silinebilir")
                tam = guvenli_yol(p)
                if os.path.islink(tam) or tam != os.path.join(KOK, *p.split("/")):
                    raise PermissionError("geçersiz yedek yolu")
                if os.path.isdir(tam):
                    shutil.rmtree(tam)
                return self.json({"tamam": True})
            self.gonder(404, "bilinmeyen uç")
        except PermissionError as e:
            self.gonder(403, str(e))
        except Exception as e:  # noqa: BLE001
            self.gonder(500, str(e))


def zaten_calisiyor(port):
    try:
        r = urllib.request.Request(f"http://127.0.0.1:{port}/api/ping", headers={"X-Almanca": "1"})
        with urllib.request.urlopen(r, timeout=1) as yanit:
            return json.load(yanit).get("almanca") is True
    except Exception:  # noqa: BLE001
        return False


def main():
    acma = "--acma" in sys.argv
    port = PORT
    for a in sys.argv[1:]:
        if a.startswith("--port="):
            port = int(a.split("=", 1)[1])
    if zaten_calisiyor(port):
        print(f"Zaten açık: http://127.0.0.1:{port}/Almanca.html")
        if not acma:
            webbrowser.open(f"http://127.0.0.1:{port}/Almanca.html")
        return
    try:
        sunucu = ThreadingHTTPServer(("127.0.0.1", port), Isleyici)
    except OSError:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        sunucu = ThreadingHTTPServer(("127.0.0.1", port), Isleyici)
    adres = f"http://127.0.0.1:{port}/Almanca.html"
    print("Almanca Vault açık:", adres)
    print("Kapatmak için bu pencereyi kapat ya da Ctrl+C.")
    if not acma:
        threading.Timer(0.4, lambda: webbrowser.open(adres)).start()
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
