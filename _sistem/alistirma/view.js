// Etkileşimli alıştırma ekranı. Günlük notta her bölüm için:
//   await dv.view("_sistem/alistirma", { gun: "2026-10-24", bolum: 1 })
// Özet kartı için: { gun: "2026-10-24", ozet: true }
// Sorular ve /kontrol sonuçları: 05 Günlük/veri/<gun>.json
// Cevaplar (her yazışta kaydedilir): 05 Günlük/veri/<gun>.cevap.json

const GUN = input.gun;
const SORU_YOLU = `05 Günlük/veri/${GUN}.json`;
const CEVAP_YOLU = `05 Günlük/veri/${GUN}.cevap.json`;
const adapter = app.vault.adapter;

const TIPLER = {
  bosluk: { ikon: "✏️", ad: "Boşluk doldur", renk: "mor" },
  secmeli: { ikon: "🔘", ad: "Seç", renk: "mavi" },
  hata: { ikon: "🔍", ad: "Hatayı düzelt", renk: "kirmizi" },
  ceviri: { ikon: "🌍", ad: "Çevir", renk: "yesil" },
  yaz: { ikon: "🧩", ad: "Cümle kur", renk: "turuncu" },
  dogruyanlis: { ikon: "⚖️", ad: "Richtig / falsch", renk: "turkuaz" },
  eslestir: { ikon: "🔗", ad: "Eşleştir", renk: "pembe" },
  yazma: { ikon: "📝", ad: "Yaz", renk: "sari" },
  donustur: { ikon: "🔄", ad: "Dönüştür", renk: "lacivert" },
  kutula: { ikon: "🗂️", ad: "Kutula", renk: "turkuaz" },
};

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  if (parent) parent.appendChild(e);
  return e;
}

// Obsidian kısayollarının ve düzenleyicinin tuş/tıklama olaylarını yakalamasını engelle
function yalit(e) {
  for (const t of ["keydown", "keyup", "keypress", "mousedown", "mouseup", "click", "beforeinput", "input", "paste"]) {
    e.addEventListener(t, (ev) => ev.stopPropagation());
  }
  return e;
}

// Okunamayan JSON: varsayılanla devam et ama o dosyaya bu oturumda hiç yazma (boş cevaplarla üstüne yazılmasın)
const BOZUK = (window.__almancaBozuk = window.__almancaBozuk || new Set());
function bozukUyar(yol) {
  if (dv.container.querySelector(`[data-bozuk="${yol}"]`)) return;
  const b = document.createElement("div");
  b.dataset.bozuk = yol;
  b.style.cssText = "margin:6px 0;padding:10px 14px;border-radius:10px;background:#b3261e;color:#fff;font-weight:600;font-size:0.9em";
  b.textContent = `⚠️ ${yol} okunamadı (bozuk ya da yarım yazılmış olabilir). Cevapların silinmesin diye bu dosyaya bu oturumda yazılmıyor. Claude'a söyle ya da _kisisel/yedek/ içinden geri yükle; sonra sayfayı yenile.`;
  dv.container.prepend(b);
}
async function jsonOku(yol, varsayilan) {
  try {
    if (!(await adapter.exists(yol))) return varsayilan;
    return JSON.parse(await adapter.read(yol));
  } catch (err) {
    console.error("alistirma: okunamadı", yol, err);
    BOZUK.add(yol);
    bozukUyar(yol);
    return varsayilan;
  }
}

