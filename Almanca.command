#!/bin/bash
# Almanca Vault arayüzünü her tarayıcıda açar (Safari, Firefox, Chrome). Çift tıkla; kapatmak için bu pencereyi kapat.
cd "$(dirname "$0")" || exit 1
exec python3 -I "_sistem/web/sunucu.py"
