// Drill ekranı: tek konuda art arda soru, anında geri bildirim. Notta:
//   await dv.view("_sistem/drill", { set: "akkusativ" })
// Sorular: _sistem/drill/<set>.json (motor drill'leri) ya da _kisisel/drill/<set>.json (Claude'un ürettiği mini drill'ler)
// Durum:   _kisisel/drill/<set>.durum.json (bu ekran yazar)

const SET = input.set;
const adapter = app.vault.adapter;
const SORU_YOLU = (await adapter.exists(`_kisisel/drill/${SET}.json`)) ? `_kisisel/drill/${SET}.json` : `_sistem/drill/${SET}.json`;
const DURUM_YOLU = `_kisisel/drill/${SET}.durum.json`;
const CINS_SUTUN = { m: 1, f: 2, n: 3, pl: 4 };

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  if (parent) parent.appendChild(e);
  return e;
}

// **kalın** yazıları güvenli biçimde göster
function zengin(parent, metin) {
  String(metin).split(/(\*\*[^*]+\*\*)/).forEach((p) => {
    if (!p) return;
    if (p.startsWith("**")) el("strong", null, p.slice(2, -2), parent);
    else parent.appendChild(document.createTextNode(p));
  });
  return parent;
}

function yalit(e) {
  for (const t of ["keydown", "keyup", "mousedown", "mouseup", "click", "pointerdown", "beforeinput", "input"]) {
    e.addEventListener(t, (ev) => ev.stopPropagation());
  }
  return e;
}

function enIyiSes() {
  // En doğal Almanca sesi seç: Premium > Gelişmiş/Enhanced > normal; eğlence seslerini (Eddy, Grandma…) atla
  const sesler = speechSynthesis.getVoices().filter((v) => /^de[-_]/i.test(v.lang || ""));
  const puan = (v) =>
    (/premium/i.test(v.name) ? 4 : 0) +
    (/enhanced|gelişmiş|erweitert|verbessert|neural|natural/i.test(v.name) ? 3 : 0) +
    (/Anna|Petra|Markus|Yannick|Helena|Martin/.test(v.name) ? 1 : 0) -
    (/Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley/.test(v.name) ? 10 : 0);
  return sesler.sort((a, b) => puan(b) - puan(a))[0] || null;
}

