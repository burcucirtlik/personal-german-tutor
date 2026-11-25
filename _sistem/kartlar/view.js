// Kaydırmalı kart destesi. Günlük notta:
//   await dv.view("_sistem/kartlar", { gun: "2026-10-24", deste: "kelime", adet: 10 })
// `gun` sadece hangi günün kart seçiminin (plan) gösterileceğini belirler; verilmezse bugün (Kartlar.md).
// Hatırlatma aralıkları, dinlenme ve öğrenilme tarihleri her zaman gerçek bugünkü (yerel) tarihle hesaplanır.
// Kartlar: _sistem/kartlar/deste.json (Claude ekler)
// Durum:   _sistem/kartlar/durum.json (bu ekran yazar)
//
// Her kartın iki yönü var: de_tr (Almanca görünür) ve tr_de (Türkçe görünür).
// Sağa = biliyorum (yön yeşil olur), sola = tekrar (kırmızı olur).
// İki yönü de yeşil olan kart "öğrenildi" sayılır ve hatırlatma aralıklarıyla geri gelir:
// 2, 5, 12, 30, 60 gün sonra. Hatırlatmada sola atılırsa yeniden öğrenilir.
// Bir turda her kart en fazla MAKS_GOSTERIM kez gelir, sonra tur biter. "Yenile" yeni bir tur başlatır.
// Turu kırmızı biten kart (devir) ertesi gün ilk sırada gelir; %40 kırmızı sınırı onu dışarıda bırakmaz.
//
// Önce tanı, sonra üret: yeni kart Almanca → Türkçe gelir; Türkçe → Almanca yönü o yön yeşil olunca açılır.
// Günlük karışım: önce zamanı gelmiş hatırlatmalardan en az HATIRLATMA_MIN tanesi (en eski vadeli önce), sonra devreden
// kartlar, en fazla KIRMIZI_MAKS takılan kart, en az YENI_MIN yeni kart (sıklık sırası olan destede en sık kelime önce).
// Tıklama sinyali: son 7 günde sözlükte tıklanan kelimelerin kartları öne alınır; günde (bütün turlar) en fazla TIK_MAKS kart.
// İnatçı kart: öğrenilmeden INATCI_ESIK kez sola atılan kart INATCI_ARA gün dinlenir; o arada Claude
// kelimeyi antrenmanda bir alıştırmaya koyar (durum.json → kartlar[id].inatci).
// Kartın arkası: Türkçesi/Almancası, örnek cümle (ornek, ornek_tr), hafıza kancası (kanca), artikel rengi.
// Kontrol kartı: Profil.md → <deste>_baslangic seviyesinin altındaki, hiç görülmemiş kartlar (seviye tespitinde geçilen
// seviyeler) günde en fazla KONTROL_MAKS tane Türkçe → Almanca gelir. Sağa atılırsa kart doğrudan öğrenilmiş sayılır.

function yerelGun() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const BUGUN = yerelGun(); // zamanlama: gerçek bugün
const GUN = input.gun || BUGUN; // gösterilen planın günü
const DESTE = input.deste || "kelime";
const ADET = input.adet || 10;
const DESTE_YOLU = "_sistem/kartlar/deste.json"; // çekirdek deste (motor)
const KISISEL_DESTE_YOLU = "_kisisel/kartlar/deste.json"; // kişisel kartlar ve çekirdeğe kişisel ekler (aynı id)
const DURUM_YOLU = "_kisisel/kartlar/durum.json";
const adapter = app.vault.adapter;
const YONLER = ["de_tr", "tr_de"];
const ARALIK = { 1: 2, 2: 5, 3: 12, 4: 30, 5: 60 };
const MAKS_GOSTERIM = 3;
const HATIRLATMA_MIN = 2;
const PLAN_SAKLA = 30; // bu kadar günden eski planlar durum.json'dan silinir
const KIRMIZI_MAKS = Math.max(2, Math.round(ADET * 0.4));
const YENI_MIN = Math.max(2, Math.round(ADET * 0.4));
const INATCI_ESIK = 5;
const INATCI_ARA = 3;
// bir seviyenin kartlarının bu kadarı öğrenilince üst seviye açılır
const SEVIYE_ESIK = DESTE === "kelime" ? 0.5 : 0.7;
const KONTROL_MAKS = Math.max(1, Math.round(ADET * 0.3));
const PROFIL = dv.page("_kisisel/Profil") || {};
const BASLANGIC = Number(PROFIL[DESTE + "_baslangic"]) || 1;
const AD = String(PROFIL.ad || "").trim() || "Alex"; // temel cümlelerdeki {ad}

