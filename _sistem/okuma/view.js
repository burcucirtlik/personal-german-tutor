// Okuma metni: her kelimeye tıklayınca Türkçesi çıkar. Günlük notlarında:
//   await dv.view("_sistem/okuma", { tarih: "Freitag, 23. Oktober", kaynak: "Tag 1", metin: `Paragraf 1…\n\nParagraf 2…` })

const kod = await app.vault.adapter.read("_sistem/sozluk/sozluk.js");
const sozluk = await new Function("app", kod)(app)();

const kok = dv.container.createDiv ? dv.container.createDiv({ cls: "ok-root" }) : dv.container.appendChild(Object.assign(document.createElement("div"), { className: "ok-root" }));
if (input.tarih) {
  const t = document.createElement("div");
  t.className = "ok-date";
  t.textContent = input.tarih;
  kok.appendChild(t);
}
for (const paragraf of String(input.metin || "").trim().split(/\n\s*\n/)) {
  const p = document.createElement("p");
  p.className = "ok-p";
  sozluk.yaz(p, paragraf.replace(/\s*\n\s*/g, " "), input.kaynak);
  kok.appendChild(p);
}
const ipucu = document.createElement("div");
ipucu.className = "ok-hint";
ipucu.textContent = "💡 Bilmediğin kelimeye tıkla, Türkçesi çıksın. Tıkladıkların sarı kalır ve kelime kartlarına eklenir.";
kok.appendChild(ipucu);
