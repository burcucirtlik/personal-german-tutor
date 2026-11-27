// Haftalık analiz ekranı: az okuma, çok görsel. 10 Analiz/<bitiş> Hafta <n>.md içinde:
//   await dv.view("_sistem/analiz", { veri: "10 Analiz/veri/2026-11-10 Hafta 3.json" })
// Veri dosyasını /analiz yazar (biçimi: .claude/skills/analiz/SKILL.md → Veri dosyası).

const adapter = app.vault.adapter;
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  if (parent) parent.appendChild(e);
  return e;
}
const tarihKisa = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return { gun: GUNLER[d.getDay()], no: d.getDate() + " " + AYLAR[d.getMonth()].slice(0, 3) };
};
const isaretli = (n) => (n > 0 ? "+" + n : String(n));

// ---- ipucu balonu (fareyle üstüne gelince / klavyeyle odaklanınca) ----
function ipucu(hedef, metin) {
  hedef.setAttribute("tabindex", "0");
  hedef.setAttribute("aria-label", metin);
  const goster = () => {
    let t = document.querySelector(".an-tip");
    if (!t) t = el("div", "an-tip", null, document.body);
    t.textContent = metin;
    const r = hedef.getBoundingClientRect();
    t.style.display = "block";
    const w = t.offsetWidth;
    t.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
    t.style.top = Math.max(8, r.top - t.offsetHeight - 8) + "px";
  };
  const gizle = () => {
    const t = document.querySelector(".an-tip");
    if (t) t.style.display = "none";
  };
  hedef.addEventListener("pointerenter", goster);
  hedef.addEventListener("focus", goster);
  hedef.addEventListener("pointerleave", gizle);
  hedef.addEventListener("blur", gizle);
}

function notLinki(ad, metin, parent, cls) {
  const sayfa = ad ? dv.page(ad) : null;
  if (!sayfa) return el("span", cls, metin, parent);
  const a = el("a", "internal-link " + (cls || ""), metin, parent);
  a.setAttribute("href", "#");
  a.addEventListener("click", (e) => {
    e.preventDefault();
    app.workspace.openLinkText(sayfa.file.path, "", false);
  });
  return a;
}

function bolum(parent, ikon, baslik, alt) {
  const k = el("section", "an-card", null, parent);
  const h = el("div", "an-card-head", null, k);
  el("span", "an-card-icon", ikon, h);
  el("h3", "an-card-title", baslik, h);
  if (alt) el("span", "an-card-sub", alt, h);
  return k;
}

function lejant(parent, ogeler) {
  const l = el("div", "an-legend", null, parent);
  for (const [cls, ad] of ogeler) {
    const o = el("span", "an-legend-item", null, l);
    el("span", "an-key " + cls, null, o);
    el("span", null, ad, o);
  }
  return l;
}

// Küçük sütun grafiği: puanlar 0–100, hedef çizgisiyle
function sutunlar(parent, degerler, { hedef = 85, yukseklik = 120, etiketler = [], ipuclari = [], kucuk = false } = {}) {
  const g = el("div", "an-cols" + (kucuk ? " an-cols-sm" : ""), null, parent);
  g.style.setProperty("--h", yukseklik + "px");
  const alan = el("div", "an-cols-plot", null, g);
  if (hedef !== null) {
    const c = el("div", "an-target", null, alan);
    c.style.bottom = hedef + "%";
    if (!kucuk) el("span", "an-target-label", "hedef " + hedef, c);
  }
  degerler.forEach((d, i) => {
    const s = el("div", "an-col", null, alan);
    if (typeof d === "number") {
      const b = el("div", "an-bar" + (d >= hedef ? " is-hit" : ""), null, s);
      b.style.height = Math.max(2, d) + "%";
      if (!kucuk) el("span", "an-bar-val", d, b);
      ipucu(s, ipuclari[i] || String(d));
    } else {
      el("div", "an-bar-empty", d === "bos" ? "boş" : d === "devam" ? "⏳" : "–", s);
      ipucu(s, ipuclari[i] || (d === "bos" ? "Antrenman yapılmadı" : "Devam ediyor"));
    }
  });
  if (etiketler.length) {
    const alt = el("div", "an-cols-axis", null, g);
    for (const e of etiketler) {
      const x = el("div", "an-col-label", null, alt);
      if (Array.isArray(e)) {
        el("span", "an-col-label-1", e[0], x);
        el("span", "an-col-label-2", e[1], x);
      } else x.textContent = e;
    }
  }
  return g;
}