// Kapı: seviye tespiti bitmeden kart turu yok (Kurallar → Seviye tespiti → Zorunlu)
if (String((dv.page("_kisisel/Profil") || {}).seviye_tespiti || "") !== "tamamlandi") {
  if (document.querySelector(".kr-kapi")) return; // aynı sayfadaki ikinci deste mesajı yinelemez
  const kapi = el("div", "kr-done kr-kapi", null, el("div", "kr-root", null, dv.container));
  kapi.style.position = "static"; // .kr-done kart sahnesinin içi için mutlak konumlu
  kapi.style.padding = "22px 12px";
  el("div", "kr-done-emoji", "🔒", kapi);
  el("div", "kr-done-title", "Kartlar seviye tespitinden sonra açılır", kapi);
  el("div", "kr-done-sub", "Önce nereden başlayacağını bulalım: Claude Code'da /seviye yaz.", kapi);
  return;
}

function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  if (parent) parent.appendChild(e);
  return e;
}

function yalit(e) {
  for (const t of ["keydown", "keyup", "mousedown", "mouseup", "click", "pointerdown", "pointerup", "touchstart"]) {
    e.addEventListener(t, (ev) => ev.stopPropagation());
  }
  return e;
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
    console.error("kartlar: okunamadı", yol, err);
    BOZUK.add(yol);
    bozukUyar(yol);
    return varsayilan;
  }
}
const bosMu = (o) => !o || (typeof o === "object" && !Object.keys(o).length);

