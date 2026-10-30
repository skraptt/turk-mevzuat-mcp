// Madde vektörlerini hesaplar ve Cloudflare Vectorize'a yükler. GitHub Actions'ta,
// yayımlamadan önce çalışır (deploy.yml).
//
//   node scripts/embed.mjs --cache .vektor [--sorgular] [--upload]
//
// Önbellek (.vektor/vectors.json) her maddenin metin özetini ve int8'e nicelenmiş
// vektörünü tutar; yalnızca değişen ya da yeni maddeler yeniden hesaplanır. Önbellek
// ayrı bir dalda (vektor-onbellek) saklanır.
//   --sorgular  ölçüm setindeki soruların vektörlerini de hesaplar (npm run eval -- --vektor …)
//   --upload    değişen vektörleri Vectorize'a yükler, veriden çıkan maddeleri siler
//
// Gerekli ortam değişkenleri: CLOUDFLARE_API_TOKEN (Workers AI: Read, Vectorize: Edit),
// CLOUDFLARE_ACCOUNT_ID.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIMS, EMBED_MODEL, INDEX_NAME, docText, queryText, quantize, dequantize, vectorsOf } from '../src/semantic.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const cacheDir = arg('--cache') || '.vektor';
const withQueries = process.argv.includes('--sorgular');
const upload = process.argv.includes('--upload');
const BATCH = 24;

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!token || !account) {
  console.error('CLOUDFLARE_API_TOKEN ve CLOUDFLARE_ACCOUNT_ID gerekli.');
  process.exit(1);
}
const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;

async function cf(path, body, { ndjson = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${api}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': ndjson ? 'application/x-ndjson' : 'application/json' },
      body: ndjson ? body : JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`${path}: HTTP ${res.status} ${text.slice(0, 500)}`);
  }
}

const embed = async (texts) => vectorsOf(await cf(`/ai/run/${EMBED_MODEL}`, { text: texts }));
const sha = (s) => createHash('sha256').update(s).digest('base64url').slice(0, 16);

const data = JSON.parse(readFileSync(new URL('../data/mevzuat.json', import.meta.url), 'utf8'));
const laws = new Map(data.laws.map((l) => [l.no, l]));
const docs = data.articles.map((a) => {
  const text = docText(a, laws.get(a.k));
  return { id: `${a.k}/${a.m}`, text, h: sha(`${EMBED_MODEL}|${DIMS}|${text}`), k: a.k };
});

mkdirSync(cacheDir, { recursive: true });
const file = join(cacheDir, 'vectors.json');
const cache = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
if (cache.model !== EMBED_MODEL || cache.dims !== DIMS) {
  if (cache.model) console.log(`Model ya da boyut değişti (${cache.model}/${cache.dims}); tüm vektörler yeniden hesaplanacak.`);
  Object.assign(cache, { model: EMBED_MODEL, dims: DIMS, maddeler: {}, sorgular: {}, yuklenen: {} });
}
cache.maddeler ??= {};
cache.sorgular ??= {};
cache.yuklenen ??= {};
const save = () => writeFileSync(file, JSON.stringify(cache));

// 1. Madde vektörleri
const todo = docs.filter((d) => cache.maddeler[d.id]?.h !== d.h);
console.log(`${docs.length} madde; ${todo.length} tanesinin vektörü hesaplanacak.`);
for (let i = 0; i < todo.length; i += BATCH) {
  const part = todo.slice(i, i + BATCH);
  const vecs = await embed(part.map((d) => d.text));
  part.forEach((d, j) => (cache.maddeler[d.id] = { h: d.h, ...quantize(vecs[j]) }));
  if ((i / BATCH) % 20 === 19) save(); // uzun ilk çalıştırmada ilerleme kaybolmasın
  process.stdout.write(`\r  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
}
if (todo.length) process.stdout.write('\n');
const live = new Set(docs.map((d) => d.id));
const removed = Object.keys(cache.maddeler).filter((id) => !live.has(id));
for (const id of removed) delete cache.maddeler[id];
save();

// 2. Ölçüm setindeki soruların vektörleri
if (withQueries) {
  const { gelistirme, kor } = await import('./eval-cases.mjs');
  const qs = [...new Set([...gelistirme, ...kor].map(([q]) => q))].filter((q) => !cache.sorgular[q]);
  console.log(`${qs.length} ölçüm sorusunun vektörü hesaplanacak.`);
  for (let i = 0; i < qs.length; i += BATCH) {
    const part = qs.slice(i, i + BATCH);
    const vecs = await embed(part.map(queryText));
    part.forEach((q, j) => (cache.sorgular[q] = quantize(vecs[j])));
  }
  save();
}

// 3. Vectorize'a yükleme
if (upload) {
  const changed = docs.filter((d) => cache.yuklenen[d.id] !== d.h);
  const gone = Object.keys(cache.yuklenen).filter((id) => !live.has(id));
  console.log(`Vectorize (${INDEX_NAME}): ${changed.length} vektör yüklenecek, ${gone.length} silinecek.`);
  for (let i = 0; i < changed.length; i += 1000) {
    const part = changed.slice(i, i + 1000);
    const body = part.map((d) => JSON.stringify({ id: d.id, values: [...dequantize(cache.maddeler[d.id])], metadata: { k: d.k } })).join('\n');
    await cf(`/vectorize/v2/indexes/${INDEX_NAME}/upsert`, body, { ndjson: true });
    for (const d of part) cache.yuklenen[d.id] = d.h;
    save();
    console.log(`  ${Math.min(i + 1000, changed.length)}/${changed.length}`);
  }
  for (let i = 0; i < gone.length; i += 1000) {
    const ids = gone.slice(i, i + 1000);
    await cf(`/vectorize/v2/indexes/${INDEX_NAME}/delete_by_ids`, { ids });
    for (const id of ids) delete cache.yuklenen[id];
    save();
  }
}
console.log('✓ vektörler güncel');
