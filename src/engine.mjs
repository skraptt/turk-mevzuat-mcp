// Mevzuat arama ve madde getirme çekirdeği. Ağ erişimi yok; yalnızca data/mevzuat.json
// içeriğiyle çalışır. Anlamsal arama sonuçları dışarıdan (search({ semantik })) verilir.
// Cloudflare Workers ve Node'da aynı kod çalışır.

import { fold, tokenize } from './text.mjs';
import { CONCEPTS } from './concepts.mjs';
import { SYNONYMS } from './synonyms.mjs';
import { articleHistory } from './history.mjs';

const K1 = 1.2;
const B = 0.75;
const TITLE_WEIGHT = 8; // başlıktaki eşleşmeler gövdedekinden değerli
const PATH_WEIGHT = 4; // bölüm yolu (Kitap › Kısım › Bölüm) konuyu belirtir ama birçok maddede ortaktır
const SYNONYM_WEIGHT = 0.8; // gündelik dil genişletmesi asıl terimden biraz az sayılır
const LAW_MENTION_BOOST = 1.6; // sorguda adı geçen kanunun maddeleri
// Konusu "kanunun kendisi" olan maddeler (amaç, kapsam, yürürlük…) bir konu sorusunun cevabı
// olmaz ama kanunun adını ve kapsamını tekrar ettikleri için sözcük eşleşmesinde öne çıkarlar.
const BOILERPLATE = /^(?:amaç|kapsam|amaç ve kapsam|dayanak|yürürlük|yürütme|yürürlükten kaldırılan.*|kaldırılan hükümler)$/iu;
const BOILERPLATE_FACTOR = 0.6;
// Anlamsal arama ile sözcük aramasının birleştirilmesi (Reciprocal Rank Fusion).
// Her liste, maddeye 1 / (RRF_K + sıra) puan verir; ağırlıklar listelerin payını belirler.
export const FUSION = { k: 60, sozcuk: 1, anlam: 1 };
// Uygulama (yürürlük) kanunları geçiş hükümleridir; asıl kanunla aynı terimleri taşırlar.
const TRANSITIONAL_FACTOR = 0.75;

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
      .replace(/^(madde|md|m)(?![a-z])\.?\s*/, '') // "mükerrer" de m ile başlar
      .replace(/^(gecici|ek|mukerrer)\s+(madde|md|m)\.?\s*/, '$1 ')
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

  // Madde başına sabit sıralama çarpanı (kalıp maddeler ve uygulama kanunları geri çekilir).
  const lastTitle = (a) => (a.b || '').split(' / ').pop().replace(/^(?:[A-ZÇĞİÖŞÜ]{1,4}|\d{1,3})\s*[.)\-–]\s*/u, '').trim();
  const prior = articles.map((a) => {
    let f = 1;
    if (BOILERPLATE.test(lastTitle(a))) f *= BOILERPLATE_FACTOR;
    if (/Yürürlüğü ve Uygulama Şekli/u.test(lawByNo.get(a.k)?.name || '')) f *= TRANSITIONAL_FACTOR;
    return f;
  });
  const synonyms = SYNONYMS.map(([k, v]) => ({ re: new RegExp(`(?:^|[^a-z0-9])${fold(k).replace(/\s+/g, '\\s+')}`), terms: tokenize(v), key: tokenize(k, { query: true }).filter((t) => !t.startsWith('~')) }));
  // Sorguda kanun adı ya da kısaltması geçiyor mu? (çok kısa ve yalnız rakamdan oluşan anahtarlar hariç)
  const mentionKeys = [...lawKeys].filter(([k]) => k.length >= 3 && !/^\d{1,2}$/.test(k)).sort((a, b) => b[0].length - a[0].length);
  const mentionedLaws = (fq) => {
    const q = ` ${fq.replace(/[^a-z0-9]+/g, ' ')} `;
    const out = new Set();
    for (const [k, no] of mentionKeys) if (q.includes(` ${k} `)) out.add(no);
    return out;
  };

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
    const num = k.match(/\b(\d{3,4})\b/);
    if (num && lawByNo.has(num[1])) return lawByNo.get(num[1]);
    return null;
  }

  // Madde numarası ve isteğe bağlı fıkra/bent: "315", "1/A", "Geçici 1", "315/2", "5/2-ç", "5 f.2 b.ç"
  const ARTICLE_SPEC =
    '(?:(?:ge[çc]ici|ek|m[üu]kerrer)\\s+(?:(?:madde|md|m)\\.?\\s*)?)?\\d+(?:\\/[a-zçğıöşü](?![a-zçğıöşü\\d]))?' +
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

  // Yerleşik atıf biçimi: "TBK m. 315", "TBK geçici m. 2", "FSEK ek m. 1", "VUK mükerrer m. 257".
  function citeOf(a) {
    const law = lawByNo.get(a.k);
    const m = a.m.match(/^(Geçici|Ek|Mükerrer) (.+)$/);
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
      kanun: { no: law.no, ad: law.name, kisaltma: law.abbr, tur: law.tur || 'Kanun' },
      madde: a.m,
      baslik: a.b,
      bolum: a.y || null,
      ...(full ? { metin: a.t } : { ozet: snippet(a.t, terms) }),
      kaynak: {
        ad: 'mevzuat.gov.tr',
        url: law.url,
        resmiGazete: law.resmiGazete,
        metinTarihi: law.metinTarihi || snapshot,
        // Metnin mevzuat.gov.tr'deki güncel hâliyle en son karşılaştırıldığı gün.
        sonKontrol: law.sonKontrol || law.metinTarihi || snapshot,
      },
      ...(a.d ? { dipnotlar: a.d } : {}),
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

  // Maddenin değişiklik geçmişi (metindeki notlar ve dipnotlardan).
  function getHistory({ kanun, madde }) {
    const law = resolveLaw(kanun);
    if (!law) return { error: `Kanun bulunamadı: "${kanun}". list_laws ile desteklenen kanunlara bakın.` };
    const want = String(madde ?? '').trim();
    if (!want) return { error: 'madde alanı boş.' };
    const r = resolveSpec(law.no, want);
    if (!r) return { error: `${law.abbr} içinde "${want}" numaralı madde bulunamadı.` };
    const a = articles[r.index];
    const olaylar = articleHistory(a.t, a.d);
    return {
      atif: citeOf(a),
      kimlik: `${a.k}/${a.m}`,
      kanun: { no: law.no, ad: law.name, kisaltma: law.abbr, tur: law.tur || 'Kanun' },
      madde: a.m,
      baslik: a.b,
      olaylar,
      aciklama:
        olaylar.length === 0
          ? 'mevzuat.gov.tr metninde bu madde için değişiklik notu ya da dipnot yok.'
          : 'Kayıtlar mevzuat.gov.tr metnindeki değişiklik notlarından ("Değişik: …") ve dipnotlardan çıkarıldı; maddenin eski metinleri bu kaynakta yer almaz.',
      kaynak: {
        ad: 'mevzuat.gov.tr',
        url: law.url,
        resmiGazete: law.resmiGazete,
        metinTarihi: law.metinTarihi || snapshot,
        sonKontrol: law.sonKontrol || law.metinTarihi || snapshot,
      },
    };
  }

  // semantik: anlamsal aramanın en yakından uzağa sıraladığı madde kimlikleri ("6098/315").
  // Verilmezse yalnızca sözcük araması yapılır.
  function search({ sorgu, kanun, limit = 8, semantik = null, fusion = FUSION, anlamsalDurum = null }) {
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

    const fq = fold(q);
    // Terim grupları: her sorgu sözcüğü bir gruptur; gündelik dil genişletmesi kendi grubunu
    // oluşturur. Kapsama oranı grup üzerinden hesaplanır, böylece "patron" ile "işveren"
    // aynı ihtiyacı karşılar ve genişletme terimleri paydayı şişirmez.
    const weight = new Map(); // terim → ağırlık
    const group = new Map(); // kaba terim → grup no
    let groups = 0;
    for (const t of tokenize(q, { query: true })) {
      if (weight.has(t)) continue;
      weight.set(t, 1);
      if (!t.startsWith('~')) group.set(t, groups++);
    }
    for (const syn of synonyms) {
      if (!syn.re.test(fq)) continue;
      // Genişletme, karşıladığı sorgu sözcüğünün grubuna girer ("patron" ya da "işveren").
      const own = syn.key.map((t) => group.get(t)).find((x) => x != null);
      const g = own ?? groups++;
      for (const t of syn.terms) {
        if (weight.has(t)) continue;
        weight.set(t, SYNONYM_WEIGHT);
        if (!t.startsWith('~')) group.set(t, g);
      }
    }
    const terms = [...weight.keys()];
    if (!terms.length) return { error: 'Sorguda aranabilir bir sözcük kalmadı; daha belirli sözcükler kullanın.' };
    const mentioned = lawFilter ? new Set() : mentionedLaws(fq);

    // Kavram dizininde eşleşen maddeler, sözcük aramasının önüne konur.
    const conceptDocs = [];
    for (const c of concepts) {
      if (!c.ifadeler.some((f) => fq.includes(f))) continue;
      for (const d of c.docs) if (!conceptDocs.includes(d) && (!lawFilter || articles[d].k === lawFilter.no)) conceptDocs.push(d);
    }

    const scores = new Map();
    const hits = new Map(); // madde → eşleşen grup kümesi (bit maskesi değil, Set)
    for (const t of terms) {
      const p = postings.get(t);
      if (!p) continue;
      const w = weight.get(t);
      const g = group.get(t);
      const df = p.length / 2;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (let j = 0; j < p.length; j += 2) {
        const d = p[j];
        if (lawFilter && articles[d].k !== lawFilter.no) continue;
        const tf = p[j + 1];
        const s = w * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * docLen[d]) / avgLen)));
        scores.set(d, (scores.get(d) || 0) + s);
        if (g != null) {
          let h = hits.get(d);
          if (!h) hits.set(d, (h = new Set()));
          h.add(g);
        }
      }
    }
    // Sorgudaki terim gruplarının çoğunu içeren maddeleri öne çıkar; sabit çarpanları uygula.
    const ranked = [...scores]
      .map(([d, s]) => {
        const cover = Math.min(hits.get(d)?.size || 0, groups) / Math.max(1, groups);
        let f = prior[d];
        if (mentioned.has(articles[d].k)) f = Math.max(f, 1) * LAW_MENTION_BOOST;
        return [d, s * (0.5 + 0.5 * cover) * f];
      })
      .sort((a, b) => b[1] - a[1]);
    const lexical = ranked.filter(([d]) => !conceptDocs.includes(d));
    const head = conceptDocs.map((d) => ({ ...present(articles[d], { terms }), eslesme: 'kavram dizini' }));

    const sem = (semantik || [])
      .map(idToIndex)
      .filter((d) => d != null && !conceptDocs.includes(d) && (!lawFilter || articles[d].k === lawFilter.no));
    if (!sem.length) {
      const sonuclar = [...head, ...lexical.map(([d, sc]) => ({ ...present(articles[d], { terms }), eslesme: 'sözcük', skor: +sc.toFixed(2) }))].slice(0, limit);
      return { sonuclar, toplam: conceptDocs.length + lexical.length, dogrudanAtif: false, ...(anlamsalDurum ? { anlamsal: false, anlamsalDurum } : {}) };
    }

    const fused = new Map(); // madde → [puan, sözcükte mi, anlamda mı]
    const add = (d, w, rank, which) => {
      const e = fused.get(d) || [0, false, false];
      e[0] += w / (fusion.k + rank);
      e[which] = true;
      fused.set(d, e);
    };
    lexical.forEach(([d], i) => add(d, fusion.sozcuk * prior[d], i + 1, 1));
    // Kalıp maddeler ve uygulama kanunları anlamsal listede de geri çekilir.
    sem.forEach((d, i) => add(d, fusion.anlam * prior[d], i + 1, 2));
    const order = [...fused].sort((a, b) => b[1][0] - a[1][0]);
    const label = (l, m) => (l && m ? 'sözcük ve anlam' : l ? 'sözcük' : 'anlam');
    const sonuclar = [...head, ...order.map(([d, [, l, m]]) => ({ ...present(articles[d], { terms }), eslesme: label(l, m) }))].slice(0, limit);
    return { sonuclar, toplam: conceptDocs.length + fused.size, dogrudanAtif: false, anlamsal: true };
  }

  function listLaws() {
    return {
      kanunlar: laws.map((l) => ({
        no: l.no,
        ad: l.name,
        kisaltma: l.abbr,
        tur: l.tur || 'Kanun',
        kabulTarihi: l.kabulTarihi,
        resmiGazete: l.resmiGazete,
        maddeSayisi: l.maddeSayisi,
        metinTarihi: l.metinTarihi || snapshot,
        sonKontrol: l.sonKontrol || l.metinTarihi || snapshot,
        url: l.url,
      })),
      metinTarihi: snapshot,
    };
  }

  return { search, getArticle, getHistory, listLaws, resolveLaw, parseCitation, snapshot };
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
// Derlenmiş dizin biçimi (v2). Her terimin kayıtları "kayıt sayısı, belge farkları…"
// olarak değişken uzunluklu tamsayılarla (varint) yazılır; belge numaraları artan
// sırada olduğu için farklar küçüktür ve çoğu tek bayta sığar. Bu, paketin
// Cloudflare'in ücretsiz plan boyut sınırının altında kalmasını sağlar.
export function encodeIndex({ postings, docLen }) {
  const terms = [...postings.keys()];
  const bytes = [];
  const varint = (n) => {
    while (n >= 0x80) {
      bytes.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    bytes.push(n);
  };
  const tfs = [];
  for (const t of terms) {
    const p = postings.get(t);
    varint(p.length / 2);
    let prev = 0;
    for (let k = 0; k < p.length; k += 2) {
      varint(p[k] - prev);
      prev = p[k];
      tfs.push(p[k + 1]);
    }
  }
  return {
    v: 2,
    terms,
    postings: b64.enc(Uint8Array.from(bytes)),
    tfs: b64.enc(Uint8Array.from(tfs)),
    docLen: b64.enc(new Uint8Array(Float32Array.from(docLen).buffer)),
  };
}

export function decodeIndex(ix) {
  if (ix.v !== 2) throw new Error('Dizin biçimi eski; npm run build ile yeniden derleyin.');
  const bytes = b64.dec(ix.postings);
  const tfs = b64.dec(ix.tfs);
  const docLen = new Float32Array(b64.dec(ix.docLen).buffer);
  const offsets = new Uint32Array(ix.terms.length + 1);
  const docs = new Uint32Array(tfs.length);
  let at = 0;
  const varint = () => {
    let n = 0;
    let shift = 0;
    let b;
    do {
      b = bytes[at++];
      n += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    return n;
  };
  let j = 0;
  for (let i = 0; i < ix.terms.length; i++) {
    offsets[i] = j;
    const count = varint();
    let prev = 0;
    for (let k = 0; k < count; k++) docs[j++] = prev += varint();
  }
  offsets[ix.terms.length] = j;
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
