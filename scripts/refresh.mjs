// Kanun metinlerini mevzuat.gov.tr'deki güncel hâlleriyle karşılaştırır.
//
//   node scripts/refresh.mjs [--only 6098,6502] [--dry-run] [--report rapor.md] [--html-dir klasör]
//
// Her kanun için: tam metin sayfası indirilir → düz metne çevrilir → maddelere ayrılır →
// sources/ içindeki mevcut metinle madde madde karşılaştırılır.
//   • Fark yoksa data/sources.json'daki "sonKontrol" bugüne çekilir.
//   • Fark varsa yeni metin sources/ klasörüne yazılır, "metinTarihi" bugün olur ve
//     değişen maddeler rapora eklenir. Raporu bir insan inceleyip onaylar (GitHub PR).
//   • Sayfa alınamaz, beklenen kanun çıkmaz ya da madde sayısı şüpheli biçimde düşerse
//     o kanuna dokunulmaz ve hata rapor edilir (emniyet freni).
//
// Çıkış kodu: 0 = sorun yok, 1 = en az bir kanunda hata. Özet, GITHUB_OUTPUT tanımlıysa
// oraya da yazılır (changed=true/false, failed=true/false).

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { LAWS, metinUrl } from './laws.mjs';
import { htmlToText, extractDocument } from './lib/html.mjs';
import { parseKanun } from './lib/parse.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER_AGENT = 'turk-mevzuat-mcp/0.4 (+https://github.com/skraptt/turk-mevzuat-mcp)';
// Yeni metinde madde sayısı bu oranın altına düşerse metin kabul edilmez.
const MIN_RATIO = 0.95;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

// İki ayrıştırılmış metni madde madde karşılaştırır.
export function compareArticles(oldList, newList) {
  const first = (list) => {
    const m = new Map();
    for (const a of list) if (!m.has(a.madde)) m.set(a.madde, a); // tekrar edenlerde ilki asıldır
    return m;
  };
  const A = first(oldList);
  const B = first(newList);
  const eklenen = [];
  const cikan = [];
  const degisen = [];
  let yalnizDipnot = 0;
  for (const [no, b] of B) {
    const a = A.get(no);
    if (!a) {
      eklenen.push(b);
      continue;
    }
    const metin = norm(a.metin) !== norm(b.metin);
    const baslik = norm(a.baslik) !== norm(b.baslik);
    const dipnot = norm(a.dipnotlar.join('\n')) !== norm(b.dipnotlar.join('\n'));
    if (metin || baslik) degisen.push({ madde: no, eski: a, yeni: b, metin, baslik, dipnot });
    else if (dipnot) yalnizDipnot++;
  }
  for (const [no, a] of A) if (!B.has(no)) cikan.push(a);
  // Bölüm yolu değişiklikleri (yeniden numaralanan başlıklar) metin değişikliği sayılmaz.
  return { eklenen, cikan, degisen, yalnizDipnot, ayni: !eklenen.length && !cikan.length && !degisen.length && !yalnizDipnot };
}

// Kısa bir fark gösterimi: ilk farklı noktanın çevresi.
export function excerpt(oldText, newText, context = 60) {
  const a = norm(oldText);
  const b = norm(newText);
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  const from = Math.max(0, i - context);
  const show = (s) => {
    const end = Math.min(s.length, s.length - j + context);
    const mid = s.slice(from, end);
    // Çok uzun farkları kısalt.
    const short = mid.length > 400 ? `${mid.slice(0, 300)} … ${mid.slice(-80)}` : mid;
    return (from ? '…' : '') + short + (end < s.length ? '…' : '');
  };
  return { eski: show(a), yeni: show(b) };
}

async function download(url, { tries = 3 } = {}) {
  let last;
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      last = err;
      if (t < tries) await new Promise((r) => setTimeout(r, 5000 * t));
    }
  }
  throw new Error(`indirilemedi (${tries} deneme): ${last?.message}`);
}