function seslendir(metin) {
  try {
    const u = new SpeechSynthesisUtterance(metin);
    u.lang = "de-DE";
    u.rate = 0.9;
    const ses = enIyiSes();
    if (ses) u.voice = ses;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (err) {
    console.warn("drill: seslendirme yok", err);
  }
}

// Okunamayan JSON: varsayılanla devam et ama o dosyaya bu oturumda hiç yazma (boş durumla ilerleme silinmesin)
const BOZUK = (window.__almancaBozuk = window.__almancaBozuk || new Set());
function bozukUyar(yol) {
  if (dv.container.querySelector(`[data-bozuk="${yol}"]`)) return;
  const b = document.createElement("div");
  b.dataset.bozuk = yol;
  b.style.cssText = "margin:6px 0;padding:10px 14px;border-radius:10px;background:#b3261e;color:#fff;font-weight:600;font-size:0.9em";
  b.textContent = `⚠️ ${yol} okunamadı (bozuk ya da yarım yazılmış olabilir). İlerleme silinmesin diye bu dosyaya bu oturumda yazılmıyor. Claude'a söyle ya da _kisisel/yedek/ içinden geri yükle; sonra sayfayı yenile.`;
  dv.container.prepend(b);
}
async function jsonOku(yol, varsayilan) {
  try {
    if (!(await adapter.exists(yol))) return varsayilan;
    return JSON.parse(await adapter.read(yol));
  } catch (err) {
    console.error("drill: okunamadı", yol, err);
    BOZUK.add(yol);
    bozukUyar(yol);
    return varsayilan;
  }
}

function medyan(dizi) {
  if (!dizi.length) return 0;
  const a = dizi.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function bugun() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function karistir(dizi) {
  const a = dizi.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const veri = await jsonOku(SORU_YOLU, null);
const kok = el("div", "dr-root", null, dv.container);
yalit(kok);
// Kapı: seviye tespiti bitmeden drill yok (Kurallar → Seviye tespiti → Zorunlu)
if (String((dv.page("_kisisel/Profil") || {}).seviye_tespiti || "") !== "tamamlandi") {
  const kapi = el("div", "dr-done", null, kok);
  el("div", "dr-done-emoji", "🔒", kapi);
  el("div", "dr-done-title", "Drill'ler seviye tespitinden sonra açılır", kapi);
  el("div", "dr-done-sub", "Önce nereden başlayacağını bulalım: Claude Code'da /seviye yaz.", kapi);
  return;
}
if (!veri) {
  el("div", "dr-error", "Drill bulunamadı: " + SORU_YOLU, kok);
  return;
}
const soruNo = Object.fromEntries(veri.sorular.map((s) => [s.no, s]));
const durum = await jsonOku(DURUM_YOLU, { aktif: null, gecmis: [] });
durum.gecmis = durum.gecmis || [];

function yeniTur(tip, numaralar) {
  durum.aktif = { tur: durum.gecmis.length + 1, tip, baslangic: bugun(), sira: numaralar, cevaplar: {} };
}
if (!durum.aktif) {
  if (veri.sorular.length > 100) {
    // havuz 100'den büyükse ilk tur da kategorilere dengeli dağılmış 100 soru olur
    const { sira, dagilim } = uyarlanabilirTur({ sira: [], cevaplar: {} });
    yeniTur("tam", sira);
    durum.aktif.dagilim = dagilim;
  } else yeniTur("tam", veri.sorular.map((s) => s.no));
}

// Kayıtta diskteki durum yeniden okunur ve birleştirilir (başka sekme ya da eski pencere ilerlemeyi ezmesin):
// geçmiş turlar birleşir, aynı aktif turun cevapları birleşir (bu sekmedeki cevap kazanır), tamamlandi korunur.
function birlestir(disk, bellek) {
  const out = { ...disk, ...bellek };
  const anahtar = (g) => `${g.tur}|${g.tip}|${g.tarih}|${g.toplam}`;
  const gecmis = new Map();
  for (const g of [...(disk.gecmis || []), ...(bellek.gecmis || [])]) gecmis.set(anahtar(g), g);
  out.gecmis = [...gecmis.values()];
  const da = disk.aktif, ba = bellek.aktif;
  if (da && ba && da.tur === ba.tur && da.baslangic === ba.baslangic && JSON.stringify(da.sira) === JSON.stringify(ba.sira)) {
    out.aktif = { ...da, ...ba, cevaplar: { ...(da.cevaplar || {}), ...(ba.cevaplar || {}) } };
  }
  const t = [disk.tamamlandi, bellek.tamamlandi].filter(Boolean).sort();
  if (t.length) out.tamamlandi = t[0];
  return out;
}
let kayitSirasi = Promise.resolve();
function kaydet() {
  const kopya = JSON.parse(JSON.stringify(durum));
  kayitSirasi = kayitSirasi
    .then(async () => {
      if (BOZUK.has(DURUM_YOLU)) return;
      const disk = await jsonOku(DURUM_YOLU, { aktif: null, gecmis: [] });
      if (BOZUK.has(DURUM_YOLU)) return;
      await adapter.write(DURUM_YOLU, JSON.stringify(birlestir(disk, kopya), null, 1));
    })
    .catch((err) => console.error("drill: kaydedilemedi", err));
}

function normal(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
}

// ---- iskelet ----
const ust = el("div", "dr-top", null, kok);
const baslik = el("div", "dr-title", null, ust);
const istat = el("div", "dr-stats", null, ust);
const ilerleme = el("div", "dr-progress", null, kok);
const ilerlemeDolu = el("div", "dr-progress-fill", null, ilerleme);
const dagilimAlan = el("div", "dr-mix", null, kok);

// tablo
const tabloKutu = el("div", "dr-table-box", null, kok);
const tabloBas = el("div", "dr-table-head", null, tabloKutu);
el("span", "dr-table-title", veri.tablo.baslik, tabloBas);
const gizleBtn = el("button", "dr-mini", "tabloyu gizle", tabloBas);
const tablo = el("table", "dr-table", null, tabloKutu);
const thead = el("tr", null, null, el("thead", null, null, tablo));
el("th", null, "", thead);
veri.tablo.sutunlar.forEach((s) => el("th", null, s, thead));
const tbody = el("tbody", null, null, tablo);
for (const satir of veri.tablo.satirlar) {
  const tr = el("tr", null, null, tbody);
  satir.forEach((h, i) => el(i === 0 ? "th" : "td", i === 1 ? "dr-strong" : null, h, tr));
}
const notlar = el("ul", "dr-notes", null, tabloKutu);
veri.tablo.notlar.forEach((n) => zengin(el("li", null, null, notlar), n));
let tabloAcik = true;
gizleBtn.addEventListener("click", () => {
  tabloAcik = !tabloAcik;
  tablo.style.display = notlar.style.display = tabloAcik ? "" : "none";
  gizleBtn.textContent = tabloAcik ? "tabloyu gizle" : "tabloyu göster";
});

const sahne = el("div", "dr-stage", null, kok);

// Sorunun `cins` kodlarına göre tabloda sütun (artikel setleri) ya da satır (`tablo.vurgu_satir` olan setler) vurgulanır
function vurgula(cinsler) {
  tablo.querySelectorAll(".dr-hl").forEach((x) => x.classList.remove("dr-hl"));
  const satirKodu = veri.tablo.vurgu_satir;
  for (const c of cinsler || []) {
    if (satirKodu) {
      tbody.children[satirKodu[c]]?.querySelectorAll("th, td").forEach((x) => x.classList.add("dr-hl"));
      continue;
    }
    const sutun = CINS_SUTUN[c];
    tablo.querySelectorAll("tr").forEach((tr) => tr.children[sutun]?.classList.add("dr-hl"));
  }
}

function aktifSonuclar() {
  const a = durum.aktif;
  const c = Object.values(a.cevaplar);
  const dogru = c.filter((x) => x.dogru).length;
  const son10 = a.sira.filter((n) => a.cevaplar[n]).slice(-10).map((n) => a.cevaplar[n].sure);
  let seri = 0;
  for (const n of a.sira.filter((n) => a.cevaplar[n]).reverse()) {
    if (a.cevaplar[n].dogru) seri++;
    else break;
  }
  return {
    yapilan: c.length,
    dogru,
    yuzde: c.length ? Math.round((dogru / c.length) * 100) : 0,
    oran: c.length ? (dogru / c.length) * 100 : 0, // yuvarlanmamış: hedef karşılaştırması bununla (%89,5 geçmez)
    ortSure: medyan(son10.map((x) => Math.min(x, 30000))) / 1000,
    seri,
  };
}

function ustCiz() {
  const a = durum.aktif;
  const r = aktifSonuclar();
  baslik.textContent = "";
  el("span", null, "🎯 " + veri.baslik, baslik);
  el("span", "dr-round", a.tip === "yanlis" ? `yanlışlar turu` : `${a.tur}. tur`, baslik);
  istat.textContent = "";
  const kutu = (ikon, deger, etiket) => {
    const k = el("div", "dr-stat", null, istat);
    el("span", "dr-stat-v", ikon + " " + deger, k);
    el("span", "dr-stat-l", etiket, k);
  };
  kutu("📍", `${r.yapilan} / ${a.sira.length}`, "soru");
  kutu("✅", `%${r.yuzde}`, "doğru");
  kutu("🔥", r.seri, "seri");
  kutu("⏱", r.ortSure ? r.ortSure.toFixed(1) + " sn" : "–", "son 10 · medyan");
  ilerlemeDolu.style.width = (r.yapilan / a.sira.length) * 100 + "%";
  dagilimAlan.textContent = "";
  if (a.dagilim && !a.bitti) {
    el("span", "dr-mix-label", "Bu turun ağırlığı:", dagilimAlan);
    const adlar = veri.kategoriler || {};
    for (const [k, n] of Object.entries(a.dagilim).sort((x, y) => y[1] - x[1])) el("span", "dr-mix-chip", `${adlar[k] || k} ${n}`, dagilimAlan);
  }
}

function soruCiz() {
  ustCiz();
  sahne.textContent = "";
  const a = durum.aktif;
  // Cevabı kontrol edilmiş ama "Sonraki" denmemiş soru varsa (ekran yeniden çizilse bile) önce onu göster
  window.__almancaDrillBekleyen = window.__almancaDrillBekleyen || {};
  const bekleyen = a.bekleyen ?? window.__almancaDrillBekleyen[SET];
  const siradaki = bekleyen && a.cevaplar[bekleyen] ? bekleyen : a.sira.find((n) => !a.cevaplar[n]);
  if (siradaki === undefined) return bitisCiz();
  const s = soruNo[siradaki];
  vurgula(s.cins);

  const kart = el("div", "dr-card", null, sahne);
  const kb = el("div", "dr-card-head", null, kart);
  el("span", "dr-section", `${s.bolum}. ${veri.bolumler[s.bolum - 1]}`, kb);
  el("span", "dr-no", `#${s.no}`, kb);

  const cumle = el("div", "dr-sentence", null, kart);
  const kutular = [];
  String(s.metin).split("___").forEach((p, i, arr) => {
    if (p) el("span", null, p, cumle);
    if (i < arr.length - 1) {
      const inp = el("input", "dr-blank", null, cumle);
      inp.type = "text";
      inp.setAttribute("autocomplete", "off");
      inp.setAttribute("spellcheck", "false");
      inp.style.width = "5ch";
      inp.addEventListener("input", () => (inp.style.width = Math.max(5, inp.value.length + 2) + "ch"));
      kutular.push(inp);
    }
  });
  el("div", "dr-hint", "💡 " + s.ipucu, kart);
  const geri = el("div", "dr-feedback", null, kart);
  const dugme = el("button", "dr-check", "Kontrol et ⏎", kart);

  const baslangic = performance.now();
  let kontrolEdildi = false;
  let kontrolAni = 0;

  // her boşluk: "tam" (ipucundaki kelime), "alt" (dilbilgisi olarak doğru başka bir kelime) ya da null (yanlış)
  function degerlendir(degerler) {
    const notlar = [];
    const sonuc = degerler.map((v, i) => {
      if (s.cevaplar[i].some((c) => normal(c) === normal(v))) return "tam";
      const alt = Object.entries((s.alternatifler || [])[i] || {}).find(([c]) => normal(c) === normal(v));
      if (alt) {
        notlar.push(alt[1]);
        return "alt";
      }
      return null;
    });
    return { sonuc, notlar };
  }

  function sonucGoster(kayit) {
    const { sonuc, notlar } = degerlendir(kayit.cevap);
    const dogru = kayit.dogru;
    const alternatif = !!kayit.alternatif;
    kutular.forEach((k, i) => {
      k.value = kayit.cevap[i] ?? k.value;
      k.style.width = Math.max(5, k.value.length + 2) + "ch";
      k.disabled = true;
      k.classList.add(sonuc[i] === "tam" ? "dr-ok" : sonuc[i] === "alt" ? "dr-alt" : "dr-bad");
    });
    kart.classList.add(alternatif ? "dr-card-alt" : dogru ? "dr-card-ok" : "dr-card-bad");
    geri.textContent = "";
    const ana = el("div", "dr-fb-main", null, geri);
    if (alternatif) {
      el("span", null, "🟡 Kabul! ", ana);
      el("span", "dr-fb-time", (kayit.sure / 1000).toFixed(1) + " sn", ana);
      for (const n of new Set(notlar)) zengin(el("div", "dr-fb-text", null, geri), n);
    } else if (dogru) {
      el("span", null, "✅ Doğru! ", ana);
      el("span", "dr-fb-time", (kayit.sure / 1000).toFixed(1) + " sn", ana);
    } else {
      el("span", null, "❌ Doğrusu: ", ana);
      el("strong", null, s.cevaplar.map((c) => c[0]).join(" · "), ana);
    }
    if (!alternatif) zengin(el("div", "dr-fb-text", null, geri), s.aciklama);
    // tam cümle ve Türkçesi
    const ceviri = el("div", "dr-fb-translation", null, geri);
    let j = 0;
    const tam = String(s.metin).replace(/___/g, () => "**" + s.cevaplar[j++][0] + "**");
    const deSatir = el("div", "dr-fb-de", null, ceviri);
    zengin(el("span", null, null, deSatir), "🇩🇪 " + tam);
    if (window.speechSynthesis) {
      const dinle = el("button", "dr-speak", "🔊", deSatir);
      dinle.title = "Cümleyi dinle";
      dinle.addEventListener("click", (e) => {
        e.stopPropagation();
        seslendir(tam.replace(/\*\*/g, ""));
      });
    }
    if (s.tr) el("div", "dr-fb-tr", "🇹🇷 " + s.tr, ceviri);
    dugme.textContent = "Sonraki ⏎";
    kontrolEdildi = true;
  }

  function kontrol() {
    if (kontrolEdildi) {
      // Cevabı onaylayan Enter tuşu, odak düğmeye geçince düğmeyi de tetikleyebiliyor: o ilk anı yok say
      if (performance.now() - kontrolAni < 600) return;
      return devam();
    }
    if (kutular.some((k) => !k.value.trim())) {
      kutular.find((k) => !k.value.trim()).focus();
      return;
    }
    kontrolAni = performance.now();
    // Uzun aralar (ekranı açık bırakıp gitmek) istatistiği bozmasın: bir soru en fazla 30 sn sayılır
    const sure = Math.min(30000, Math.round(performance.now() - baslangic));
    const degerler = kutular.map((k) => k.value.trim());
    const { sonuc } = degerlendir(degerler);
    const dogru = sonuc.every(Boolean);
    const alternatif = dogru && sonuc.includes("alt");
    a.cevaplar[s.no] = { cevap: degerler, dogru, sure, tarih: bugun(), ...(alternatif ? { alternatif: true } : {}) };
    a.bekleyen = s.no;
    window.__almancaDrillBekleyen[SET] = s.no;
    kaydet();
    sonucGoster(a.cevaplar[s.no]);
    ustCiz();
    setTimeout(() => dugme.isConnected && dugme.focus(), 300);
  }

  function devam() {
    if (!kart.isConnected) return;
    delete a.bekleyen;
    delete window.__almancaDrillBekleyen[SET];
    kaydet();
    soruCiz();
  }

  kutular.forEach((k, i) =>
    k.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (i < kutular.length - 1 && !kutular[i + 1].value) kutular[i + 1].focus();
      else kontrol();
    })
  );
  dugme.addEventListener("click", kontrol);
  dugme.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      kontrol();
    }
  });

  if (a.cevaplar[s.no]) {
    // yeniden çizim: kontrol edilmiş soruyu sonucuyla göster, Sonraki'yi bekle
    sonucGoster(a.cevaplar[s.no]);
    setTimeout(() => dugme.isConnected && dugme.focus({ preventScroll: true }), 30);
  } else {
    setTimeout(() => kutular[0]?.focus({ preventScroll: true }), 30);
  }
}

