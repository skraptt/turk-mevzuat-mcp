// Anlamsal arama: sorgunun anlamına yakın maddeleri bulur. Sözcük aramasının
// yakalayamadığı, kanun terimi içermeyen sorular için ("patronum maaşımı yatırmıyor").
//
// Maddelerin vektörleri derleme sırasında hesaplanır ve Cloudflare Vectorize'a yüklenir
// (scripts/embed.mjs). İstek sırasında yalnızca sorgunun vektörü Workers AI ile hesaplanır
// ve Vectorize'da en yakın maddeler aranır. Bu adım herhangi bir nedenle başarısız olursa
// arama sözcük aramasıyla devam eder; anlamsal arama hiçbir zaman zorunlu değildir.
//
// Bu dosya Worker'da, Node'daki betiklerde ve testlerde aynı şekilde kullanılır.

export const EMBED_MODEL = '@cf/qwen/qwen3-embedding-0.6b';
// Model 1024 boyutlu vektör üretir ve Matryoshka eğitimlidir: ilk 512 boyut, yeniden
// normalize edildiğinde neredeyse aynı kaliteyi verir ve Vectorize ücretsiz kotasına sığar.
export const DIMS = 512;
export const INDEX_NAME = 'turk-mevzuat';
// Qwen3-Embedding sorgulara görev tanımı eklenmesini önerir (belgelere eklenmez).
export const QUERY_INSTRUCTION =
  'Instruct: Given a legal question in Turkish, retrieve the Turkish statute article that answers it\nQuery: ';
const DOC_CHARS = 2000;
const TIMEOUT_MS = 2500;

// Bir maddenin vektörü hesaplanırken kullanılan metin: kanun, madde numarası, bölüm yolu,
// başlık ve gövdenin başı. Değişirse tüm vektörler yeniden hesaplanır (özet değişir).
export function docText(article, law) {
  const head = `${law.abbr} m. ${article.m} (${law.name})`;
  const path = [article.y, article.b].filter(Boolean).join(' › ');
  return `${head}\n${path}\n${article.t}`.slice(0, DOC_CHARS);
}

export const queryText = (q) => QUERY_INSTRUCTION + String(q).trim();

// Workers AI yanıtından vektör listesini çıkarır (Worker bağlamı ve REST API biçimleri).
export function vectorsOf(res) {
  const data = res?.data ?? res?.result?.data ?? res?.result?.response ?? res?.response;
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Workers AI yanıtında vektör yok');
  return data.map(truncate);
}

// İlk DIMS boyutu alıp birim uzunluğa getirir.
export function truncate(v) {
  const out = new Float32Array(DIMS);
  let n = 0;
  for (let i = 0; i < DIMS; i++) {
    out[i] = v[i];
    n += v[i] * v[i];
  }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIMS; i++) out[i] /= n;
  return out;
}

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('anlamsal arama zaman aşımı')), ms))]);

// Worker ortamı (env.AI ve env.VEC bağları) varsa bir arama işlevi döner, yoksa null.
// İşlev { ids } (en yakından uzağa madde kimlikleri) ya da { hata } döndürür; hiçbir zaman
// istisna fırlatmaz. Hata metni sorgu içermez (Workers AI / Vectorize hata mesajı).
export function createSemantic(env, { topK = 30 } = {}) {
  if (!env?.AI || !env?.VEC) return null;
  return async function semanticSearch(sorgu, kanunNo) {
    try {
      const run = async () => {
        const [vec] = vectorsOf(await env.AI.run(EMBED_MODEL, { text: [queryText(sorgu)] }));
        const opts = { topK, returnValues: false, returnMetadata: 'none' };
        if (kanunNo) opts.filter = { k: kanunNo };
        const r = await env.VEC.query([...vec], opts);
        return { ids: (r?.matches || []).map((m) => m.id) };
      };
      return await withTimeout(run(), TIMEOUT_MS);
    } catch (err) {
      return { hata: String(err?.message || err).slice(0, 200) };
    }
  };
}

// ---- Yerel vektör deposu (ölçüm betiği ve vektör önbelleği için) ----
// Önbellekte her vektör int8'e nicelenir: 512 bayt + ölçek. Kosinüs benzerliği için yeterli.
export function quantize(v) {
  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  const scale = max / 127 || 1;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / scale);
  return { q: Buffer.from(q.buffer).toString('base64'), s: scale };
}

export function dequantize({ q, s }) {
  const b = Buffer.from(q, 'base64');
  const i8 = new Int8Array(b.buffer, b.byteOffset, b.length);
  const v = new Float32Array(i8.length);
  let n = 0;
  for (let i = 0; i < i8.length; i++) {
    v[i] = i8[i] * s;
    n += v[i] * v[i];
  }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

// Kaba kuvvet en yakın komşu: Vectorize'ın kosinüs sıralamasının yerel karşılığı.
export function nearest(store, vec, { topK = 30, kanunNo = null } = {}) {
  const scored = [];
  for (const [id, v] of store) {
    if (kanunNo && !id.startsWith(`${kanunNo}/`)) continue;
    let s = 0;
    for (let i = 0; i < vec.length; i++) s += vec[i] * v[i];
    scored.push([id, s]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, topK).map(([id]) => id);
}
