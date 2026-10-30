// Arama kalitesini ölçer: npm run eval  (ayrıntı için: npm run eval -- --ayrinti)
//
// İki küme vardır:
//   gelistirme — sıralama ve kavram dizini ayarlanırken bakılan sorular.
//   kor        — ayarlama sırasında BAKILMAYAN sorular. Yalnızca sonuç ölçülür; bir değişiklik
//                buradaki bir soruyu düzeltmek için yapılmamalı. Aşırı uyumu (overfitting) yakalar.
// Her soru için kabul edilebilir maddeler (kanunNo/madde) ve bir kategori verilir:
//   eski      — ilk sürümdeki 16 kanunluk set
//   teknik    — hukukçu diliyle sorulmuş
//   gundelik  — vatandaş diliyle sorulmuş
// Ölçütler: ilk 1, ilk 3 isabet ve MRR@5 (ilk doğru sonucun sırasının tersi, ortalama).
// Beklenen maddeler data/mevzuat.json'daki başlık ve metinle tek tek doğrulanmıştır.

import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';
import { gelistirme, kor } from './eval-cases.mjs';
import { dequantize, nearest } from '../src/semantic.mjs';

const e = createEngine(JSON.parse(readFileSync(new URL('../data/mevzuat.json', import.meta.url), 'utf8')));
const arg = (n) => { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1]; };
const ayrinti = process.argv.includes('--ayrinti');

// --vektor DOSYA: anlamsal aramayı yerel vektör önbelleğiyle (scripts/embed.mjs) ölçer.
// --anlam W, --sozcuk W, --rrf K: birleştirme ağırlıkları.
const vektor = arg('--vektor');
let store = null;
let qvec = null;
if (vektor) {
  const c = JSON.parse(readFileSync(vektor, 'utf8'));
  store = new Map(Object.entries(c.maddeler).map(([id, v]) => [id, dequantize(v)]));
  qvec = new Map(Object.entries(c.sorgular || {}).map(([q, v]) => [q, dequantize(v)]));
}
const fusion = { k: +(arg('--rrf') ?? 60), sozcuk: +(arg('--sozcuk') ?? 1), anlam: +(arg('--anlam') ?? 1) };
const yalnizAnlam = process.argv.includes('--yalniz-anlam');
const semantikOf = (q) => {
  if (!store) return null;
  const v = qvec.get(q);
  if (!v) throw new Error(`Sorgu vektörü önbellekte yok: ${q} (scripts/embed.mjs --sorgular ile hesaplayın)`);
  return nearest(store, v, { topK: 30 });
};

function olc(ad, cases) {
  const by = {};
  const add = (k, r) => { const s = (by[k] ??= { n: 0, t1: 0, t3: 0, rr: 0 }); s.n++; s.t1 += r === 1; s.t3 += r > 0 && r <= 3; s.rr += r ? 1 / r : 0; };
  if (ayrinti) console.log(`\n— ${ad} —`);
  for (const [q, ok, kat] of cases) {
    const sem = semantikOf(q);
    const ids = yalnizAnlam ? sem.slice(0, 5) : e.search({ sorgu: q, limit: 5, semantik: sem, fusion }).sonuclar.map((x) => x.kimlik);
    const i = ids.findIndex((x) => ok.includes(x));
    const r = i === -1 ? 0 : i + 1;
    add('toplam', r); add(kat, r);
    if (ayrinti) console.log(r === 1 ? '✓' : r && r <= 3 ? '~' : r ? '·' : '✗', q.padEnd(58), ids.slice(0, 3).join('  '));
  }
  const satir = (k, s) => `  ${k.padEnd(10)} ${String(s.n).padStart(3)} soru   ilk 1: ${(100 * s.t1 / s.n).toFixed(0).padStart(3)}%   ilk 3: ${(100 * s.t3 / s.n).toFixed(0).padStart(3)}%   MRR@5: ${(s.rr / s.n).toFixed(3)}`;
  console.log(`\n${ad}`);
  for (const k of ['toplam', 'eski', 'teknik', 'gundelik']) if (by[k]) console.log(satir(k, by[k]));
  return by.toplam;
}

olc('gelistirme', gelistirme);
olc('kor', kor);