// Bir önceki turun hatalarına göre yeni tur: yanlış yapılan sorular mutlaka gelir, hata oranı yüksek kategorilerden
// daha çok soru seçilir, önce görülmemiş sorular tercih edilir. Toplam 100 soru, bölüm sırasıyla (kolaydan zora).
function uyarlanabilirTur(onceki) {
  const HEDEF = Math.min(100, veri.sorular.length);
  const kat = (n) => soruNo[n].kategori || "diger";
  const hata = {};
  const toplam = {};
  for (const n of onceki.sira) {
    toplam[kat(n)] = (toplam[kat(n)] || 0) + 1;
    if (!onceki.cevaplar[n]?.dogru) hata[kat(n)] = (hata[kat(n)] || 0) + 1;
  }
  const kategoriler = [...new Set(veri.sorular.map((s) => s.kategori || "diger"))];
  // hiç sorulmamış kategoriler orta zorlukta sayılır
  const oran = (k) => ((hata[k] || 0) + 1) / ((toplam[k] || 0) + 4);
  const toplamOran = kategoriler.reduce((t, k) => t + oran(k), 0);
  const havuzBoyu = (k) => veri.sorular.filter((s) => (s.kategori || "diger") === k).length;
  const kota = {};
  for (const k of kategoriler) kota[k] = Math.min(havuzBoyu(k), Math.max(4, Math.round((HEDEF * oran(k)) / toplamOran)));

  const yanlislar = onceki.sira.filter((n) => !onceki.cevaplar[n]?.dogru);
  const gorulen = new Set(onceki.sira);
  const secilen = new Set(yanlislar);
  for (const k of kategoriler) {
    const havuz = veri.sorular.filter((s) => (s.kategori || "diger") === k && !secilen.has(s.no));
    const sirali = [...karistir(havuz.filter((s) => !gorulen.has(s.no))), ...karistir(havuz.filter((s) => gorulen.has(s.no)))];
    let gerek = kota[k] - [...secilen].filter((n) => kat(n) === k).length;
    for (const s of sirali) {
      if (gerek <= 0) break;
      secilen.add(s.no);
      gerek--;
    }
  }
  let liste = [...secilen];
  if (liste.length > HEDEF) {
    // fazlayı en güçlü kategorilerden at (yanlış yapılanlara dokunma)
    const atilabilir = liste.filter((n) => !yanlislar.includes(n)).sort((x, y) => oran(kat(x)) - oran(kat(y)));
    const at = new Set(atilabilir.slice(0, liste.length - HEDEF));
    liste = liste.filter((n) => !at.has(n));
  } else if (liste.length < HEDEF) {
    liste.push(...karistir(veri.sorular.map((s) => s.no).filter((n) => !secilen.has(n))).slice(0, HEDEF - liste.length));
  }
  const sira = [];
  for (let b = 1; b <= veri.bolumler.length; b++) sira.push(...karistir(liste.filter((n) => soruNo[n].bolum === b)));
  const dagilim = {};
  for (const n of sira) dagilim[kat(n)] = (dagilim[kat(n)] || 0) + 1;
  return { sira, dagilim };
}