function gunEkle(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function karistir(dizi) {
  const a = [...dizi];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Durum her açılışta diskten okunur; kayıtta sadece bu destenin kısmı diskteki dosyaya işlenir
const durum = await jsonOku(DURUM_YOLU, { kartlar: {}, planlar: {} });
durum.kartlar = durum.kartlar || {};
durum.planlar = durum.planlar || {};
const desteHam = new Map((await jsonOku(DESTE_YOLU, { kartlar: [] })).kartlar.map((k) => [k.id, k]));
for (const k of (await jsonOku(KISISEL_DESTE_YOLU, { kartlar: [] })).kartlar || []) desteHam.set(k.id, { ...(desteHam.get(k.id) || {}), ...k });
const adli = (s) => (typeof s === "string" ? s.replaceAll("{ad}", AD) : s);
const deste = [...desteHam.values()].filter((k) => k.deste === DESTE && !k.arsiv).map((k) => ({ ...k, de: adli(k.de), tr: adli(k.tr), ornek: adli(k.ornek), ornek_tr: adli(k.ornek_tr) }));
const kartById = Object.fromEntries(deste.map((k) => [k.id, k]));

function kd(id) {
  return (durum.kartlar[id] = durum.kartlar[id] || {});
}
const yesil = (id, yon) => kd(id)[yon]?.d === "yesil";
const ogrenildi = (id) => YONLER.every((y) => yesil(id, y));
const hatirlatmaZamani = (id) => ogrenildi(id) && kd(id).sonraki && kd(id).sonraki <= BUGUN;
const dinleniyor = (id) => !!durum.kartlar[id]?.inatci && durum.kartlar[id].inatci.donus > BUGUN;
// turu kırmızı bitmiş, bugünden önceki bir günden devreden kart
const devrediyor = (id) => !!durum.kartlar[id]?.devir && durum.kartlar[id].devir < BUGUN;
const kontrolKarti = (k) => !!k.seviye && k.seviye < BASLANGIC && !YONLER.some((y) => durum.kartlar[k.id]?.[y]);

// Tıklama sinyali (kelime destesi): son TIK_GUN günde sözlükte tıklanan kelimelerin kartları öne alınır (çok tıklanan önce).
// Günde, bütün turlar toplamında en fazla TIK_MAKS kart öne alınır (üst seviyeden gelenler dahil). Kart öğrenilince sinyal biter.
const TIK_GUN = 7;
const TIK_MAKS = 3;
const oncelik = new Map(); // kart id → tıklama puanı (son TIK_GUN gündeki tıklama sayısı)
if (DESTE === "kelime") {
  const tik = (await jsonOku("_kisisel/sozluk/tiklananlar.json", { kelimeler: {} })).kelimeler || {};
  const soz = { ...((await jsonOku("_sistem/sozluk/sozluk.json", { kelimeler: {} })).kelimeler || {}), ...((await jsonOku("_kisisel/sozluk/sozluk.json", { kelimeler: {} })).kelimeler || {}) };
  const taban = (s) => String(s || "").replace(/\s*\(.*?\)/g, "").split(",")[0].trim().replace(/^(der|die|das)\s+/i, "").toLowerCase();
  const kartTaban = new Map(deste.map((k) => [taban(k.de), k.id]));
  const bas = gunEkle(BUGUN, -TIK_GUN);
  for (const [w, e] of Object.entries(tik)) {
    // Balonda "✓ Biliyorum" denen kelime öne alınmaz; "⭐ Karta ekle" denen en öne geçer
    if (e.biliyor && e.biliyor >= (e.son || "")) continue;
    if (!e.istek && (!e.son || e.son < bas || e.son > BUGUN)) continue;
    const id = kartTaban.get(taban(e.kok || soz[w]?.kok)) || kartTaban.get(w);
    if (!id || ogrenildi(id)) continue;
    const gunluk = Object.entries(e.gunler || {}).filter(([g]) => g >= bas && g <= BUGUN);
    const puan = (gunluk.length ? gunluk.reduce((n, [, x]) => n + x, 0) : e.sayi || 1) + gunluk.length + (e.istek ? 10 : 0); // farklı günler ekstra sayılır
    oncelik.set(id, (oncelik.get(id) || 0) + puan);
  }
}
const tikSirasi = [...oncelik].sort((a, b) => b[1] - a[1]).map(([id]) => id);
// Bu seçimde öne alınabilecek kartlar: bugünkü plana daha önce öne alınarak girmemiş olanlardan, günlük sınırın kalanı kadar
let oneAl = new Set();
function oneAlHazirla(mevcutPlan) {
  const kullanilan = mevcutPlan.filter((p) => p.tik);
  const kalan = Math.max(0, TIK_MAKS - kullanilan.length);
  const gorulen = new Set(mevcutPlan.map((p) => p.id));
  oneAl = new Set(tikSirasi.filter((id) => !gorulen.has(id)).slice(0, kalan));
}
const tikOnce = (a, b) => (oneAl.has(b.id) ? oncelik.get(b.id) : 0) - (oneAl.has(a.id) ? oncelik.get(a.id) : 0);

function dinlendir(id) {
  const s = kd(id);
  s.inatci = { bas: BUGUN, donus: gunEkle(BUGUN, INATCI_ARA), kez: (s.inatci?.kez || 0) + 1 };
  s.sol_sayac = 0;
}

// eski kayıtlar: öğrenilmemiş kartların sola atılma sayısını sayaca taşı, eşiği geçenleri dinlendir
const kirli = new Set(); // bu oturumda değişen kartlar: kayıtta sadece bunlar diske işlenir
let gocVar = false;
for (const k of deste) {
  const s = durum.kartlar[k.id];
  if (!s || s.sol_sayac !== undefined || ogrenildi(k.id)) continue;
  const toplam = YONLER.reduce((t, y) => t + (s[y]?.sol || 0), 0);
  if (!toplam) continue;
  s.sol_sayac = toplam;
  if (toplam >= INATCI_ESIK) dinlendir(k.id);
  kirli.add(k.id);
  gocVar = true;
}

// Kelime ve cümle bölümleri (ve başka sekmeler) aynı dosyaya yazar: her kayıtta dosyayı yeniden oku, sadece bu oturumda
// değişen kartları (kart id'sine göre; `kirli` oturum boyunca birikir, küçük kalır) ve bu destenin o günkü planını işle. Boş kart kayıtları ve PLAN_SAKLA günden
// eski planlar silinir. Dosya okunamadıysa (BOZUK) hiç yazılmaz.
// Kuyruk sayfadaki bütün kart görünümleri için ortak: iki deste aynı anda okuyup yazınca sonraki öncekinin planını siliyordu.
const KUYRUK = (window.__almancaKartKuyruk = window.__almancaKartKuyruk || { son: Promise.resolve() });
function kaydet(...idler) {
  for (const id of idler) kirli.add(id);
  KUYRUK.son = KUYRUK.son.then(async () => {
    if (BOZUK.has(DURUM_YOLU)) return;
    const yazilacak = [...kirli];
    try {
      const disk = await jsonOku(DURUM_YOLU, { kartlar: {}, planlar: {} });
      if (BOZUK.has(DURUM_YOLU)) return;
      disk.kartlar = disk.kartlar || {};
      disk.planlar = disk.planlar || {};
      for (const id of yazilacak) {
        if (bosMu(durum.kartlar[id])) delete disk.kartlar[id];
        else disk.kartlar[id] = durum.kartlar[id];
      }
      for (const [id, v] of Object.entries(disk.kartlar)) if (bosMu(v)) delete disk.kartlar[id];
      disk.planlar[GUN] = disk.planlar[GUN] || {};
      disk.planlar[GUN][DESTE] = durum.planlar[GUN][DESTE];
      const sinir = gunEkle(BUGUN, -PLAN_SAKLA);
      for (const g of Object.keys(disk.planlar)) if (g < sinir && g !== GUN) delete disk.planlar[g];
      await adapter.write(DURUM_YOLU, JSON.stringify(disk, null, 1));
    } catch (err) {
      console.error("kartlar: kaydedilemedi", err);
    }
  });
}

// ---- kart seçimi ----
// Gruplar: kırmızı (takılan yön) · hatırlatma (zamanı gelmiş öğrenilmiş kart) · ikinci yön (Almanca → Türkçe
// yeşil, sıra Türkçe → Almanca'da) · yeni kart (her zaman Almanca → Türkçe ile başlar). Dinlenen kartlar gelmez.
// Seviyeli destelerde kolaydan zora: bir seviyenin kartlarının SEVIYE_ESIK kadarı öğrenilmeden
// bir üst seviyenin yeni ya da kırmızı kartları gelmez. Hatırlatmalar her seviyeden gelir.
function aktifSeviye() {
  const seviyeler = [...new Set(deste.map((k) => k.seviye).filter(Boolean))].sort((a, b) => a - b);
  if (!seviyeler.length) return Infinity;
  for (const s of seviyeler) {
    if (s < BASLANGIC) continue;
    const ks = deste.filter((k) => k.seviye === s);
    if (ks.filter((k) => ogrenildi(k.id)).length / ks.length < SEVIYE_ESIK) return s;
  }
  return Infinity;
}

function planSec(haric, tur, seviyeSiniri = aktifSeviye()) {
  const g = { kirmizi: [], devir: [], hatirlatma: [], ikinci: [], yeni: [], ust: [], kontrol: [] };
  deste.forEach((k, sira) => {
    if (haric.has(k.id) || dinleniyor(k.id)) return;
    const s = kd(k.id);
    if (ogrenildi(k.id)) {
      if (!hatirlatmaZamani(k.id)) return;
      // hatırlatmada daha uzun süredir görülmeyen yön gelir
      const yon = (s.de_tr?.son || "") <= (s.tr_de?.son || "") ? "de_tr" : "tr_de";
      g.hatirlatma.push({ id: k.id, yon, anahtar: s.sonraki || "", sira, tip: "hatirlatma" });
      return;
    }
    if (kontrolKarti(k)) {
      g.kontrol.push({ id: k.id, yon: "tr_de", anahtar: "", sira, tip: "kontrol" });
      return;
    }
    const kirmiziYon = YONLER.find((y) => s[y]?.d === "kirmizi");
    const [grup, a] = kirmiziYon
      ? ["kirmizi", { id: k.id, yon: kirmiziYon, anahtar: s[kirmiziYon].son || "", sira, tip: "tekrar" }]
      : yesil(k.id, "de_tr")
        ? ["ikinci", { id: k.id, yon: "tr_de", anahtar: s.de_tr.son || "", sira, tip: "yeni" }]
        : ["yeni", { id: k.id, yon: "de_tr", anahtar: "", sira, tip: "yeni" }];
    // üst seviyedeki kart sadece tıklandıysa gelebilir
    if (k.seviye && k.seviye > seviyeSiniri) {
      if (oneAl.has(k.id)) g.ust.push(a);
      return;
    }
    // dünkü (ya da daha önceki) turu kırmızı bitmiş kart: ilk sırada, kırmızı sınırına takılmadan
    if (grup === "kirmizi" && devrediyor(k.id)) g.devir.push({ ...a, ilk: true });
    else g[grup].push(a);
  });
  const eskiOnce = (a, b) => a.anahtar.localeCompare(b.anahtar) || a.sira - b.sira;
  g.kirmizi.sort((a, b) => tikOnce(a, b) || eskiOnce(a, b));
  g.devir.sort(eskiOnce);
  g.hatirlatma.sort(eskiOnce);
  g.ikinci.sort((a, b) => tikOnce(a, b) || eskiOnce(a, b));
  g.ust.sort(tikOnce);
  // yeni kartlar: sıklık sırası (sira alanı) varsa en sık kullanılan önce;
  // yoksa bir en son eklenen (günün teması), bir en eski bekleyen
  const yeniler = g.yeni.sort((a, b) => a.sira - b.sira);
  const yeniSira = [];
  const rutbe = (a) => deste[a.sira].sira;
  if (yeniler.length && yeniler.every((a) => rutbe(a))) yeniSira.push(...yeniler.sort((a, b) => rutbe(a) - rutbe(b)));
  else for (let bas = 0, son = yeniler.length - 1, sondan = true; bas <= son; sondan = !sondan) yeniSira.push(sondan ? yeniler[son--] : yeniler[bas++]);
  yeniSira.sort(tikOnce);

  // Sıra: tıklanan üst seviye kartları (günlük TIK_MAKS sınırı oneAl'da) → zamanı gelmiş hatırlatmalardan en az
  // HATIRLATMA_MIN tanesi (en eski vadeli önce) → devreden kırmızılar (yeni kartlara YENI_MIN yer bırakarak; %40 sınırı
  // bunları dışarıda bırakmaz) → kalan kırmızı sınırı kadar takılan kart → en az YENI_MIN yeni → kontrol kartları →
  // boş yerler: hatırlatma, ikinci yön, yeni, kırmızı.
  const al = (liste, n) => liste.splice(0, Math.max(0, Math.min(n, ADET - secilen.length)));
  const secilen = [];
  secilen.push(...al(g.ust, TIK_MAKS));
  secilen.push(...al(g.hatirlatma, HATIRLATMA_MIN));
  const devir = al(g.devir, Math.max(1, ADET - YENI_MIN - secilen.length));
  secilen.push(...devir);
  secilen.push(...al(g.kirmizi, KIRMIZI_MAKS - devir.length));
  secilen.push(...al(yeniSira, YENI_MIN));
  secilen.push(...al(karistir(g.kontrol), KONTROL_MAKS));
  for (const liste of [g.hatirlatma, g.ikinci, yeniSira, g.devir, g.kirmizi]) secilen.push(...al(liste, ADET));

  const plan = (liste) =>
    liste.map((a) => ({ id: a.id, yon: a.yon, tip: a.tip, tur, sonuc: null, gosterim: 0, sol: 0, ...(a.ilk ? { ilk: true } : {}), ...(oneAl.has(a.id) ? { tik: true } : {}) }));
  // karıştır ama devreden kartlar en önde kalsın
  const sirala = (liste) => {
    const k = karistir(liste);
    return [...k.filter((p) => p.ilk), ...k.filter((p) => !p.ilk)];
  };
  const enYuksek = Math.max(0, ...deste.map((k) => k.seviye || 0));
  if (secilen.length < ADET && seviyeSiniri < enYuksek) {
    const ek = planSec(new Set([...haric, ...secilen.map((a) => a.id)]), tur, seviyeSiniri + 1);
    return sirala([...plan(secilen), ...ek]).slice(0, ADET);
  }
  return sirala(plan(secilen));
}

durum.planlar[GUN] = durum.planlar[GUN] || {};
let plan = (durum.planlar[GUN][DESTE] || []).filter((p) => kartById[p.id]);
plan.forEach((p) => {
  p.tur = p.tur || 1;
  // eski biçimdeki planlar: kaç kez gösterildiğini sola/sağa atma sayısından çıkar
  if (p.gosterim === undefined) p.gosterim = (p.sol || 0) + (p.sonuc === "sag" ? 1 : 0);
});
if (!plan.length) {
  oneAlHazirla(plan);
  plan = planSec(new Set(), 1);
  kaydet();
} else if (gocVar) kaydet();
oneAlHazirla(plan); // rozetler ve sonraki turlar için: bugün öne alınanlar sınırdan düşülür
durum.planlar[GUN][DESTE] = plan;
let bugunlukYeter = false;

const aktifTur = () => Math.max(1, ...plan.map((p) => p.tur));
const turKartlari = () => plan.filter((p) => p.tur === aktifTur());

function kuyruk() {
  if (bugunlukYeter) return [];
  const t = turKartlari().filter((p) => !dinleniyor(p.id));
  // önce bu turda hiç görülmeyenler, sonra sola atılanlar (en uzun beklemiş olan önce, az önce atılan en sonda).
  // Bir kart bu turda MAKS_GOSTERIM kez geldiyse yarına kalır. Dinlenmeye çıkan kart bugün bir daha gelmez.
  const gorulmemis = t.filter((p) => !p.sonuc);
  const tekrar = t.filter((p) => p.sonuc === "sol" && (p.gosterim || 0) < MAKS_GOSTERIM).sort((a, b) => (a.zaman || 0) - (b.zaman || 0));
  return [...gorulmemis, ...tekrar];
}

// ---- çizim ----
const kok = el("div", "kr-root", null, dv.container);
yalit(kok);
const bas = el("div", "kr-head", null, kok);
el("div", "kr-title", DESTE === "kelime" ? "🃏 Kelime kartları" : "💬 Cümle kartları", bas);
const sagUst = el("div", "kr-head-right", null, bas);
const sayac = el("div", "kr-count", null, sagUst);
const yenileBtn = el("button", "kr-refresh", "↻ Yenile", sagUst);
yenileBtn.title = "Yeni bir tur kart getir";
const sahne = el("div", "kr-stage", null, kok);
const ekAlan = el("div", "kr-extra", null, kok);
const altBilgi = el("div", "kr-foot", null, kok);

function yeniTur() {
  const bugunGorulen = new Set(plan.map((p) => p.id));
  oneAlHazirla(plan);
  let yeni = planSec(bugunGorulen, aktifTur() + 1);
  // bugün hiç görülmemiş kart kalmadıysa bugünkü tekrar kartlarıyla yeni tur
  if (!yeni.length) {
    const kirmizilar = new Set(plan.filter((p) => !yesil(p.id, p.yon)).map((p) => p.id));
    yeni = planSec(new Set([...bugunGorulen].filter((id) => !kirmizilar.has(id))), aktifTur() + 1);
  }
  if (!yeni.length) {
    ekAlan.textContent = "";
    el("div", "kr-note", "Bugün getirilecek yeni kart kalmadı. Yarın hatırlatmalar ve yeni kartlar gelecek.", ekAlan);
    return;
  }
  plan.push(...yeni);
  bugunlukYeter = false;
  kaydet();
  kartCiz();
}
yenileBtn.addEventListener("click", yeniTur);

function istatistikCiz() {
  const t = turKartlari();
  const sag = t.filter((p) => p.sonuc === "sag").length;
  const sol = t.filter((p) => p.sonuc === "sol").length;
  sayac.textContent = (aktifTur() > 1 ? `${aktifTur()}. tur · ` : "") + `${sag} / ${t.length}` + (sol ? `  ·  🔁 ${sol}` : "");
  const ogrenilen = deste.filter((k) => ogrenildi(k.id)).length;
  const hatirlatma = deste.filter((k) => hatirlatmaZamani(k.id)).length;
  const dinlenen = deste.filter((k) => dinleniyor(k.id)).length;
  const sev = aktifSeviye();
  altBilgi.textContent =
    `Destede ${deste.length} kart · ${ogrenilen} öğrenildi` +
    (hatirlatma ? ` · ${hatirlatma} hatırlatma bekliyor` : "") +
    (dinlenen ? ` · 💤 ${dinlenen} kart dinleniyor` : "") +
    (sev !== Infinity ? ` · seviye ${sev}/${Math.max(...deste.map((k) => k.seviye || 0))}` : "");
}

// "die Miete, -n" → der/die/das renkli
function artikelli(parent, metin) {
  String(metin)
    .split(/\b(der|die|das)\b/)
    .forEach((parca, i) => {
      if (i % 2) el("span", "kr-art kr-art-" + parca, parca, parent);
      else if (parca) parent.appendChild(document.createTextNode(parca));
    });
}

// Türkçe → Almanca ipucu: "die Miete, -n" → "die M _ _ _ e"
function maske(de) {
  const ana = String(de).split(" / ")[0].split(",")[0].replace(/\s*\(.*?\)/g, "").trim();
  return ana
    .split(/\s+/)
    .map((w) => (/^(der|die|das|ein|einen|eine|sich)$/i.test(w) || w.length <= 2 ? w : w[0] + " _".repeat(w.length - 2) + " " + w[w.length - 1]))
    .join("   ");
}
let bildirim = null;

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
    const u = new SpeechSynthesisUtterance(metin.replace(/\s*\(.*?\)/g, "").replace(/,\s*(-\w*|die \w+)$/, ""));
    u.lang = "de-DE";
    u.rate = 0.92;
    const ses = enIyiSes();
    if (ses) u.voice = ses;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (err) {
    console.warn("kartlar: seslendirme yok", err);
  }
}

function bitisCiz() {
  sahne.textContent = "";
  const t = turKartlari();
  const kalan = t.filter((p) => p.sonuc === "sol" && !dinleniyor(p.id)).length;
  const dinlenen = t.filter((p) => dinleniyor(p.id)).length;
  const bilinen = t.filter((p) => p.sonuc === "sag").length;
  const b = el("div", "kr-done", null, sahne);
  el("div", "kr-done-emoji", kalan ? "💪" : "🎉", b);
  el("div", "kr-done-title", "Bu tur bitti!", b);
  el("div", "kr-done-sub", `${bilinen} kart bildin` + (kalan ? ` · ${kalan} kart yarın ilk sırada gelecek` : "") + (dinlenen ? ` · 💤 ${dinlenen} kart dinleniyor` : "") + ".", b);
  const dugmeler = el("div", "kr-done-actions", null, b);
  const yeni = el("button", "kr-pill", "↻ Yeni tur başlat", dugmeler);
  yeni.addEventListener("click", yeniTur);
  if (kalan && bugunlukYeter) {
    const geri = el("button", "kr-link", "Tekrarlara devam et", dugmeler);
    geri.addEventListener("click", () => {
      bugunlukYeter = false;
      kartCiz();
    });
  }
}

// Bir atış bitmeden (uçma animasyonu 260 ms) ikinci atış yok sayılır: çift tık ya da basılı tutulan ok tuşu
// bir hatırlatmayı iki aralık ilerletmesin, inatçı sayacını iki artırmasın.
let atiliyor = false;
function at(p, yon, kart) {
  if (atiliyor || !kart.isConnected) return;
  atiliyor = true;
  kart.classList.add(yon === "sag" ? "kr-fly-right" : "kr-fly-left");
  const s = kd(p.id);
  const y = (s[p.yon] = s[p.yon] || { d: null, sag: 0, sol: 0, son: "" });
  const onceOgrenilmis = ogrenildi(p.id);
  y.son = BUGUN;
  p.gosterim = (p.gosterim || 0) + 1;
  if (p.tip === "kontrol") s.kontrol = BUGUN;
  if (yon === "sag") {
    y.d = "yesil";
    y.sag++;
    p.sonuc = "sag";
    delete s.devir;
    if (p.tip === "kontrol" && !onceOgrenilmis) {
      // geçilen seviyeden bir kartı üretebildi: öğrenilmiş say, ilk hatırlatma 5 gün sonra
      for (const o of YONLER) if (o !== p.yon) s[o] = { d: "yesil", sag: 1, sol: 0, son: BUGUN };
      s.kutu = 2;
      s.sonraki = gunEkle(BUGUN, ARALIK[2]);
      s.sol_sayac = 0;
      if (!s.tamam) s.tamam = BUGUN;
    } else if (onceOgrenilmis) {
      // hatırlatmayı bildi: bir sonraki aralığa geç
      s.kutu = Math.min(5, (s.kutu || 1) + 1);
      s.sonraki = gunEkle(BUGUN, ARALIK[s.kutu]);
    } else if (ogrenildi(p.id)) {
      // iki yön de yeşil: ilk hatırlatma 2 gün sonra
      s.kutu = 1;
      s.sonraki = gunEkle(BUGUN, ARALIK[1]);
      s.sol_sayac = 0;
      if (!s.tamam) s.tamam = BUGUN;
    }
  } else {
    y.d = "kirmizi";
    y.sol++;
    p.sonuc = "sol";
    p.sol = (p.sol || 0) + 1;
    p.zaman = Date.now();
    // gün sonunda hâlâ kırmızıysa ertesi gün ilk sırada gelir (sağa atılınca silinir)
    s.devir = BUGUN;
    // hatırlatmada unutuldu: yeniden öğrenilecek, iki yön yeşil olunca aralıklar baştan başlar
    delete s.kutu;
    delete s.sonraki;
    s.sol_sayac = (s.sol_sayac || 0) + 1;
    if (s.sol_sayac >= INATCI_ESIK) {
      dinlendir(p.id);
      delete s.devir;
      bildirim = kartById[p.id].de;
    }
  }
  kaydet(p.id);
  setTimeout(kartCiz, 260);
}

function kartCiz() {
  atiliyor = false;
  istatistikCiz();
  sahne.textContent = "";
  ekAlan.textContent = "";
  if (bildirim) {
    el("div", "kr-note kr-rest", `💤 „${bildirim}" ${INATCI_ARA} gün dinlenmeye çıktı. Bu arada antrenmanda bir alıştırmada karşına çıkacak.`, ekAlan);
    bildirim = null;
  }
  const q = kuyruk();
  if (!q.length) return bitisCiz();

  if (q[1]) el("div", "kr-card kr-behind", null, sahne);

  const p = q[0];
  const k = kartById[p.id];
  const onYuz = p.yon === "de_tr" ? k.de : k.tr;
  const arkaYuz = p.yon === "de_tr" ? k.tr : k.de;

  const kart = el("div", "kr-card" + (p.sonuc === "sol" ? " kr-again" : ""), null, sahne);
  kart.tabIndex = 0;
  const ust = el("div", "kr-card-top", null, kart);
  el("span", "kr-dir", p.yon === "de_tr" ? "🇩🇪 → 🇹🇷" : "🇹🇷 → 🇩🇪", ust);
  if (p.sonuc === "sol") el("span", "kr-again-badge", `tekrar ${p.gosterim}/${MAKS_GOSTERIM}`, ust);
  else if (p.tip === "hatirlatma") el("span", "kr-remind-badge", "🧠 hatırlatma", ust);
  else if (p.tip === "kontrol") el("span", "kr-test-badge", "🧪 kontrol", ust);
  else if (p.tip === "tekrar") el("span", "kr-again-badge", "dünden", ust);
  else if (YONLER.some((o) => o !== p.yon && yesil(p.id, o))) el("span", "kr-half-badge", "½ öğrenildi", ust);
  if (p.tik && p.sonuc !== "sol") el("span", "kr-tik-badge", "🔍 tıkladın", ust);

  const almancaOnde = p.yon === "de_tr";
  const yuz = el("div", "kr-face", null, kart);
  const on = el("div", "kr-front" + (DESTE === "cumle" ? " kr-sentence" : ""), null, yuz);
  if (almancaOnde) artikelli(on, onYuz);
  else on.textContent = onYuz;
  const arka = el("div", "kr-back", null, yuz);
  const cevap = el("div", "kr-answer" + (DESTE === "cumle" ? " kr-sentence" : ""), null, arka);
  if (almancaOnde) cevap.textContent = arkaYuz;
  else artikelli(cevap, arkaYuz);
  if (k.ornek) {
    const ornek = el("div", "kr-example", null, arka);
    const satir = el("div", "kr-ex-de", k.ornek, ornek);
    if (window.speechSynthesis) {
      const dinle = el("button", "kr-ex-speak", "🔊", satir);
      dinle.title = "Örnek cümleyi dinle";
      dinle.addEventListener("click", (e) => {
        e.stopPropagation();
        seslendir(k.ornek);
      });
    }
    if (k.ornek_tr) el("div", "kr-ex-tr", k.ornek_tr, ornek);
  }
  if (k.kanca) el("div", "kr-hook", "💡 " + k.kanca, arka);
  const ipucu = el("div", "kr-tap", "Cevabı görmek için karta dokun", kart);

  // Türkçe → Almanca yönünde istenirse ilk ve son harfler
  if (!almancaOnde && DESTE === "kelime") {
    const ipucuBtn = el("button", "kr-hint-btn", "💡 ipucu", kart);
    ipucuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      ipucuBtn.remove();
      on.insertAdjacentElement("afterend", el("div", "kr-hint", maske(k.de)));
    });
  }

  if (window.speechSynthesis) {
    const hoparlor = el("button", "kr-speak", "🔊", kart);
    hoparlor.title = "Almancasını dinle";
    hoparlor.addEventListener("click", (e) => {
      e.stopPropagation();
      seslendir(k.de);
    });
  }

  const sagEtiket = el("div", "kr-stamp kr-stamp-yes", "BİLİYORUM", kart);
  const solEtiket = el("div", "kr-stamp kr-stamp-no", "TEKRAR", kart);

  let acik = false;
  function cevir() {
    acik = !acik;
    kart.classList.toggle("kr-open", acik);
    kart.querySelector(".kr-hint-btn")?.remove();
    ipucu.textContent = acik ? "Bildin mi? Sağa ya da sola at" : "Cevabı görmek için karta dokun";
  }

  let basX = null;
  let dx = 0;
  let surukledi = false;
  kart.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    basX = e.clientX;
    dx = 0;
    surukledi = false;
    kart.setPointerCapture?.(e.pointerId);
    kart.classList.add("kr-dragging");
  });
  kart.addEventListener("pointermove", (e) => {
    if (basX === null) return;
    dx = e.clientX - basX;
    if (Math.abs(dx) > 6) surukledi = true;
    kart.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    const oran = Math.min(1, Math.abs(dx) / 110);
    sagEtiket.style.opacity = dx > 0 ? oran : 0;
    solEtiket.style.opacity = dx < 0 ? oran : 0;
  });
  const birak = () => {
    if (basX === null) return;
    basX = null;
    kart.classList.remove("kr-dragging");
    if (dx > 110) return at(p, "sag", kart);
    if (dx < -110) return at(p, "sol", kart);
    kart.style.transform = "";
    sagEtiket.style.opacity = 0;
    solEtiket.style.opacity = 0;
    if (!surukledi) cevir();
  };
  kart.addEventListener("pointerup", birak);
  kart.addEventListener("pointercancel", birak);
  kart.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") at(p, "sag", kart);
    else if (e.key === "ArrowLeft") at(p, "sol", kart);
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      cevir();
    }
  });

  const dugmeler = el("div", "kr-buttons", null, sahne);
  const hayir = el("button", "kr-btn kr-btn-no", "✗", dugmeler);
  hayir.title = "Bilmiyorum, tekrar gelsin (←)";
  const cevirBtn = el("button", "kr-btn kr-btn-flip", "↻", dugmeler);
  cevirBtn.title = "Çevir (boşluk)";
  const evet = el("button", "kr-btn kr-btn-yes", "✓", dugmeler);
  evet.title = "Biliyorum (→)";
  hayir.addEventListener("click", () => at(p, "sol", kart));
  evet.addEventListener("click", () => at(p, "sag", kart));
  cevirBtn.addEventListener("click", cevir);

  if (q.every((x) => x.sonuc === "sol")) {
    const yeter = el("button", "kr-link", `Kalan ${q.length} tekrar kartını yarına bırak`, ekAlan);
    yeter.addEventListener("click", () => {
      bugunlukYeter = true;
      kartCiz();
    });
  }
}

if (!deste.length) {
  el("div", "kr-done-sub", "Bu destede henüz kart yok.", sahne);
} else {
  kartCiz();
}
