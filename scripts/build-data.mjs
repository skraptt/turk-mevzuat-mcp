// sources/*.txt içindeki kanun metinlerini maddelere ayırır ve data/mevzuat.json üretir.
// Metinler mevzuat.gov.tr'deki "Kanun Numarası / Kabul Tarihi / Resmî Gazete" künyeli
// düz metin biçimindedir (ayrıştırıcı: scripts/lib/parse.mjs). Her kanunun metin tarihi
// ve son kontrol günü data/sources.json'dan okunur; o dosyayı scripts/refresh.mjs günceller.
//
//   node scripts/build-data.mjs

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAWS, mevzuatUrl, TUR_ADI } from './laws.mjs';
import { buildIndex, encodeIndex } from '../src/engine.mjs';
import { parseKanun } from './lib/parse.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'data', 'sources.json'), 'utf8'));
// Genel tarih: kanunların en son karşılaştırıldığı gün (her kanunun kendi tarihi ayrıca tutulur).
const snapshot = Object.values(manifest).map((m) => m.sonKontrol).filter(Boolean).sort().at(-1);


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
    resmiGazete: { tarih: meta.rgTarih || kunye.rgTarih, sayi: meta.rgSayi || kunye.rgSayi || null },
    url: mevzuatUrl(no, meta.tertip, meta.tur),
    tur: TUR_ADI[meta.tur || 1],
    metinTarihi: manifest[no]?.metinTarihi || snapshot,
    sonKontrol: manifest[no]?.sonKontrol || manifest[no]?.metinTarihi || snapshot,
    maddeSayisi: unique.length,
  });
  for (const m of unique) articles.push({ k: no, m: m.madde, b: m.baslik, y: m.bolum, t: m.metin, ...(m.dipnotlar.length ? { d: m.dipnotlar } : {}) });
  console.log(
    `${no.padEnd(5)} ${meta.abbr.padEnd(13)} ${String(unique.length).padStart(5)} madde` +
      (dropped ? `  (${dropped} tekrar atıldı)` : '') +
      (empty ? `  ⚠ ${empty} boş` : '') +
      (!kunye.rgTarih && !meta.rgTarih ? '  ⚠ RG tarihi yok' : ''),
  );
}

mkdirSync(join(root, 'data'), { recursive: true });
const index = encodeIndex(buildIndex(articles));
const data = { snapshot, laws, articles, index };
writeFileSync(join(root, 'data', 'mevzuat.json'), JSON.stringify(data));
console.log(`✓ ${laws.length} kanun, ${articles.length} madde → data/mevzuat.json (${(JSON.stringify(data).length / 1e6).toFixed(1)} MB)`);
if (problems) process.exitCode = 1;
