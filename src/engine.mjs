// Mevzuat arama ve madde getirme çekirdeği. Ağ erişimi yok; yalnızca
// data/mevzuat.json içeriğiyle çalışır. Cloudflare Workers ve Node'da aynı kod çalışır.

import { fold, tokenize } from './text.mjs';
import { CONCEPTS } from './concepts.mjs';

const K1 = 1.2;
const B = 0.75;
const TITLE_WEIGHT = 8; // başlıktaki eşleşmeler gövdedekinden değerli
const PATH_WEIGHT = 4; // bölüm yolu (Kitap › Kısım › Bölüm) konuyu belirtir ama birçok maddede ortaktır

export function createEngine(data) {
  const { laws, articles, snapshot } = data;
  const lawByNo = new Map(laws.map((l) => [l.no, l]));

  // Kanun adı, numarası, kısaltması ve takma adlarından çözümleme tablosu.
  const lawKeys = new Map();
  const addKey = (key, no) => {
    const k = fold(key).replace(/[^a-z0-9]+/g, ' ').trim();
    if (k && !lawKeys.has(k)) lawKeys.set(k, no);
  };
  for (const l of laws) {
    addKey(l.no, l.no);
    addKey(`${l.no} sayili kanun`, l.no);
    addKey(l.abbr, l.no);
    addKey(l.name, l.no);
    for (const a of l.aliases) addKey(a, l.no);
  }

  // Madde numarası anahtarları: "315", "gecici 1", "ek 3", "1/a".
  const normMadde = (m) =>
    fold(m)
      .replace(/^(madde|md|m)\.?\s*/, '')
      .replace(/^(gecici|ek)\s+(madde|md|m)\.?\s*/, '$1 ')
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*/g, '/')
      .trim();
  const articleIndex = new Map();
  articles.forEach((a, i) => articleIndex.set(`${a.k}|${normMadde(a.m)}`, i));
  const idToIndex = (id) => {
    const [k, ...rest] = id.split('/');
    return articleIndex.get(`${k}|${normMadde(rest.join('/'))}`);
  };
  const concepts = CONCEPTS.map((c) => ({
    ifadeler: c.ifadeler.map(fold),
    docs: c.maddeler.map(idToIndex).filter((i) => i != null),
  }));

  // ---- Ters dizin (BM25) ----
  // Derleme sırasında hazırlanmış dizin varsa onu kullan (Worker açılışını hızlandırır).
  const { postings, docLen } = data.index ? decodeIndex(data.index) : buildIndex(articles);
  let total = 0;
  for (const l of docLen) total += l;
  const avgLen = total / articles.length;
  const N = articles.length;

  function resolveLaw(input) {
    if (input == null || input === '') return null;
    const k = fold(input).replace(/[^a-z0-9]+/g, ' ').trim();
    if (lawKeys.has(k)) return lawByNo.get(lawKeys.get(k));
    const num = k.match(/\b(\d{4})\b/);
    if (num && lawByNo.has(num[1])) return lawByNo.get(num[1]);
    return null;
  }

  // Madde numarası ve isteğe bağlı fıkra/bent: "315", "1/A", "Geçici 1", "315/2", "5/2-ç", "5 f.2 b.ç"
  const ARTICLE_SPEC =
    '(?:(?:ge[çc]ici|ek)\\s+(?:(?:madde|md|m)\\.?\\s*)?)?\\d+(?:\\/[a-zçğıöşü](?![a-zçğıöşü\\d]))?' +
    '(?:\\s*(?:\\/|f\\.?|fıkra)\\s*\\d+(?:\\s*[-,(]?\\s*(?:b\\.?\\s*|bent\\s*)?[a-zçğıöşü]{1,2}\\)?)?)?';
  const CITATION = new RegExp(`^(.+?)[\\s,/]+(?:(?:madde|md|m)\\.?\\s*)?(${ARTICLE_SPEC})\\s*\\.?$`, 'iu');
  const SPEC_PARTS = new RegExp(
    '^(.*?\\d+(?:\\/[a-zçğıöşü](?![a-zçğıöşü\\d]))?)\\s*(?:\\/|f\\.?|fıkra)\\s*(\\d+)(?:\\s*[-,(]?\\s*(?:b\\.?\\s*|bent\\s*)?([a-zçğıöşü]{1,2})\\)?)?$',
    'u',
  );

  // Madde numarasını (ve varsa fıkra/bent) veri dizinine çözer.
  function resolveSpec(lawNo, spec) {
    const raw = String(spec).trim();
    const exact = articleIndex.get(`${lawNo}|${normMadde(raw)}`);
    if (exact != null) return { index: exact, fikra: null, bent: null };
    const m = raw.toLocaleLowerCase('tr-TR').match(SPEC_PARTS);
    if (!m) return null;
    const index = articleIndex.get(`${lawNo}|${normMadde(m[1])}`);
    if (index == null) return null;
    return { index, fikra: +m[2], bent: m[3] || null };
  }

  // "TBK m. 315", "TBK 315", "6098 sayılı Kanun m.315", "6098/315", "TMK Geçici 1", "KVKK m. 5/2-ç"
  function parseCitation(text) {
    const s = String(text).trim();
    const m = s.match(CITATION);
    if (!m) return null;
    const law = resolveLaw(m[1]);
    if (!law) return null;
    return { law, madde: m[2] };
  }

  // Yerleşik atıf biçimi: "TBK m. 315", "TBK geçici m. 2", "FSEK ek m. 1".
  function citeOf(a) {
    const law = lawByNo.get(a.k);
    const m = a.m.match(/^(Geçici|Ek) (.+)$/);
    return m ? `${law.abbr} ${m[1].toLocaleLowerCase('tr-TR')} m. ${m[2]}` : `${law.abbr} m. ${a.m}`;
  }

  function present(a, { full = false, terms = [], fikra = null, bent = null } = {}) {
    const law = lawByNo.get(a.k);
    let part = null;
    if (fikra) {
      part = extractFikra(a.t, fikra, bent);
    }
    return {
      atif: citeOf(a) + (part ? `/${fikra}${bent ? `-${bent}` : ''}` : ''),
      ...(part ? { alinti: part } : {}),
      kimlik: `${a.k}/${a.m}`,
      kanun: { no: law.no, ad: law.name, kisaltma: law.abbr },
      madde: a.m,
      baslik: a.b,
      bolum: a.y || null,
      ...(full ? { metin: a.t } : { ozet: snippet(a.t, terms) }),
      kaynak: {
        ad: 'mevzuat.gov.tr',
        url: law.url,
        resmiGazete: law.resmiGazete,
        metinTarihi: snapshot,
      },
    };
  }

  function getArticle({ kanun, madde }) {
    const law = resolveLaw(kanun);
    if (!law) return { error: `Kanun bulunamadı: "${kanun}". list_laws ile desteklenen kanunlara bakın.` };
    const want = String(madde ?? '').trim();
    if (!want) return { error: 'madde alanı boş.' };

    // Aralık: "344-347" (en fazla 10 madde)
    const range = want.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const from = +range[1];
      const to = +range[2];
      if (to < from) return { error: `Geçersiz aralık: ${want}` };
      if (to - from > 9) return { error: 'Bir seferde en fazla 10 madde getirilebilir.' };
      const list = [];
      const missing = [];
      for (let n = from; n <= to; n++) {
        const i = articleIndex.get(`${law.no}|${n}`);
        if (i == null) missing.push(String(n));
        else list.push(present(articles[i], { full: true }));
      }
      return { maddeler: list, bulunamayan: missing };
    }

    const r = resolveSpec(law.no, want);
    if (!r) {
      return { error: `${law.abbr} içinde "${want}" numaralı madde bulunamadı. ${law.abbr} ${law.maddeSayisi} madde içeriyor (geçici ve ek maddeler dahil).` };
    }
    const a = articles[r.index];
    if (r.fikra && !extractFikra(a.t, r.fikra, r.bent)) {
      const count = splitFikralar(a.t).length;
      const what = r.bent ? `${r.fikra}. fıkranın (${r.bent}) bendi` : `${r.fikra}. fıkra`;
      return { error: `${citeOf(a)} içinde ${what} bulunamadı. Madde ${count} fıkradan oluşuyor; tam metin için madde numarasını tek başına verin.` };
    }
    return { maddeler: [present(a, { full: true, fikra: r.fikra, bent: r.bent })], bulunamayan: [] };
  }

  function search({ sorgu, kanun, limit = 8 }) {
    const q = String(sorgu ?? '').trim();
    if (!q) return { error: 'sorgu alanı boş.' };
    limit = Math.max(1, Math.min(20, Number(limit) || 8));

    let lawFilter = null;
    if (kanun) {
      lawFilter = resolveLaw(kanun);
      if (!lawFilter) return { error: `Kanun bulunamadı: "${kanun}". list_laws ile desteklenen kanunlara bakın.` };
    }

    // Sorgu doğrudan bir atıfsa önce o madde gelir.
    const cite = parseCitation(q);
    if (cite && (!lawFilter || lawFilter.no === cite.law.no)) {
      const r = resolveSpec(cite.law.no, cite.madde);
      if (r) {
        const ok = !r.fikra || extractFikra(articles[r.index].t, r.fikra, r.bent);
        const opts = ok ? { full: true, fikra: r.fikra, bent: r.bent } : { full: true };
        return { sonuclar: [present(articles[r.index], opts)], toplam: 1, dogrudanAtif: true };
      }
    }

    const all = tokenize(q);
    const terms = [...new Set(all)];
    // Kapsama oranı yalnızca kaba köklerle hesaplanır; ince kökler ("~") ek puandır.
    const coarse = terms.filter((t) => !t.startsWith('~'));
    if (!terms.length) return { error: 'Sorguda aranabilir bir sözcük kalmadı; daha belirli sözcükler kullanın.' };

    // Kavram dizininde eşleşen maddeler, sözcük aramasının önüne konur.
    const fq = fold(q);
    const conceptDocs = [];
    for (const c of concepts) {
      if (!c.ifadeler.some((f) => fq.includes(f))) continue;
      for (const d of c.docs) if (!conceptDocs.includes(d) && (!lawFilter || articles[d].k === lawFilter.no)) conceptDocs.push(d);
    }

    const scores = new Map();
    const hits = new Map();
    for (const t of terms) {
      const p = postings.get(t);
      if (!p) continue;
      const df = p.length / 2;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (let j = 0; j < p.length; j += 2) {
        const d = p[j];
        if (lawFilter && articles[d].k !== lawFilter.no) continue;
        const tf = p[j + 1];
        const s = idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * docLen[d]) / avgLen)));
        scores.set(d, (scores.get(d) || 0) + s);
        if (!t.startsWith('~')) hits.set(d, (hits.get(d) || 0) + 1);
      }
    }
    // Sorgudaki terimlerin çoğunu içeren maddeleri öne çıkar.
    const ranked = [...scores]
      .map(([d, s]) => [d, s * (0.5 + (0.5 * Math.min(hits.get(d) || 0, coarse.length)) / Math.max(1, coarse.length))])
      .sort((a, b) => b[1] - a[1]);
    const lexical = ranked.filter(([d]) => !conceptDocs.includes(d));
    const sonuclar = [
      ...conceptDocs.map((d) => ({ ...present(articles[d], { terms }), eslesme: 'kavram dizini' })),
      ...lexical.map(([d, s]) => ({ ...present(articles[d], { terms }), eslesme: 'sözcük', skor: +s.toFixed(2) })),
    ].slice(0, limit);
    return { sonuclar, toplam: conceptDocs.length + lexical.length, dogrudanAtif: false };
  }

  function listLaws() {
    return {
      kanunlar: laws.map((l) => ({
        no: l.no,
        ad: l.name,
        kisaltma: l.abbr,
        kabulTarihi: l.kabulTarihi,
        resmiGazete: l.resmiGazete,
        maddeSayisi: l.maddeSayisi,
        url: l.url,
      })),
      metinTarihi: snapshot,
    };
  }

  return { search, getArticle, listLaws, resolveLaw, parseCitation, snapshot };
}