// ---- veri ----
let v;
try {
  v = JSON.parse(await adapter.read(input.veri));
} catch (err) {
  el("div", "an-error", "Analiz verisi okunamadı: " + input.veri + " (" + err.message + ")", dv.container);
  return;
}
const kok = el("div", "an-root", null, dv.container);

// ================= 1. Hero =================
{
  const h = el("div", "an-hero", null, kok);
  const sol = el("div", "an-hero-main", null, h);
  el("div", "an-eyebrow", "Ortalama puan", sol);
  const sayi = el("div", "an-hero-num", null, sol);
  el("span", null, "%" + v.ortalama.bu, sayi);
  if (v.ortalama.gecen !== null && v.ortalama.gecen !== undefined) {
    const f = v.ortalama.bu - v.ortalama.gecen;
    el("span", "an-delta " + (f > 0 ? "is-up" : f < 0 ? "is-down" : ""), (f > 0 ? "▲ " : f < 0 ? "▼ " : "= ") + Math.abs(f) + " puan", sayi);
  }
  if (v.ortalama.gecen != null) el("div", "an-hero-sub", `geçen hafta %${v.ortalama.gecen}`, sol);
  if (v.ozet) el("p", "an-ozet", v.ozet, sol);
  const t = el("div", "an-tiles", null, h);
  for (const k of v.kutucuklar || []) {
    const x = el("div", "an-tile", null, t);
    el("div", "an-tile-label", k.etiket, x);
    const d = el("div", "an-tile-value", null, x);
    el("span", null, k.deger, d);
    if (k.fark !== undefined && k.fark !== null && k.fark !== 0) el("span", "an-tile-delta " + ((k.iyi ?? k.fark > 0) ? "is-up" : "is-down"), (k.fark > 0 ? "▲" : "▼") + Math.abs(k.fark), d);
    if (k.alt) el("div", "an-tile-sub", k.alt, x);
  }
}

