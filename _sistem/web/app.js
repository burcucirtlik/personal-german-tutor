// Almanca Vault tarayıcı arayüzü (Obsidian yerine).
// Almanca.html bu dosyayı yükler. Notları okur, ```dataviewjs bloklarını çalıştırır ve
// _sistem/*/view.js görünümlerine Obsidian + Dataview'in kullandıkları küçük API'yi (app, dv) sağlar.
// Böylece görünümler ve Claude'un yazdığı notlar hiç değişmeden hem Obsidian'da hem burada çalışır.
//
// Dosyalara iki yoldan erişir:
//  - Almanca.html doğrudan açıldıysa (file://): Chrome/Edge'in klasör erişimi (File System Access API).
//  - Almanca.command ile açıldıysa (http://127.0.0.1): _sistem/web/sunucu.py'nin /api uçları (her tarayıcıda çalışır).
"use strict";
(() => {
  const ATLA_KLASOR = new Set([".obsidian", ".claude", ".git", ".trash", "node_modules", "__pycache__"]);
  const TURLER = {
    m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
    pdf: "application/pdf",
  };
  const SES = new Set(["m4a", "mp3", "wav", "ogg", "aac"]);
  const RESIM = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);
  const ANA_SAYFA = "00 Dashboard.md";
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const nfc = (s) => String(s).normalize("NFC");
  const uzanti = (p) => (/\.([^./]+)$/.exec(p) || [, ""])[1].toLowerCase();
  const adi = (p) => p.split("/").pop().replace(/\.[^.]+$/, "");
  const klasoru = (p) => p.split("/").slice(0, -1).join("/");
  const kacis = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const bugunISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  // Okunamayan (bozuk ya da yarım yazılmış) JSON dosyaları: bu oturumda bunlara hiç yazılmaz, yoksa
  // boş varsayılan dosyanın üstüne yazılıp ilerleme silinir. Görünümler (view.js) de aynı kümeyi kullanır.
  const BOZUK = (window.__almancaBozuk = window.__almancaBozuk || new Set());
  function bozukUyari(yol) {
    const id = "ab-bozuk-" + yol.replace(/[^\w]/g, "_");
    if (document.getElementById(id)) return;
    const b = document.createElement("div");
    b.id = id;
    b.className = "ab-bozuk";
    b.textContent = `⚠️ ${yol} okunamadı (bozuk ya da yarım yazılmış olabilir). İlerleme silinmesin diye bu dosyaya bu oturumda yazılmıyor. Claude'a söyle ya da _kisisel/yedek/ içinden geri yükle; sonra sayfayı yenile.`;
    let kutu = document.getElementById("ab-bozuk-kutu");
    if (!kutu) {
      kutu = document.createElement("div");
      kutu.id = "ab-bozuk-kutu";
      document.body.appendChild(kutu);
    }
    kutu.appendChild(b);
  }
  // Günlük yedek: bir .json dosyası o gün ilk kez değiştirilmeden önce eski hâli _kisisel/yedek/<gün>/ içine kopyalanır
  const YEDEK_KOK = "_kisisel/yedek";
  const YEDEK_GUN = 14;
  const yedeklenen = new Set();
  const ls = {
    al(k, v) {
      try {
        const x = localStorage.getItem("almanca:" + k);
        return x === null ? v : JSON.parse(x);
      } catch {
        return v;
      }
    },
    koy(k, v) {
      try {
        localStorage.setItem("almanca:" + k, JSON.stringify(v));
      } catch {}
    },
  };

  function el(tag, cls, text, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Obsidian'ın HTMLElement eklentileri (görünümler bazen bunları kullanır)
  const HP = HTMLElement.prototype;
  if (!HP.createEl) {
    HP.createEl = function (tag, o = {}, cb) {
      if (typeof o === "string") o = { cls: o };
      const e = document.createElement(tag);
      if (o.cls) e.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
      if (o.text !== undefined) e.textContent = String(o.text);
      if (o.attr) for (const [k, v] of Object.entries(o.attr)) e.setAttribute(k, v);
      if (o.title) e.title = o.title;
      if (o.href) e.setAttribute("href", o.href);
      this.appendChild(e);
      if (cb) cb(e);
      return e;
    };
    HP.createDiv = function (o, cb) { return this.createEl("div", o, cb); };
    HP.createSpan = function (o, cb) { return this.createEl("span", o, cb); };
    HP.empty = function () { this.textContent = ""; };
    HP.addClass = function (...c) { this.classList.add(...c); };
    HP.removeClass = function (...c) { this.classList.remove(...c); };
    HP.toggleClass = function (c, v) { this.classList.toggle(c, v); };
    HP.setText = function (t) { this.textContent = t; };
    HP.setAttr = function (k, v) { this.setAttribute(k, v); };
    HP.detach = function () { this.remove(); };
  }

  // ---------------------------------------------------------------- dosya erişimi

  class KlasorErisimi {
    constructor(kok) {
      this.kok = kok;
      this.tur = "klasor";
    }
    async cocuk(dizin, ad, tur, olustur) {
      const al = (n, o) => (tur === "dizin" ? dizin.getDirectoryHandle(n, o) : dizin.getFileHandle(n, o));
      try {
        return await al(ad);
      } catch (err) {
        if (err.name !== "NotFoundError" && err.name !== "TypeError") throw err;
      }
      // Ad diskte farklı Unicode biçiminde (NFD) saklanmış olabilir
      for await (const [n, h] of dizin.entries()) {
        if (nfc(n) === nfc(ad) && h.kind === (tur === "dizin" ? "directory" : "file")) return h;
      }
      if (olustur) return al(ad, { create: true });
      const e = new Error("Bulunamadı: " + ad);
      e.name = "NotFoundError";
      throw e;
    }
    async dizin(parcalar, olustur) {
      let d = this.kok;
      for (const p of parcalar) if (p) d = await this.cocuk(d, p, "dizin", olustur);
      return d;
    }
    async dosya(yol, olustur) {
      const p = yol.split("/");
      const d = await this.dizin(p.slice(0, -1), olustur);
      return this.cocuk(d, p[p.length - 1], "dosya", olustur);
    }
    async read(yol) {
      return (await (await this.dosya(yol)).getFile()).text();
    }
    async blob(yol) {
      return (await this.dosya(yol)).getFile();
    }
    async write(yol, metin) {
      const h = await this.dosya(yol, true);
      const w = await h.createWritable();
      await w.write(metin);
      await w.close();
      return (await h.getFile()).lastModified;
    }
    // Sadece _kisisel/yedek/<gün> klasörlerini siler (eski yedekleri budamak için)
    async sil(yol) {
      if (!/^_kisisel\/yedek\/\d{4}-\d{2}-\d{2}$/.test(yol)) throw new Error("silinemez: " + yol);
      const p = yol.split("/");
      const d = await this.dizin(p.slice(0, -1));
      await d.removeEntry(p[p.length - 1], { recursive: true });
    }
    async exists(yol) {
      if (!yol) return true;
      try {
        await this.dosya(yol);
        return true;
      } catch {}
      try {
        await this.dizin(yol.split("/"));
        return true;
      } catch {}
      return false;
    }
    async mkdir(yol) {
      await this.dizin(yol.split("/"), true);
    }
    async list() {
      const sonuc = [];
      const gez = async (dizin, onek) => {
        const isler = [];
        for await (const [ad, h] of dizin.entries()) {
          if (h.kind === "file" && (ad.startsWith(".") || ad.endsWith(".crswap"))) continue;
          if (ATLA_KLASOR.has(ad)) continue;
          const yol = onek + nfc(ad);
          if (h.kind === "directory") isler.push(gez(h, yol + "/"));
          else isler.push(h.getFile().then((f) => sonuc.push({ path: yol, mtime: f.lastModified, size: f.size })));
        }
        await Promise.all(isler);
      };
      await gez(this.kok, "");
      return sonuc;
    }
  }

  class SunucuErisimi {
    constructor() {
      this.tur = "sunucu";
    }
    async istek(yol, p, secenek = {}) {
      const r = await fetch("api/" + yol + (p !== undefined ? "?p=" + encodeURIComponent(p) : ""), {
        ...secenek,
        headers: { "X-Almanca": "1", ...(secenek.headers || {}) },
        cache: "no-store",
      });
      if (!r.ok) {
        const e = new Error((await r.text().catch(() => "")) || r.status + " " + yol + " " + (p || ""));
        if (r.status === 404) e.name = "NotFoundError";
        throw e;
      }
      return r;
    }
    async read(yol) {
      return (await this.istek("read", yol)).text();
    }
    async blob(yol) {
      return (await this.istek("read", yol)).blob();
    }
    async write(yol, metin) {
      return (await (await this.istek("write", yol, { method: "POST", body: metin, headers: { "Content-Type": "text/plain; charset=utf-8" } })).json()).mtime;
    }
    async exists(yol) {
      return (await (await this.istek("exists", yol)).json()).var;
    }
    async mkdir(yol) {
      await this.istek("mkdir", yol, { method: "POST" });
    }
    async sil(yol) {
      await this.istek("sil", yol, { method: "POST" });
    }
    async list() {
      return (await (await this.istek("list")).json()).map((f) => ({ ...f, path: nfc(f.path) }));
    }
  }

  // Seçilen klasörün tutamacı IndexedDB'de saklanır, bir dahaki açılışta tek tıkla devam edilir
  const idb = {
    ac() {
      return new Promise((tamam, hata) => {
        // Bazı tarayıcılar file:// sayfalarında IndexedDB'yi hiç yanıtlamaz: takılmak yerine vazgeç
        const sure = setTimeout(() => hata(new Error("IndexedDB yanıt vermedi")), 1500);
        const r = indexedDB.open("almanca-web", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => (clearTimeout(sure), tamam(r.result));
        r.onerror = () => (clearTimeout(sure), hata(r.error));
        r.onblocked = () => (clearTimeout(sure), hata(new Error("IndexedDB engellendi")));
      });
    },
    async al(k) {
      try {
        const db = await this.ac();
        return await new Promise((tamam) => {
          const r = db.transaction("kv").objectStore("kv").get(k);
          r.onsuccess = () => tamam(r.result);
          r.onerror = () => tamam(undefined);
        });
      } catch {
        return undefined;
      }
    },
    async koy(k, v) {
      try {
        const db = await this.ac();
        await new Promise((tamam) => {
          const t = db.transaction("kv", "readwrite");
          t.objectStore("kv").put(v, k);
          t.oncomplete = tamam;
          t.onerror = tamam;
        });
      } catch {}
    },
  };

  let depo = null; // KlasorErisimi | SunucuErisimi

  // ---------------------------------------------------------------- dizin (index)

  const dosyalar = new Map(); // yol → { path, mtime, size }
  const sayfalar = new Map(); // .md yolu → { mtime, metin, fm, govde, sayfa }
  const kendiYazdiklarim = new Map(); // yol → mtime (kendi yazdığımız değişiklikler sayfayı yenilemesin)

  function yamlDeger(s) {
    s = s.trim();
    if (s === "" || s === "~" || s === "null") return null;
    if (s === "true") return true;
    if (s === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(s) && !/^-?0\d/.test(s)) return Number(s);
    if (s[0] === '"' && s.endsWith('"') && s.length > 1) {
      try {
        return JSON.parse(s);
      } catch {
        return s.slice(1, -1);
      }
    }
    if (s[0] === "'" && s.endsWith("'") && s.length > 1) return s.slice(1, -1).replace(/''/g, "'");
    if (s[0] === "[" && s.endsWith("]")) {
      const ic = s.slice(1, -1).trim();
      if (!ic) return [];
      const parcalar = [];
      let tirnak = null, cur = "", derinlik = 0;
      for (const c of ic) {
        if (tirnak) {
          if (c === tirnak) tirnak = null;
          cur += c;
        } else if (c === '"' || c === "'") {
          tirnak = c;
          cur += c;
        } else if (c === "[") {
          derinlik++;
          cur += c;
        } else if (c === "]") {
          derinlik--;
          cur += c;
        } else if (c === "," && !derinlik) {
          parcalar.push(cur);
          cur = "";
        } else cur += c;
      }
      parcalar.push(cur);
      return parcalar.map(yamlDeger);
    }
    return s.replace(/\s+#.*$/, "");
  }

  function yamlCoz(metin) {
    const veri = {};
    const satirlar = metin.split(/\r?\n/);
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i];
      if (!s.trim() || /^\s*#/.test(s) || /^\s/.test(s)) continue;
      const m = /^([^:]+?):(?:\s+(.*)|\s*)$/.exec(s);
      if (!m) continue;
      const anahtar = m[1].trim();
      const deger = m[2] === undefined ? "" : m[2];
      if (deger.trim() === "" && i + 1 < satirlar.length && /^\s*-\s/.test(satirlar[i + 1])) {
        const liste = [];
        while (i + 1 < satirlar.length && /^\s*-\s/.test(satirlar[i + 1])) liste.push(yamlDeger(satirlar[++i].replace(/^\s*-\s/, "")));
        veri[anahtar] = liste;
      } else if (deger.trim() === "" && i + 1 < satirlar.length && /^\s+\S+:/.test(satirlar[i + 1])) {
        const alt = [];
        while (i + 1 < satirlar.length && /^\s+/.test(satirlar[i + 1])) alt.push(satirlar[++i].replace(/^\s{2}/, ""));
        veri[anahtar] = yamlCoz(alt.join("\n"));
      } else if (/^[|>][-+]?$/.test(deger.trim())) {
        const alt = [];
        while (i + 1 < satirlar.length && (/^\s+/.test(satirlar[i + 1]) || !satirlar[i + 1].trim())) alt.push(satirlar[++i].trim());
        veri[anahtar] = alt.join(deger.trim()[0] === "|" ? "\n" : " ").trim();
      } else veri[anahtar] = yamlDeger(deger);
    }
    return veri;
  }

  function frontmatterAyir(metin) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(metin);
    if (!m) return { fm: {}, govde: metin };
    let fm = {};
    try {
      fm = yamlCoz(m[1]);
    } catch (err) {
      console.warn("frontmatter okunamadı", err);
    }
    return { fm, govde: metin.slice(m[0].length) };
  }

  function sayfaNesnesi(yol, fm) {
    const sayfa = { ...fm };
    sayfa.file = {
      path: yol,
      name: adi(yol),
      basename: adi(yol),
      folder: klasoru(yol),
      ext: "md",
      extension: "md",
      link: { path: yol, display: adi(yol) },
      mtime: dosyalar.get(yol)?.mtime,
      frontmatter: fm,
    };
    return sayfa;
  }

  async function sayfaOku(yol, zorla) {
    const d = dosyalar.get(yol);
    const eski = sayfalar.get(yol);
    if (eski && !zorla && d && eski.mtime === d.mtime) return eski;
    const metin = await depo.read(yol);
    const { fm, govde } = frontmatterAyir(metin);
    const kayit = { mtime: d?.mtime, metin, fm, govde, sayfa: sayfaNesnesi(yol, fm) };
    sayfalar.set(yol, kayit);
    return kayit;
  }

  // Bütün dosyaları tarar; değişen yolları döndürür
  async function tara() {
    const liste = await depo.list();
    const degisen = new Set();
    const gorulen = new Set();
    for (const f of liste) {
      gorulen.add(f.path);
      const eski = dosyalar.get(f.path);
      if (!eski || eski.mtime !== f.mtime) {
        if (!(kendiYazdiklarim.get(f.path) === f.mtime)) degisen.add(f.path);
        dosyalar.set(f.path, f);
      }
    }
    for (const yol of [...dosyalar.keys()]) {
      if (!gorulen.has(yol)) {
        dosyalar.delete(yol);
        sayfalar.delete(yol);
        degisen.add(yol);
      }
    }
    const mdler = [...dosyalar.keys()].filter((y) => y.endsWith(".md"));
    for (let i = 0; i < mdler.length; i += 24) {
      await Promise.all(mdler.slice(i, i + 24).map((y) => sayfaOku(y).catch((err) => console.warn("okunamadı", y, err))));
    }
    return degisen;
  }

  // Obsidian'daki gibi bağlantı çözümü: tam yol, uzantısız yol, sonra dosya adı
  function linkCoz(hedef, kaynak) {
    if (!hedef) return null;
    let h = nfc(String(hedef).trim()).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
    if (!h) return kaynak || null;
    h = h.replace(/^\/+/, "");
    if (dosyalar.has(h)) return h;
    if (dosyalar.has(h + ".md")) return h + ".md";
    if (kaynak) {
      const goreli = [klasoru(kaynak), h].filter(Boolean).join("/");
      if (dosyalar.has(goreli)) return goreli;
      if (dosyalar.has(goreli + ".md")) return goreli + ".md";
    }
    const ad = h.split("/").pop();
    const aday = [];
    for (const yol of dosyalar.keys()) {
      const son = yol.split("/").pop();
      if (son === ad || son === ad + ".md" || (yol.endsWith("/" + h) || yol.endsWith("/" + h + ".md"))) aday.push(yol);
    }
    if (!aday.length) {
      const kucuk = ad.toLocaleLowerCase("tr");
      for (const yol of dosyalar.keys()) {
        const son = yol.split("/").pop().toLocaleLowerCase("tr");
        if (son === kucuk || son === kucuk + ".md") aday.push(yol);
      }
    }
    aday.sort((a, b) => (a.endsWith(".md") ? 0 : 1) - (b.endsWith(".md") ? 0 : 1) || a.split("/").length - b.split("/").length || a.localeCompare(b));
    return aday[0] || null;
  }

  // ---------------------------------------------------------------- markdown

  // Kütüphane giris() içinde, varlığı kontrol edildikten sonra kurulur (yoksa dosya en başta çökmesin)
  let md = null;
  const mdKur = () => {
  md = new marked.Marked({ gfm: true, breaks: true });
  md.use({
    extensions: [
      {
        name: "wikilink",
        level: "inline",
        start(src) {
          const i = src.search(/!?\[\[/);
          return i < 0 ? undefined : i;
        },
        tokenizer(src) {
          const m = /^(!?)\[\[([^\]\n]+?)\]\]/.exec(src);
          if (m) return { type: "wikilink", raw: m[0], embed: !!m[1], hedef: m[2] };
        },
        renderer(t) {
          const [hedef, ...rest] = t.hedef.split("|");
          const ad = rest.join("|").trim();
          if (t.embed) return `<span class="ab-embed" data-hedef="${kacis(hedef.trim())}" data-ad="${kacis(ad)}"></span>`;
          const gorunen = ad || hedef.split("#")[0].split("/").pop() || hedef;
          return `<a class="internal-link" data-href="${kacis(hedef.trim())}" href="#">${kacis(gorunen)}</a>`;
        },
      },
      {
        name: "isaret",
        level: "inline",
        start(src) {
          const i = src.indexOf("==");
          return i < 0 ? undefined : i;
        },
        tokenizer(src) {
          const m = /^==(?=\S)([^=\n]+?)==/.exec(src);
          if (m) return { type: "isaret", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(t) {
          return "<mark>" + this.parser.parseInline(t.tokens) + "</mark>";
        },
      },
    ],
  });
  };

  const CALLOUT = {
    note: ["📝", "8, 109, 221"], abstract: ["📋", "0, 191, 188"], summary: "abstract", tldr: "abstract",
    info: ["ℹ️", "8, 109, 221"], todo: ["☑️", "8, 109, 221"], tip: ["💡", "0, 191, 188"], hint: "tip", important: "tip",
    success: ["✅", "8, 185, 78"], check: "success", done: "success", question: ["❓", "236, 117, 0"], help: "question", faq: "question",
    warning: ["⚠️", "236, 117, 0"], caution: "warning", attention: "warning", failure: ["✖️", "233, 49, 71"], fail: "failure", missing: "failure",
    danger: ["⛔", "233, 49, 71"], error: "danger", bug: ["🐞", "233, 49, 71"], example: ["🧪", "120, 82, 238"], quote: ["❝", "158, 158, 158"], cite: "quote",
    soru: ["✏️"], ders: ["📘"], dogru: ["✅"], yanlis: ["❌"], kismen: ["🟡"], sonuc: ["🏆"], dinle: ["🎧"],
  };
  const calloutBilgi = (tip) => {
    let b = CALLOUT[tip];
    if (typeof b === "string") b = CALLOUT[b];
    return b || ["📌", "8, 109, 221"];
  };

  function calloutlar(kok) {
    for (const bq of kok.querySelectorAll("blockquote")) {
      const p = bq.firstElementChild;
      if (!p || p.tagName !== "P") continue;
      const ilk = p.firstChild;
      if (!ilk || ilk.nodeType !== Node.TEXT_NODE) continue;
      const m = /^\s*\[!([\w-]+)\]([+-]?)[ \t]*/.exec(ilk.textContent);
      if (!m) continue;
      ilk.textContent = ilk.textContent.slice(m[0].length);
      const baslikDugum = [];
      while (p.firstChild) {
        const n = p.firstChild;
        if (n.nodeName === "BR") {
          n.remove();
          break;
        }
        if (n.nodeType === Node.TEXT_NODE && n.textContent.includes("\n")) {
          const i = n.textContent.indexOf("\n");
          const once = n.textContent.slice(0, i);
          n.textContent = n.textContent.slice(i + 1);
          if (once) baslikDugum.push(document.createTextNode(once));
          break;
        }
        baslikDugum.push(n);
        n.remove();
      }
      if (!p.textContent.trim() && !p.querySelector("img, audio, .ab-embed, a")) p.remove();
      else if (p.firstChild && p.firstChild.nodeType === Node.TEXT_NODE) p.firstChild.textContent = p.firstChild.textContent.replace(/^\s+/, "");

      const tip = m[1].toLowerCase();
      const [ikon, renk] = calloutBilgi(tip);
      const c = document.createElement("div");
      c.className = "callout" + (m[2] ? " is-collapsible" : "") + (m[2] === "-" ? " is-collapsed" : "");
      c.dataset.callout = tip;
      if (renk && !["soru", "ders", "dogru", "yanlis", "kismen", "sonuc", "dinle"].includes(tip)) c.style.setProperty("--callout-color", renk);
      const baslik = el("div", "callout-title", null, c);
      el("span", "callout-icon", ikon, baslik);
      const ic = el("span", "callout-title-inner", null, baslik);
      if (baslikDugum.some((n) => n.textContent.trim())) baslikDugum.forEach((n) => ic.appendChild(n));
      else ic.textContent = tip.charAt(0).toUpperCase() + tip.slice(1);
      if (m[2]) {
        el("span", "callout-fold", "›", baslik);
        baslik.addEventListener("click", () => c.classList.toggle("is-collapsed"));
      }
      const icerik = el("div", "callout-content", null, c);
      while (bq.firstChild) icerik.appendChild(bq.firstChild);
      if (!icerik.textContent.trim() && !icerik.querySelector("audio, .ab-embed, img")) icerik.remove();
      bq.replaceWith(c);
    }
  }

  const blobAdresleri = new Map(); // yol|mtime → objectURL
  async function blobAdresi(yol) {
    const anahtar = yol + "|" + (dosyalar.get(yol)?.mtime || 0);
    if (blobAdresleri.has(anahtar)) return blobAdresleri.get(anahtar);
    const b = await depo.blob(yol);
    const tur = TURLER[uzanti(yol)];
    const url = URL.createObjectURL(tur && b.type !== tur ? new Blob([b], { type: tur }) : b);
    blobAdresleri.set(anahtar, url);
    return url;
  }

  function gomululer(kok, kaynak) {
    for (const g of kok.querySelectorAll(".ab-embed")) {
      const hedef = g.dataset.hedef;
      const yol = linkCoz(hedef, kaynak);
      const u = yol ? uzanti(yol) : uzanti(hedef);
      if (yol && SES.has(u)) {
        const kutuBaslik = g.closest(".callout")?.querySelector(".callout-title")?.textContent || "";
        g.replaceWith(oynatici(yol, { ad: g.dataset.ad || "", baslik: kutuBaslik, kaynak }));
      } else if (yol && RESIM.has(u)) {
        const img = el("img", "ab-img");
        img.alt = g.dataset.ad || hedef;
        const w = /^\d+$/.test(g.dataset.ad || "") ? g.dataset.ad : null;
        if (w) img.style.width = w + "px";
        g.replaceWith(img);
        blobAdresi(yol).then((url) => (img.src = url));
      } else if (yol) {
        const a = el("a", "internal-link ab-embed-link", "↪ " + (g.dataset.ad || adi(yol)));
        a.dataset.href = hedef;
        a.href = "#";
        g.replaceWith(a);
      } else {
        g.replaceWith(el("span", "ab-missing", "Bulunamadı: " + hedef));
      }
    }
  }

  function linkler(kok, kaynak) {
    for (const a of kok.querySelectorAll("a.internal-link[data-href]")) {
      const yol = linkCoz(a.dataset.href, kaynak);
      if (yol) {
        a.dataset.yol = yol;
        a.href = "#" + encodeURIComponent(yol);
      } else a.classList.add("is-unresolved");
    }
    for (const a of kok.querySelectorAll("a[href]:not(.internal-link)")) {
      const h = a.getAttribute("href");
      if (/^(https?:|mailto:)/i.test(h)) {
        a.target = "_blank";
        a.rel = "noopener";
        a.classList.add("external-link");
      } else if (h && !h.startsWith("#")) {
        // markdown biçimli iç bağlantı: [ad](klasör/not.md)
        const yol = linkCoz(decodeURIComponent(h), kaynak);
        if (yol) {
          a.classList.add("internal-link");
          a.dataset.yol = yol;
          a.href = "#" + encodeURIComponent(yol);
        }
      }
    }
    for (const t of kok.querySelectorAll("table")) {
      if (t.parentElement?.classList.contains("ab-table")) continue;
      const w = document.createElement("div");
      w.className = "ab-table";
      t.replaceWith(w);
      w.appendChild(t);
    }
    for (const kutu of kok.querySelectorAll('input[type="checkbox"]')) kutu.disabled = true;
  }

  // Markdown → DOM; dataviewjs bloklarını yer tutucuyla değiştirip kodlarını döndürür
  function markdownCiz(hedefEl, metin, kaynak) {
    const kodlar = [];
    let m = String(metin ?? "").replace(/%%[\s\S]*?%%/g, "");
    m = m.replace(/^([ \t]*)(`{3,}|~{3,})[ \t]*dataviewjs[ \t]*\r?\n([\s\S]*?)\r?\n\1\2[ \t]*$/gm, (_, girinti, cit, kod) => {
      kodlar.push(kod);
      return `\n<div class="ab-dvjs" data-i="${kodlar.length - 1}"></div>\n`;
    });
    hedefEl.innerHTML = md.parse(m);
    calloutlar(hedefEl);
    gomululer(hedefEl, kaynak);
    linkler(hedefEl, kaynak);
    return [...hedefEl.querySelectorAll(".ab-dvjs")].map((yer) => ({ yer, kod: kodlar[Number(yer.dataset.i)] }));
  }

  // ---------------------------------------------------------------- ses oynatıcı: hız, dinleme hakkı, cümle cümle, dikte
  // Cümleler: <ses adı>.cumleler.json (_sistem/ses.py ya da _sistem/ses_cumle.py yazar).
  // Dinleme sayıları: _kisisel/ses/dinleme.json · Dikte sonuçları: _kisisel/ses/dikte.json (bu ekran yazar).

  const DINLEME_YOLU = "_kisisel/ses/dinleme.json";
  const DIKTE_YOLU = "_kisisel/ses/dikte.json";
  let jsonKuyruk = Promise.resolve();
  // Dosya yoksa varsayılan; okunamazsa da varsayılan döner ama dosya BOZUK sayılır (bir daha yazılmaz)
  async function jsonOku(yol, varsayilan) {
    try {
      if (!(await depo.exists(yol))) return varsayilan;
      return JSON.parse(await depo.read(yol));
    } catch (err) {
      console.error("okunamadı", yol, err);
      BOZUK.add(nfc(yol));
      bozukUyari(nfc(yol));
      return varsayilan;
    }
  }
  // Oku → değiştir → yaz, sırayla (aynı anda iki yazma birbirini silmesin)
  function jsonGuncelle(yol, varsayilan, degistir) {
    jsonKuyruk = jsonKuyruk.then(async () => {
      try {
        if (BOZUK.has(nfc(yol))) return;
        const v = await jsonOku(yol, varsayilan);
        if (BOZUK.has(nfc(yol))) return;
        degistir(v);
        await app.vault.adapter.write(yol, JSON.stringify(v, null, 1));
      } catch (err) {
        console.error("kaydedilemedi", yol, err);
      }
    });
    return jsonKuyruk;
  }

  const SAYI_KELIME = { tek: 1, bir: 1, iki: 2, "üç": 3, dort: 4, "dört": 4 };
  function dinlemeHakki(ad, baslik) {
    const m1 = /dinleme\s*:\s*(\d+)/i.exec(ad || "");
    if (m1) return Number(m1[1]);
    const m2 = /(tek|bir|iki|üç|dört|\d+)\s*(?:kez|kere|defa)\s*dinle/i.exec(baslik || "");
    if (m2) return SAYI_KELIME[m2[1].toLocaleLowerCase("tr")] || Number(m2[1]) || null;
    return null;
  }

  const sureYaz = (t) => (Number.isFinite(t) ? Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0") : "0:00");
  const sadeKelime = (w) => w.normalize("NFC").replace(/^[„“"«»‚‘'(\[]+|[.,!?;:…"“”»«‘’')\]]+$/g, "");
  const harfsiz = (w) => sadeKelime(w).toLocaleLowerCase("de").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

  // Kelime kelime karşılaştırma (en uzun ortak dizi): her beklenen kelime ok / harf / eksik olur
  function karsilastir(beklenen, yazilan) {
    const B = beklenen.split(/\s+/).filter(Boolean);
    const Y = yazilan.split(/\s+/).filter(Boolean);
    const b = B.map(sadeKelime), y = Y.map(sadeKelime);
    const bh = B.map(harfsiz), yh = Y.map(harfsiz);
    const n = B.length, m = Y.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) L[i][j] = bh[i] === yh[j] && bh[i] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const sonuc = [], fazla = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (bh[i] === yh[j] && bh[i]) {
        sonuc.push({ k: B[i], d: b[i] === y[j] ? "ok" : "harf", yazilan: Y[j] });
        i++;
        j++;
      } else if (L[i + 1][j] >= L[i][j + 1]) sonuc.push({ k: B[i++], d: "eksik" });
      else fazla.push(Y[j++]);
    }
    while (i < n) sonuc.push({ k: B[i++], d: "eksik" });
    while (j < m) fazla.push(Y[j++]);
    const puan = sonuc.reduce((t, x) => t + (x.d === "ok" ? 1 : x.d === "harf" ? 0.5 : 0), 0);
    return { kelimeler: sonuc, fazla, oran: n ? Math.max(0, (puan - fazla.length * 0.25) / n) : 0 };
  }

  function oynatici(yol, { ad, baslik, kaynak }) {
    const kok = el("div", "ab-player");
    const ses = el("audio", null, null, kok);
    ses.preload = "auto";
    blobAdresi(yol).then((url) => (ses.src = url)).catch((err) => (ust.textContent = "Ses açılamadı: " + err.message));

    const notFm = sayfalar.get(kaynak)?.fm || {};
    const notTarihi = String(notFm.tarih || "").slice(0, 10);
    const hak = notTarihi && notTarihi < bugunISO() ? null : dinlemeHakki(ad, baslik);
    let dinlenen = 0; // bugün
    let tazeBaslangic = true;
    let bolum = null; // { son, sonra } — cümle çalarken

    const ust = el("div", "ab-pl-row", null, kok);
    const oynat = el("button", "ab-pl-play", "▶", ust);
    oynat.title = "Oynat / durdur (boşluk)";
    const cubuk = el("div", "ab-pl-bar", null, ust);
    const dolgu = el("div", "ab-pl-fill", null, cubuk);
    const zaman = el("span", "ab-pl-time", "0:00", ust);

    const araclar = el("div", "ab-pl-tools", null, kok);
    const hizlar = el("div", "ab-pl-speeds", null, araclar);
    let hiz = ls.al("hiz", 1);
    const hizDugmeleri = [0.75, 0.9, 1].map((h) => {
      const d = el("button", "ab-pl-chip", h === 1 ? "1×" : h + "×", hizlar);
      d.addEventListener("click", () => {
        hiz = h;
        ls.koy("hiz", h);
        ses.playbackRate = h;
        hizDugmeleri.forEach((x, i) => x.classList.toggle("is-on", [0.75, 0.9, 1][i] === h));
      });
      return d;
    });
    hizDugmeleri.forEach((x, i) => x.classList.toggle("is-on", [0.75, 0.9, 1][i] === hiz));
    const geri = el("button", "ab-pl-chip", "↺ 5 sn", araclar);
    const sayac = el("span", "ab-pl-count", "", araclar);
    const cumleDugme = el("button", "ab-pl-chip ab-pl-mode", "📝 Cümle cümle", araclar);
    const dikteDugme = el("button", "ab-pl-chip ab-pl-mode", "✍️ Dikte", araclar);
    const kilitNotu = el("span", "ab-pl-lock", "", araclar);
    const panel = el("div", "ab-pl-panel", null, kok);
    panel.hidden = true;

    let cumleler = null;
    const cumleYolu = yol.replace(/\.[^./]+$/, "") + ".cumleler.json";
    cumleDugme.hidden = dikteDugme.hidden = true;
    if (dosyalar.has(cumleYolu))
      jsonOku(cumleYolu, null).then((v) => {
        cumleler = v?.cumleler?.length ? v : null;
        durumCiz();
      });

    // baştan başlatılmış bir dinleme bitmedi (son hak dinlenirken araçlar kapalı kalır). Dosyaya da yazılır
    // (`suruyor: <gün>`), böylece son dinleme sırasında sayfayı yenilemek cümle araçlarını erken açmaz.
    let dinlemeSuruyor = false;
    let yarimKaldi = false; // yenilemeden önce yarım kalan dinleme: sayılmadan bir kez baştan çalınabilir
    jsonOku(DINLEME_YOLU, { sesler: {} }).then((v) => {
      const k = v?.sesler?.[yol];
      dinlenen = k?.gunler?.[bugunISO()] || 0;
      if (hak !== null && k?.suruyor === bugunISO()) dinlemeSuruyor = yarimKaldi = true;
      durumCiz();
    });

    const hakBitti = () => hak !== null && dinlenen >= hak;
    const araclarAcik = () => hak === null || (hakBitti() && !dinlemeSuruyor);
    function durumCiz() {
      sayac.textContent = hak !== null ? `🎧 ${Math.min(dinlenen, hak)} / ${hak} dinleme` : dinlenen ? `🎧 bugün ${dinlenen}. dinleme` : "";
      const var_ = !!cumleler;
      cumleDugme.hidden = dikteDugme.hidden = !var_ || !araclarAcik();
      kilitNotu.textContent = var_ && !araclarAcik() ? "🔒 cümle araçları dinleme hakkın bitince açılır" : cumleler?.yaklasik ? "⚠️ cümle zamanları yaklaşık" : "";
      cubuk.classList.toggle("is-locked", !araclarAcik());
      geri.hidden = !araclarAcik();
      if (hakBitti() && ses.paused && !bolum) oynat.title = "Dinleme hakkın bitti";
    }

    function dinlemeSay() {
      dinlenen++;
      dinlemeSuruyor = true;
      durumCiz();
      const gun = bugunISO();
      jsonGuncelle(DINLEME_YOLU, { sesler: {} }, (v) => {
        v.sesler = v.sesler || {};
        const k = (v.sesler[yol] = v.sesler[yol] || { gunler: {} });
        k.gunler[gun] = (k.gunler[gun] || 0) + 1;
        k.son = gun;
        if (hak !== null) k.suruyor = gun;
      });
    }
    function dinlemeBitti() {
      if (hak === null) return;
      jsonGuncelle(DINLEME_YOLU, { sesler: {} }, (v) => {
        if (v.sesler?.[yol]) delete v.sesler[yol].suruyor;
      });
    }

    function tamOynat() {
      if (ses.paused) {
        if (tazeBaslangic && yarimKaldi) {
          // yarım kalan dinlemeyi baştan sürdür (yeniden sayılmaz)
          yarimKaldi = false;
          tazeBaslangic = false;
          ses.currentTime = 0;
        } else if (tazeBaslangic) {
          if (hakBitti()) {
            kilitNotu.textContent = "Bugünkü dinleme hakkın bitti (" + hak + ").";
            return;
          }
          dinlemeSay();
          tazeBaslangic = false;
        }
        bolum = null;
        ses.playbackRate = hiz;
        ses.play();
      } else ses.pause();
    }
    oynat.addEventListener("click", tamOynat);
    kok.tabIndex = 0;
    kok.addEventListener("keydown", (e) => {
      if (e.key === " " && e.target === kok) {
        e.preventDefault();
        tamOynat();
      }
    });
    geri.addEventListener("click", () => (ses.currentTime = Math.max(0, ses.currentTime - 5)));
    cubuk.addEventListener("click", (e) => {
      if (!araclarAcik() || !ses.duration) return;
      const r = cubuk.getBoundingClientRect();
      ses.currentTime = ((e.clientX - r.left) / r.width) * ses.duration;
    });
    ses.addEventListener("play", () => (oynat.textContent = "⏸"));
    ses.addEventListener("pause", () => (oynat.textContent = "▶"));
    ses.addEventListener("ended", () => {
      tazeBaslangic = true;
      if (dinlemeSuruyor) dinlemeBitti();
      dinlemeSuruyor = false;
      oynat.textContent = "▶";
      durumCiz();
    });
    ses.addEventListener("loadedmetadata", () => (zaman.textContent = "0:00 / " + sureYaz(ses.duration)));
    const ilerle = () => {
      if (ses.duration) {
        dolgu.style.width = (ses.currentTime / ses.duration) * 100 + "%";
        zaman.textContent = sureYaz(ses.currentTime) + " / " + sureYaz(ses.duration);
      }
      if (bolum && ses.currentTime >= bolum.son) {
        ses.pause();
        const sonra = bolum.sonra;
        bolum = null;
        sonra?.();
      }
      if (!ses.paused) requestAnimationFrame(ilerle);
    };
    ses.addEventListener("play", () => requestAnimationFrame(ilerle));
    ses.addEventListener("seeked", ilerle);

    function cumleCal(c, sonra, yavas) {
      ses.pause();
      ses.currentTime = c.bas;
      ses.playbackRate = yavas ? 0.75 : hiz;
      bolum = { son: c.son, sonra };
      tazeBaslangic = false;
      ses.play();
    }

    // ---- cümle cümle ----
    let acikMod = null;
    function modAc(mod) {
      ses.pause();
      bolum = null;
      if (acikMod === mod) {
        acikMod = null;
        panel.hidden = true;
        cumleDugme.classList.remove("is-on");
        dikteDugme.classList.remove("is-on");
        return;
      }
      acikMod = mod;
      cumleDugme.classList.toggle("is-on", mod === "cumle");
      dikteDugme.classList.toggle("is-on", mod === "dikte");
      panel.hidden = false;
      panel.textContent = "";
      if (mod === "cumle") cumlePaneli();
      else diktePaneli();
    }
    cumleDugme.addEventListener("click", () => modAc("cumle"));
    dikteDugme.addEventListener("click", () => modAc("dikte"));

    function cumlePaneli() {
      const ust_ = el("div", "ab-pl-panel-top", null, panel);
      let gizli = ls.al("metinGizli", true);
      const goster = el("button", "ab-pl-chip", "", ust_);
      const tekrar = el("button", "ab-pl-chip", "🗣 Arkasından tekrar et", ust_);
      tekrar.title = "Her cümleden sonra durur, cümleyi yüksek sesle tekrar etmen için süre bırakır";
      const liste = el("ol", "ab-pl-sentences", null, panel);
      const satirlar = cumleler.cumleler.map((c, i) => {
        const li = el("li", c.baslik ? "is-title" : "", null, liste);
        const b = el("button", "ab-pl-mini", "▶", li);
        const t = el("span", "ab-pl-text", c.metin, li);
        b.addEventListener("click", () => {
          isaretle(i);
          cumleCal(c, () => isaretle(-1));
        });
        t.addEventListener("click", (e) => {
          if (li.classList.contains("is-blur")) {
            e.stopPropagation();
            li.classList.remove("is-blur");
          }
        });
        return li;
      });
      function isaretle(i) {
        satirlar.forEach((s, j) => s.classList.toggle("is-playing", j === i));
      }
      const gizleCiz = () => {
        goster.textContent = gizli ? "👁 Metni göster" : "🙈 Metni gizle";
        satirlar.forEach((s) => s.classList.toggle("is-blur", gizli));
      };
      goster.addEventListener("click", () => {
        gizli = !gizli;
        ls.koy("metinGizli", gizli);
        gizleCiz();
      });
      gizleCiz();
      let calisiyor = false;
      tekrar.addEventListener("click", () => {
        if (calisiyor) {
          calisiyor = false;
          ses.pause();
          bolum = null;
          isaretle(-1);
          tekrar.textContent = "🗣 Arkasından tekrar et";
          return;
        }
        calisiyor = true;
        tekrar.textContent = "⏹ Durdur";
        const sira = cumleler.cumleler.map((c, i) => [c, i]).filter(([c]) => !c.baslik);
        const adim = (k) => {
          if (!calisiyor || k >= sira.length) {
            calisiyor = false;
            isaretle(-1);
            tekrar.textContent = "🗣 Arkasından tekrar et";
            return;
          }
          const [c, i] = sira[k];
          isaretle(i);
          cumleCal(c, () => {
            // cümle süresinin 1,5 katı kadar sessizlik: sen tekrar et
            setTimeout(() => adim(k + 1), Math.max(1500, (c.son - c.bas) * 1500 / (ses.playbackRate || 1)));
          });
        };
        adim(0);
      });
    }

    // ---- dikte ----
    function diktePaneli() {
      const sira = cumleler.cumleler.filter((c) => !c.baslik);
      const oturum = { ses: yol, tarih: bugunISO(), baslangic: new Date().toISOString(), cumleler: [] };
      let k = 0;
      const ust_ = el("div", "ab-pl-panel-top", null, panel);
      const ilerleme = el("span", "ab-pl-progress", "", ust_);
      const alan = el("div", "ab-dikte", null, panel);
      function adim() {
        alan.textContent = "";
        if (k >= sira.length) return bitir();
        ilerleme.textContent = `Cümle ${k + 1} / ${sira.length}`;
        const c = sira[k];
        const dugmeler = el("div", "ab-dikte-btns", null, alan);
        const dinle = el("button", "ab-pl-chip is-on", "▶ Dinle", dugmeler);
        const yavas = el("button", "ab-pl-chip", "🐢 Yavaş", dugmeler);
        const atla = el("button", "ab-pl-chip", "Atla →", dugmeler);
        dinle.addEventListener("click", () => cumleCal(c));
        yavas.addEventListener("click", () => cumleCal(c, null, true));
        const giris = el("input", "ab-dikte-input", null, alan);
        giris.type = "text";
        giris.placeholder = "Duyduğunu yaz, Enter'a bas…";
        giris.spellcheck = false;
        giris.autocomplete = "off";
        giris.setAttribute("autocapitalize", "off");
        const sonucKutu = el("div", "ab-dikte-result", null, alan);
        let bitti = false;
        const kontrol = () => {
          if (bitti) {
            k++;
            return adim();
          }
          if (!giris.value.trim()) return;
          bitti = true;
          giris.disabled = true;
          const r = karsilastir(c.metin, giris.value);
          const satir = el("div", "ab-dikte-words", null, sonucKutu);
          for (const w of r.kelimeler) {
            const s = el("span", "ab-dw ab-dw-" + w.d, w.k, satir);
            if (w.d === "harf") s.title = "Sen: " + w.yazilan;
            satir.appendChild(document.createTextNode(" "));
          }
          if (r.fazla.length) el("div", "ab-dikte-extra", "Fazla: " + r.fazla.join(" "), sonucKutu);
          const yuzde = Math.round(r.oran * 100);
          el("div", "ab-dikte-score", (yuzde === 100 ? "✅ Tam! " : yuzde >= 70 ? "🟡 " : "❌ ") + yuzde + "%", sonucKutu);
          const ileri = el("button", "ab-btn ab-btn-primary", k + 1 < sira.length ? "Sonraki cümle →" : "Bitir", sonucKutu);
          ileri.addEventListener("click", kontrol);
          setTimeout(() => ileri.focus(), 0);
          oturum.cumleler.push({ metin: c.metin, yazilan: giris.value, oran: Math.round(r.oran * 100) / 100, hatalar: r.kelimeler.filter((x) => x.d !== "ok").map((x) => (x.d === "harf" ? sadeKelime(x.yazilan) + "→" + sadeKelime(x.k) : "eksik: " + sadeKelime(x.k))) });
          kaydet();
        };
        atla.addEventListener("click", () => {
          if (!bitti) oturum.cumleler.push({ metin: c.metin, yazilan: "", oran: 0, atlandi: true });
          kaydet();
          k++;
          adim();
        });
        giris.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            kontrol();
          }
        });
        setTimeout(() => giris.focus(), 0);
        cumleCal(c);
      }
      function kaydet() {
        const ort = oturum.cumleler.length ? oturum.cumleler.reduce((t, x) => t + x.oran, 0) / oturum.cumleler.length : 0;
        oturum.oran = Math.round(ort * 100) / 100;
        oturum.toplam = sira.length;
        jsonGuncelle(DIKTE_YOLU, { oturumlar: [] }, (v) => {
          v.oturumlar = (v.oturumlar || []).filter((o) => !(o.ses === oturum.ses && o.baslangic === oturum.baslangic));
          v.oturumlar.push(oturum);
        });
      }
      function bitir() {
        ilerleme.textContent = "Bitti";
        const ort = Math.round((oturum.oran || 0) * 100);
        const tam = oturum.cumleler.filter((x) => x.oran >= 1).length;
        el("div", "ab-dikte-final", `${ort >= 85 ? "🏆" : ort >= 60 ? "💪" : "🌱"} Dikte: %${ort} · ${tam} / ${sira.length} cümle tam`, alan);
        el("div", "ab-dikte-note", "Sonuç kaydedildi; Claude /kontrol ve /analiz'de görür.", alan);
        const yeniden = el("button", "ab-btn", "Baştan başla", alan);
        yeniden.addEventListener("click", () => {
          panel.textContent = "";
          diktePaneli();
        });
      }
      adim();
    }

    durumCiz();
    return kok;
  }

  // ---------------------------------------------------------------- kelime araması: bir kelime nerelerde geçiyor?

  const KELIME_ROTA = "?kelime=";
  const aramaFormlari = new Map();
  window.almancaKelimeAra = (w, formlar) => {
    aramaFormlari.set(w.toLowerCase(), formlar);
    git(KELIME_ROTA + w);
  };

  function mdSade(m) {
    return String(m)
      .replace(/!\[\[[^\]]*\]\]/g, " ")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, (_, x) => x.split("/").pop())
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s*>\s?\[![\w-]+\][-+]?/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+(\[.\]\s+)?/gm, "")
      .replace(/^\|?\s*-{2,}.*$/gm, "")
      .replace(/\|/g, " · ")
      .replace(/(\*\*|__|==|~~|\*|`)/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/#flashcards\S*/g, "")
      .replace(/::/g, " — ");
  }

  async function aramaKaynaklari() {
    const kaynaklar = [];
    for (const [yol, k] of sayfalar) {
      if (/^_(sistem|kisisel)\//.test(yol) || !yol.includes("/")) continue;
      const okumalar = [...k.govde.matchAll(/metin:\s*`([\s\S]*?)`/g)].map((m) => m[1]);
      const govde = k.govde.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, " ");
      kaynaklar.push({ yol, ad: baslikAdi(yol), tarih: String(k.fm.tarih || "").slice(0, 10), metin: okumalar.join("\n\n") + "\n\n" + mdSade(govde) });
    }
    const gunler = [...dosyalar.keys()].filter((y) => /^05 Günlük\/veri\/\d{4}-\d\d-\d\d\.json$/.test(y));
    await Promise.all(
      gunler.map(async (y) => {
        const v = await jsonOku(y, null);
        if (!v) return;
        const tarih = y.match(/\d{4}-\d\d-\d\d/)[0];
        const parcalar = [];
        for (const b of v.bolumler || []) {
          if (b.metin) parcalar.push(b.metin);
          for (const i of b.pano?.ilanlar || []) parcalar.push(i.metin);
          for (const s of b.sorular || []) {
            if (s.tip !== "ceviri" && s.metin) parcalar.push(String(s.metin).replace(/___/g, "…"));
            const r = v.sonuc?.[s.id];
            if (r?.dogru && !/^[a-f]\)?$/.test(r.dogru) && !/^(richtig|falsch)$/.test(r.dogru)) parcalar.push(r.dogru);
          }
        }
        const notYolu = `05 Günlük/${tarih}.md`;
        kaynaklar.push({ yol: dosyalar.has(notYolu) ? notYolu : null, ad: "Alıştırmalar · " + tarih, tarih, metin: parcalar.join("\n") });
      })
    );
    const deste = { kartlar: [...((await jsonOku("_sistem/kartlar/deste.json", { kartlar: [] })).kartlar || []), ...((await jsonOku("_kisisel/kartlar/deste.json", { kartlar: [] })).kartlar || [])] };
    const kartMetni = (deste.kartlar || []).flatMap((k) => [k.deste === "cumle" ? k.de : null, k.ornek].filter(Boolean));
    kaynaklar.push({ yol: null, ad: "🃏 Kart destesi", tarih: "", metin: kartMetni.join("\n") });
    return kaynaklar;
  }

  async function kelimeSayfasi(w, sahne, benim) {
    const kutu = el("div", "markdown-preview-view markdown-rendered ab-word-page", null, sahne);
    let sozluk = null;
    try {
      sozluk = await sozlukModulu();
    } catch {}
    const formlar = aramaFormlari.get(w.toLowerCase()) || sozluk?.formlar(w) || [w.toLowerCase()];
    const kayit = sozluk?.bul(w);
    const bas = el("div", "ab-word-head", null, kutu);
    const h = el("h1", null, w, bas);
    if (window.speechSynthesis && sozluk?.seslendir) {
      const b = el("button", "ab-pl-mini ab-word-speak", "🔊", h);
      b.addEventListener("click", () => sozluk.seslendir(w));
    }
    if (kayit) el("div", "ab-word-tr", kayit.tr + (kayit.kok && kayit.kok.toLowerCase() !== w.toLowerCase() ? " · sözlükte: " + kayit.kok : ""), bas);
    const fs = el("div", "ab-word-forms", null, bas);
    el("span", "ab-word-forms-label", "Aranan biçimler:", fs);
    for (const f of formlar) el("span", "ab-pl-chip", f, fs);
    const bilgi = el("p", "ab-word-info", "Aranıyor…", kutu);

    const kaynaklar = await aramaKaynaklari();
    if (benim !== nesil) return;
    const kac = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const desen = new RegExp("(?<![\\p{L}])(" + formlar.sort((a, b) => b.length - a.length).map(kac).join("|") + ")(?![\\p{L}])", "giu");
    const gruplar = [];
    let toplam = 0;
    for (const k of kaynaklar) {
      const gorulen = new Set();
      const cumleler = [];
      for (const c of k.metin.split(/(?<=[.!?…]["“”»]?)\s+|\n+/)) {
        const t = c.replace(/\s+/g, " ").trim();
        // sözlük/tablo satırları (· ile ayrılmış hücreler) cümle değildir
        if (!t || t.length > 400 || gorulen.has(t) || t.startsWith("·") || (t.match(/ · /g) || []).length >= 2) continue;
        desen.lastIndex = 0;
        if (desen.test(t)) {
          gorulen.add(t);
          cumleler.push(t);
        }
      }
      if (cumleler.length) {
        gruplar.push({ ...k, cumleler });
        toplam += cumleler.length;
      }
    }
    gruplar.sort((a, b) => (b.tarih || "").localeCompare(a.tarih || "") || a.ad.localeCompare(b.ad, "tr"));
    bilgi.textContent = toplam ? `${toplam} cümle · ${gruplar.length} yerde. En yeni önce.` : "Bu kelime notlarda henüz geçmiyor.";
    let gosterilen = 0;
    for (const g of gruplar) {
      if (gosterilen > 300) break;
      const kart = el("div", "ab-word-group", null, kutu);
      const bas_ = el("div", "ab-word-src", null, kart);
      if (g.yol) {
        const a = el("a", "internal-link", g.ad, bas_);
        a.dataset.yol = g.yol;
        a.href = "#" + encodeURIComponent(g.yol);
      } else el("span", null, g.ad, bas_);
      el("span", "ab-count", g.cumleler.length, bas_);
      const ul = el("ul", null, null, kart);
      for (const c of g.cumleler.slice(0, 12)) {
        const li = el("li", null, null, ul);
        let son = 0;
        desen.lastIndex = 0;
        for (const m of c.matchAll(desen)) {
          if (m.index > son) li.appendChild(document.createTextNode(c.slice(son, m.index)));
          el("mark", null, m[0], li);
          son = m.index + m[0].length;
        }
        if (son < c.length) li.appendChild(document.createTextNode(c.slice(son)));
        gosterilen++;
      }
      if (g.cumleler.length > 12) el("div", "ab-word-more", "+" + (g.cumleler.length - 12) + " cümle daha", kart);
    }
  }

  // ---------------------------------------------------------------- Obsidian + Dataview API'si

  // Var olan bir .json dosyasının o günkü ilk değişikliğinden önce eski hâlini _kisisel/yedek/<gün>/ içine kopyala.
  // Yedek alınamazsa yazma yine yapılır (sadece uyarı).
  async function yedekle(yol) {
    if (!yol.endsWith(".json") || yol.startsWith(YEDEK_KOK + "/")) return;
    const hedef = `${YEDEK_KOK}/${bugunISO()}/${yol.replace(/\//g, "__")}`;
    if (yedeklenen.has(hedef)) return;
    try {
      if (!(await depo.exists(hedef))) {
        if (!(await depo.exists(yol))) return; // yeni dosya: yedeklenecek eski hâl yok
        await depo.write(hedef, await depo.read(yol));
      }
      yedeklenen.add(hedef);
    } catch (err) {
      console.warn("yedek alınamadı", yol, err);
    }
  }

  // Açılışta bir kez: YEDEK_GUN günden eski yedek klasörlerini sil (sadece _kisisel/yedek/<YYYY-MM-DD>)
  let budandi = false;
  async function yedekBuda() {
    if (budandi) return;
    budandi = true;
    try {
      const d = new Date();
      d.setDate(d.getDate() - YEDEK_GUN);
      const sinir = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const gunler = new Set();
      for (const p of dosyalar.keys()) {
        const m = /^_kisisel\/yedek\/(\d{4}-\d{2}-\d{2})\//.exec(p);
        if (m) gunler.add(m[1]);
      }
      for (const g of gunler) {
        if (g >= sinir) continue;
        await depo.sil(`${YEDEK_KOK}/${g}`);
        for (const p of [...dosyalar.keys()]) if (p.startsWith(`${YEDEK_KOK}/${g}/`)) dosyalar.delete(p);
      }
    } catch (err) {
      console.warn("eski yedekler silinemedi", err);
    }
  }

  const app = {
    vault: {
      getName: () => "Almanca Vault",
      adapter: {
        read: (yol) => depo.read(nfc(yol)),
        exists: (yol) => depo.exists(nfc(yol)),
        mkdir: (yol) => depo.mkdir(nfc(yol)),
        async write(yol, metin) {
          yol = nfc(yol);
          if (BOZUK.has(yol)) throw new Error("bozuk dosya, yazılmadı: " + yol);
          await yedekle(yol);
          const mtime = await depo.write(yol, metin);
          kendiYazdiklarim.set(yol, mtime);
          dosyalar.set(yol, { path: yol, mtime, size: metin.length });
          if (yol.endsWith(".md")) sayfalar.delete(yol);
          return mtime;
        },
        async list(yol) {
          const onek = yol ? nfc(yol).replace(/\/$/, "") + "/" : "";
          const files = [], folders = new Set();
          for (const p of dosyalar.keys()) {
            if (!p.startsWith(onek)) continue;
            const kalan = p.slice(onek.length);
            if (kalan.includes("/")) folders.add(onek + kalan.split("/")[0]);
            else files.push(p);
          }
          return { files, folders: [...folders] };
        },
      },
      getMarkdownFiles: () => [...sayfalar.keys()].map((p) => ({ path: p, basename: adi(p), name: p.split("/").pop(), extension: "md" })),
    },
    workspace: {
      openLinkText(link, kaynak) {
        const yol = linkCoz(link, kaynak) || link;
        git(yol);
      },
      getActiveFile: () => (aktifYol ? { path: aktifYol, basename: adi(aktifYol), name: aktifYol.split("/").pop(), extension: uzanti(aktifYol) } : null),
    },
  };
  window.app = app;

  class VeriDizisi extends Array {
    array() {
      return Array.from(this);
    }
    where(f) {
      return VeriDizisi.from(this.filter(f));
    }
    sort(f, yon) {
      if (typeof f !== "function" || f.length === 2) return super.sort(f);
      const k = Array.from(this).sort((a, b) => {
        const x = f(a), y = f(b);
        return (x < y ? -1 : x > y ? 1 : 0) * (yon === "desc" ? -1 : 1);
      });
      return VeriDizisi.from(k);
    }
    limit(n) {
      return VeriDizisi.from(this.slice(0, n));
    }
  }
  Object.defineProperty(VeriDizisi, Symbol.species, { get: () => VeriDizisi });

  function sayfaBul(p) {
    if (!p) return undefined;
    if (typeof p === "object") p = p.path || p.file?.path;
    const yol = linkCoz(p);
    return yol && sayfalar.has(yol) ? sayfalar.get(yol).sayfa : undefined;
  }

  function sayfalariSorgula(kaynak) {
    const hepsi = [...sayfalar.values()].map((k) => k.sayfa);
    if (!kaynak || !String(kaynak).trim()) return VeriDizisi.from(hepsi);
    const klasorler = [...String(kaynak).matchAll(/"([^"]+)"/g)].map((m) => nfc(m[1]).replace(/\/$/, ""));
    const etiketler = [...String(kaynak).matchAll(/(?:^|\s)#([\w/-]+)/g)].map((m) => m[1]);
    return VeriDizisi.from(
      hepsi.filter((s) => {
        const yol = s.file.path;
        if (klasorler.some((k) => yol === k + ".md" || yol.startsWith(k + "/"))) return true;
        if (etiketler.length) {
          const t = [].concat(s.tags || s.tag || []).map(String);
          return etiketler.some((e) => t.includes(e));
        }
        return false;
      })
    );
  }

  const gorunumKodu = new Map(); // view.js → kod (her çizimde tazelenir)
  async function gorunumCalistir(yol, input, kap, ctx) {
    yol = nfc(yol).replace(/\.js$/, "").replace(/\/$/, "");
    let kod = null;
    let jsYolu = null;
    for (const aday of [yol + "/view.js", yol + ".js"]) {
      if (dosyalar.has(aday)) {
        jsYolu = aday;
        break;
      }
    }
    if (!jsYolu) throw new Error("Görünüm bulunamadı: " + yol);
    const anahtar = jsYolu + "|" + ctx.nesil;
    kod = gorunumKodu.get(anahtar);
    if (!kod) {
      kod = depo.read(jsYolu);
      gorunumKodu.set(anahtar, kod);
    }
    kod = await kod;
    const cssYolu = jsYolu.replace(/view\.js$|\.js$/, (m) => (m === "view.js" ? "view.css" : ".css"));
    if (dosyalar.has(cssYolu) && !ctx.css.has(cssYolu)) {
      ctx.css.add(cssYolu);
      const css = await depo.read(cssYolu);
      const id = "ab-css-" + cssYolu.replace(/[^\w]/g, "_");
      let st = document.getElementById(id);
      if (!st) {
        st = document.createElement("style");
        st.id = id;
        document.head.appendChild(st);
      }
      if (st.textContent !== css) st.textContent = css;
    }
    const dv = dvYap(kap, ctx);
    const fn = new AsyncFunction("dv", "input", "app", "obsidian", kod + "\n//# sourceURL=" + encodeURI(jsYolu));
    return fn.call(kap, dv, input || {}, app, {});
  }

  function dvYap(kap, ctx) {
    const dv = {
      container: kap,
      app,
      current: () => (ctx.yol ? sayfaBul(ctx.yol) : undefined),
      page: (p) => sayfaBul(p),
      pages: (k) => sayfalariSorgula(k),
      array: (a) => VeriDizisi.from(a || []),
      view: (yol, input) => gorunumCalistir(yol, input, kap, ctx),
      el(tag, metin, o = {}) {
        const e = document.createElement(tag);
        if (o.cls) e.className = [].concat(o.cls).join(" ");
        if (o.attr) for (const [k, v] of Object.entries(o.attr)) e.setAttribute(k, v);
        e.classList.add("markdown-rendered");
        markdownCiz(e, typeof metin === "string" ? metin : String(metin ?? ""), ctx.yol);
        (o.container || kap).appendChild(e);
        return e;
      },
      paragraph: (m, o = {}) => dv.el("p", m, o),
      span: (m, o = {}) => dv.el("span", m, o),
      header: (n, m, o = {}) => dv.el("h" + Math.min(6, Math.max(1, n)), m, o),
      list(xs, o = {}) {
        return dv.el("div", [...(xs || [])].map((x) => "- " + x).join("\n"), o);
      },
      table(basliklar, satirlar, o = {}) {
        const t = el("table", null, null, o.container || kap);
        const tr = el("tr", null, null, el("thead", null, null, t));
        for (const b of basliklar) el("th", null, b, tr);
        const tb = el("tbody", null, null, t);
        for (const s of satirlar || []) {
          const r = el("tr", null, null, tb);
          for (const h of s) el("td", null, h, r);
        }
        return t;
      },
      fileLink: (yol, embed, ad) => `[[${yol}${ad ? "|" + ad : ""}]]`,
      date: (s) => s,
      luxon: undefined,
      io: { load: (yol) => depo.read(nfc(yol)) },
    };
    return dv;
  }

  // ---------------------------------------------------------------- sözlük balonu (eski Obsidian eklentisinin yaptığı)

  const HARF = /[A-Za-zÄÖÜäöüß-]/;
  const TURKCE = /[çğışİ]/;
  const SOZ_ATLA = "a, button, input, textarea, select, code, pre, audio, .sz-w:not(.sz-plugin), .sz-pop, .kr-root, .dr-root, .callout-title, .ab-crumb, .ab-editor";
  let sozlukSoz = null;
  let sozlukZamani = 0;
  async function sozlukModulu() {
    const mt = (dosyalar.get("_sistem/sozluk/sozluk.json")?.mtime || 0) + (dosyalar.get("_kisisel/sozluk/sozluk.json")?.mtime || 0);
    if (!sozlukSoz || sozlukZamani !== mt) {
      sozlukZamani = mt;
      sozlukSoz = depo.read("_sistem/sozluk/sozluk.js").then((kod) => new Function("app", kod)(app)());
      sozlukSoz.catch(() => (sozlukSoz = null));
    }
    return sozlukSoz;
  }

  function kelimeBul(e) {
    let dugum, ofset;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (!p) return null;
      dugum = p.offsetNode;
      ofset = p.offset;
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!r) return null;
      dugum = r.startContainer;
      ofset = r.startOffset;
    } else return null;
    if (!dugum || dugum.nodeType !== Node.TEXT_NODE) return null;
    const t = dugum.textContent;
    let a = ofset, b = ofset;
    while (a > 0 && HARF.test(t[a - 1])) a--;
    while (b < t.length && HARF.test(t[b])) b++;
    while (a < b && t[a] === "-") a++;
    while (b > a && t[b - 1] === "-") b--;
    if (b - a < 2) return null;
    return { dugum, a, b, kelime: t.slice(a, b), metin: t };
  }

  async function sozlukTikla(e) {
    if (e.button !== 0 || e.defaultPrevented) return;
    const hedef = e.target;
    if (!(hedef instanceof HTMLElement)) return;
    if (!hedef.closest("#ab-note .markdown-rendered")) return;
    if (hedef.closest(SOZ_ATLA)) return;
    const secim = window.getSelection();
    if (secim && !secim.isCollapsed) return;
    const onceki = hedef.closest(".sz-plugin");
    const k = onceki ? { span: onceki, kelime: onceki.textContent, metin: onceki.parentElement?.textContent || "" } : kelimeBul(e);
    if (!k) return;
    let sozluk;
    try {
      sozluk = await sozlukModulu();
    } catch (err) {
      console.error("sözlük yüklenemedi", err);
      return;
    }
    const bulundu = sozluk.bul(k.kelime);
    const blok = hedef.closest("p, li, td, th, h1, h2, h3, h4, h5, h6, .callout-content, div");
    const cevre = (blok?.textContent || "") + " " + k.metin;
    if (!bulundu && (TURKCE.test(cevre) || TURKCE.test(k.kelime) || k.kelime.length < 3)) return;
    if (bulundu && k.kelime.length < 3) return;
    let span = k.span;
    if (!span) {
      const aralik = document.createRange();
      aralik.setStart(k.dugum, k.a);
      aralik.setEnd(k.dugum, k.b);
      span = document.createElement("span");
      span.className = "sz-w sz-plugin";
      try {
        aralik.surroundContents(span);
      } catch {
        return;
      }
    }
    sozluk.goster(span, k.kelime, aktifYol ? (aktifYol.startsWith(KELIME_ROTA) ? "Kelime araması" : adi(aktifYol)) : undefined);
  }

  // ---------------------------------------------------------------- arayüz

  let aktifYol = null;
  let nesil = 0;
  let duzenleme = false;
  const ui = {};

  function temaUygula(t) {
    document.body.classList.toggle("theme-dark", t === "dark");
    document.body.classList.toggle("theme-light", t !== "dark");
    if (ui.tema) ui.tema.textContent = t === "dark" ? "☀️" : "🌙";
  }
  function temaSec() {
    const kayitli = ls.al("tema", null);
    return kayitli || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  function iskelet() {
    const kok = document.getElementById("app");
    kok.textContent = "";
    kok.className = "ab-shell";
    ui.yan = el("aside", "ab-side", null, kok);
    ui.perde = el("div", "ab-scrim", null, kok);
    ui.perde.addEventListener("click", () => yanKapat());
    const marka = el("div", "ab-brand", null, ui.yan);
    el("span", "ab-brand-logo", "🇩🇪", marka);
    const mm = el("div", "ab-brand-text", null, marka);
    el("div", "ab-brand-title", "Almanca", mm);
    ui.markaAlt = el("div", "ab-brand-sub", "telc B1 hazırlık", mm);
    ui.tema = el("button", "ab-icon-btn", "🌙", marka);
    ui.tema.title = "Açık / koyu tema";
    ui.tema.addEventListener("click", () => {
      const yeni = document.body.classList.contains("theme-dark") ? "light" : "dark";
      ls.koy("tema", yeni);
      temaUygula(yeni);
    });

    ui.hizli = el("nav", "ab-quick", null, ui.yan);
    const ara = el("div", "ab-search", null, ui.yan);
    ui.ara = el("input", null, null, ara);
    ui.ara.type = "search";
    ui.ara.placeholder = "Not ara…";
    ui.ara.addEventListener("input", () => agacCiz());
    ui.ara.addEventListener("keydown", (e) => {
      if (e.key === "Enter") ui.agac.querySelector("a.ab-file")?.click();
      if (e.key === "Escape") {
        ui.ara.value = "";
        agacCiz();
      }
    });
    ui.agac = el("nav", "ab-tree", null, ui.yan);
    ui.alt = el("div", "ab-side-foot", null, ui.yan);

    const ana = el("main", "ab-main", null, kok);
    ui.ana = ana;
    const ust = el("header", "ab-top", null, ana);
    const menu = el("button", "ab-icon-btn ab-menu", "☰", ust);
    menu.title = "Menü";
    menu.addEventListener("click", () => document.body.classList.toggle("ab-side-open"));
    const geri = el("button", "ab-icon-btn", "←", ust);
    geri.title = "Geri";
    geri.addEventListener("click", () => history.back());
    ui.iz = el("div", "ab-crumb", null, ust);
    ui.eylem = el("div", "ab-actions", null, ust);
    ui.duzenle = el("button", "ab-btn", "✏️ Düzenle", ui.eylem);
    ui.duzenle.title = "Notun ham metnini düzenle";
    ui.duzenle.addEventListener("click", () => {
      duzenleme = !duzenleme;
      ciz(aktifYol, { koru: false });
    });
    ui.yenile = el("button", "ab-icon-btn", "⟳", ui.eylem);
    ui.yenile.title = "Diskten yenile (Claude bir şey değiştirdiyse)";
    ui.yenile.addEventListener("click", () => yenile(true));
    ui.icerik = el("div", "ab-content", null, ana);

    temaUygula(temaSec());
    document.addEventListener("click", (e) => {
      const a = e.target.closest?.("a.internal-link");
      if (a && !e.defaultPrevented && (a.dataset.yol || a.dataset.href)) {
        e.preventDefault();
        if (a.dataset.yol) git(a.dataset.yol);
      }
    });
    document.addEventListener("click", sozlukTikla);
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.body.classList.add("ab-side-open");
        ui.ara.focus();
        ui.ara.select();
      }
    });
    window.addEventListener("hashchange", () => {
      const yol = hashYolu();
      if (yol !== aktifYol) {
        duzenleme = false;
        ciz(yol);
      }
    });
    // Claude dosyaları değiştirdiyse (ör. /kontrol sonuçları) pencereye dönünce sayfa kendiliğinden tazelenir
    let sonKontrol = 0;
    const donus = () => {
      if (document.visibilityState !== "visible" || Date.now() - sonKontrol < 1500) return;
      sonKontrol = Date.now();
      yenile(false);
    };
    document.addEventListener("visibilitychange", donus);
    window.addEventListener("focus", donus);
  }

  function yanKapat() {
    document.body.classList.remove("ab-side-open");
  }

  function hashYolu() {
    const h = location.hash.slice(1);
    if (!h) return ANA_SAYFA;
    try {
      return nfc(decodeURIComponent(h));
    } catch {
      return ANA_SAYFA;
    }
  }

  function git(yol) {
    yanKapat();
    if (!yol) return;
    const h = "#" + encodeURIComponent(yol);
    if (location.hash === h) {
      duzenleme = false;
      ciz(yol);
    } else location.hash = h;
  }

  function baslikAdi(yol) {
    const k = sayfalar.get(yol);
    const fm = k?.fm || {};
    return fm.baslik && fm.id ? fm.id + " · " + fm.baslik : adi(yol);
  }

  function bugunNotu() {
    const bugun = bugunISO();
    const adaylar = [...sayfalar.values()].filter((k) => k.fm.tur === "gunluk" && String(k.fm.tarih || "").slice(0, 10) === bugun);
    if (adaylar.length) return adaylar.sort((a, b) => a.sayfa.file.path.localeCompare(b.sayfa.file.path))[0].sayfa.file.path;
    return null;
  }
  function sonNot(tur) {
    const xs = [...sayfalar.values()].filter((k) => k.fm.tur === tur).sort((a, b) => String(b.fm.tarih || b.sayfa.file.name).localeCompare(String(a.fm.tarih || a.sayfa.file.name)) || Number(b.fm.tag || 0) - Number(a.fm.tag || 0));
    return xs[0]?.sayfa.file.path || null;
  }

  function hizliCiz() {
    ui.hizli.textContent = "";
    const bugunYol = bugunNotu();
    const gunluk = sonNot("tagebuch");
    const ogeler = [
      [ANA_SAYFA, "🏠", "Dashboard"],
      [bugunYol || sonNot("gunluk"), "✍️", bugunYol ? "Bugünün antrenmanı" : "Son antrenman"],
      [gunluk, "📓", "Tempelhof günlüğü"],
      [sonNot("analiz"), "📊", "Haftalık analiz"],
      ["_kisisel/Profil.md", "⚙️", "Profil"],
    ];
    for (const [yol, ikon, ad] of ogeler) {
      if (!yol || !dosyalar.has(yol)) continue;
      const a = el("a", "ab-quick-item" + (yol === aktifYol ? " is-active" : ""), null, ui.hizli);
      a.href = "#" + encodeURIComponent(yol);
      a.dataset.yol = yol;
      el("span", "ab-quick-icon", ikon, a);
      el("span", null, ad, a);
    }
  }

  const TERS_SIRA = /^(05 Günlük|08 Tempelhof|10 Analiz|07 Modelltests)/;
  function agacCiz() {
    ui.agac.textContent = "";
    const sorgu = ui.ara.value.trim().toLocaleLowerCase("tr");
    const mdler = [...sayfalar.keys()].filter((y) => !/^(_sistem|_kisisel|LICENSES|docs)\//.test(y) && y.includes("/"));
    if (sorgu) {
      const bulunan = mdler
        .filter((y) => (y + " " + baslikAdi(y)).toLocaleLowerCase("tr").includes(sorgu))
        .sort((a, b) => adi(a).localeCompare(adi(b), "tr", { numeric: true }))
        .slice(0, 80);
      if (/^[a-zäöüß-]{2,}$/i.test(ui.ara.value.trim())) {
        const w = ui.ara.value.trim();
        const a = el("a", "ab-file ab-word-search", null, ui.agac);
        a.href = "#" + encodeURIComponent(KELIME_ROTA + w);
        a.dataset.yol = KELIME_ROTA + w;
        el("span", "ab-file-name", `🔎 „${w}" kelimesini cümlelerde ara`, a);
      }
      if (!bulunan.length) el("div", "ab-empty", "Not adı eşleşmedi", ui.agac);
      for (const y of bulunan) dosyaSatiri(y, ui.agac, true);
      return;
    }
    const kok = { klasorler: new Map(), notlar: [] };
    for (const y of mdler) {
      const p = y.split("/");
      let d = kok;
      for (const k of p.slice(0, -1)) {
        if (!d.klasorler.has(k)) d.klasorler.set(k, { klasorler: new Map(), notlar: [] });
        d = d.klasorler.get(k);
      }
      d.notlar.push(y);
    }
    const acik = ls.al("acik", {});
    const ciz = (d, onek, ebeveyn, derinlik) => {
      const ters = TERS_SIRA.test(onek);
      for (const [ad, alt] of [...d.klasorler].sort((a, b) => a[0].localeCompare(b[0], "tr", { numeric: true }))) {
        const yol = onek ? onek + "/" + ad : ad;
        const det = el("details", "ab-folder", null, ebeveyn);
        const aktifIcinde = aktifYol && aktifYol.startsWith(yol + "/");
        if (acik[yol] || aktifIcinde) det.open = true;
        const s = el("summary", null, null, det);
        el("span", "ab-folder-name", ad.replace(/^\d\d /, ""), s);
        const sayi = (function say(x) {
          let n = x.notlar.length;
          for (const v of x.klasorler.values()) n += say(v);
          return n;
        })(alt);
        el("span", "ab-count", sayi, s);
        det.addEventListener("toggle", () => {
          const a = ls.al("acik", {});
          if (det.open) a[yol] = true;
          else delete a[yol];
          ls.koy("acik", a);
        });
        const ic = el("div", "ab-folder-body", null, det);
        ciz(alt, yol, ic, derinlik + 1);
      }
      const notlar = d.notlar.sort((a, b) => adi(a).localeCompare(adi(b), "tr", { numeric: true }) * (ters ? -1 : 1));
      for (const y of notlar) dosyaSatiri(y, ebeveyn, false);
    };
    ciz(kok, "", ui.agac, 0);
  }

  function dosyaSatiri(y, ebeveyn, yolGoster) {
    const k = sayfalar.get(y);
    const fm = k?.fm || {};
    const a = el("a", "ab-file" + (y === aktifYol ? " is-active" : ""), null, ebeveyn);
    a.href = "#" + encodeURIComponent(y);
    a.dataset.yol = y;
    const durum = fm.durum;
    if (fm.tur === "gunluk") a.classList.add(durum === "tamamlandi" ? "is-done" : "is-open");
    else if (durum && ["temiz", "ogreniliyor", "zayif", "kilitli", "yeni", "beklemede"].includes(durum)) a.classList.add("st-" + durum);
    el("span", "ab-file-name", adi(y), a);
    if (yolGoster) el("span", "ab-file-path", klasoru(y).replace(/^\d\d /, ""), a);
  }

  function izCiz(yol) {
    ui.iz.textContent = "";
    const parcalar = yol.split("/");
    parcalar.forEach((p, i) => {
      if (i) el("span", "ab-crumb-sep", "›", ui.iz);
      const ad = (i === parcalar.length - 1 ? adi(p) : p).replace(/^\d\d (?=\S)/, "");
      el("span", i === parcalar.length - 1 ? "ab-crumb-last" : "ab-crumb-part", ad, ui.iz);
    });
  }

  function aktifIsaretle() {
    for (const a of document.querySelectorAll(".ab-side a[data-yol]")) a.classList.toggle("is-active", a.dataset.yol === aktifYol);
  }

  async function ciz(yol, { koru = false } = {}) {
    const benim = ++nesil;
    const kaydirma = koru ? ui.ana.scrollTop : 0;
    yol = yol || ANA_SAYFA;
    if (yol.startsWith(KELIME_ROTA)) {
      const w = yol.slice(KELIME_ROTA.length);
      aktifYol = yol;
      aktifIsaretle();
      ui.iz.textContent = "";
      el("span", "ab-crumb-part", "🔎 Kelime", ui.iz);
      el("span", "ab-crumb-sep", "›", ui.iz);
      el("span", "ab-crumb-last", w, ui.iz);
      ui.duzenle.hidden = true;
      document.title = w + " · Almanca";
      const sahne = document.createElement("div");
      sahne.id = "ab-note";
      ui.icerik.replaceChildren(sahne);
      ui.ana.scrollTop = 0;
      return kelimeSayfasi(w, sahne, benim);
    }
    if (!dosyalar.has(yol)) {
      const c = linkCoz(yol);
      if (c) yol = c;
    }
    aktifYol = yol;
    izCiz(yol);
    aktifIsaretle();
    const sp = window.__almancaPop;
    if (sp) {
      sp.el.remove();
      window.__almancaPop = null;
    }
    const sahne = document.createElement("div");
    sahne.id = "ab-note";
    const md_ = yol.endsWith(".md");
    ui.duzenle.hidden = !md_ || !dosyalar.has(yol);
    ui.duzenle.textContent = duzenleme ? "👁 Oku" : "✏️ Düzenle";
    document.title = adi(yol) + " · Almanca";

    if (!dosyalar.has(yol)) {
      el("div", "ab-notfound", "Not bulunamadı: " + yol, sahne);
      ui.icerik.replaceChildren(sahne);
      return;
    }
    if (!md_) {
      dosyaGoster(yol, sahne);
      ui.icerik.replaceChildren(sahne);
      return;
    }

    let kayit;
    try {
      kayit = await sayfaOku(yol, true);
    } catch (err) {
      el("div", "ab-notfound", "Not okunamadı: " + err.message, sahne);
      ui.icerik.replaceChildren(sahne);
      return;
    }
    if (benim !== nesil) return;

    if (duzenleme) {
      editorCiz(yol, kayit, sahne);
      ui.icerik.replaceChildren(sahne);
      return;
    }

    const siniflar = [].concat(kayit.fm.cssclasses || kayit.fm.cssclass || []).filter(Boolean).map(String);
    const gorunum = el("div", "markdown-preview-view markdown-rendered " + siniflar.join(" "), null, sahne);
    gorunum.dataset.yol = yol;
    const bloklar = markdownCiz(gorunum, kayit.govde, yol);
    ui.icerik.replaceChildren(sahne);
    if (koru) ui.ana.scrollTop = kaydirma;
    else ui.ana.scrollTop = 0;

    const ctx = { yol, nesil: benim, css: new Set() };
    for (const { yer, kod } of bloklar) {
      if (benim !== nesil) return;
      const kap = document.createElement("div");
      kap.className = "block-language-dataviewjs";
      yer.replaceWith(kap);
      try {
        const dv = dvYap(kap, ctx);
        await new AsyncFunction("dv", "app", "input", kod)(dv, app, undefined);
      } catch (err) {
        console.error("dataviewjs hatası", yol, err);
        const h = el("div", "ab-dv-error", null, kap);
        el("strong", null, "Blok çalışmadı: ", h);
        el("span", null, err?.message || String(err), h);
      }
    }
    if (koru && benim === nesil) ui.ana.scrollTop = kaydirma;
  }

  function editorCiz(yol, kayit, sahne) {
    const kutu = el("div", "ab-editor", null, sahne);
    const bilgi = el("div", "ab-editor-info", null, kutu);
    el("span", null, "Ham metin · ", bilgi);
    el("code", null, yol, bilgi);
    el("div", "ab-editor-warn", "Üstteki --- arasındaki alanları (frontmatter) Claude ve dashboard kullanır. Adlarını değiştirme.", kutu);
    const ta = el("textarea", "ab-editor-text", null, kutu);
    ta.value = kayit.metin;
    ta.spellcheck = false;
    const alt = el("div", "ab-editor-bar", null, kutu);
    const durum = el("span", "ab-editor-status", "", alt);
    const vazgec = el("button", "ab-btn", "Vazgeç", alt);
    const kaydet = el("button", "ab-btn ab-btn-primary", "Kaydet", alt);
    vazgec.addEventListener("click", () => {
      duzenleme = false;
      ciz(yol);
    });
    const yaz = async () => {
      durum.textContent = "kaydediliyor…";
      try {
        await app.vault.adapter.write(yol, ta.value);
        sayfalar.delete(yol);
        await sayfaOku(yol, true);
        durum.textContent = "kaydedildi ✓";
        duzenleme = false;
        agacCiz();
        ciz(yol);
      } catch (err) {
        durum.textContent = "kaydedilemedi: " + err.message;
      }
    };
    kaydet.addEventListener("click", yaz);
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        yaz();
      }
    });
    setTimeout(() => ta.focus(), 0);
  }

  function dosyaGoster(yol, sahne) {
    const u = uzanti(yol);
    const kutu = el("div", "markdown-preview-view markdown-rendered", null, sahne);
    el("h1", null, yol.split("/").pop(), kutu);
    if (SES.has(u)) {
      const a = el("audio", "ab-audio", null, kutu);
      a.controls = true;
      blobAdresi(yol).then((url) => (a.src = url));
    } else if (RESIM.has(u)) {
      const i = el("img", "ab-img", null, kutu);
      blobAdresi(yol).then((url) => (i.src = url));
    } else if (u === "pdf") {
      const f = el("iframe", "ab-pdf", null, kutu);
      blobAdresi(yol).then((url) => (f.src = url));
    } else {
      const pre = el("pre", null, null, kutu);
      depo.read(yol).then((t) => (pre.textContent = u === "json" ? (() => { try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; } })() : t));
    }
  }

  async function yenile(elle) {
    if (!depo) return;
    if (elle) ui.yenile.classList.add("is-spinning");
    try {
      const degisen = await tara();
      hizliCiz();
      if (degisen.size) agacCiz();
      if (elle || (degisen.size && !duzenleme)) await ciz(aktifYol, { koru: true });
    } catch (err) {
      console.error("yenileme", err);
      if (err.name === "NotAllowedError" || err.name === "SecurityError") baglantiEkrani("izin");
    } finally {
      ui.yenile.classList.remove("is-spinning");
    }
  }

  async function basla(d) {
    depo = d;
    iskelet();
    ui.icerik.textContent = "";
    el("div", "ab-loading", "Notlar yükleniyor…", ui.icerik);
    await tara();
    yedekBuda();
    ui.alt.textContent = "";
    el("span", null, depo.tur === "sunucu" ? "🟢 Yerel sunucu" : "🟢 Klasöre bağlı", ui.alt);
    if (depo.tur === "klasor") {
      const b = el("button", "ab-link-btn", "klasörü değiştir", ui.alt);
      b.addEventListener("click", klasorSec);
    }
    const profil = sayfalar.get("_kisisel/Profil.md")?.fm || {};
    if (profil.ad) ui.markaAlt.textContent = profil.ad + " · " + (profil.sinav || "telc B1");
    hizliCiz();
    agacCiz();
    await ciz(hashYolu());
  }

  // ---------------------------------------------------------------- bağlantı ekranı

  async function klasorSec() {
    let kok;
    try {
      kok = await window.showDirectoryPicker({ id: "almanca-vault", mode: "readwrite", startIn: "desktop" });
    } catch (err) {
      if (err.name !== "AbortError") baglantiEkrani("hata", err.message);
      return;
    }
    const d = new KlasorErisimi(kok);
    if (!(await d.exists("_sistem/Kurallar.md"))) {
      baglantiEkrani("yanlis", kok.name);
      return;
    }
    await idb.koy("kok", kok);
    basla(d);
  }

  function baglantiEkrani(durum, ek) {
    const kok = document.getElementById("app");
    kok.className = "ab-connect-wrap";
    kok.textContent = "";
    const k = el("div", "ab-connect", null, kok);
    el("div", "ab-connect-logo", "🇩🇪", k);
    el("h1", null, "Almanca Vault", k);
    const p = (t) => el("p", null, t, k);
    if (durum === "destek") {
      p("Bu tarayıcı bilgisayardaki klasöre yazamıyor, bu yüzden cevapların kaydedilemez.");
      const ul = el("ol", null, null, k);
      el("li", null, "Almanca.html dosyasını Google Chrome ya da Microsoft Edge ile aç (sağ tık → Birlikte Aç), ya da", ul);
      el("li", null, "vault klasöründeki Almanca.command dosyasına çift tıkla: her tarayıcıda çalışır.", ul);
      return;
    }
    if (durum === "yanlis") p(`Seçtiğin klasör (${ek}) vault değil. İçinde _sistem klasörü olan "Almanca Vault" klasörünü seç.`);
    else if (durum === "hata") p("Klasör açılamadı: " + ek);
    else if (durum === "izin") p("Tarayıcı klasör iznini geri aldı. Devam etmek için izin ver.");
    else p("Notlarını okuyup cevaplarını kaydedebilmem için bir kereliğine vault klasörünü seçmen gerekiyor. Tarayıcı izin sorunca \"Düzenlemeye izin ver\" de.");
    const dugmeler = el("div", "ab-connect-actions", null, k);
    idb.al("kok").then((h) => {
      if (h && durum !== "yanlis") {
        const devam = el("button", "ab-btn ab-btn-primary ab-btn-big", `▶ Devam et (${h.name})`, dugmeler);
        devam.addEventListener("click", async () => {
          try {
            const izin = await h.requestPermission({ mode: "readwrite" });
            if (izin === "granted") return basla(new KlasorErisimi(h));
          } catch (err) {
            console.warn(err);
          }
          baglantiEkrani("izin");
        });
      }
      const sec = el("button", "ab-btn" + (h && durum !== "yanlis" ? "" : " ab-btn-primary ab-btn-big"), "📁 Vault klasörünü seç", dugmeler);
      sec.addEventListener("click", klasorSec);
    });
    el("p", "ab-connect-note", "Dosyaların bilgisayarından çıkmaz; her şey bu klasöre yazılır, Claude da oradan okur.", k);
  }

  async function giris() {
    temaUygula(temaSec());
    if (typeof marked === "undefined" || !marked.Marked) throw new Error("Markdown kütüphanesi yüklenemedi (_sistem/web/vendor/marked.min.js).");
    mdKur();
    if (/^https?:$/.test(location.protocol)) {
      try {
        return await basla(new SunucuErisimi());
      } catch (err) {
        document.getElementById("app").textContent = "Sunucuya bağlanılamadı: " + err.message;
        return;
      }
    }
    if (!window.showDirectoryPicker) return baglantiEkrani("destek");
    const h = await idb.al("kok");
    if (h) {
      try {
        if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return basla(new KlasorErisimi(h));
      } catch {}
    }
    baglantiEkrani(h ? "izin-iste" : "ilk");
  }

  function acilisHatasi(err) {
    console.error("açılış hatası", err);
    const kok = document.getElementById("app");
    // Notlar yüklenirken takıldıysa hatayı oraya yaz
    const yukleniyor = document.querySelector(".ab-content > .ab-loading");
    if (yukleniyor) {
      yukleniyor.textContent = "Notlar yüklenemedi: " + String(err?.message || err);
      return;
    }
    // Sadece açılış ekranı hâlâ duruyorsa göster; arayüz çizildikten sonraki hatalar konsola gider
    if (!kok || !document.getElementById("ab-fallback")) return;
    kok.className = "ab-connect-wrap";
    kok.textContent = "";
    const k = el("div", "ab-connect", null, kok);
    el("div", "ab-connect-logo", "⚠️", k);
    el("h1", null, "Arayüz açılamadı", k);
    el("p", null, String(err?.message || err), k);
    el("p", "ab-connect-note", "Chrome ya da Edge ile açmayı dene, olmazsa Almanca.command'a çift tıkla. Bu mesajı Claude'a gönderebilirsin.", k);
  }

  window.__abYuklendi = true;
  window.addEventListener("error", (e) => acilisHatasi(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => acilisHatasi(e.reason));
  const calistir = () => giris().catch(acilisHatasi);
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", calistir);
  else calistir();
})();