// Eşleşen terimlerin geçtiği en yoğun bölümden ~320 karakterlik bir özet.
export function snippet(text, terms, size = 320) {
  if (text.length <= size) return text;
  if (!terms.length) return text.slice(0, size).trimEnd() + '…';
  const folded = fold(text);
  let best = 0;
  let bestHits = -1;
  for (let start = 0; start < folded.length; start += 80) {
    const win = folded.slice(start, start + size);
    let h = 0;
    for (const t of terms) if (win.includes(t.replace(/^~/, ''))) h++;
    if (h > bestHits) {
      bestHits = h;
      best = start;
    }
  }
  // Sözcük ortasından başlamamak için bir önceki boşluğa geri git.
  let s = best;
  while (s > 0 && !/\s/.test(text[s - 1])) s--;
  const out = text.slice(s, s + size).trimEnd();
  return (s > 0 ? '…' : '') + out + (s + size < text.length ? '…' : '');
}

// ---- Dizin oluşturma ve kodlama ----

export function buildIndex(articles) {
  const postings = new Map(); // terim → [docIdx, tf, docIdx, tf, ...]
  const docLen = new Float32Array(articles.length);
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const tf = new Map();
    for (const t of tokenize(a.t)) tf.set(t, (tf.get(t) || 0) + 1);
    if (a.b) for (const t of tokenize(a.b)) tf.set(t, (tf.get(t) || 0) + TITLE_WEIGHT);
    if (a.y) for (const t of tokenize(a.y)) tf.set(t, (tf.get(t) || 0) + PATH_WEIGHT);
    let len = 0;
    for (const [t, n] of tf) {
      len += n;
      let p = postings.get(t);
      if (!p) postings.set(t, (p = []));
      p.push(i, Math.min(n, 255));
    }
    docLen[i] = len;
  }
  return { postings, docLen };
}