// ================= 1b. Sınav yolu =================
if (v.sinav) {
  const s = v.sinav;
  const gun = (iso) => new Date(iso + "T12:00:00Z").getTime();
  const t0 = gun(s.baslangic), t1 = gun(s.tarih), bugun = gun(v.bitis);
  const yuzde = (iso) => Math.max(0, Math.min(100, ((gun(iso) - t0) / (t1 - t0)) * 100));
  const uzun = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.getDate() + " " + AYLAR[d.getMonth()] + " " + d.getFullYear();
  };
  const k = bolum(kok, "🎓", "Sınav yolu", "telc B1 · " + uzun(s.tarih) + (s.varsayim ? " (" + s.varsayim + ")" : ""));

  const ust = el("div", "an-cards-top an-exam-tiles", null, k);
  for (const [etiket, deger, alt] of s.kutucuklar || []) {
    const t = el("div", "an-tile an-tile-flat", null, ust);
    el("div", "an-tile-label", etiket, t);
    el("div", "an-tile-value", deger, t);
    if (alt) el("div", "an-tile-sub", alt, t);
  }

  // zaman çizelgesi: her hat için A1 → A2 → B1 → prova
  lejant(k, [["is-a1", "A1"], ["is-a2", "A2"], ["is-b1", "B1"], ["is-prova", "sınav provası (son 4 hafta)"], ["is-past", "geçen süre"]]);
  const cizelge = el("div", "an-timeline", null, k);
  const bugunX = yuzde(v.bitis);
  for (const h of s.hatlar) {
    const satir = el("div", "an-tl-row", null, cizelge);
    el("div", "an-tl-name", h.ad, satir);
    const iz = el("div", "an-tl-track", null, satir);
    const parca = (bas, son, cls, ad, ipucuMetni) => {
      const p = el("div", "an-tl-seg " + cls, null, iz);
      p.style.left = yuzde(bas) + "%";
      p.style.width = Math.max(0.5, yuzde(son) - yuzde(bas)) + "%";
      if (ad && yuzde(son) - yuzde(bas) > 7) el("span", "an-tl-seg-label", ad, p);
      ipucu(p, ipucuMetni);
    };
    parca(s.baslangic, v.bitis, "is-past", null, `Başlangıç ${uzun(s.baslangic)} → bugün`);
    let onceki = v.bitis;
    for (const a of h.asamalar) {
      parca(onceki, a.bitis, "is-" + a.ad.toLowerCase(), a.ad, `${h.ad} · ${a.ad}: ${a.konu} konu, hedef bitiş ${uzun(a.bitis)}`);
      onceki = a.bitis;
    }
    parca(s.prova, s.tarih, "is-prova", "Prova", `Sınav provası: ${uzun(s.prova)} → ${uzun(s.tarih)} (Modelltest, gerçek hayat görevleri)`);
    const isaret = el("div", "an-tl-today", null, iz);
    isaret.style.left = bugunX + "%";
    const bayrak = el("div", "an-tl-flag", "🎓", iz);
    ipucu(bayrak, "Sınav: " + uzun(s.tarih));
    const hiz = el("div", "an-tl-pace", null, satir);
    el("strong", null, String(h.gereken).replace(".", ","), hiz);
    el("span", null, " konu / hafta", hiz);
    ipucu(hiz, `${h.ad}: ${h.kalan} konu kaldı, haftada ~${String(h.gereken).replace(".", ",")} konu bitmeli. Bu hafta biten: ${h.bu_hafta}.`);
  }
  // eksen: ay işaretleri
  const eksen = el("div", "an-tl-axis", null, cizelge);
  el("div", null, null, eksen);
  const ayAlan = el("div", "an-tl-months", null, eksen);
  const d = new Date(s.baslangic + "T12:00:00Z");
  d.setUTCDate(1);
  for (d.setUTCMonth(d.getUTCMonth() + 1); d.getTime() < t1; d.setUTCMonth(d.getUTCMonth() + 2)) {
    const iso = d.toISOString().slice(0, 10);
    if (Math.abs(yuzde(iso) - bugunX) < 6) continue; // "bugün" etiketiyle çakışmasın
    const m = el("span", "an-tl-month", AYLAR[d.getUTCMonth()].slice(0, 3) + (d.getUTCMonth() === 0 ? " " + String(d.getUTCFullYear()).slice(2) : ""), ayAlan);
    m.style.left = yuzde(iso) + "%";
  }
  const bugunEtiket = el("span", "an-tl-month an-tl-today-label", "bugün", ayAlan);
  bugunEtiket.style.left = bugunX + "%";
  el("div", null, null, eksen);

  // konu haritası: her konu bir kare
  el("div", "an-subhead", "Gramer haritası: her kare bir konu", k);
  lejant(k, [["is-temiz", "✓ temiz"], ["is-onarim", "🔁 onarımda"], ["is-simdi", "▶ şu an"], ["is-sirada", "sırada"]]);
  const harita = el("div", "an-map", null, k);
  for (const h of s.hatlar) {
    const r = el("div", "an-map-row", null, harita);
    el("div", "an-tl-name", h.ad, r);
    const gruplar = el("div", "an-map-groups", null, r);
    for (const sev of ["A1", "A2", "B1"]) {
      const ks = h.konular.filter((x) => x.seviye === sev);
      if (!ks.length) continue;
      const g = el("div", "an-map-group", null, gruplar);
      el("span", "an-map-level", sev, g);
      const kutu = el("div", "an-map-cells", null, g);
      for (const x of ks) {
        const tur = x.durum === "temiz" ? "temiz" : x.durum === "zayif" ? "onarim" : x.durum === "ogreniliyor" ? "simdi" : "sirada";
        const c = el("span", "an-map-cell is-" + tur, tur === "temiz" ? "✓" : tur === "onarim" ? "↻" : tur === "simdi" ? "▶" : null, kutu);
        ipucu(c, `${x.id} · ${x.ad} · ${{ temiz: "temiz", onarim: "onarımda", simdi: "şu an öğreniliyor" + (x.kademe ? " (K" + x.kademe + ")" : ""), sirada: "sırada" }[tur]}`);
        if (x.dosya)
          c.addEventListener("click", () => {
            const sayfa = dv.page(x.dosya);
            if (sayfa) app.workspace.openLinkText(sayfa.file.path, "", false);
          });
      }
    }
  }
  if (s.not) el("div", "an-lane-note an-exam-note", s.not, k);
}