// Aynı gündeki bütün bölümler tek bir cevap nesnesini paylaşır. Bloklar aynı anda
// çalıştığı için okuma sözü (promise) paylaşılır; yoksa her blok kendi nesnesini alır
// ve son kaydeden blok ötekilerin cevaplarını siler.
window.__almanca = window.__almanca || {};
const ortak = (window.__almanca[GUN] = window.__almanca[GUN] || {});
if (!ortak.cevaplar) {
  ortak.yukleme = ortak.yukleme || jsonOku(CEVAP_YOLU, {});
  ortak.cevaplar = await ortak.yukleme;
} else {
  // Önbellekte olmayan cevapları diskten tamamla (dosya dışarıdan güncellendiyse)
  const diskte = await jsonOku(CEVAP_YOLU, {});
  for (const [k, v] of Object.entries(diskte)) if (!(k in ortak.cevaplar)) ortak.cevaplar[k] = v;
  if (diskte._anlik && typeof diskte._anlik === "object") ortak.cevaplar._anlik = Object.assign(ortak.cevaplar._anlik || {}, diskte._anlik);
}
if (BOZUK.has(CEVAP_YOLU)) bozukUyar(CEVAP_YOLU);
const cevaplar = ortak.cevaplar;
const veri = await jsonOku(SORU_YOLU, null);

// Almanca kelimelere tıklayınca Türkçesi (bkz. _sistem/sozluk/sozluk.js)
const sozluk = await new Function("app", await adapter.read("_sistem/sozluk/sozluk.js"))(app)();
const KAYNAK = "Antrenman " + GUN;

const kok = el("div", "al-root", null, dv.container);
if (!veri) {
  el("div", "al-error", "Sorular bulunamadı: " + SORU_YOLU, kok);
  return;
}
const sonuc = veri.sonuc || null;
const kilitli = !!sonuc;

// ---- anında kontrol (ilk cevap kilidi) ----
// Tek doğru cevaplı sorularda (bosluk, secmeli, dogruyanlis, eslestir) Claude `anahtar` yazar.
// "Kontrol et" denince ilk cevap kilitlenir ve hemen geri bildirim gelir; sonuç cevap dosyasının
// `_anlik` alanına yazılır. Kesin puanı yine /kontrol verir (ör. kabul edilebilir bir alternatif).
const ANLIK_TIPLER = new Set(["bosluk", "secmeli", "dogruyanlis", "eslestir", "kutula"]);
if (!cevaplar._anlik || typeof cevaplar._anlik !== "object") cevaplar._anlik = {};
const anlik = cevaplar._anlik;

