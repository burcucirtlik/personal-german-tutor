// Almanca dashboard: 00 Dashboard.md içinden `await dv.view("_sistem/dashboard")` ile çalışır.
// Konu bilgisi notların frontmatter'ından, kullanıcının ilerlemesi _kisisel/ilerleme.json'dan gelir (frontmatter'ın
// üstüne yazılır; alan adları _sistem/Kurallar.md ile aynı). Kişisel dosyalar _kisisel/ altında.

const SEVIYELER = ["A1", "A2", "B1"];
const DURUM_ETIKET = { temiz: "temiz", ogreniliyor: "öğreniliyor", zayif: "zayıf", yeni: "yeni", beklemede: "beklemede", kilitli: "kilitli" };
const KADEMELER = ["Tanıma", "Üretme", "Cümle"]; // K3 geçilince konu biter ve genele yayılır (Kurallar → Yayılım)
// Kademe geçişi: son 12 yapı sorusunda en az 10 doğru (Kurallar → Kademe geçişi). `pencere: 9/12` alanını ilerleme.py yazar.
// Onarımdaki konu (bitmiş konu ya da dar onarım) hattın odağı olamaz (Kurallar → Dar onarım)
const onarimda = (k) => k.durum === "zayif" && (!!k.dar || !!k.bitis || String(k.yoklama || "") === "gecti");
const darListe = (k) => (Array.isArray(k.dar) ? k.dar : String(k.dar || "").replace(/^\[|\]$/g, "").split(/",\s*"/).map((x) => x.replace(/"/g, "").trim()).filter(Boolean));
const pencereOku = (k) => { const m = /^(\d+)\/(\d+)$/.exec(String(k.pencere || "")); return m ? { d: +m[1], s: +m[2] } : null; };
const pencereYazi = (k) => { const p = pencereOku(k); return p && p.s ? ` · son ${p.s} soruda ${p.d} doğru (geçiş: 12'de 10)` : ""; };
const pencereYakin = (k) => { const p = pencereOku(k); return !!p && p.s >= 6 && p.d / p.s >= 0.8; };
const AKTIF = ["ogreniliyor", "zayif", "temiz"];
const ATASOZLERI = [
  ["Übung macht den Meister.", "Alıştırma ustalaştırır."],
  ["Aller Anfang ist schwer.", "Her başlangıç zordur."],
  ["Steter Tropfen höhlt den Stein.", "Damlaya damlaya göl olur."],
  ["Wer rastet, der rostet.", "İşleyen demir pas tutmaz."],
  ["Schritt für Schritt kommt man ans Ziel.", "Adım adım hedefe varılır."],
  ["Ohne Fleiß kein Preis.", "Emek olmadan ödül olmaz."],
  ["Morgenstund hat Gold im Mund.", "Sabah kalkan yol alır."],
  ["Ende gut, alles gut.", "Sonu iyi biten her şey iyidir."],
  ["Geduld bringt Rosen.", "Sabrın sonu selamettir."],
  ["Wo ein Wille ist, ist auch ein Weg.", "İstemek başarmanın yarısıdır."],
];

function isoTarih(v) {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  if (typeof v.toISODate === "function") return v.toISODate();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function bugunISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function gunEkle(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function gunFarki(a, b) {
  return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
}

function sayi(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  if (parent) parent.appendChild(e);
  return e;
}

function metin(parent, text) {
  parent.appendChild(document.createTextNode(text));
}

function notLinki(sayfa, text, parent, cls) {
  const a = el("a", "internal-link" + (cls ? " " + cls : ""), text, parent);
  a.setAttribute("href", sayfa.file.path);
  a.setAttribute("data-href", sayfa.file.path);
  a.addEventListener("click", (e) => {
    e.preventDefault();
    app.workspace.openLinkText(sayfa.file.path, "", false);
  });
  return a;
}

const bugun = bugunISO();
const tumu = dv
  .pages('"02 Wortschatz" or "03 Grammatik" or "01 Sınav" or "05 Günlük" or "06 Fehlerlog" or "07 Modelltests" or "_kisisel"')
  .array();

// Kişisel ilerleme: konu notunun frontmatter'ı varsayılandır, _kisisel/ilerleme.json'daki alanlar üstüne yazılır
let ILERLEME = {};
try {
  if (await app.vault.adapter.exists("_kisisel/ilerleme.json")) ILERLEME = JSON.parse(await app.vault.adapter.read("_kisisel/ilerleme.json")).konular || {};
} catch (err) {
  console.error("dashboard: _kisisel/ilerleme.json okunamadı", err);
}
const konular = tumu
  .filter((p) => ["gramer", "kelime", "sinav"].includes(p.tur) && p.id)
  .map((p) => (ILERLEME[p.id] ? { ...p, ...ILERLEME[p.id] } : p))
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));
const gunlukler = tumu.filter((p) => p.tur === "gunluk");
const hatalar = tumu.filter((p) => p.tur === "hata");
const testler = tumu.filter((p) => p.tur === "modelltest");
const profil = tumu.find((p) => p.file.path === "_kisisel/Profil.md") || {};

// ---- hesaplar ----
const tekrarZamani = (k) => AKTIF.includes(k.durum) && isoTarih(k.sonraki_tekrar) && isoTarih(k.sonraki_tekrar) <= bugun;
const vadesiGelen = konular
  .filter(tekrarZamani)
  .sort((a, b) => (a.durum === "zayif" ? -1 : 0) - (b.durum === "zayif" ? -1 : 0) || sayi(a.ustalik) - sayi(b.ustalik));

const tamamGunler = new Set(gunlukler.filter((g) => g.durum === "tamamlandi").map((g) => isoTarih(g.tarih)).filter(Boolean));
// Seri: tek boş gün seriyi bozmaz (mola), art arda iki boş gün bozar. Kısa gün de seri sayılır.
let seri = 0;
let mola = 0;
{
  let gun = tamamGunler.has(bugun) ? bugun : gunEkle(bugun, -1);
  while (true) {
    if (tamamGunler.has(gun)) { seri++; gun = gunEkle(gun, -1); continue; }
    if (seri > 0 && tamamGunler.has(gunEkle(gun, -1))) { mola++; gun = gunEkle(gun, -1); continue; }
    break;
  }
}

const sinavTarihi = isoTarih(profil.sinav_tarihi);
const kalanGun = sinavTarihi ? gunFarki(bugun, sinavTarihi) : null;
const temizSayisi = konular.filter((k) => k.durum === "temiz").length;

// Hız (Kurallar → Hız ve sınav takvimi): prova = sınav − 28 gün
const prova = sinavTarihi ? gunEkle(sinavTarihi, -28) : null;
const son28 = gunEkle(bugun, -27);
const ilkGun = [...tamamGunler].sort()[0] || bugun;
const pencereGun = Math.max(1, Math.min(28, gunFarki(ilkGun > son28 ? ilkGun : son28, bugun) + 1));
const seans28 = [...tamamGunler].filter((t) => t >= son28 && t <= bugun).length;
const katilim = seans28 / pencereGun;
const kalanHat = ["fiil", "isim"].map((h) => konular.filter((k) => k.tur === "gramer" && k.hat === h && k.durum !== "temiz").length);
const enUzunHat = Math.max(...kalanHat, 0);
const biten28 = konular.filter((k) => k.tur === "gramer" && aralikta(isoTarih(k.bitis), son28, bugun)).length;
const butce = prova && enUzunHat ? (Math.max(0, gunFarki(bugun, prova)) * katilim) / enUzunHat : null;
// iki hat paralel yürür: hat başına seans/konu = seans ÷ (biten konu ÷ 2)
const gozlenen = biten28 ? seans28 / (biten28 / 2) : null;
function aralikta(t, bas, bit) { return !!t && t >= bas && t <= bit; }

function ilerleme(ks) {
  if (!ks.length) return { yuzde: 0, temiz: 0, toplam: 0 };
  const ort = ks.reduce((t, k) => t + Math.min(100, sayi(k.ustalik)), 0) / ks.length;
  return { yuzde: Math.round(ort), temiz: ks.filter((k) => k.durum === "temiz").length, toplam: ks.length };
}

const asamalar = [
  ...SEVIYELER.map((s) => ({ ad: s, alt: s === "A1" ? "Temel" : s === "A2" ? "Gelişen" : "Bağımsız", ...ilerleme(konular.filter((k) => k.seviye === s && k.tur !== "sinav")) })),
  { ad: "telc", alt: "Sınav", ...ilerleme(konular.filter((k) => k.tur === "sinav")) },
];
const aktifAsama = asamalar.findIndex((a) => a.yuzde < 85);

// ---- çizim ----
const kok = el("div", "ad-root", null, dv.container);

// karşılama kartı
const saat = new Date().getHours();
const selam = saat < 11 ? "Guten Morgen" : saat < 18 ? "Guten Tag" : "Guten Abend";
const gunNo = Math.floor(new Date(bugun + "T12:00:00Z").getTime() / 86400000);
const [soz, ceviri] = ATASOZLERI[gunNo % ATASOZLERI.length];

const hero = el("div", "ad-hero", null, kok);
const heroSol = el("div", "ad-hero-main", null, hero);
el("div", "ad-hero-date", new Date(bugun + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" }), heroSol);
el("div", "ad-hero-title", selam + (profil.ad ? ", " + profil.ad : "") + "! 👋", heroSol);
const sozKutu = el("div", "ad-hero-quote", null, heroSol);
el("span", "ad-hero-quote-de", "„" + soz + "“", sozKutu);
el("span", "ad-hero-quote-tr", ceviri, sozKutu);

const bugunNotlari = gunlukler.filter((g) => isoTarih(g.tarih) === bugun).sort((a, b) => a.file.name.localeCompare(b.file.name));
const acikNot = bugunNotlari.find((g) => g.durum !== "tamamlandi");
const bitenNot = bugunNotlari.find((g) => g.durum === "tamamlandi");
const cta = el("div", "ad-cta", null, hero);
if (acikNot) {
  el("div", "ad-cta-label", acikNot.seans && String(acikNot.seans).startsWith("seviye") ? "Seviye tespiti" : "Bugünün antrenmanı", cta);
  el("div", "ad-cta-title", "Seni bekliyor", cta);
  el("div", "ad-cta-sub", sayi(acikNot.dakika || profil.gunluk_dakika || 45) + " dakika", cta);
  notLinki(acikNot, "Başla →", cta, "ad-btn");
  const ip = el("div", "ad-cta-hint", "Bitince Claude Code'da ", cta);
  el("code", null, String(acikNot.seans || "").startsWith("seviye") ? "/seviye" : "/kontrol", ip);
} else if (String(profil.seviye_tespiti || "") !== "tamamlandi") {
  el("div", "ad-cta-label", "Hoş geldin", cta);
  el("div", "ad-cta-title", profil.beyan ? "Seviye tespiti sürüyor" : "Önce seviye tespiti", cta);
  const ip = el("div", "ad-cta-hint", "Claude Code'da ", cta);
  el("code", null, "/seviye", ip);
  metin(ip, " yaz");
} else if (bitenNot) {
  el("div", "ad-cta-label", "Bugün tamamlandı", cta);
  el("div", "ad-cta-title", (bitenNot.puan ?? "–") + "%", cta);
  el("div", "ad-cta-sub", "Harika iş! 🎉", cta);
  notLinki(bitenNot, "Sonuçları gör →", cta, "ad-btn ad-btn-ghost");
} else {
  el("div", "ad-cta-label", "Bugünün antrenmanı", cta);
  el("div", "ad-cta-title", "Hazırlanmadı", cta);
  const ip = el("div", "ad-cta-hint", "Claude Code'da ", cta);
  el("code", null, "/antrenman", ip);
  metin(ip, " yaz");
}

// ---- ilk kullanım: seviye tespiti bitene kadar sadece başlangıç adımları (Kurallar → Seviye tespiti → Zorunlu) ----
if (String(profil.seviye_tespiti || "") !== "tamamlandi") {
  const seviyeNotu = (n) => gunlukler.filter((g) => String(g.seans || "") === "seviye-tespiti-" + n).sort((a, b) => b.file.name.localeCompare(a.file.name))[0];
  const kart = el("div", "ad-card ad-onboard", null, kok);
  el("div", "ad-card-title", "🧭 Başlarken", kart);
  el("div", "ad-onboard-intro", "Önce seviyeni ölçüyoruz: bildiğin konuları tekrar etmeyesin, yarım bildiğin bir konuyu da atlamayasın diye. Sonra her gün sana göre bir antrenman gelir.", kart);
  const liste = el("ol", "ad-ob-steps", null, kart);
  const adim = (baslik, alt, durum, sayfa, dugme) => {
    const li = el("li", "ad-ob-step ad-ob-step-" + durum, null, liste);
    el("span", "ad-ob-step-mark", durum === "bitti" ? "✓" : durum === "simdi" ? "▶" : "", li);
    const g = el("div", "ad-ob-step-body", null, li);
    el("div", "ad-ob-step-title", baslik, g);
    if (alt) el("div", "ad-ob-step-sub", alt, g);
    if (sayfa) notLinki(sayfa, dugme || "Aç →", li, "ad-btn" + (durum === "bitti" ? " ad-btn-ghost" : ""));
  };
  const profilVar = !!profil.file;
  const beyan = String(profil.beyan || "");
  const t = [1, 2, 3].map(seviyeNotu);
  const turDurum = (n) => (t[n - 1]?.durum === "tamamlandi" ? "bitti" : t[n - 1] ? "simdi" : "sonra");
  let simdiVerildi = false;
  const sira = (d) => (d === "bitti" ? "bitti" : !simdiVerildi ? ((simdiVerildi = true), "simdi") : "sonra");
  adim("Claude Code'da bu klasörü aç ve /seviye yaz", "Claude kendini tanıtır, adını ve günde kaç dakika çalışacağını sorar.", sira(profilVar && beyan ? "bitti" : "x"));
  adim("Seviye beyanı", beyan ? "Beyanın: " + beyan : "Altı Almanca cümleden yardımsız kurabileceğin sonuncusunu seçersin. Hiç bilmiyorsan sıfırdan başlarız, ölçüm yok.", sira(beyan ? "bitti" : "x"));
  const tur = (n, baslik, alt) => {
    const d = turDurum(n);
    adim(baslik, alt, sira(d === "bitti" ? "bitti" : "x"), t[n - 1] || null, d === "bitti" ? "Sonuçlar →" : "Çöz →");
  };
  tur(1, "1. tur · Kabul görüşmesi", "35–90 dk, seviyene göre. Kısa bir dilekçe, sonra çeviri ve düzeltme soruları. Bilmediğin yerde tahmin etme, ? yaz. Ara verebilirsin; bitince /seviye.");
  tur(2, "2. tur · Daraltma", "5–25 dk. Sadece sınırına yakın konular.");
  tur(3, "3. tur · Doğrulama (ertesi gün)", "10–45 dk. Gerekmiyorsa atlanır. Sonunda iki hatta nereden başladığını görürsün.");
  const nasil = el("div", "ad-onboard-how", null, kart);
  el("div", "ad-card-subtitle", "Sonra her gün", nasil);
  const ul = el("ul", "ad-onboard-list", null, nasil);
  for (const [k, v] of [
    ["/antrenman", "bugünün alıştırmaları seviyene göre hazırlanır (~" + sayi(profil.gunluk_dakika || 45) + " dk)"],
    ["Çöz", "bu sayfada, tarayıcıda; her Almanca kelimeye tıklayınca Türkçesi çıkar"],
    ["/kontrol", "Claude puanlar, hatalarını açıklar, ilerlemeni günceller"],
    ["Tempelhof", "her gün bir karakterin günlüğü: okur, dinler, kağıda geçirirsin"],
  ]) {
    const li = el("li", null, null, ul);
    el("b", null, k, li);
    metin(li, " · " + v);
  }
  return;
}

// ilk hafta: seviye tespitinin sonucu
const baslangic = isoTarih(profil.baslangic);
if (baslangic && gunFarki(baslangic, bugun) <= 7) {
  const sonNot = gunlukler.filter((g) => String(g.seans || "").startsWith("seviye-tespiti")).sort((a, b) => b.file.name.localeCompare(a.file.name))[0];
  const kart = el("div", "ad-card ad-onboard", null, kok);
  const bas = el("div", "ad-card-head", null, kart);
  el("div", "ad-card-title", "🚀 İlk hafta", bas);
  if (sonNot) notLinki(sonNot, "Seviye sonucunu gör →", bas, "ad-btn ad-btn-ghost");
  el("div", "ad-onboard-intro", "Seviye tespiti bitti. Aşağıdaki Müfredat kartı iki hatta nereden başladığını gösterir. Her gün: /antrenman → çöz → /kontrol. Kartlar ve Tempelhof günlüğü antrenmanın sonunda.", kart);
}

// istatistikler
const stat = el("div", "ad-stats", null, kok);
function istatistik(ikon, deger, etiket, cls) {
  const s = el("div", "ad-stat" + (cls ? " " + cls : ""), null, stat);
  el("div", "ad-stat-icon", ikon, s);
  const m = el("div", null, null, s);
  el("div", "ad-stat-value", deger, m);
  el("div", "ad-stat-label", etiket, m);
}
istatistik("🔥", seri, mola ? `günlük seri · ${mola} mola` : "günlük seri", seri > 0 ? "ad-stat-fire" : "");
istatistik("🎯", kalanGun === null ? "–" : kalanGun, kalanGun === null ? "sınav tarihi yok" : "gün kaldı");
istatistik("🔁", vadesiGelen.length, "tekrar bekliyor");
istatistik("✅", temizSayisi, "konu oturdu");

// hız kartı: gereken ve gözlenen seans/konu yan yana
if (butce !== null) {
  const hiz = el("div", "ad-card ad-pace", null, kok);
  const bas = el("div", "ad-card-head", null, hiz);
  el("div", "ad-card-title", "⏱️ Hız", bas);
  el("div", "ad-week-range", `Hedef: müfredat ${prova} (prova) günü biter · katılım son 28 gün %${Math.round(katilim * 100)}`, bas);
  const ws = el("div", "ad-week-stats", null, hiz);
  const kutu = (deger, etiket, alt, cls) => {
    const k = el("div", "ad-week-stat", null, ws);
    el("div", "ad-week-v " + (cls || ""), deger, k);
    el("div", "ad-week-l", etiket, k);
    if (alt) el("div", "ad-week-sub", alt, k);
  };
  const yuvarla = (x) => (Math.round(x * 10) / 10).toLocaleString("tr-TR");
  kutu(`${enUzunHat}`, "konu kaldı", `fiil ${kalanHat[0]} · isim ${kalanHat[1]}`);
  kutu(`${yuvarla(butce)}`, "seans / konu bütçe", "yetişmek için gereken");
  const geride = gozlenen !== null && gozlenen > butce;
  kutu(gozlenen === null ? "–" : `${yuvarla(gozlenen)}`, "seans / konu gözlenen", gozlenen === null ? "son 28 günde biten konu yok" : `son 28 gün · ${biten28} konu bitti`, geride ? "ad-down" : gozlenen !== null ? "ad-up" : "");
  if (gozlenen === null || geride) {
    el("div", "ad-week-sub", "Bütçenin üstündesin. Ön konu ve kısa günler bunu kapatmak için var: boş gün yerine 15 dakika.", hiz);
  }
}

// Tempelhof günlüğü
const gunceler = dv
  .pages('"08 Tempelhof"')
  .array()
  .filter((p) => p.tur === "tagebuch" && isoTarih(p.tarih))
  .sort((a, b) => isoTarih(b.tarih).localeCompare(isoTarih(a.tarih)) || sayi(b.tag) - sayi(a.tag));
if (gunceler.length) {
  const g = gunceler[0];
  const kart = el("div", "ad-card ad-diary", null, kok);
  const sol = el("div", "ad-diary-main", null, kart);
  el("div", "ad-diary-label", "📓 Tempelhof günlüğü · Tag " + sayi(g.tag), sol);
  el("div", "ad-diary-title", (g.yazar || g.file.name) + (isoTarih(g.tarih) === bugun ? " bugün yazdı" : " yazdı"), sol);
  el("div", "ad-diary-sub", "Dinle, oku, kağıda geçir · " + isoTarih(g.tarih), sol);
  notLinki(g, "Oku →", kart, "ad-btn ad-btn-diary");
}

// ---- bu hafta: son 7 gün, önceki 7 günle karşılaştırmalı ----
// Günlük notlar (puan), soru dosyalarındaki `sonuc`, Fehlerlog'daki "Son görülmeler" satırları,
// drill ve kart durum dosyalarından hesaplanır. Yazılı yorum 10 Analiz/ notlarında (/analiz).
const adapter = app.vault.adapter;
async function jsonOku(yol) {
  try {
    return (await adapter.exists(yol)) ? JSON.parse(await adapter.read(yol)) : null;
  } catch (err) {
    console.error("dashboard: okunamadı", yol, err);
    return null;
  }
}
const haftaBas = gunEkle(bugun, -6);
const oncekiBas = gunEkle(bugun, -13);
const bitenler = gunlukler.filter((g) => g.durum === "tamamlandi" && isoTarih(g.tarih)).sort((a, b) => isoTarih(a.tarih).localeCompare(isoTarih(b.tarih)));
const buHafta = bitenler.filter((g) => aralikta(isoTarih(g.tarih), haftaBas, bugun));
const gecenHafta = bitenler.filter((g) => aralikta(isoTarih(g.tarih), oncekiBas, gunEkle(haftaBas, -1)));
// seviye tespiti seansları ortalamaya girmez (konuların hepsinden ilk kez soru sorulur)
const ortPuan = (hepsi) => {
  const gs = hepsi.filter((g) => !String(g.seans || "").startsWith("seviye-tespiti"));
  return gs.length ? Math.round(gs.reduce((t, g) => t + sayi(g.puan), 0) / gs.length) : null;
};
const haftaOrt = ortPuan(buHafta);
const gecenOrt = ortPuan(gecenHafta);
const calisilanGun = new Set(buHafta.map((g) => isoTarih(g.tarih))).size;

const beceri = {};
const konuSeans = {};
let haftaSoru = 0;
let haftaPuan = 0;
for (const g of buHafta) {
  const v = g.veri ? await jsonOku(String(g.veri)) : null;
  if (!v || !v.sonuc) continue;
  for (const b of v.bolumler) {
    const ids = b.sorular.map((s) => s.id);
    const p = ids.reduce((t, i) => t + sayi(v.sonuc[i]?.puan), 0);
    haftaSoru += ids.length;
    haftaPuan += p;
    const ad = !b.konu ? ["Hören", "Lesen", "Schreiben"].find((x) => String(b.baslik).includes(x)) || "Beceri" : String(b.konu).startsWith("W") ? "Kelime" : "Gramer";
    beceri[ad] = beceri[ad] || { p: 0, n: 0 };
    beceri[ad].p += p;
    beceri[ad].n += ids.length;
    if (b.konu) (konuSeans[b.konu] = konuSeans[b.konu] || []).push({ tarih: isoTarih(g.tarih), yuzde: Math.round((p / ids.length) * 100) });
  }
}

const haftaHata = {};
for (const h of hatalar) {
  const t = await adapter.read(h.file.path).catch(() => "");
  const n = [...t.matchAll(/^- (\d{4}-\d{2}-\d{2}):/gm)].filter((m) => aralikta(m[1], haftaBas, bugun)).length;
  if (n) haftaHata[h.file.path] = { h, n };
}

const kartDurum = (await jsonOku("_kisisel/kartlar/durum.json")) || { kartlar: {}, planlar: {} };
const kartlar = Object.values(kartDurum.kartlar || {});
const ogrenilenToplam = kartlar.filter((k) => k && k.tamam).length;
const ogrenilenHafta = kartlar.filter((k) => k && aralikta(k.tamam, haftaBas, bugun)).length;
let kaydirma = 0;
for (const [t, plan] of Object.entries(kartDurum.planlar || {})) {
  if (!aralikta(t, haftaBas, bugun)) continue;
  for (const liste of Object.values(plan)) if (Array.isArray(liste)) kaydirma += liste.filter((x) => x.sonuc).length;
}

const drilller = [];
for (const d of dv.pages('"09 Drill"').array().filter((p) => p.tur === "drill" && p.set)) {
  const durum = await jsonOku(`_kisisel/drill/${d.set}.durum.json`);
  drilller.push({ d, durum });
}
const analizler = dv
  .pages('"10 Analiz"')
  .array()
  .filter((p) => p.tur === "analiz")
  .sort((a, b) => String(isoTarih(b.bitis) || "").localeCompare(String(isoTarih(a.bitis) || "")));

const hafta = el("div", "ad-card ad-week", null, kok);
const haftaBaslik = el("div", "ad-card-head", null, hafta);
const hb = el("div", null, null, haftaBaslik);
el("div", "ad-card-title", "📊 Bu hafta", hb);
el("div", "ad-week-range", `${haftaBas.slice(8)}.${haftaBas.slice(5, 7)} – ${bugun.slice(8)}.${bugun.slice(5, 7)} · son 7 gün`, hb);
if (analizler.length) notLinki(analizler[0], "📝 Haftalık analizi oku →", haftaBaslik, "ad-week-link");

const ws = el("div", "ad-week-stats", null, hafta);
function haftaKutu(deger, etiket, alt, cls) {
  const k = el("div", "ad-week-stat", null, ws);
  el("div", "ad-week-v", deger, k);
  el("div", "ad-week-l", etiket, k);
  if (alt) el("div", "ad-week-sub " + (cls || ""), alt, k);
}
haftaKutu(`${calisilanGun}/7`, "antrenman günü", buHafta.length > calisilanGun ? `${buHafta.length} seans` : null);
const fark = haftaOrt !== null && gecenOrt !== null ? haftaOrt - gecenOrt : null;
haftaKutu(haftaOrt === null ? "–" : `%${haftaOrt}`, "ortalama puan", fark === null ? "ilk hafta" : `${fark >= 0 ? "↑ +" : "↓ "}${fark} geçen haftaya göre`, fark === null ? "" : fark >= 0 ? "ad-up" : "ad-down");
haftaKutu(String(haftaSoru), "soru çözüldü", haftaSoru ? `%${Math.round((haftaPuan / haftaSoru) * 100)} doğru` : null);
haftaKutu(`+${ogrenilenHafta}`, "kart öğrenildi", `${kaydirma} kaydırma · toplam ${ogrenilenToplam}`);

const renk = (y) => (y >= 85 ? "ad-fill-temiz" : y >= 60 ? "ad-fill-orta" : "ad-fill-zayif");
const haftaIki = el("div", "ad-grid2", null, hafta);
const becKart = el("div", null, null, haftaIki);
el("div", "ad-card-subtitle", "Becerilere göre", becKart);
if (!Object.keys(beceri).length) el("div", "ad-empty", "Bu hafta puanlanmış bir antrenman yok.", becKart);
for (const ad of ["Gramer", "Kelime", "Hören", "Lesen", "Schreiben", "Beceri"].filter((a) => beceri[a])) {
  const y = Math.round((beceri[ad].p / beceri[ad].n) * 100);
  const r = el("div", "ad-week-row", null, becKart);
  el("span", "ad-week-name", ad, r);
  const bar = el("div", "ad-minibar ad-week-bar", null, r);
  el("div", "ad-minibar-fill " + renk(y), null, bar).style.width = Math.max(4, y) + "%";
  el("span", "ad-week-num", `%${y}`, r);
}
const hataKart = el("div", null, null, haftaIki);
el("div", "ad-card-subtitle", "Bu haftanın hataları", hataKart);
const hataListe = Object.values(haftaHata).sort((a, b) => b.n - a.n).slice(0, 5);
if (!hataListe.length) el("div", "ad-empty", "Bu hafta kayıtlı hata yok.", hataKart);
for (const { h, n } of hataListe) {
  const r = el("div", "ad-week-row", null, hataKart);
  notLinki(h, h.etiket || h.file.name, r, "ad-week-name");
  const bar = el("div", "ad-minibar ad-week-bar", null, r);
  el("div", "ad-minibar-fill ad-fill-zayif", null, bar).style.width = Math.round((n / hataListe[0].n) * 100) + "%";
  el("span", "ad-week-num", n + "×", r);
}

const calisilan = Object.entries(konuSeans)
  .map(([id, seanslar]) => ({ k: konular.find((x) => x.id === id), seanslar }))
  .filter((x) => x.k)
  .sort((a, b) => (a.k.durum === "zayif" ? 0 : 1) - (b.k.durum === "zayif" ? 0 : 1) || a.seanslar[a.seanslar.length - 1].yuzde - b.seanslar[b.seanslar.length - 1].yuzde);
if (calisilan.length) {
  el("div", "ad-card-subtitle", "Bu hafta çalıştığın konular · her nokta bir seans", hafta);
  const izgara = el("div", "ad-week-topics", null, hafta);
  for (const { k, seanslar } of calisilan) {
    const r = el("div", "ad-item", null, izgara);
    notLinki(k, k.baslik || k.file.name, r);
    const sag = el("div", "ad-week-right", null, r);
    const noktalar = el("span", "ad-week-dots", null, sag);
    for (const s of seanslar) {
      const n = el("span", "ad-week-dot " + renk(s.yuzde), null, noktalar);
      n.setAttribute("title", `${s.tarih}: %${s.yuzde}`);
    }
    el("span", "ad-pill ad-pill-" + k.durum, `${sayi(k.ustalik)} · ${DURUM_ETIKET[k.durum]}`, sag);
  }
}

if (drilller.length) {
  el("div", "ad-card-subtitle", "🎯 Drill'ler", hafta);
  for (const { d, durum } of drilller) {
    const r = el("div", "ad-item", null, hafta);
    notLinki(d, d.file.name + " drill", r);
    const gecmis = (durum && durum.gecmis) || [];
    const son = gecmis[gecmis.length - 1];
    const a = durum && durum.aktif;
    const yapilan = a && !a.bitti ? Object.keys(a.cevaplar || {}).length : 0;
    let yazi = "henüz başlamadın";
    if (durum && durum.tamamlandi) yazi = `✅ tamamlandı (${durum.tamamlandi})`;
    else if (yapilan) yazi = `${a.tur}. tur: ${yapilan}/${a.sira.length} soru`;
    else if (son) yazi = `${gecmis.length} tur · son: %${Math.round((son.dogru / son.toplam) * 100)} · ${son.ort_sure} sn`;
    el("span", "ad-week-drill", yazi, r);
  }
}

// tıklanan kelimeler: canlı olarak tiklananlar.json'dan, "artık bakmıyorsun" sinyal.json'dan (_sistem/sozluk/sinyal.py)
const tikKayit = ((await jsonOku("_kisisel/sozluk/tiklananlar.json")) || {}).kelimeler || {};
const sinyal = (await jsonOku("_kisisel/sozluk/sinyal.json")) || { kelimeler: {} };
const isimMi = (e) => !!e?.ozel || String(e?.karta_eklendi || "").startsWith("atlandı") || /\((isim|soyadı|.*artikel|.*zamir)/.test(String(e?.tr || ""));
const haftaTik = Object.entries(tikKayit).filter(([, e]) => aralikta(e.son, haftaBas, bugun) && !isimMi(e));
if (haftaTik.length) {
  const gunlukSayim = haftaTik.reduce((n, [, e]) => n + Object.entries(e.gunler || {}).filter(([g]) => aralikta(g, haftaBas, bugun)).reduce((a, [, x]) => a + x, 0), 0);
  el("div", "ad-card-subtitle", "🔍 Tıkladığın kelimeler", hafta);
  el("div", "ad-tik-ozet", `Bu hafta ${haftaTik.length} kelimeye baktın` + (gunlukSayim ? ` · ${gunlukSayim} tıklama` : ""), hafta);
  const sik = haftaTik
    .filter(([, e]) => Object.keys(e.gunler || {}).length >= 2 || (e.ilk !== e.son && e.ilk) || sayi(e.sayi) >= 3)
    .filter(([w]) => !["bakmiyor", "ogrenildi"].includes(sinyal.kelimeler?.[w]?.durum))
    .sort((a, b) => sayi(b[1].sayi) - sayi(a[1].sayi))
    .slice(0, 10);
  const satir = (baslik, liste, cls) => {
    if (!liste.length) return;
    const r = el("div", "ad-tik-satir", null, hafta);
    el("span", "ad-tik-baslik", baslik, r);
    const kutu = el("div", "ad-tags", null, r);
    for (const [w, n, title] of liste) {
      const c = el("span", "ad-tik-chip " + cls, n ? `${w} · ${n}×` : w, kutu);
      if (title) c.setAttribute("title", title);
    }
  };
  satir("Sık baktıkların", sik.map(([w, e]) => [w, sayi(e.sayi), e.tr || ""]), "ad-tik-sik");
  const sk = Object.entries(sinyal.kelimeler || {}).filter(([, s]) => !isimMi(s));
  satir("Artık bakmıyorsun", sk.filter(([, s]) => s.durum === "bakmiyor").slice(0, 10).map(([w, s]) => [w, 0, `${s.tr || ""} · tıklamadan geçtiği günler: ${(s.tiklamadan_gecti || []).join(", ")}`]), "ad-tik-birakti");
  satir("Kartı öğrenildi", sk.filter(([, s]) => s.durum === "ogrenildi").slice(0, 10).map(([w, s]) => [s.kart_de || w, 0, s.tr || ""]), "ad-tik-ogrenildi");
  if (sinyal.guncelleme) el("div", "ad-week-sub", `"Artık bakmıyorsun" ${sinyal.guncelleme} itibarıyla. Asıl ölçü kart: kart öğrenilmeden kelime öğrenilmiş sayılmaz.`, hafta);
}

// seviye yolu
const yol = el("div", "ad-card ad-path-card", null, kok);
el("div", "ad-card-title", "Yolculuğun", yol);
const path = el("div", "ad-path", null, yol);
asamalar.forEach((a, i) => {
  const adim = el("div", "ad-step" + (i < aktifAsama || aktifAsama === -1 ? " ad-step-done" : i === aktifAsama ? " ad-step-active" : ""), null, path);
  const halka = el("div", "ad-ring", null, adim);
  halka.style.setProperty("--p", a.yuzde);
  el("div", "ad-ring-inner", a.yuzde + "%", halka);
  el("div", "ad-step-name", a.ad, adim);
  el("div", "ad-step-sub", a.temiz + "/" + a.toplam + " temiz", adim);
  if (i < asamalar.length - 1) el("div", "ad-step-line", null, path);
});

// müfredat: iki hat, odak konusu ve kademesi (_sistem/Müfredat.md, Kurallar → Müfredat)
const yoklamaDurum = (k) => {
  const y = String(k.yoklama ?? "0/0/0");
  if (y.startsWith("hata")) return { tip: "hata" };
  if (y.startsWith("gecti")) return { tip: "gecti" };
  const [d, s, g] = y.split("/").map(sayi);
  return { tip: "acik", d, s, g };
};
const mufredat = el("div", "ad-card", null, kok);
const mufBas = el("div", "ad-card-head", null, mufredat);
el("div", "ad-card-title", "🧭 Müfredat", mufBas);
const mufLejant = el("div", "ad-legend", null, mufBas);
for (const [cls, ad] of [["temiz", "bitti"], ["ogreniliyor", "odak"], ["yeni", "🔎 yoklamada"], ["beklemede", "sırası gelecek"]]) {
  const l = el("span", "ad-legend-item", null, mufLejant);
  el("span", "ad-dot ad-dot-" + cls, null, l);
  metin(l, ad);
}
for (const [hat, ad] of [["fiil", "🔧 Fiil hattı"], ["isim", "🧱 İsim hattı"]]) {
  const ks = konular.filter((k) => k.tur === "gramer" && k.hat === hat).sort((a, b) => sayi(a.sira) - sayi(b.sira));
  if (!ks.length) continue;
  const odakI = ks.findIndex((k) => k.durum !== "temiz" && !onarimda(k));
  const odak = odakI >= 0 ? ks[odakI] : null;
  const pencere = new Set();
  if (odak && sayi(odak.kademe) === 0 && yoklamaDurum(odak).tip === "acik") pencere.add(odak.id);
  if (odak) {
    let n = 0;
    for (const k of ks.slice(odakI + 1)) {
      if (n >= 2) break;
      if (k.durum !== "temiz" && !onarimda(k) && yoklamaDurum(k).tip === "acik") { pencere.add(k.id); n++; }
    }
  }
  const blok = el("div", "ad-hat", null, mufredat);
  const bas = el("div", "ad-hat-head", null, blok);
  el("span", "ad-hat-name", ad, bas);
  const bitti = ks.filter((k) => k.durum === "temiz").length;
  el("span", "ad-hat-count", `${bitti}/${ks.length} bitti`, bas);
  if (odak) {
    const satir = el("div", "ad-hat-focus", null, blok);
    metin(satir, "Odak: ");
    notLinki(odak, odak.baslik || odak.file.name, satir);
    const kd = sayi(odak.kademe);
    const y = yoklamaDurum(odak);
    const bilgi = kd === 0 && y.tip === "acik" ? ` · yoklamada ${y.d}/${y.s}, ${y.g} gün` : ` · K${kd} ${KADEMELER[kd - 1] || ""}${pencereYazi(odak)}`;
    el("span", "ad-hat-sub", bilgi + (odak.durum === "zayif" ? " · kademe düştü" : ""), satir);
    const basamak = el("div", "ad-kademe", null, blok);
    KADEMELER.forEach((kad, i) => {
      const n = i + 1;
      const cls = n < kd ? " ad-kademe-ok" : n === kd ? (pencereYakin(odak) ? " ad-kademe-yarim" : " ad-kademe-simdi") : "";
      el("div", "ad-kademe-adim" + cls, `K${n} ${kad}`, basamak);
    });
    const dar = ks.find((k) => k.durum === "zayif" && k.dar);
    if (dar) {
      const s3 = el("div", "ad-hat-focus", null, blok);
      metin(s3, "Dar onarım: ");
      notLinki(dar, dar.baslik || dar.file.name, s3);
      el("span", "ad-hat-sub", ` · sadece ${darListe(dar).join(", ")}${pencereYazi(dar).replace("geçiş: 12'de 10", "çıkış: 6'da 5")}`, s3);
    }
    const yay = ks.filter((k) => k.durum === "temiz" && isoTarih(k.yayilim) && isoTarih(k.yayilim) >= bugun);
    if (yay.length) {
      const s4 = el("div", "ad-hat-focus", null, blok);
      metin(s4, "Genele yayılıyor: ");
      yay.forEach((k, i) => {
        if (i) metin(s4, ", ");
        notLinki(k, k.baslik || k.file.name, s4);
      });
      el("span", "ad-hat-sub", " · her gün tekrarda ve alıştırmaların içinde", s4);
    }
    const on = ks.find((k) => k !== odak && String(k.on) === "true");
    if (on) {
      const s2 = el("div", "ad-hat-focus", null, blok);
      metin(s2, "Ön konu: ");
      notLinki(on, on.baslik || on.file.name, s2);
      el("span", "ad-hat-sub", ` · K${Math.max(1, sayi(on.kademe))}${pencereYazi(on)} · en fazla K2`, s2);
    }
  } else {
    el("div", "ad-empty", "Bu hattın bütün konuları bitti 🎉", blok);
  }
  const chips = el("div", "ad-chips", null, blok);
  for (const k of ks) {
    const y = yoklamaDurum(k);
    let cls = k.durum === "temiz" ? "temiz" : onarimda(k) ? "zayif" : k === odak || String(k.on) === "true" ? (k.durum === "zayif" ? "zayif" : "ogreniliyor") : pencere.has(k.id) ? "yeni" : k.durum === "beklemede" ? "beklemede" : "kilitli";
    const etiket = (pencere.has(k.id) && k !== odak ? "🔎 " : "") + (k.baslik || k.file.name);
    const chip = notLinki(k, etiket, chips, "ad-chip ad-chip-" + cls + (tekrarZamani(k) && k.durum === "temiz" ? " ad-due" : ""));
    const ek = k.durum === "temiz" ? "bitti" + (y.tip === "gecti" ? " (yoklamayla)" : "") : k.durum === "zayif" && k.dar ? "dar onarım: " + darListe(k).join(", ") : onarimda(k) ? "onarımda" : y.tip === "hata" ? `yoklama bozuldu · K${Math.max(1, sayi(k.kademe))}'den başlar` : y.tip === "acik" && y.s ? `yoklama ${y.d}/${y.s}, ${y.g} gün` : "";
    chip.setAttribute("title", `${sayi(k.sira)}. ${k.id}` + (ek ? " · " + ek : ""));
  }
}

// iki kart: takıldıkların + tekrar sırası
const ikili = el("div", "ad-grid2", null, kok);

const takil = el("div", "ad-card", null, ikili);
el("div", "ad-card-title", "🧩 Takıldığın yerler", takil);
const zayiflar = konular.filter((k) => k.durum === "zayif").sort((a, b) => sayi(a.ustalik) - sayi(b.ustalik)).slice(0, 5);
if (!zayiflar.length) el("div", "ad-empty", "Henüz takıldığın bir konu yok. İlk kontrolden sonra burada görünecek.", takil);
for (const k of zayiflar) {
  const r = el("div", "ad-item", null, takil);
  notLinki(k, k.baslik || k.file.name, r);
  const bar = el("div", "ad-minibar", null, r);
  const dolu = el("div", "ad-minibar-fill ad-fill-zayif", null, bar);
  dolu.style.width = Math.max(4, sayi(k.ustalik)) + "%";
}
const enCokHata = hatalar.filter((h) => sayi(h.sayac) > 0).sort((a, b) => sayi(b.sayac) - sayi(a.sayac)).slice(0, 4);
if (enCokHata.length) {
  el("div", "ad-card-subtitle", "Sık yaptığın hatalar", takil);
  const etiketler = el("div", "ad-tags", null, takil);
  for (const h of enCokHata) {
    const t = notLinki(h, (h.etiket || h.file.name) + " · " + sayi(h.sayac) + "×", etiketler, "ad-tag");
    t.setAttribute("title", "Kartlarını tekrar et");
  }
}

const sira = el("div", "ad-card", null, ikili);
el("div", "ad-card-title", "🔁 Tekrar sırası", sira);
if (!vadesiGelen.length) el("div", "ad-empty", "Bugün tekrar edilecek konu yok.", sira);
for (const k of vadesiGelen.slice(0, 6)) {
  const r = el("div", "ad-item", null, sira);
  notLinki(k, k.baslik || k.file.name, r);
  const gec = gunFarki(isoTarih(k.sonraki_tekrar), bugun);
  el("span", "ad-pill ad-pill-" + k.durum, DURUM_ETIKET[k.durum] + (gec > 0 ? ` · ${gec} gün gecikti` : ""), r);
}
if (vadesiGelen.length > 6) el("div", "ad-empty", `+${vadesiGelen.length - 6} konu daha`, sira);

// konu haritası
const harita = el("div", "ad-card", null, kok);
const haritaBas = el("div", "ad-card-head", null, harita);
el("div", "ad-card-title", "🗺️ Konu haritası", haritaBas);
const lejant = el("div", "ad-legend", null, haritaBas);
for (const d of ["temiz", "ogreniliyor", "zayif", "yeni", "beklemede", "kilitli"]) {
  const l = el("span", "ad-legend-item", null, lejant);
  el("span", "ad-dot ad-dot-" + d, null, l);
  metin(l, DURUM_ETIKET[d]);
}
const gruplar = [
  ...SEVIYELER.map((s) => ({ ad: "Gramer " + s, ks: konular.filter((k) => k.tur === "gramer" && k.seviye === s) })),
  ...SEVIYELER.map((s) => ({ ad: "Kelime " + s, ks: konular.filter((k) => k.tur === "kelime" && k.seviye === s) })),
  { ad: "Sınav bölümleri", ks: konular.filter((k) => k.tur === "sinav") },
];
for (const g of gruplar) {
  if (!g.ks.length) continue;
  const det = el("details", "ad-group", null, harita);
  const aktifVar = g.ks.some((k) => k.durum !== "kilitli");
  if (aktifVar) det.setAttribute("open", "");
  const sum = el("summary", null, null, det);
  el("span", "ad-group-name", g.ad, sum);
  const sayac = el("span", "ad-group-count", null, sum);
  const say = (d) => g.ks.filter((k) => k.durum === d).length;
  for (const d of ["temiz", "ogreniliyor", "zayif", "yeni"]) {
    if (say(d)) {
      const c = el("span", "ad-count", null, sayac);
      el("span", "ad-dot ad-dot-" + d, null, c);
      metin(c, String(say(d)));
    }
  }
  if (!aktifVar) el("span", "ad-count ad-muted", "🔒 " + g.ks.length, sayac);
  const grid = el("div", "ad-chips", null, det);
  for (const k of g.ks) {
    const durum = DURUM_ETIKET[k.durum] ? k.durum : "kilitli";
    const chip = notLinki(k, k.baslik || k.file.name, grid, "ad-chip ad-chip-" + durum + (tekrarZamani(k) ? " ad-due" : ""));
    const sonraki = isoTarih(k.sonraki_tekrar);
    chip.setAttribute("title", `${k.id} · ${DURUM_ETIKET[durum]} · ustalık ${sayi(k.ustalik)}` + (sonraki ? ` · tekrar ${sonraki}` : ""));
  }
}

// son 14 gün + deneme sınavı
const alt = el("div", "ad-grid2", null, kok);

const grafik = el("div", "ad-card", null, alt);
el("div", "ad-card-title", "📈 Son 14 gün", grafik);
const puanlar = {};
for (const g of gunlukler) {
  const t = isoTarih(g.tarih);
  if (t && g.durum === "tamamlandi" && g.puan !== null && g.puan !== undefined) puanlar[t] = Math.max(puanlar[t] ?? 0, sayi(g.puan));
}
const sutunlar = el("div", "ad-chart", null, grafik);
for (let i = 13; i >= 0; i--) {
  const t = gunEkle(bugun, -i);
  const s = el("div", "ad-col", null, sutunlar);
  const alan = el("div", "ad-col-area", null, s);
  const b = el("div", "ad-col-bar", null, alan);
  if (t in puanlar) {
    b.style.height = Math.max(6, puanlar[t]) + "%";
    b.setAttribute("title", t + ": " + puanlar[t] + "%");
    if (puanlar[t] >= 85) b.classList.add("ad-col-good");
  } else {
    b.classList.add("ad-col-empty");
  }
  el("div", "ad-col-label" + (t === bugun ? " ad-col-today" : ""), String(Number(t.slice(8, 10))), s);
}

const testKart = el("div", "ad-card", null, alt);
el("div", "ad-card-title", "📝 Deneme sınavı", testKart);
const puanliTestler = testler
  .filter((t) => isoTarih(t.tarih) && ["lesen", "sprachbausteine", "hoeren", "schreiben"].some((a) => t[a] !== null && t[a] !== undefined))
  .sort((a, b) => isoTarih(b.tarih).localeCompare(isoTarih(a.tarih)));
if (!puanliTestler.length) {
  const ip = el("div", "ad-empty", "Henüz deneme sınavı çözmedin. ", testKart);
  const ilk = testler[0];
  if (ilk) notLinki(ilk, ilk.file.name + " →", ip);
} else {
  const t = puanliTestler[0];
  const yazili = sayi(t.lesen) + sayi(t.sprachbausteine) + sayi(t.hoeren) + sayi(t.schreiben);
  const sozlu = t.sprechen === null || t.sprechen === undefined ? null : sayi(t.sprechen);
  notLinki(t, t.file.name + " · " + isoTarih(t.tarih), el("div", "ad-card-subtitle", null, testKart));
  function baraj(etiket, puan, max, esik) {
    const r = el("div", "ad-exam", null, testKart);
    const ust = el("div", "ad-exam-top", null, r);
    el("span", null, etiket, ust);
    el("span", "ad-exam-score " + (puan === null ? "" : puan >= esik ? "ad-good" : "ad-bad"), puan === null ? "–" : puan + " / " + max, ust);
    const bar = el("div", "ad-minibar ad-minibar-lg", null, r);
    const dolu = el("div", "ad-minibar-fill " + (puan !== null && puan >= esik ? "ad-fill-temiz" : "ad-fill-zayif"), null, bar);
    dolu.style.width = (puan === null ? 0 : Math.min(100, (puan / max) * 100)) + "%";
    const cizgi = el("div", "ad-threshold", null, bar);
    cizgi.style.left = (esik / max) * 100 + "%";
  }
  baraj("Yazılı · baraj 135", yazili, 225, 135);
  baraj("Sözlü · baraj 45", sozlu, 75, 45);
}

// alt bağlantılar
const linkler = el("div", "ad-footer", null, kok);
for (const [yolu, ad] of [
  ["01 Sınav/Format.md", "Sınav formatı"],
  ["01 Sınav/Geçmiş konular.md", "Geçmiş konular"],
  ["01 Sınav/Puanlama ipuçları.md", "Puanlama ipuçları"],
  ["04 Redemittel/Schreiben E-Mail.md", "E-posta kalıpları"],
  ["04 Redemittel/Sprechen Teil 1.md", "Sprechen 1"],
  ["04 Redemittel/Sprechen Teil 2.md", "Sprechen 2"],
  ["04 Redemittel/Sprechen Teil 3.md", "Sprechen 3"],
  ["Kartlar.md", "🃏 Kartlar"],
  ...dv.pages('"09 Drill"').array().filter((p) => p.tur === "drill").map((p) => [p.file.path, "🎯 " + p.file.name + (p.durum === "acik" ? " ·  açık" : "")]),
  ["_kisisel/Profil.md", "⚙️ Profil"],
]) {
  notLinki({ file: { path: yolu } }, ad, linkler, "ad-footer-link");
}