// ================= 2. Günler =================
if (v.gunler?.length) {
  const k = bolum(kok, "📅", "Günlük puanlar", "hedef çizgisi 85");
  sutunlar(
    k,
    v.gunler.map((g) => (typeof g.puan === "number" ? g.puan : g.durum || "bos")),
    {
      etiketler: v.gunler.map((g) => [tarihKisa(g.tarih).gun, tarihKisa(g.tarih).no]),
      ipuclari: v.gunler.map((g) => `${tarihKisa(g.tarih).no}: ` + (typeof g.puan === "number" ? `%${g.puan}` : g.durum === "devam" ? "devam ediyor" : "boş gün")),
    }
  );
}

// ================= 3. Bulgu =================
if (v.bulgu) {
  const k = bolum(kok, "🧩", v.bulgu.baslik);
  k.classList.add("an-finding");
  if (v.bulgu.maddeler?.length) {
    const ul = el("ul", "an-points", null, k);
    for (const m of v.bulgu.maddeler) el("li", null, m, ul);
  }
  if (v.bulgu.ornekler?.length) {
    const g = el("div", "an-pairs", null, k);
    for (const [yanlis, dogru, not] of v.bulgu.ornekler) {
      const p = el("div", "an-pair", null, g);
      el("span", "an-wrong", yanlis, p);
      el("span", "an-arrow", "→", p);
      el("span", "an-right", dogru, p);
      if (not) el("span", "an-pair-note", not, p);
    }
  }
}

// ================= 4. Müfredat =================
if (v.hatlar?.length) {
  // Kademeler 1.1.0'dan beri üç (K3 geçilince konu biter, Kurallar → Kademeler); eski analizler beş kademeyle çizilir
  const kSayi = Math.max(...v.hatlar.map((h) => Math.max(h.bas || 0, h.son || 0))) > 3 ? 5 : 3;
  const kAd = ["", "Tanıma", "Üretme", "Cümle", "Serbest", "Bağlam"];
  const k = bolum(kok, "🧭", "Müfredat", kSayi === 3 ? "K1 Tanıma · K2 Üretme · K3 Cümle → konu biter, genele yayılır" : "K1 Tanıma · K2 Üretme · K3 Cümle · K4 Serbest · K5 Bağlam");
  const g = el("div", "an-lanes", null, k);
  for (const h of v.hatlar) {
    const c = el("div", "an-lane", null, g);
    const ust = el("div", "an-lane-head", null, c);
    el("span", "an-lane-name", h.ikon + " " + h.ad, ust);
    const ilerledi = h.son > h.bas;
    // h.bitti: konu bu hafta bitti (K3 geçildi ya da süre tavanı) ve genele yayılıyor
    el("span", "an-chip " + (ilerledi || h.bitti ? "is-good" : "is-wait"), h.bitti ? "✓ bitti · genele yayılıyor" : ilerledi ? `✓ K${h.bas} → K${h.son}` : `⏸ K${h.son}'te`, ust);
    notLinki(h.konu, h.kisa, c, "an-lane-topic");
    const iz = el("div", "an-steps", null, c);
    for (let i = 1; i <= kSayi; i++) {
      const s = el("div", "an-step" + (i <= h.son ? " is-on" : "") + (i > h.bas && i <= h.son ? " is-new" : ""), "K" + i, iz);
      ipucu(s, kAd[i] + (i <= h.son ? " · geçildi" : ""));
    }
    if (h.seanslar?.length) {
      const m = el("div", "an-lane-sessions", null, c);
      el("span", "an-mini-label", "seanslar", m);
      sutunlar(m, h.seanslar, { yukseklik: 44, kucuk: true, ipuclari: h.seanslar.map((x, i) => `${i + 1}. seans: %${x}`) });
    }
    if (h.not) el("div", "an-lane-note", h.not, c);
  }
  if (v.onarim?.length) {
    // Veri dosyası eşiği yazmazsa 85 kabul edilir (eski biçim; Kurallar → onarım).
    // o.sonuc ("temiz" | "onarimda") ve o.etiket verilirse çip onlardan yazılır (ör. temiz olup aynı gün geri dönen konu).
    const esik = v.onarim_esik || 85;
    el("div", "an-subhead", v.onarim_esik ? "🔁 Onarım: çıkış için son 10 soruda 8 doğru, 2 gün" : `🔁 Onarım: iki seans üst üste ≥ ${esik} gerekiyor`, k);
    const t = el("div", "an-repairs", null, k);
    for (const o of v.onarim) {
      const r = el("div", "an-repair", null, t);
      notLinki(o.konu, o.kisa, r, "an-repair-name");
      sutunlar(r, o.seanslar, { yukseklik: 34, kucuk: true, ipuclari: o.seanslar.map((x, i) => `${i + 1}. seans: %${x}`) });
      let seri = 0;
      for (let i = o.seanslar.length - 1; i >= 0 && o.seanslar[i] >= esik; i--) seri++;
      const son = o.seanslar[o.seanslar.length - 1];
      const temiz = o.sonuc ? o.sonuc === "temiz" : seri >= 2;
      el("span", "an-chip " + (temiz ? "is-good" : "is-wait"), o.etiket || (temiz ? "✓ yeniden temiz" : `son %${son} · ${Math.min(seri, 2)}/2`), r);
    }
  }
  if (v.biten?.length) {
    const b = el("div", "an-done-row", null, k);
    el("span", "an-mini-label", "✅ temiz kalanlar", b);
    for (const x of v.biten) notLinki(x.konu, x.kisa, b, "an-chip is-good");
  }
}