// Tek bir kanunu denetler. Dosya yazmaz; sonucu döndürür.
export function checkLaw(law, html, oldText) {
  if (!extractDocument(html)) throw new Error('sayfada kanun metni bulunamadı (sayfa yapısı değişmiş olabilir)');
  const text = htmlToText(html);
  const parsed = parseKanun(text, `${law.no}.txt`);
  if (parsed.no !== law.no) throw new Error(`sayfadaki kanun numarası ${parsed.no}, beklenen ${law.no}`);
  const old = parseKanun(oldText, `${law.no}.txt`);
  const n = new Set(parsed.maddeler.map((m) => m.madde)).size;
  const o = new Set(old.maddeler.map((m) => m.madde)).size;
  if (n < o * MIN_RATIO) throw new Error(`madde sayısı ${o} → ${n}; şüpheli düşüş, metin kabul edilmedi`);
  const empty = parsed.maddeler.filter((m) => !m.metin).length;
  if (empty > Math.max(2, n * 0.02)) throw new Error(`${empty} madde boş çıktı; ayrıştırma sorunu olabilir`);
  return { text, maddeSayisi: n, eskiMaddeSayisi: o, fark: compareArticles(old.maddeler, parsed.maddeler) };
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function renderReport({ today, results, abbrOf }) {
  const changed = results.filter((r) => r.durum === 'değişti');
  const failed = results.filter((r) => r.durum === 'hata');
  const lines = [`# Mevzuat güncelleme raporu (${today})`, ''];
  lines.push(
    `${results.length} kanun kontrol edildi: ${changed.length} kanunda değişiklik, ` +
      `${results.filter((r) => r.durum === 'aynı').length} kanun aynı, ${failed.length} hata.`,
    '',
  );
  if (failed.length) {
    lines.push('## Hatalar', '', 'Bu kanunlara dokunulmadı; mevcut metin kullanılmaya devam ediyor.', '');
    for (const r of failed) lines.push(`- **${abbrOf(r.no)}** (${r.no}): ${r.hata}`);
    lines.push('');
  }
  for (const r of changed) {
    const f = r.fark;
    lines.push(`## ${abbrOf(r.no)} (${r.no} sayılı)`, '');
    lines.push(
      `Madde sayısı ${r.eskiMaddeSayisi} → ${r.maddeSayisi}. ` +
        `Değişen: ${f.degisen.length}, eklenen: ${f.eklenen.length}, çıkan: ${f.cikan.length}` +
        (f.yalnizDipnot ? `, yalnız dipnotu değişen: ${f.yalnizDipnot}` : '') + '.',
      '',
    );
    if (f.eklenen.length) lines.push(`**Eklenen maddeler:** ${f.eklenen.map((m) => m.madde).join(', ')}`, '');
    if (f.cikan.length) lines.push(`**Metinden çıkan maddeler:** ${f.cikan.map((m) => m.madde).join(', ')}`, '');
    const shown = f.degisen.slice(0, 25);
    for (const d of shown) {
      const what = [d.metin && 'metin', d.baslik && 'başlık', d.dipnot && 'dipnot'].filter(Boolean).join(', ');
      lines.push(`<details><summary>m. ${d.madde}${d.yeni.baslik ? ` (${d.yeni.baslik})` : ''}: ${what}</summary>`, '');
      if (d.baslik) lines.push(`Başlık: “${norm(d.eski.baslik)}” → “${norm(d.yeni.baslik)}”`, '');
      if (d.metin) {
        const x = excerpt(d.eski.metin, d.yeni.metin);
        lines.push('```diff', `- ${x.eski}`, `+ ${x.yeni}`, '```', '');
      }
      lines.push('</details>', '');
    }
    if (f.degisen.length > shown.length) lines.push(`…ve ${f.degisen.length - shown.length} madde daha (tamamı için dosya farkına bakın).`, '');
  }
  if (changed.length) {
    lines.push(
      '---',
      'Bu PR otomatik olarak açıldı. Birleştirmeden önce değişikliklerin mevzuat.gov.tr ile uyumlu',
      'olduğunu ve ayrıştırmanın bozulmadığını kontrol edin. Birleştirildiğinde sunucu yeniden yayımlanır.',
    );
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : null;
  };
  const dryRun = process.argv.includes('--dry-run');
  const only = arg('--only')?.split(',');
  const htmlDir = arg('--html-dir'); // test ve elle denetim için: {no}.html dosyalarını kullan
  const reportPath = arg('--report') || join(root, 'refresh-report.md');
  const today = arg('--today') || new Date().toISOString().slice(0, 10);

  const manifestPath = join(root, 'data', 'sources.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const abbrOf = (no) => LAWS.find((l) => l.no === no)?.abbr || no;
  const results = [];

  for (const law of LAWS) {
    if (only && !only.includes(law.no)) continue;
    const entry = manifest[law.no];
    const r = { no: law.no };
    try {
      if (!entry?.dosya) throw new Error('data/sources.json içinde kaydı yok');
      const file = join(root, 'sources', entry.dosya);
      const html = htmlDir ? readFileSync(join(htmlDir, `${law.no}.html`), 'utf8') : await download(metinUrl(law.no, law.tertip));
      const res = checkLaw(law, html, existsSync(file) ? readFileSync(file, 'utf8') : ''); // yeni kanunda dosya henüz yok
      Object.assign(r, res);
      if (res.fark.ayni) {
        r.durum = 'aynı';
        entry.sonKontrol = today;
      } else {
        r.durum = 'değişti';
        if (!dryRun) writeFileSync(file, res.text);
        Object.assign(entry, { metinTarihi: today, sonKontrol: today, kaynak: 'mevzuat.gov.tr', sha256: sha256(res.text), maddeSayisi: res.maddeSayisi });
      }
    } catch (err) {
      r.durum = 'hata';
      r.hata = err.message;
    }
    delete r.text;
    results.push(r);
    console.log(`${law.no.padEnd(5)} ${abbrOf(law.no).padEnd(13)} ${r.durum}` +
      (r.durum === 'değişti' ? `  (${r.fark.degisen.length} değişen, ${r.fark.eklenen.length} eklenen, ${r.fark.cikan.length} çıkan, ${r.fark.yalnizDipnot} dipnot)` : '') +
      (r.hata ? `  ${r.hata}` : ''));
    if (!htmlDir) await new Promise((res) => setTimeout(res, 2000)); // siteye nazik ol
  }

  if (!dryRun) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(reportPath, renderReport({ today, results, abbrOf }));

  const changed = results.some((r) => r.durum === 'değişti');
  const failed = results.some((r) => r.durum === 'hata');
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nfailed=${failed}\nchanged_laws=${results.filter((r) => r.durum === 'değişti').map((r) => abbrOf(r.no)).join(', ')}\n`);
  }
  console.log(`\n${changed ? 'Değişiklik var' : 'Değişiklik yok'}${failed ? ', hata var' : ''}. Rapor: ${reportPath}`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
