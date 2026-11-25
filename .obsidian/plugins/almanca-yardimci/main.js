// Almanca Vault yardımcı eklentisi
// 1) Notları okuma modunda açar: canlı önizlemede kutulara (callout) tıklayınca ham markdown görünmesini engeller.
// 2) Sayfadaki herhangi bir Almanca kelimeye tıklayınca Türkçesini gösterir (_sistem/sozluk/sozluk.js modülünü kullanır).

const { Plugin, MarkdownView } = require("obsidian");

const HARF = /[A-Za-zÄÖÜäöüß-]/;
const TURKCE = /[çğışİ]/;
const ATLA = "a, button, input, textarea, select, code, pre, .sz-w:not(.sz-plugin), .sz-pop, .kr-root, .callout-title, .metadata-container, .inline-title, .collapse-indicator";

module.exports = class AlmancaYardimci extends Plugin {
  async onload() {
    this.registerEvent(this.app.workspace.on("file-open", (file) => this.okumaModu(file)));
    this.app.workspace.onLayoutReady(() => this.okumaModu(this.app.workspace.getActiveFile()));
    this.registerDomEvent(document, "click", (e) => this.tikla(e));
    this.addCommand({
      id: "duzenleme-modu",
      name: "Bu notu düzenleme modunda aç",
      callback: () => this.duzenle(),
    });
  }

  async okumaModu(file) {
    if (!file || file.extension !== "md") return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file?.path !== file.path || view.getMode() !== "source") return;
    const durum = view.leaf.getViewState();
    durum.state = { ...durum.state, mode: "preview" };
    await view.leaf.setViewState(durum);
  }

  async duzenle() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const durum = view.leaf.getViewState();
    durum.state = { ...durum.state, mode: "source", source: false };
    await view.leaf.setViewState(durum);
  }

  async sozluk() {
    // Her tıklamada taze yükle: Claude sözlüğe yeni kelime eklediyse hemen görünsün
    const kod = await this.app.vault.adapter.read("_sistem/sozluk/sozluk.js");
    return await new Function("app", kod)(this.app)();
  }

  kelimeBul(e) {
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
    let a = ofset;
    let b = ofset;
    while (a > 0 && HARF.test(t[a - 1])) a--;
    while (b < t.length && HARF.test(t[b])) b++;
    while (a < b && t[a] === "-") a++;
    while (b > a && t[b - 1] === "-") b--;
    if (b - a < 2) return null;
    return { dugum, a, b, kelime: t.slice(a, b), metin: t };
  }

  async tikla(e) {
    if (e.button !== 0 || e.defaultPrevented) return;
    const hedef = e.target;
    if (!(hedef instanceof HTMLElement)) return;
    if (!hedef.closest(".markdown-preview-view, .markdown-rendered")) return;
    if (hedef.closest(ATLA)) return;
    const secim = window.getSelection();
    if (secim && !secim.isCollapsed) return;

    // Daha önce bu eklentinin sardığı bir kelimeye tekrar tıklandıysa doğrudan onu kullan
    const onceki = hedef.closest(".sz-plugin");
    const k = onceki ? { span: onceki, kelime: onceki.textContent, metin: onceki.parentElement?.textContent || "" } : this.kelimeBul(e);
    if (!k) return;
    let sozluk;
    try {
      sozluk = await this.sozluk();
    } catch (err) {
      console.error("almanca-yardimci: sözlük yüklenemedi", err);
      return;
    }
    const bulundu = sozluk.bul(k.kelime);
    // Sözlükte olmayan kelimeleri sadece Türkçe olmayan metinlerde göster (Türkçe açıklamalara tıklayınca balon çıkmasın).
    // Kalın/italik bir kelime Türkçe bir cümlenin içindeyse cümlenin tamamına bak.
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
      } catch (err) {
        return;
      }
    }
    sozluk.goster(span, k.kelime, this.app.workspace.getActiveFile()?.basename);
  }
};