// ================= 5. Beceriler =================
if (v.beceriler?.length) {
  const k = bolum(kok, "🎯", "Becerilere göre", "doğru oranı");
  lejant(k, [["is-now", "bu hafta"], ["is-prev", "geçen hafta"]]);
  const g = el("div", "an-hbars", null, k);
  for (const b of v.beceriler) {
    const r = el("div", "an-hbar-row", null, g);
    el("span", "an-hbar-name", b.ad, r);
    const iz = el("div", "an-hbar-track", null, r);
    const bu = el("div", "an-hbar is-now", null, iz);
    bu.style.width = Math.max(1, b.bu) + "%";
    if (b.gecen !== null && b.gecen !== undefined) {
      const ge = el("div", "an-hbar is-prev", null, iz);
      ge.style.width = Math.max(1, b.gecen) + "%";
    }
    ipucu(iz, `${b.ad}: bu hafta ${b.etiket || "%" + b.bu}${b.gecen != null ? ", geçen hafta %" + b.gecen : ""}${b.soru ? " · " + b.soru + " soru" : ""}`);
    const deg = el("span", "an-hbar-val", null, r);
    el("strong", null, b.etiket || "%" + b.bu, deg);
    if (b.gecen != null && b.bu !== b.gecen) el("span", "an-tile-delta " + (b.bu > b.gecen ? "is-up" : "is-down"), (b.bu > b.gecen ? "▲" : "▼") + Math.abs(b.bu - b.gecen), deg);
  }
}

// ================= 6. Hata türleri =================
if (v.hatalar?.length) {
  const k = bolum(kok, "🧩", "Hata türleri", "kaç kez görüldü");
  lejant(k, [["is-now", "bu hafta"], ["is-prev", "geçen hafta"]]);
  const enCok = Math.max(1, ...v.hatalar.flatMap((h) => [h.bu, h.gecen || 0]));
  const g = el("div", "an-hbars an-errors", null, k);
  for (const h of v.hatalar) {
    const r = el("div", "an-hbar-row", null, g);
    const ad = el("div", "an-hbar-name", null, r);
    el("span", null, h.ad, ad);
    if (h.ornek) {
      const o = el("span", "an-err-example", null, ad);
      el("span", "an-wrong", h.ornek[0], o);
      el("span", "an-arrow", "→", o);
      el("span", "an-right", h.ornek[1], o);
    }
    const iz = el("div", "an-hbar-track", null, r);
    const bu = el("div", "an-hbar is-now", null, iz);
    bu.style.width = (h.bu / enCok) * 100 + "%";
    const ge = el("div", "an-hbar is-prev", null, iz);
    ge.style.width = ((h.gecen || 0) / enCok) * 100 + "%";
    ipucu(iz, `${h.ad}: bu hafta ${h.bu}×, geçen hafta ${h.gecen || 0}×`);
    const deg = el("span", "an-hbar-val", null, r);
    el("strong", null, h.bu + "×", deg);
    const f = h.bu - (h.gecen || 0);
    // hata artışı kötü: status ikon + etiket
    el("span", "an-trend " + (f > 0 ? "is-bad" : f < 0 ? "is-good" : ""), f > 0 ? "▲ arttı" : f < 0 ? "▼ azaldı" : "= aynı", deg);
  }
}

