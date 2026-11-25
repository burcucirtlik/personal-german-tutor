// Tıklayınca Türkçesini gösteren kelimeler. Bir dv.view içinden şöyle yüklenir:
//   const sozluk = await new Function("app", await app.vault.adapter.read("_sistem/sozluk/sozluk.js"))(app)();
//   sozluk.yaz(ebeveynEleman, "Almanca metin", "kaynak");
// Sözlük: _sistem/sozluk/sozluk.json (motor) + _kisisel/sozluk/sozluk.json (Claude'un kişisel ekleri; aynı kelimede bu kazanır)
// Tıklanan kelimeler: _kisisel/sozluk/tiklananlar.json (bu modül yazar: ilk, son, sayi ve gün gün `gunler`).
// Öğrenme sinyali: _sistem/sozluk/sinyal.py bunlardan sinyal.json üretir; kart ekranı son 7 günde tıklananları öne alır.
// Sayfanın geri kalanındaki tıklamaları .obsidian/plugins/almanca-yardimci eklentisi bu modülün goster() işlevine yollar.

const adapter = app.vault.adapter;
const SOZLUK_YOLU = "_sistem/sozluk/sozluk.json";
const KISISEL_SOZLUK_YOLU = "_kisisel/sozluk/sozluk.json";
const TIK_YOLU = "_kisisel/sozluk/tiklananlar.json";
const KELIME = /[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*/g;

const CSS = `
.sz-w { cursor: pointer; border-radius: 4px; transition: background 0.12s; }
.sz-w:hover { background: rgba(124, 92, 255, 0.22); }
.sz-w.sz-seen { background: rgba(255, 196, 61, 0.28); box-shadow: inset 0 -2px 0 rgba(255, 170, 30, 0.8); }
.sz-w.sz-active { background: rgba(124, 92, 255, 0.4); }
.sz-pop { position: fixed; z-index: 9999; max-width: 300px; min-width: 160px; padding: 10px 14px 10px; border-radius: 14px;
  background: #ffffff; color: #26213f; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); font-family: "Nunito", var(--font-interface), system-ui, sans-serif;
  font-size: 14px; line-height: 1.4; animation: sz-in 0.12s ease-out; }
.sz-pop::after { content: ""; position: absolute; left: var(--ok, 20px); bottom: -6px; width: 12px; height: 12px; background: #fff; transform: rotate(45deg); }
.sz-pop.sz-below::after { bottom: auto; top: -6px; }
@keyframes sz-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.sz-pop-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sz-pop-word { font-weight: 800; font-size: 1.05em; color: #5a3df0; }
.sz-pop-tr { font-weight: 800; font-size: 1.15em; margin-top: 2px; }
.sz-pop-kok { color: #6b6690; font-size: 0.88em; margin-top: 4px; }
.sz-pop-not { color: #6b6690; font-size: 0.85em; margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e4defc; }
.sz-pop-foot { color: #c78a00; font-size: 0.78em; font-weight: 700; margin-top: 6px; }
.sz-pop button.sz-speak { width: 28px; height: 28px; padding: 0; border: none; border-radius: 50%; background: #f2efff; cursor: pointer; box-shadow: none; font-size: 0.9em; }
.sz-pop-acts { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eeeafc; }
.sz-pop button.sz-act { border: 1px solid #e4defc; background: #faf9ff; color: #3d3566; border-radius: 8px; padding: 3px 8px; font: inherit; font-size: 0.8em; font-weight: 700; cursor: pointer; box-shadow: none; height: auto; }
.sz-pop button.sz-act:hover { border-color: #7c5cff; }
.sz-pop button.sz-act.sz-on { background: #7c5cff; border-color: #7c5cff; color: #fff; }
`;

return async function () {
  if (!document.getElementById("almanca-sozluk-css")) {
    const st = document.createElement("style");
    st.id = "almanca-sozluk-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // Okunamayan JSON: varsayılanla devam et ama o dosyaya bu oturumda hiç yazma (boş listeyle tıklamalar silinmesin)
  const BOZUK = (window.__almancaBozuk = window.__almancaBozuk || new Set());
  function bozukUyar(yol) {
    const id = "sz-bozuk-" + yol.replace(/[^\w]/g, "_");
    if (document.getElementById(id)) return;
    const b = document.createElement("div");
    b.id = id;
    b.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:10000;padding:10px 14px;border-radius:10px;background:#b3261e;color:#fff;font-weight:600;font-size:0.9em;box-shadow:0 4px 16px rgba(0,0,0,.25)";
    b.textContent = `⚠️ ${yol} okunamadı (bozuk ya da yarım yazılmış olabilir). Silinmesin diye bu dosyaya bu oturumda yazılmıyor. Claude'a söyle ya da _kisisel/yedek/ içinden geri yükle; sonra sayfayı yenile. (kapatmak için tıkla)`;
    b.addEventListener("click", () => b.remove());
    document.body.appendChild(b);
  }
  async function oku(yol, varsayilan) {
    try {
      if (!(await adapter.exists(yol))) return varsayilan;
      return JSON.parse(await adapter.read(yol));
    } catch (err) {
      console.error("sozluk: okunamadı", yol, err);
      BOZUK.add(yol);
      bozukUyar(yol);
      return varsayilan;
    }
  }

  const kelimeler = { ...((await oku(SOZLUK_YOLU, { kelimeler: {} })).kelimeler || {}), ...((await oku(KISISEL_SOZLUK_YOLU, { kelimeler: {} })).kelimeler || {}) };
  const tiklananlar = (await oku(TIK_YOLU, { kelimeler: {} })).kelimeler || {};

  function bul(w) {
    const k = w.toLowerCase();
    if (kelimeler[k]) return kelimeler[k];
    for (const ek of ["en", "n", "e", "s", "es", "er", "em", "st", "t"]) {
      if (k.length > ek.length + 2 && k.endsWith(ek) && kelimeler[k.slice(0, -ek.length)]) return kelimeler[k.slice(0, -ek.length)];
    }
    return null;
  }

  // Aynı sözlük biçimine (kok) bağlı bütün biçimler: lernt → lerne, lernst, lernen…
  // "stehen / aufstehen", "der Tisch, -e" → ["stehen", "aufstehen"], ["tisch"]
  const kokler = (s) =>
    String(s || "")
      .toLowerCase()
      .split("/")
      .map((x) => x.replace(/\(.*?\)/g, "").replace(/^\s*(der|die|das)\s+/, "").split(",")[0].trim())
      .filter((x) => x && !/\s/.test(x));
  function formlar(w) {
    const k = w.toLowerCase();
    const kayit = bul(w);
    const sonuc = new Set([k]);
    if (!kayit) return [...sonuc];
    const tabanlar = new Set(kokler(kayit.kok).length ? kokler(kayit.kok) : [Object.keys(kelimeler).find((x) => kelimeler[x] === kayit) || k]);
    for (const t of tabanlar) sonuc.add(t);
    for (const [anahtar, v] of Object.entries(kelimeler)) if (tabanlar.has(anahtar) || kokler(v.kok).some((x) => tabanlar.has(x))) sonuc.add(anahtar);
    return [...sonuc];
  }

  // Tıklananları dosyaya sırayla işle (aynı anda iki yazma çakışmasın)
  window.__almancaSozlukKuyruk = window.__almancaSozlukKuyruk || Promise.resolve();
  // Balondaki düğmeler: biliyor (bunu biliyorum, sinyal sayma) / istek (bunun kartını istiyorum)
  function isaretKoy(w, alan, acik) {
    const k = w.toLowerCase();
    const bugun = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    window.__almancaSozlukKuyruk = window.__almancaSozlukKuyruk.then(async () => {
      try {
        if (BOZUK.has(TIK_YOLU)) return;
        const disk = await oku(TIK_YOLU, { kelimeler: {} });
        if (BOZUK.has(TIK_YOLU)) return;
        disk.kelimeler = disk.kelimeler || {};
        const e = disk.kelimeler[k] || { ilk: bugun, son: bugun, sayi: 0, gunler: {} };
        if (acik) e[alan] = bugun;
        else delete e[alan];
        if (acik && alan === "biliyor") delete e.istek;
        if (acik && alan === "istek") delete e.biliyor;
        disk.kelimeler[k] = e;
        tiklananlar[k] = e;
        await adapter.write(TIK_YOLU, JSON.stringify(disk, null, 1));
      } catch (err) {
        console.error("sozluk: kaydedilemedi", err);
      }
    });
  }

  // Tıklanan kelimenin içinde geçtiği cümle
  function cumlesi(span) {
    const blok = span.closest("p, li, td, th, .ok-p, .al-sentence, .al-wrong-sentence, .al-note-text, .callout-content, div");
    if (!blok) return span.textContent;
    const r = document.createRange();
    r.setStart(blok, 0);
    r.setEnd(span, 0);
    const once = r.toString().length;
    const metin = blok.textContent;
    let a = once, b = once + span.textContent.length;
    while (a > 0 && !/[.!?\n]/.test(metin[a - 1])) a--;
    while (b < metin.length && !/[.!?\n]/.test(metin[b])) b++;
    if (b < metin.length) b++;
    while (b < metin.length && /[„“"»]/.test(metin[b])) b++;
    return metin.slice(a, b).replace(/^[\s:–-]+/, "").trim() || span.textContent;
  }
  function kaydet(w, kayit, kaynak) {
    const k = w.toLowerCase();
    const bugun = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    window.__almancaSozlukKuyruk = window.__almancaSozlukKuyruk.then(async () => {
      try {
        if (BOZUK.has(TIK_YOLU)) return;
        const disk = await oku(TIK_YOLU, { kelimeler: {} });
        if (BOZUK.has(TIK_YOLU)) return;
        disk.kelimeler = disk.kelimeler || {};
        const e = disk.kelimeler[k] || { ilk: bugun, sayi: 0 };
        e.son = bugun;
        e.sayi = (e.sayi || 0) + 1;
        e.gunler = e.gunler || {};
        e.gunler[bugun] = (e.gunler[bugun] || 0) + 1;
        e.tr = kayit ? kayit.tr : null;
        if (kayit?.kok) e.kok = kayit.kok;
        if (kaynak) e.kaynak = kaynak;
        disk.kelimeler[k] = e;
        tiklananlar[k] = e;
        await adapter.write(TIK_YOLU, JSON.stringify(disk, null, 1));
      } catch (err) {
        console.error("sozluk: kaydedilemedi", err);
      }
    });
  }

  function enIyiSes(tercih) {
    // En doğal Almanca sesi seç: Premium > Gelişmiş/Enhanced > normal; eğlence seslerini (Eddy, Grandma…) atla
    const sesler = speechSynthesis.getVoices().filter((v) => /^de[-_]/i.test(v.lang || ""));
    const puan = (v) =>
      (/premium/i.test(v.name) ? 4 : 0) +
      (/enhanced|gelişmiş|erweitert|verbessert|neural|natural/i.test(v.name) ? 3 : 0) +
      (tercih && v.name.includes(tercih) ? 1 : 0) +
      (/Anna|Petra|Markus|Yannick|Helena|Martin|Katja|Conrad/.test(v.name) ? 1 : 0) -
      (/Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bahh|Bells|Boing|Bubbles|Jester|Organ|Trinoids|Whisper|Zarvox/.test(v.name) ? 10 : 0);
    return sesler.sort((a, b) => puan(b) - puan(a))[0] || null;
  }

  function seslendir(metin) {
    try {
      const u = new SpeechSynthesisUtterance(metin);
      u.lang = "de-DE";
      u.rate = 0.92;
      const ses = enIyiSes();
      if (ses) u.voice = ses;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (err) {
      console.warn("sozluk: seslendirme yok", err);
    }
  }

  function kapat() {
    const p = window.__almancaPop;
    if (p) {
      p.el.remove();
      p.span?.classList.remove("sz-active");
      window.__almancaPop = null;
    }
  }
  if (!window.__almancaPopDinleyici) {
    window.__almancaPopDinleyici = true;
    document.addEventListener("mousedown", (e) => {
      if (window.__almancaPop && !window.__almancaPop.el.contains(e.target) && !e.target.classList?.contains("sz-w")) kapat();
    }, true);
    document.addEventListener("scroll", kapat, true);
    document.addEventListener("keydown", (e) => e.key === "Escape" && kapat(), true);
  }

  function goster(span, w, kaynak) {
    kapat();
    const kayit = bul(w);
    const pop = document.createElement("div");
    pop.className = "sz-pop";
    const ust = document.createElement("div");
    ust.className = "sz-pop-top";
    const kel = document.createElement("span");
    kel.className = "sz-pop-word";
    kel.textContent = w;
    ust.appendChild(kel);
    if (window.speechSynthesis) {
      const b = document.createElement("button");
      b.className = "sz-speak";
      b.textContent = "🔊";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        seslendir(w);
      });
      ust.appendChild(b);
    }
    pop.appendChild(ust);
    const satir = (cls, text) => {
      const d = document.createElement("div");
      d.className = cls;
      d.textContent = text;
      pop.appendChild(d);
    };
    if (kayit) {
      satir("sz-pop-tr", kayit.tr);
      if (kayit.kok && kayit.kok.toLowerCase() !== w.toLowerCase()) satir("sz-pop-kok", "sözlükte: " + kayit.kok);
      if (kayit.not) satir("sz-pop-not", kayit.not);
      satir("sz-pop-foot", "🔍 Tıkladın: kartı varsa öne alınır");
    } else {
      satir("sz-pop-tr", "Sözlükte henüz yok");
      satir("sz-pop-not", "Not edildi. Bir sonraki /antrenman'da Türkçesi eklenecek.");
    }
    // düğmeler
    const eylem = document.createElement("div");
    eylem.className = "sz-pop-acts";
    const dugme = (metin, baslik, tik) => {
      const b = document.createElement("button");
      b.className = "sz-act";
      b.textContent = metin;
      b.title = baslik;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        tik(b);
      });
      eylem.appendChild(b);
      return b;
    };
    if (window.speechSynthesis) {
      const cumle = cumlesi(span);
      if (cumle && cumle.toLowerCase() !== w.toLowerCase()) dugme("🗣 Cümleyi dinle", cumle, () => seslendir(cumle));
    }
    const kayitli = tiklananlar[w.toLowerCase()] || {};
    const bil = dugme("✓ Biliyorum", "Bu kelimeyi biliyorum: tıklamam sinyal sayılmasın", (b) => {
      const ac = !b.classList.contains("sz-on");
      b.classList.toggle("sz-on", ac);
      ist.classList.remove("sz-on");
      isaretKoy(w, "biliyor", ac);
    });
    const ist = dugme("⭐ Karta ekle", "Bu kelimenin kartını istiyorum (isim, fiil ya da sıfatsa yalın biçimiyle eklenir)", (b) => {
      const ac = !b.classList.contains("sz-on");
      b.classList.toggle("sz-on", ac);
      bil.classList.remove("sz-on");
      isaretKoy(w, "istek", ac);
    });
    bil.classList.toggle("sz-on", !!kayitli.biliyor);
    ist.classList.toggle("sz-on", !!kayitli.istek);
    if (typeof window.almancaKelimeAra === "function") {
      dugme("🔎 Nerelerde geçiyor", "Bu kelimenin (ve diğer biçimlerinin) geçtiği bütün cümleler", () => {
        kapat();
        window.almancaKelimeAra(w, formlar(w));
      });
    }
    pop.appendChild(eylem);
    document.body.appendChild(pop);
    const r = span.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let left = Math.min(Math.max(8, r.left + r.width / 2 - pr.width / 2), window.innerWidth - pr.width - 8);
    let top = r.top - pr.height - 10;
    if (top < 8) {
      top = r.bottom + 10;
      pop.classList.add("sz-below");
    }
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    pop.style.setProperty("--ok", Math.max(10, Math.min(pr.width - 22, r.left + r.width / 2 - left - 6)) + "px");
    span.classList.add("sz-active", "sz-seen");
    window.__almancaPop = { el: pop, span };
    kaydet(w, kayit, kaynak);
  }

  // Metni kelime kelime tıklanabilir yap
  function yaz(parent, metin, kaynak) {
    const t = String(metin ?? "");
    let son = 0;
    for (const m of t.matchAll(KELIME)) {
      if (m.index > son) parent.appendChild(document.createTextNode(t.slice(son, m.index)));
      const w = m[0];
      const s = document.createElement("span");
      s.className = "sz-w" + (tiklananlar[w.toLowerCase()] ? " sz-seen" : "");
      s.textContent = w;
      s.addEventListener("mousedown", (e) => e.stopPropagation());
      s.addEventListener("pointerdown", (e) => e.stopPropagation());
      s.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        goster(s, w, kaynak);
      });
      parent.appendChild(s);
      son = m.index + w.length;
    }
    if (son < t.length) parent.appendChild(document.createTextNode(t.slice(son)));
    return parent;
  }

  return { yaz, bul, goster, formlar, seslendir };
};
