// sources/*.txt içindeki kanun metinlerini maddelere ayırır ve data/mevzuat.json üretir.
// Metinler mevzuat.gov.tr'deki "Kanun Numarası / Kabul Tarihi / Resmî Gazete" künyeli
// düz metin biçimindedir. Ayrıştırma mantığı mikeTR'deki import-kanunlar.ts'den alınmıştır.
//
//   node scripts/build-data.mjs [--snapshot YYYY-MM-DD]

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAWS, mevzuatUrl } from './laws.mjs';
import { buildIndex, encodeIndex } from '../src/engine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argSnap = process.argv.indexOf('--snapshot');
// Metinlerin mevzuat.gov.tr'den alındığı (ya da en son karşılaştırıldığı) tarih.
const snapshot = argSnap > -1 ? process.argv[argSnap + 1] : '2026-10-10';

// "MADDE 1-", "Madde 1 –", "Geçici Madde 2-", "EK MADDE 3 –", "Madde 1/A –", "MADDE 146 ila 149 –"
const HEADING = /^\s*(?:(ge[çÇ][iİ]c[iİ]|ek)\s+)?madde\s+(\d+(?:\/[a-zçğıöşü])?)(?:\s+ila\s+(\d+))?\s*[-–—]\s*/iu;

function isTitleLine(line) {
  const t = line.trim();
  // "2. Nutuklar:" gibi iki nokta ile biten numaralı başlıklar da başlıktır.
  if (/^(?:[IVX]+|[A-ZÇĞİÖŞÜ]|\d+|[a-zçğıöşü]{1,3})[.)-]\s+\S.{0,80}:$/u.test(t)) return true;
  return t.length > 0 && t.length < 150 && !/[.:;,]$/.test(t) && !/^\(\d+\)/.test(t);
}

function readKunye(lines) {
  const field = (re) => lines.find((l) => re.test(l));
  const kabul = field(/Kabul Tarihi/i)?.split(':').slice(1).join(':').trim() || null;
  const rgLine = field(/Yayımlandığı Resm[îi] Gazete/i) || '';
  const tarih = rgLine.match(/Tarihi?\s*:\s*([\d/.]+)/i)?.[1] || null;
  const sayi = rgLine.match(/Sayı\s*:\s*(\d+)/i)?.[1] || null;
  const fmt = (d) => (d ? d.split(/[/.]/).map((p) => p.padStart(2, '0')).join('.') : null);
  return { kabul: fmt(kabul), rgTarih: fmt(tarih), rgSayi: sayi };
}

function parseKanun(text, fileName) {
  const allLines = text.replace(/\r\n?/g, '\n').split('\n');
  const tailStart = allLines.findIndex((l) => /İŞLENEMEYEN HÜKÜMLER|DEĞİŞİKLİK GETİREN MEVZUATIN/u.test(l));
  const lines = tailStart === -1 ? allLines : allLines.slice(0, tailStart);

  const noLine = lines.find((l) => /^\s*Kanun Numarası\s*:/i.test(l));
  const no = noLine?.split(':')[1]?.trim() || fileName.match(/^(\d+)/)?.[1];
  if (!no) throw new Error(`${fileName}: kanun numarası bulunamadı`);

  const headingIdx = lines.flatMap((l, i) => (HEADING.test(l) ? [i] : []));
  const out = [];
  let pendingTitle = [];
  for (let i = (headingIdx[0] ?? 0) - 1; i >= 0 && isTitleLine(lines[i]); i--) pendingTitle.unshift(lines[i].trim());

  for (let h = 0; h < headingIdx.length; h++) {
    const start = headingIdx[h];
    const end = h + 1 < headingIdx.length ? headingIdx[h + 1] : lines.length;
    const m = lines[start].match(HEADING);
    const prefix = m[1] ? (/^ek$/i.test(m[1]) ? 'Ek ' : 'Geçici ') : '';
    const madde = prefix + m[2].toLocaleUpperCase('tr-TR') + (m[3] ? `-${m[3]}` : '');

    const body = [lines[start].slice(m[0].length), ...lines.slice(start + 1, end)];
    while (body.length && !body[body.length - 1].trim()) body.pop();
    const nextTitle = [];
    if (h + 1 < headingIdx.length) {
      while (body.length > 1 && isTitleLine(body[body.length - 1])) {
        nextTitle.unshift(body.pop().trim());
        while (body.length && !body[body.length - 1].trim()) body.pop();
      }
    }
    // U+FFFC: kaynak metinde dipnot işaretinin yerinde kalan nesne karakteri.
    const metin = body.map((l) => l.replace(/\uFFFC/g, '').trim()).filter(Boolean).join('\n');
    // Başlık sonundaki dipnot numaralarını at: "Belirlenmesi2" → "Belirlenmesi".
    const baslik =
      pendingTitle
        .slice(-2)
        .map((t) => t.replace(/\uFFFC/g, '').replace(/:$/, '').replace(/([a-zçğıöşüâîû)])\d{1,2}$/iu, '$1').trim())
        .join(' / ') || null;
    out.push({ madde, baslik, metin });
    pendingTitle = nextTitle;
  }
  return { no, kunye: readKunye(lines), maddeler: out };
}

const files = readdirSync(join(root, 'sources')).filter((f) => f.endsWith('.txt')).sort();
const laws = [];
const articles = [];
let problems = 0;

for (const file of files) {
  const { no, kunye, maddeler } = parseKanun(readFileSync(join(root, 'sources', file), 'utf8'), file);
  const meta = LAWS.find((l) => l.no === no);
  if (!meta) {
    console.warn(`! ${file}: ${no} scripts/laws.mjs içinde tanımlı değil, atlanıyor`);
    problems++;
    continue;
  }
  // Aynı numara tekrar ederse ilk geçen asıl maddedir; sonrakiler değişiklik metinlerinden alıntıdır.
  const seen = new Set();
  const unique = maddeler.filter((m) => (seen.has(m.madde) ? false : seen.add(m.madde)));
  const dropped = maddeler.length - unique.length;
  const empty = unique.filter((m) => !m.metin).length;
  laws.push({
    no,
    name: meta.name,
    abbr: meta.abbr,
    aliases: meta.aliases,
    kabulTarihi: kunye.kabul,
    resmiGazete: { tarih: meta.rgTarih || kunye.rgTarih, sayi: meta.rgSayi || kunye.rgSayi },
    url: mevzuatUrl(no, meta.tertip),
    maddeSayisi: unique.length,
  });
  for (const m of unique) articles.push({ k: no, m: m.madde, b: m.baslik, t: m.metin });
  console.log(
    `${no.padEnd(5)} ${meta.abbr.padEnd(13)} ${String(unique.length).padStart(5)} madde` +
      (dropped ? `  (${dropped} tekrar atıldı)` : '') +
      (empty ? `  ⚠ ${empty} boş` : '') +
      (!kunye.rgTarih ? '  ⚠ RG tarihi yok' : ''),
  );
}

mkdirSync(join(root, 'data'), { recursive: true });
const index = encodeIndex(buildIndex(articles));
const data = { snapshot, laws, articles, index };
writeFileSync(join(root, 'data', 'mevzuat.json'), JSON.stringify(data));
console.log(`✓ ${laws.length} kanun, ${articles.length} madde → data/mevzuat.json (${(JSON.stringify(data).length / 1e6).toFixed(1)} MB)`);
if (problems) process.exitCode = 1;