// ================= 7. Kartlar =================
if (v.kartlar) {
  const kr = v.kartlar;
  const k = bolum(kok, "🃏", "Kartlar");
  const ust = el("div", "an-cards-top", null, k);
  const t1 = el("div", "an-tile an-tile-flat", null, ust);
  el("div", "an-tile-label", "bu hafta öğrenildi", t1);
  const d1 = el("div", "an-tile-value", null, t1);
  el("span", null, (kr.ogrenilen.kelime || 0) + (kr.ogrenilen.cumle || 0), d1);
  if (kr.gecen != null) {
    const f = (kr.ogrenilen.kelime || 0) + (kr.ogrenilen.cumle || 0) - kr.gecen;
    if (f) el("span", "an-tile-delta " + (f > 0 ? "is-up" : "is-down"), (f > 0 ? "▲" : "▼") + Math.abs(f), d1);
  }
  el("div", "an-tile-sub", `${kr.ogrenilen.kelime || 0} kelime · ${kr.ogrenilen.cumle || 0} cümle`, t1);
  if (kr.deste) {
    const t2 = el("div", "an-tile an-tile-flat an-meter-tile", null, ust);
    el("div", "an-tile-label", "kelime destesi " + (kr.deste.seviye ? `(${kr.deste.seviye}. seviye)` : ""), t2);
    const d2 = el("div", "an-tile-value", null, t2);
    el("span", null, kr.deste.ogrenilen, d2);
    el("span", "an-tile-of", " / " + kr.deste.toplam, d2);
    const m = el("div", "an-meter", null, t2);
    el("div", "an-meter-fill", null, m).style.width = (kr.deste.ogrenilen / kr.deste.toplam) * 100 + "%";
    ipucu(m, `${kr.deste.ogrenilen} / ${kr.deste.toplam} kelime öğrenildi`);
  }
  if (kr.gunler?.length) {
    lejant(k, [["is-now", "sağa (biliyorum)"], ["is-left", "solda kaldı"], ["is-closed", "açılmadı"]]);
    const tablo = el("div", "an-card-grid", null, k);
    tablo.style.setProperty("--n", kr.gunler.length);
    el("div", "an-cg-corner", null, tablo);
    for (const g of kr.gunler) {
      const x = el("div", "an-cg-day", null, tablo);
      el("span", null, tarihKisa(g.tarih).gun, x);
    }
    for (const [anahtar, ad] of [["kelime", "Kelime"], ["cumle", "Cümle"]]) {
      el("div", "an-cg-name", ad, tablo);
      for (const g of kr.gunler) {
        const hucre = el("div", "an-cg-cell", null, tablo);
        const deger = g[anahtar];
        const dots = el("div", "an-dots", null, hucre);
        for (let i = 0; i < 10; i++) el("span", "an-dot " + (deger === null || deger === undefined ? "is-closed" : i < deger ? "is-now" : "is-left"), null, dots);
        ipucu(hucre, `${tarihKisa(g.tarih).no} · ${ad}: ` + (deger === null || deger === undefined ? "açılmadı" : `${deger} / 10 sağda`));
      }
    }
  }
}

// ================= 8. Kelimeler =================
if (v.kelimeler) {
  const k = bolum(kok, "🔍", "Kelimeler", v.kelimeler.tiklama ? `${v.kelimeler.tiklama.kelime} kelimeye ${v.kelimeler.tiklama.sayi} tıklama` : null);
  const ara = typeof window.almancaKelimeAra === "function" ? window.almancaKelimeAra : null;
  for (const [anahtar, ikon, ad, cls] of [
    ["zor", "🔥", "En zor: kartı kırmızı", "is-bad"],
    ["okuyorsun", "👀", "Artık tıklamadan okuyorsun", "is-mid"],
    ["ogrenildi", "✅", "Öğrenildi", "is-good"],
  ]) {
    const xs = v.kelimeler[anahtar];
    if (!xs?.length) continue;
    const r = el("div", "an-word-row", null, k);
    el("div", "an-word-head", ikon + " " + ad, r);
    const cs = el("div", "an-words", null, r);
    for (const w of xs) {
      const c = el(ara ? "button" : "span", "an-word " + cls, w, cs);
      if (ara) {
        c.title = "Nerelerde geçiyor?";
        c.addEventListener("click", () => ara(w.replace(/^(der|die|das)\s+/i, ""), [w.replace(/^(der|die|das)\s+/i, "").toLowerCase()]));
      }
    }
  }
}