const b64 = {
  enc: (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  },
  dec: (str) => {
    const s = atob(str);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  },
};

// Dizini JSON'a sığacak küçük bir biçime çevirir: terim listesi + ikili diziler (base64).
export function encodeIndex({ postings, docLen }) {
  const terms = [...postings.keys()];
  const offsets = new Uint32Array(terms.length + 1);
  let n = 0;
  terms.forEach((t, i) => {
    offsets[i] = n;
    n += postings.get(t).length / 2;
  });
  offsets[terms.length] = n;
  const docs = new Uint16Array(n);
  const tfs = new Uint8Array(n);
  let j = 0;
  for (const t of terms) {
    const p = postings.get(t);
    for (let k = 0; k < p.length; k += 2) {
      docs[j] = p[k];
      tfs[j] = p[k + 1];
      j++;
    }
  }
  return {
    terms,
    offsets: b64.enc(new Uint8Array(offsets.buffer)),
    docs: b64.enc(new Uint8Array(docs.buffer)),
    tfs: b64.enc(tfs),
    docLen: b64.enc(new Uint8Array(Float32Array.from(docLen).buffer)),
  };
}

export function decodeIndex(ix) {
  const offsets = new Uint32Array(b64.dec(ix.offsets).buffer);
  const docs = new Uint16Array(b64.dec(ix.docs).buffer);
  const tfs = b64.dec(ix.tfs);
  const docLen = new Float32Array(b64.dec(ix.docLen).buffer);
  // Sorgu kodu terim başına [doc, tf, ...] dizisi bekler; ihtiyaç olunca tembel üret.
  const pos = new Map(ix.terms.map((t, i) => [t, i]));
  const cache = new Map();
  const postings = {
    get(t) {
      if (cache.has(t)) return cache.get(t);
      const i = pos.get(t);
      if (i == null) return undefined;
      const out = [];
      for (let k = offsets[i]; k < offsets[i + 1]; k++) out.push(docs[k], tfs[k]);
      cache.set(t, out);
      return out;
    },
  };
  return { postings, docLen };
}

