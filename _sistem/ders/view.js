// Ders notu kutusu: konu notundaki bir bölümü (varsayılan "Ders notu") açılır-kapanır kutuda gösterir.
// Callout + embed yerine kullanılır, çünkü canlı önizlemede callout'a tıklayınca ham markdown açılıyor.
//   await dv.view("_sistem/ders", { not: "A1-17 Perfekt mit haben", baslik: "Perfekt mit haben", acik: false })
//   await dv.view("_sistem/ders", { not: "W-A1-01 Begrüßung und Vorstellung", bolum: "Kartlar", baslik: "Kelimeler" })

const BOLUM = input.bolum || "Ders notu";
const sayfa = dv.page(input.not);
const kok = dv.container.createEl ? dv.container.createEl("details", { cls: "ds-root" }) : dv.container.appendChild(Object.assign(document.createElement("details"), { className: "ds-root" }));
if (input.acik) kok.setAttribute("open", "");
for (const t of ["mousedown", "click", "pointerdown"]) kok.addEventListener(t, (e) => e.stopPropagation());

const ozet = document.createElement("summary");
ozet.className = "ds-summary";
ozet.textContent = "📘 " + (input.baslik ? (BOLUM === "Ders notu" ? "Ders notu: " : "") + input.baslik : BOLUM);
kok.appendChild(ozet);
const govde = document.createElement("div");
govde.className = "ds-body";
kok.appendChild(govde);

if (!sayfa) {
  govde.textContent = "Not bulunamadı: " + input.not;
} else {
  const metin = await app.vault.adapter.read(sayfa.file.path);
  const parca = metin.split(new RegExp("^## " + BOLUM + "\\s*$", "m"))[1];
  let icerik = parca ? parca.split(/^## /m)[0].trim() : "";
  if (BOLUM === "Kartlar") {
    // "almanca::türkçe" satırlarını tabloya çevir
    const satirlar = icerik.split("\n").filter((s) => s.includes("::"));
    icerik = "| Almanca | Türkçe |\n|---|---|\n" + satirlar.map((s) => "| " + s.split("::").map((x) => x.trim().replace(/\|/g, "/")).join(" | ") + " |").join("\n");
  }
  if (!icerik || icerik.startsWith("*Bu bölümü Claude")) {
    govde.textContent = "Bu ders notu henüz yazılmadı.";
  } else {
    dv.el("div", icerik, { container: govde });
    const git = document.createElement("a");
    git.className = "ds-link";
    git.textContent = "Konu notunu aç →";
    git.addEventListener("click", (e) => {
      e.preventDefault();
      app.workspace.openLinkText(sayfa.file.path, "", false);
    });
    govde.appendChild(git);
  }
}