function normal(x) {
  return String(x ?? "")
    .normalize("NFC")
    .replace(/[„“”"«»]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .trim();
}
const secenekAyikla = (x) => normal(x).replace(/^[a-f]\)\s*/i, "");

function bosluklar(s) {
  const n = Math.max(1, String(s.metin || "").split("___").length - 1);
  let a = s.anahtar;
  if (!Array.isArray(a)) a = [a];
  else if (n === 1 && a.every((x) => !Array.isArray(x))) a = [a]; // tek boşluk: liste = alternatifler
  return a.map((x) => (Array.isArray(x) ? x : [x]).map(String));
}

function anahtarKontrol(s, cevap) {
  if (s.tip === "bosluk") {
    const cevaplarListe = Array.isArray(cevap) ? cevap : [cevap];
    const beklenen = bosluklar(s);
    let dogru = true;
    let harf = false;
    const kutular = beklenen.map((alt, i) => {
      const v = normal(cevaplarListe[i]);
      const ok = alt.some((x) => normal(x) === v);
      if (!ok && alt.some((x) => normal(x).toLowerCase() === v.toLowerCase())) harf = true;
      if (!ok) dogru = false;
      return ok;
    });
    return { dogru, harf, kutular, beklenen: beklenen.map((alt) => alt[0]).join(" … ") };
  }
  if (s.tip === "kutula") {
    // her öğe için bir kutu seçilir; anahtar öğelerle aynı sırada
    const secilen = Array.isArray(cevap) ? cevap : [];
    const a = Array.isArray(s.anahtar) ? s.anahtar : [];
    const satirlar = (s.ogeler || []).map((_, i) => normal(secilen[i]) === normal(a[i]));
    // geri bildirimde sadece yanlış kutulanan öğeler gösterilir
    const yanlislar = (s.ogeler || []).map((o, i) => (satirlar[i] ? null : `${o} → ${a[i]}`)).filter(Boolean);
    return { dogru: satirlar.every(Boolean), satirlar, beklenen: yanlislar.join(" · ") };
  }
  const a = String(s.anahtar);
  const secenekler = s.tip === "dogruyanlis" ? ["richtig", "falsch"] : s.secenekler || [];
  const i = secenekler.findIndex((sec, j) => normal(sec) === normal(a) || secenekAyikla(sec) === secenekAyikla(a) || (/^[a-f]$/i.test(a) && "abcdef"[j] === a.toLowerCase()));
  const dogruSecenek = i >= 0 ? secenekler[i] : a;
  return { dogru: normal(cevap) === normal(dogruSecenek), dogruSecenek, beklenen: dogruSecenek };
}

function anlikGeriBildirim(kart, s, sonucA) {
  kart.querySelector(".al-instant")?.remove();
  const fb = el("div", "al-feedback al-instant", null, kart);
  const ilk = el("div", "al-feedback-main", null, fb);
  el("span", "al-feedback-icon", sonucA.dogru ? "✅" : "❌", ilk);
  el("span", null, sonucA.dogru ? "Doğru!" : "Doğrusu: " + (sonucA.beklenen || ""), ilk);
  if (!sonucA.dogru && sonucA.harf) el("div", "al-feedback-text", "Büyük/küçük harfe dikkat: Almancada isimler büyük harfle başlar.", fb);
  el("div", "al-tag", "⚡ anında kontrol · kesin puan /kontrol'de", fb);
  kart.classList.remove("al-ok", "al-wrong");
  kart.classList.add(sonucA.dogru ? "al-ok" : "al-wrong");
}

// Kayıt, aynı gündeki bütün bölümler için tek zamanlayıcıyla toplu yapılır. Diske sadece bu oturumda değişen
// cevaplar (ortak.kirli) işlenir; `_anlik` kilitleri birleştirilir ve diskteki kilit hiç silinmez/değişmez
// (başka sekme ya da eski önbellek kilitli bir cevabı ezmesin). Yazmalar sırayla yapılır.
ortak.bekleyen = ortak.bekleyen || new Set();
ortak.kirli = ortak.kirli || new Set();
ortak.kuyruk = ortak.kuyruk || Promise.resolve();
ortak.surum = ortak.surum || {}; // id → değişiklik sayacı (yazım sırasında gelen değişiklik kirli kalsın diye)
function diskeYaz() {
  const is = ortak.kuyruk.then(async () => {
    if (BOZUK.has(CEVAP_YOLU)) return false;
    const yazilacak = [...ortak.kirli];
    const surum = Object.fromEntries(yazilacak.map((id) => [id, ortak.surum[id]]));
    try {
      if (!(await adapter.exists("05 Günlük/veri"))) await adapter.mkdir("05 Günlük/veri");
      const diskte = await jsonOku(CEVAP_YOLU, {});
      if (BOZUK.has(CEVAP_YOLU)) return false;
      const diskKilit = diskte._anlik && typeof diskte._anlik === "object" ? diskte._anlik : {};
      for (const id of yazilacak) if (id !== "_anlik" && !(id in diskKilit)) diskte[id] = cevaplar[id];
      // kilitler: diskte olan kazanır (ilk cevap), bellekteki yeni kilitler eklenir
      diskte._anlik = { ...anlikBellek(), ...diskKilit };
      Object.assign(anlikBellek(), diskKilit);
      await adapter.write(CEVAP_YOLU, JSON.stringify(diskte, null, 2));
      // bu arada yeniden değişmemiş olanlar temizlenir (yazım sırasında gelen yeni değişiklik kirli kalır)
      for (const id of yazilacak) if (ortak.surum[id] === surum[id]) ortak.kirli.delete(id);
      return true;
    } catch (err) {
      console.error("alistirma: kaydedilemedi", err);
      return false;
    }
  });
  ortak.kuyruk = is;
  return is;
}
function anlikBellek() {
  if (!cevaplar._anlik || typeof cevaplar._anlik !== "object") cevaplar._anlik = {};
  return cevaplar._anlik;
}
function isaretle(id, deger) {
  cevaplar[id] = deger;
  ortak.kirli.add(id);
  ortak.surum[id] = (ortak.surum[id] || 0) + 1;
  window.dispatchEvent(new CustomEvent("almanca-cevap", { detail: { gun: GUN } }));
}
function kaydet(id, deger, durumEl) {
  isaretle(id, deger);
  clearTimeout(ortak.zamanlayici);
  if (durumEl) {
    durumEl.textContent = "…";
    ortak.bekleyen.add(durumEl);
  }
  ortak.zamanlayici = setTimeout(async () => {
    const isaretler = [...ortak.bekleyen];
    ortak.bekleyen.clear();
    const tamam = await diskeYaz();
    const mesaj = tamam ? "kaydedildi ✓" : BOZUK.has(CEVAP_YOLU) ? "kaydedilmedi (dosya okunamadı)" : "kaydedilemedi!";
    for (const e of isaretler) e.textContent = mesaj;
  }, 400);
}

// Metindeki ___ boşluklarını görsel bir boşlukla göster (seçmeli sorularda)
function bosluklu(metin, parent) {
  const satir = el("div", "al-sentence", null, parent);
  String(metin).split("___").forEach((p, i, arr) => {
    if (p) sozluk.yaz(satir, p, KAYNAK);
    if (i < arr.length - 1) el("span", "al-gap", "?", satir);
  });
  return satir;
}

function bos(v) {
  if (v === undefined || v === null) return true;
  if (Array.isArray(v)) return v.every((x) => !String(x || "").trim());
  return !String(v).trim();
}

function tumSorular() {
  return veri.bolumler.flatMap((b) => b.sorular);
}

// ---- özet kartı ----
if (input.ozet) {
  const kart = el("div", "al-summary", null, kok);
  const sol = el("div", "al-summary-main", null, kart);
  const sag = el("div", "al-summary-side", null, kart);
  function ciz() {
    sol.textContent = "";
    sag.textContent = "";
    const hepsi = tumSorular();
    if (sonuc) {
      const toplam = hepsi.reduce((t, s) => t + (sonuc[s.id] ? Number(sonuc[s.id].puan) || 0 : 0), 0);
      const yuzde = Math.round((toplam / hepsi.length) * 100);
      el("div", "al-summary-label", "Sonuç", sol);
      el("div", "al-summary-title", yuzde + "%", sol);
      el("div", "al-summary-sub", `${String(toplam).replace(".", ",")} / ${hepsi.length} puan · aşağıda her sorunun açıklaması var`, sol);
      const halka = el("div", "al-ring", null, sag);
      halka.style.setProperty("--p", yuzde);
      el("div", "al-ring-inner", yuzde >= 85 ? "🏆" : yuzde >= 60 ? "💪" : "🌱", halka);
      return;
    }
    const dolu = hepsi.filter((s) => !bos(cevaplar[s.id])).length;
    const yuzde = Math.round((dolu / hepsi.length) * 100);
    el("div", "al-summary-label", veri.baslik || "Bugünün antrenmanı", sol);
    el("div", "al-summary-title", `${dolu} / ${hepsi.length} soru`, sol);
    const chips = el("div", "al-summary-chips", null, sol);
    for (const b of veri.bolumler) {
      const d = b.sorular.filter((s) => !bos(cevaplar[s.id])).length;
      const c = el("span", "al-chip" + (d === b.sorular.length ? " al-chip-done" : ""), `${b.no}. ${b.kisa || b.baslik} ${d}/${b.sorular.length}`, chips);
      c.setAttribute("title", b.baslik);
    }
    const anliklar = Object.values(anlik);
    if (anliklar.length) el("div", "al-summary-sub", `⚡ Anında kontrol: ${anliklar.filter((x) => x.dogru).length} / ${anliklar.length} doğru`, sol);
    el("div", "al-summary-sub", dolu === hepsi.length ? "Hepsi tamam! Claude Code'da /kontrol yaz." : "Cevapların otomatik kaydediliyor. Bitince Claude Code'da /kontrol yaz.", sol);
    const halka = el("div", "al-ring", null, sag);
    halka.style.setProperty("--p", yuzde);
    el("div", "al-ring-inner", yuzde + "%", halka);
  }
  ciz();
  const dinleyici = (e) => {
    if (!document.body.contains(kok)) return window.removeEventListener("almanca-cevap", dinleyici);
    if (e.detail.gun === GUN) ciz();
  };
  window.addEventListener("almanca-cevap", dinleyici);
  return;
}

// ---- bölüm ----
const bolum = veri.bolumler.find((b) => b.no === input.bolum);
if (!bolum) {
  el("div", "al-error", "Bölüm bulunamadı: " + input.bolum, kok);
  return;
}

// Numaralı boşluklar (Sprachbausteine): bölüm metnindeki {1}, {2}… işaretleri boşluk rozeti olur.
// `yer: 1` alanı olan sorunun cevabı seçildikçe ya da yazıldıkça metindeki rozet dolar.
const yerler = {};
function metinSatiri(parent, satir) {
  String(satir).split(/\{(\d+)\}/).forEach((p, i) => {
    if (i % 2 === 0) {
      if (p) sozluk.yaz(parent, p, KAYNAK);
      return;
    }
    const g = el("span", "al-gap al-gap-no", p, parent);
    (yerler[p] = yerler[p] || []).push(g);
  });
}
function yerGoster(s, deger) {
  if (s.yer === undefined || s.yer === null) return;
  let yazi = Array.isArray(deger) ? deger.join(" ") : String(deger || "");
  if (s.tip === "secmeli") yazi = secenekAyikla(yazi);
  if (s.tip === "eslestir" && bolum.pano) yazi = (bolum.pano.ilanlar.find((x) => normal(x.harf) === normal(yazi)) || {}).metin || yazi;
  for (const g of yerler[String(s.yer)] || []) {
    g.textContent = yazi.trim() ? `${s.yer} · ${yazi.trim()}` : String(s.yer);
    g.classList.toggle("al-gap-dolu", !!yazi.trim());
  }
}

if (bolum.aciklama) el("div", "al-section-note", bolum.aciklama, kok);
if (bolum.pano) {
  const pano = el("div", "al-board" + (bolum.pano.tur === "kelime" ? " al-board-words" : ""), null, kok);
  el("div", "al-board-title", bolum.pano.baslik || "📌 Schwarzes Brett", pano);
  const grid = el("div", "al-board-grid", null, pano);
  for (const ilan of bolum.pano.ilanlar) {
    const k = el("div", "al-note", null, grid);
    el("span", "al-note-letter", ilan.harf, k);
    sozluk.yaz(el("span", "al-note-text", null, k), ilan.metin, KAYNAK);
  }
}
if (bolum.metin) {
  const m = el("div", "al-letter", null, kok);
  for (const satir of String(bolum.metin).split("\n")) metinSatiri(el("div", null, null, m), satir);
}

const liste = el("div", "al-cards", null, kok);

for (const s of bolum.sorular) {
  const tip = TIPLER[s.tip] || TIPLER.ceviri;
  const kart = el("div", `al-card al-${tip.renk}`, null, liste);
  const r = sonuc && sonuc[s.id];
  if (r) kart.classList.add(Number(r.puan) >= 1 ? "al-ok" : Number(r.puan) > 0 ? "al-half" : "al-wrong");

  const ust = el("div", "al-card-head", null, kart);
  el("span", "al-badge", `${tip.ikon} ${tip.ad}`, ust);
  el("span", "al-qno", s.id, ust);
  if (s.yer !== undefined && s.yer !== null) el("span", "al-instr", "boşluk " + s.yer, ust);
  if (s.talimat) el("span", "al-instr", s.talimat, ust);
  const durum = el("span", "al-saved", "", ust);

  const govde = el("div", "al-card-body", null, kart);
  const mevcut = cevaplar[s.id];
  const anlikVar = !kilitli && s.anahtar !== undefined && s.anahtar !== null && ANLIK_TIPLER.has(s.tip);
  const anlikKayit = anlikVar ? anlik[s.id] : null;
  const pasif = kilitli || !!anlikKayit;
  const kutular = [];
  const dugmeler = [];
  const siraSatirlari = []; // kutula: satır başına {satir, oge}
  let kontrolEt = null;
  let kontrolDugmesi = null;

  if (s.tip === "bosluk") {
    const parcalar = String(s.metin).split("___");
    const satir = el("div", "al-sentence", null, govde);
    const deger = Array.isArray(mevcut) ? mevcut.slice() : mevcut ? [mevcut] : [];
    parcalar.forEach((p, i) => {
      if (p) sozluk.yaz(satir, p, KAYNAK);
      if (i < parcalar.length - 1) {
        const inp = yalit(el("input", "al-blank", null, satir));
        inp.type = "text";
        inp.value = deger[i] || "";
        inp.disabled = pasif;
        inp.style.width = Math.max(4, (deger[i] || "").length + 2) + "ch";
        inp.setAttribute("autocomplete", "off");
        inp.setAttribute("spellcheck", "false");
        inp.addEventListener("input", () => {
          inp.style.width = Math.max(4, inp.value.length + 2) + "ch";
          const v = kutular.map((k) => k.value);
          kaydet(s.id, v.length === 1 ? v[0] : v, durum);
          yerGoster(s, v);
        });
        inp.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            const icerde = kutular[kutular.indexOf(inp) + 1];
            if (!icerde && kontrolEt) return kontrolEt();
            const sonraki = icerde || kart.nextElementSibling?.querySelector("input:not(:disabled), textarea:not(:disabled), button:not(:disabled)");
            sonraki?.focus();
          }
        });
        kutular.push(inp);
      }
    });
  } else if (s.tip === "secmeli" || s.tip === "dogruyanlis" || s.tip === "eslestir") {
    if (s.metin) bosluklu(s.metin, govde);
    const secenekler = s.tip === "dogruyanlis" ? ["richtig", "falsch"] : s.secenekler || [];
    const grup = el("div", "al-options" + (s.tip === "eslestir" ? " al-options-letters" : ""), null, govde);
    secenekler.forEach((sec, i) => {
      // eşleştirmede "x": hiçbiri uymuyor (telc Lesen Teil 3'teki gibi)
      const etiket = s.tip === "secmeli" ? (/^[a-f]\)\s/i.test(sec) ? sec : `${"abcdef"[i]})  ${sec}`) : s.tip === "dogruyanlis" ? (sec === "richtig" ? "✓ richtig" : "✗ falsch") : normal(sec).toLowerCase() === "x" ? "x · uyan yok" : sec;
      const d = yalit(el("button", "al-option" + (mevcut === sec ? " al-selected" : ""), etiket, grup));
      d.dataset.sec = sec;
      d.disabled = pasif;
      d.addEventListener("click", () => {
        const yeni = cevaplar[s.id] === sec ? "" : sec;
        dugmeler.forEach((x) => x.classList.remove("al-selected"));
        if (yeni) d.classList.add("al-selected");
        kaydet(s.id, yeni, durum);
        yerGoster(s, yeni);
        if (yeni) kontrolDugmesi?.focus();
      });
      dugmeler.push(d);
    });
  } else if (s.tip === "kutula") {
    // Her öğe bir satır: kelime + kutu düğmeleri (der / die / das, değişir / değişmez …)
    if (s.metin) sozluk.yaz(el("div", "al-sentence", null, govde), s.metin, KAYNAK);
    const deger = Array.isArray(mevcut) ? mevcut.slice() : [];
    const tablo = el("div", "al-sort", null, govde);
    (s.ogeler || []).forEach((oge, i) => {
      const satir = el("div", "al-sort-row", null, tablo);
      const ogeKutusu = el("span", "al-sort-item", null, satir);
      sozluk.yaz(ogeKutusu, oge, KAYNAK);
      siraSatirlari.push({ satir, oge: ogeKutusu });
      const grup = el("div", "al-options", null, satir);
      const sira = [];
      (s.kutular || []).forEach((k) => {
        const d = yalit(el("button", "al-option" + (deger[i] === k ? " al-selected" : ""), k, grup));
        d.dataset.sec = k;
        d.dataset.satir = String(i);
        d.disabled = pasif;
        d.addEventListener("click", () => {
          deger[i] = deger[i] === k ? "" : k;
          sira.forEach((x) => x.classList.toggle("al-selected", x.dataset.sec === deger[i]));
          kaydet(s.id, (s.ogeler || []).map((_, j) => deger[j] || ""), durum);
        });
        sira.push(d);
        dugmeler.push(d);
      });
    });
  } else if (s.tip === "yazma") {
    if (s.metin) el("div", "al-sentence", s.metin, govde);
    const ta = yalit(el("textarea", "al-textarea", null, govde));
    ta.value = mevcut || "";
    ta.disabled = kilitli;
    ta.rows = 6;
    ta.placeholder = "Buraya yaz…";
    const sayac = el("div", "al-counter", null, govde);
    const say = () => (sayac.textContent = (ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0) + " kelime");
    say();
    ta.addEventListener("input", () => {
      say();
      kaydet(s.id, ta.value, durum);
    });
  } else {
    // hata, ceviri, yaz: tek satırlık serbest cevap
    if (s.tip === "hata") {
      const h = el("div", "al-wrong-sentence", null, govde);
      el("span", "al-wrong-label", "Hatalı:", h);
      sozluk.yaz(h, " " + s.metin, KAYNAK);
    } else if (s.tip === "ceviri") {
      const c = el("div", "al-sentence al-tr", null, govde);
      el("span", "al-flag", "TR", c);
      el("span", null, s.metin, c);
    } else if (s.metin) {
      sozluk.yaz(el("div", "al-sentence", null, govde), s.metin, KAYNAK);
    }
    const satir = el("div", "al-answer-row", null, govde);
    if (s.tip === "ceviri") el("span", "al-flag al-flag-de", "DE", satir);
    const inp = yalit(el("input", "al-line", null, satir));
    inp.type = "text";
    inp.value = mevcut || "";
    inp.disabled = kilitli;
    inp.placeholder = s.tip === "hata" ? "Düzeltilmiş cümleyi yaz…" : s.tip === "ceviri" ? "Almancası…" : "Cümleni yaz…";
    inp.setAttribute("autocomplete", "off");
    inp.setAttribute("spellcheck", "false");
    inp.addEventListener("input", () => kaydet(s.id, inp.value, durum));
    if (s.tip === "hata" && !kilitli) {
      const kopya = yalit(el("button", "al-mini", "↧ cümleyi kopyala", satir));
      kopya.addEventListener("click", () => {
        inp.value = s.metin;
        inp.focus();
        kaydet(s.id, inp.value, durum);
      });
    }
    if (s.kelimeler && !kilitli) {
      const kel = el("div", "al-words", null, govde);
      for (const k of s.kelimeler) {
        const ch = yalit(el("button", "al-word", k, kel));
        ch.addEventListener("click", () => {
          inp.value = (inp.value ? inp.value.trimEnd() + " " : "") + k;
          inp.focus();
          kaydet(s.id, inp.value, durum);
        });
      }
    } else if (s.kelimeler) {
      el("div", "al-hint", "Kelimeler: " + s.kelimeler.join(" / "), govde);
    }
  }

  if (anlikVar) {
    let satir = null;
    const kilitle = (sonucA) => {
      for (const x of [...kutular, ...dugmeler]) x.disabled = true;
      satir?.remove();
      if (s.tip === "bosluk") kutular.forEach((k, i) => k.classList.add(sonucA.kutular?.[i] ? "al-blank-ok" : "al-blank-wrong"));
      else if (s.tip === "kutula") {
        for (const d of dugmeler) {
          if (normal(d.dataset.sec) === normal((s.anahtar || [])[Number(d.dataset.satir)])) d.classList.add("al-opt-right");
          else if (d.classList.contains("al-selected")) d.classList.add("al-opt-wrong");
        }
        // her satırın yanına sonucu yaz: doğruysa ✓, yanlışsa doğru kutu
        siraSatirlari.forEach(({ satir, oge }, i) => {
          satir.querySelector(".al-sort-mark")?.remove();
          const ok = sonucA.satirlar?.[i];
          satir.classList.add(ok ? "al-sort-ok" : "al-sort-wrong");
          el("span", "al-sort-mark", ok ? "✓" : "→ " + ((s.anahtar || [])[i] ?? ""), oge);
        });
      } else
        for (const d of dugmeler) {
          if (d.dataset.sec === sonucA.dogruSecenek) d.classList.add("al-opt-right");
          else if (d.classList.contains("al-selected")) d.classList.add("al-opt-wrong");
        }
      anlikGeriBildirim(kart, s, sonucA);
    };
    if (anlikKayit) {
      kilitle(anlikKayit);
    } else {
      satir = el("div", "al-check-row", null, govde);
      kontrolDugmesi = yalit(el("button", "al-check", "Kontrol et ✓", satir));
      el("span", "al-check-note", "ilk cevabın kilitlenir", satir);
      kontrolEt = () => {
        const deger = cevaplar[s.id];
        const eksikKutu = s.tip === "kutula" && (!Array.isArray(deger) || (s.ogeler || []).some((_, i) => !deger[i]));
        if (bos(deger) || eksikKutu || (s.tip === "bosluk" && kutular.some((k) => !k.value.trim()))) {
          kontrolDugmesi.classList.remove("al-shake");
          void kontrolDugmesi.offsetWidth;
          kontrolDugmesi.classList.add("al-shake");
          return;
        }
        const sonucA = anahtarKontrol(s, deger);
        anlik[s.id] = { ...sonucA, zaman: new Date().toISOString() };
        kontrolEt = null;
        kilitle(sonucA);
        // Kilit beklemeden (debounce yok) hemen diske yazılır: yenileyince cevap değiştirilemesin.
        // Yazılamazsa cevap ekranda kilitli kalır, kart "kaydedilemedi" diye işaretlenir ve yeniden denenir.
        isaretle(s.id, deger);
        const kilitYaz = async (deneme) => {
          durum.textContent = "…";
          if (await diskeYaz()) {
            durum.textContent = "kaydedildi ✓";
            durum.style.color = "";
            kart.style.outline = "";
            return;
          }
          durum.style.color = "#b3261e";
          kart.style.outline = "2px solid #b3261e";
          if (BOZUK.has(CEVAP_YOLU)) {
            durum.textContent = "⚠️ kaydedilemedi (dosya okunamadı)";
            return;
          }
          durum.textContent = `⚠️ kaydedilemedi, tekrar deneniyor (${deneme})…`;
          if (document.body.contains(kart)) setTimeout(() => kilitYaz(deneme + 1), 5000);
        };
        kilitYaz(1);
        const sonraki = kart.nextElementSibling?.querySelector("input:not(:disabled), textarea:not(:disabled), button.al-option:not(:disabled)");
        if (s.tip === "bosluk") sonraki?.focus();
      };
      kontrolDugmesi.addEventListener("click", () => kontrolEt?.());
    }
  }

  yerGoster(s, mevcut);
  if (s.ipucu) el("div", "al-hint", "💡 " + s.ipucu, govde);

  if (r) {
    const fb = el("div", "al-feedback", null, kart);
    const ikon = Number(r.puan) >= 1 ? "✅" : Number(r.puan) > 0 ? "🟡" : "❌";
    const ilk = el("div", "al-feedback-main", null, fb);
    el("span", "al-feedback-icon", ikon, ilk);
    if (Number(r.puan) >= 1 && !r.aciklama) el("span", null, "Doğru!", ilk);
    else el("span", null, (Number(r.puan) >= 1 ? "Doğru · " : "Doğrusu: ") + (r.dogru || ""), ilk);
    if (r.aciklama) el("div", "al-feedback-text", r.aciklama, fb);
    if (r.etiket) el("span", "al-tag", "#" + r.etiket, fb);
  }
}