// ---- Fıkra ve bent ----

const BENT_LINE = /^([a-zçğıöşü]{1,2})\)\s/u;

// Madde metnini fıkralara ayırır. Numaralı fıkralar "(1)" ile başlar; numarasız
// metinlerde her paragraf bir fıkradır. Bent satırları ("a) …") içinde bulundukları
// fıkraya aittir.
export function splitFikralar(text) {
  const lines = text.split('\n');
  const numbered = lines.some((l) => /^\(\d+\)/.test(l));
  const out = [];
  let notes = [];
  for (const line of lines) {
    // Tek başına duran değişiklik notları ("(Değişik: …)") fıkra sayılmaz; izleyen fıkraya eklenir.
    if (/^\((?:Değişik|Ek|Mülga|İptal)[^)]*\)\s*$/u.test(line)) {
      notes.push(line);
      continue;
    }
    const starts = numbered ? /^\(\d+\)/.test(line) : !BENT_LINE.test(line);
    if (starts || !out.length) out.push([...notes, line]);
    else out[out.length - 1].push(...notes, line);
    notes = [];
  }
  if (notes.length) (out.length ? out[out.length - 1] : out[out.push([]) - 1]).push(...notes);
  return out;
}

export function extractFikra(text, fikra, bent) {
  const parts = splitFikralar(text);
  const f = parts[fikra - 1];
  if (!f) return null;
  if (!bent) return f.join('\n');
  const line = f.find((l) => {
    const m = l.match(BENT_LINE);
    return m && m[1] === bent;
  });
  return line || null;
}