function bitisCiz() {
  vurgula([]);
  const a = durum.aktif;
  const r = aktifSonuclar();
  const ort = medyan(Object.values(a.cevaplar).map((x) => Math.min(x.sure, 30000))) / 1000;
  // turu geçmişe yaz (bir kez)
  if (!a.bitti) {
    a.bitti = bugun();
    const bolumler = {};
    for (const n of a.sira) {
      const b = soruNo[n].bolum;
      bolumler[b] = bolumler[b] || { dogru: 0, toplam: 0 };
      bolumler[b].toplam++;
      if (a.cevaplar[n]?.dogru) bolumler[b].dogru++;
    }
    durum.gecmis.push({ tur: a.tur, tip: a.tip, tarih: a.bitti, toplam: a.sira.length, dogru: r.dogru, ort_sure: Math.round(ort * 10) / 10, olcu: "medyan", bolumler, yanlis: a.sira.filter((n) => !a.cevaplar[n]?.dogru) });
    kaydet();
  }
  const kart = el("div", "dr-card dr-done", null, sahne);
  // Mini setlerde süre şartı olmayabilir (hedef.sure_sn: null) ve sıradaki set olmayabilir (sonraki: null)
  const hedef = veri.hedef || { dogruluk: 90, sure_sn: null };
  const sureVar = hedef.sure_sn !== null && hedef.sure_sn !== undefined;
  const ustalasti = a.tip === "tam" && r.oran >= hedef.dogruluk && (!sureVar || ort <= hedef.sure_sn);
  // tam bir turda hedef geçilince set tamamlanmış sayılır (ilk geçtiği gün kalır)
  if (ustalasti && !durum.tamamlandi) {
    durum.tamamlandi = a.bitti || bugun();
    kaydet();
  }
  el("div", "dr-done-emoji", ustalasti ? "🏆" : r.yuzde >= 75 ? "💪" : "🌱", kart);
  el("div", "dr-done-title", `Tur bitti: %${r.yuzde} doğru` + (sureVar ? ` · soru başına ${ort.toFixed(1)} sn (medyan)` : ""), kart);
  const tablo2 = el("div", "dr-sections", null, kart);
  const son = durum.gecmis[durum.gecmis.length - 1];
  for (const [b, v] of Object.entries(son.bolumler)) {
    const satir = el("div", "dr-sec-row", null, tablo2);
    el("span", null, `${b}. ${veri.bolumler[b - 1]}`, satir);
    el("span", v.dogru === v.toplam ? "dr-sec-full" : "", `${v.dogru}/${v.toplam}`, satir);
  }
  if (ustalasti) {
    const kosul = `en az %${hedef.dogruluk} doğru` + (sureVar ? `, en fazla ${hedef.sure_sn} sn` : "");
    zengin(
      el("div", "dr-banner", null, kart),
      veri.sonraki
        ? `Hedefi geçtin (${kosul}). **${veri.sonraki}** drill'ine hazırsın! Claude Code'a "${veri.sonraki} drill'ini hazırla" yaz.`
        : `Hedefi geçtin (${kosul}). Mini drill tamamlandı. Claude Code'da /kontrol bunu görür.`,
    );
  } else if (a.tip === "tam") {
    el("div", "dr-done-sub", `Hedef: en az %${hedef.dogruluk} doğru` + (sureVar ? ` ve soru başına en fazla ${hedef.sure_sn} saniye` : "") + ". Bir tur daha!", kart);
  }
  const dugmeler = el("div", "dr-actions", null, kart);
  const yanlislar = a.sira.filter((n) => !a.cevaplar[n]?.dogru);
  if (yanlislar.length) {
    const y = el("button", "dr-btn", `❌ Yanlışlarımı tekrar et (${yanlislar.length})`, dugmeler);
    y.addEventListener("click", () => {
      yeniTur("yanlis", karistir(yanlislar));
      kaydet();
      soruCiz();
    });
  }
  const t = el("button", "dr-btn dr-btn-main", "↻ Yeni tur: zayıf yerlerime ağırlık ver", dugmeler);
  t.addEventListener("click", () => {
    const { sira, dagilim } = uyarlanabilirTur(a);
    yeniTur("tam", sira);
    durum.aktif.dagilim = dagilim;
    kaydet();
    soruCiz();
  });
  if (durum.gecmis.length > 1) {
    const g = el("div", "dr-history", null, kart);
    el("div", "dr-history-title", "Önceki turlar", g);
    for (const x of durum.gecmis.slice(-6).reverse()) {
      el("div", null, `${x.tarih} · ${x.tip === "yanlis" ? "yanlışlar" : x.tur + ". tur"} · %${Math.round((x.dogru / x.toplam) * 100)} · ${x.ort_sure} sn`, g);
    }
  }
  ustCiz();
}

soruCiz();