// ================= 9. Plan tuttu mu =================
if (v.plan?.length) {
  const tutan = v.plan.filter((p) => p.sonuc === "evet").length + v.plan.filter((p) => p.sonuc === "yarim").length / 2;
  const k = bolum(kok, "📋", `Hafta ${v.hafta} planı`, `${String(tutan).replace(".", ",")} / ${v.plan.length} tuttu`);
  const seg = el("div", "an-seg", null, k);
  for (const p of v.plan) el("span", "an-seg-part is-" + p.sonuc, null, seg);
  const g = el("div", "an-plan", null, k);
  for (const p of v.plan) {
    const x = el("div", "an-plan-item is-" + p.sonuc, null, g);
    el("span", "an-plan-icon", p.sonuc === "evet" ? "✓" : p.sonuc === "yarim" ? "½" : "✗", x);
    const m = el("div", null, null, x);
    el("div", "an-plan-goal", p.hedef, m);
    if (p.not) el("div", "an-plan-note", p.not, m);
  }
}

// ================= 10. Gelecek hafta =================
if (v.hedefler?.length) {
  const k = bolum(kok, "🚀", `Hafta ${v.hafta + 1} hedefleri`);
  const g = el("div", "an-goals", null, k);
  for (const h of v.hedefler) {
    const x = el("div", "an-goal", null, g);
    el("div", "an-goal-icon", h.ikon, x);
    el("div", "an-goal-title", h.baslik, x);
    el("div", "an-goal-metric", h.olcu, x);
    if (h.ipucu) el("div", "an-goal-hint", h.ipucu, x);
  }
}

// ================= Tablo görünümü (erişilebilirlik) =================
{
  const d = el("details", "an-table-view", null, kok);
  el("summary", null, "Rakamlar tablo hâlinde", d);
  const tablo = (baslik, kolonlar, satirlar) => {
    if (!satirlar.length) return;
    el("div", "an-subhead", baslik, d);
    const t = el("table", null, null, d);
    const tr = el("tr", null, null, el("thead", null, null, t));
    for (const c of kolonlar) el("th", null, c, tr);
    const tb = el("tbody", null, null, t);
    for (const s of satirlar) {
      const r = el("tr", null, null, tb);
      for (const h of s) el("td", null, h, r);
    }
  };
  tablo("Günler", ["Gün", "Puan"], (v.gunler || []).map((g) => [g.tarih, typeof g.puan === "number" ? "%" + g.puan : g.durum === "devam" ? "devam" : "boş"]));
  tablo("Müfredat", ["Hat", "Konu", "Kademe", "Seanslar"], (v.hatlar || []).map((h) => [h.ad, h.kisa, `K${h.bas} → K${h.son}`, (h.seanslar || []).map((x) => "%" + x).join(", ")]));
  tablo("Onarım", ["Konu", "Seanslar"], (v.onarim || []).map((o) => [o.kisa, o.seanslar.map((x) => "%" + x).join(", ")]));
  tablo("Beceriler", ["Beceri", "Bu hafta", "Geçen hafta", "Soru"], (v.beceriler || []).map((b) => [b.ad, b.etiket || "%" + b.bu, b.gecen != null ? "%" + b.gecen : "–", b.soru || "–"]));
  tablo("Hata türleri", ["Tür", "Bu hafta", "Geçen hafta"], (v.hatalar || []).map((h) => [h.ad, h.bu, h.gecen || 0]));
  tablo("Kartlar", ["Gün", "Kelime (sağda / 10)", "Cümle (sağda / 10)"], (v.kartlar?.gunler || []).map((g) => [g.tarih, g.kelime ?? "açılmadı", g.cumle ?? "açılmadı"]));
}
