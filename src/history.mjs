// Madde tarihçesi: bir maddenin hangi tarihte, hangi kanunla değiştiğini çıkarır.
// İki kaynak kullanılır, ikisi de mevzuat.gov.tr metninin kendisinden gelir:
//   1. Metin içindeki değişiklik notları: "(Değişik birinci fıkra: 16/7/2026-7589/19 md.)"
//   2. Dipnotlar: "24/6/2026 tarihli ve 7587 sayılı Kanunun 10 uncu maddesi ile …",
//      "Anayasa Mahkemesinin 25/12/2025 tarihli ve E.: 2025/120; K.: 2025/270 sayılı Kararı ile …"
// Sonuç tarih sırasına dizilir. Ayrıştırılamayan notlar atılmaz, "aciklama" ile döner.

const DATE = String.raw`(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4})`;
const iso = (d, m, y) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

// Parantez içindeki tek bir not parçası: "Ek fıkra: 1/1/2000-4567/12 md." (";" ile ayrılmış birkaç parça olabilir)
const NOTE_PART = new RegExp(
  String.raw`^\s*([A-Za-zÇĞİÖŞÜçğıöşüâîû ,]+?)\s*(?::|[-–—]|(?=\d))\s*${DATE}\s*[-–—]\s*((?:KHK|CBK)?\s*[-/]?\s*\d+)\s*/\s*(\d+(?:\s*/\s*[a-zçğıöşü])?)\s*md\.?\s*$`,
  'iu',
);
const NOTE = /\(((?:Değişik|Ek|Mülga|İptal|Başlığı ile Birlikte|Yürürlükten Kaldırıl|Aynen kabul|Yeniden düzenleme)[^()]*?)\)/giu;

const LAW_FOOTNOTE = new RegExp(
  String.raw`${DATE}\s+tarih(?:li)?\s+ve\s+(\d+)\s+sayılı\s+(Kanun Hükmünde Kararname|Cumhurbaşkanlığı Kararname|KHK|Kanun)\S*\s+(\d+(?:\/[a-zçğıöşü])?)\s*['’]?\s*\S*\s+madde`,
  'iu',
);
const AYM = new RegExp(
  String.raw`Anayasa Mahkemesi[’']?\s?\S*\s+${DATE}\s+tarih(?:li)?\s+ve\s+E\.?\s*:?\s*(\d{4}\s*/\s*\d+)\s*[;,]?\s*K\.?\s*:?\s*(\d{4}\s*/\s*\d+)`,
  'iu',
);

const kind = (label) => {
  if (/iptal/i.test(label)) return 'iptal';
  if (/mülga|yürürlükten/i.test(label)) return 'yürürlükten kaldırma';
  if (/aynen kabul/i.test(label)) return 'aynen kabul';
  if (/^ek/i.test(label)) return 'ekleme';
  return 'değişiklik';
};
const lawRef = (no, madde, type = 'Kanun') => {
  const n = no.replace(/\s+/g, '');
  const t = /^KHK/i.test(n) ? 'KHK' : /^CBK/i.test(n) ? 'Cumhurbaşkanlığı Kararnamesi' : type;
  return `${n.replace(/^(KHK|CBK)[-/]?/i, '')} sayılı ${t} m. ${madde.replace(/\s+/g, '')}`;
};
const shorten = (s, n = 240) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Metin içindeki notlar. "yer" = notun geçtiği fıkra (numaralı fıkralarda "(2)" gibi).
function inlineEvents(text) {
  // Notun geçtiği fıkra: notun önündeki son "(n)" fıkra numarası.
  const starts = [...text.matchAll(/^\((\d+)\)/gm)].map((m) => [m.index, +m[1]]);
  const fikraAt = (pos) => {
    let f = null;
    for (const [i, n] of starts) if (i <= pos) f = n;
    return f;
  };
  const out = [];
  for (const m of text.matchAll(NOTE)) {
    const fikra = fikraAt(m.index);
    const body = m[1].replace(/\s+/g, ' ');
    const aym = body.match(AYM);
    if (aym) {
      // AYM kararı notu ("İptal: Anayasa Mahkemesinin … E.: …; K.: … sayılı Kararı ile") bölünmez.
      out.push({ tarih: iso(aym[1], aym[2], aym[3]), islem: 'iptal', not: body.split(':')[0].trim(), kaynak: `AYM E. ${aym[4].replace(/\s/g, '')}, K. ${aym[5].replace(/\s/g, '')}`, ...(fikra ? { fikra } : {}) });
      continue;
    }
    // Bir parantezde birden çok not olabilir: "Ek: … md.; Mülga: … md." ya da virgülle.
    for (const part of body.split(/;|,\s*(?=[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[a-zçğıöşü]+)*\s*:)/u)) {
      const p = part.match(NOTE_PART);
      if (p) {
        out.push({ tarih: iso(p[2], p[3], p[4]), islem: kind(p[1]), not: p[1].trim(), kaynak: lawRef(p[5], p[6]), ...(fikra ? { fikra } : {}) });
        continue;
      }
      const a = part.match(AYM);
      if (a) {
        out.push({ tarih: iso(a[1], a[2], a[3]), islem: 'iptal', not: part.split(':')[0].trim(), kaynak: `AYM E. ${a[4].replace(/\s/g, '')}, K. ${a[5].replace(/\s/g, '')}`, ...(fikra ? { fikra } : {}) });
      }
    }
  }
  return out;
}

function footnoteEvents(notes = []) {
  const out = [];
  for (const n of notes) {
    const a = n.match(AYM);
    if (a) {
      out.push({ tarih: iso(a[1], a[2], a[3]), islem: /iptal/i.test(n) ? 'iptal' : 'AYM kararı', kaynak: `AYM E. ${a[4].replace(/\s/g, '')}, K. ${a[5].replace(/\s/g, '')}`, aciklama: shorten(n) });
      continue;
    }
    const l = n.match(LAW_FOOTNOTE);
    if (l) {
      const type = /kanun hükmünde|khk/i.test(l[5]) ? 'KHK' : /cumhurbaşkanlığı/i.test(l[5]) ? 'Cumhurbaşkanlığı Kararnamesi' : 'Kanun';
      out.push({
        tarih: iso(l[1], l[2], l[3]),
        islem: /yürürlükten kaldır|mülga/i.test(n) ? 'yürürlükten kaldırma' : /eklen/i.test(n) ? 'ekleme' : 'değişiklik',
        kaynak: lawRef(l[4], l[6], type),
        aciklama: shorten(n),
      });
      continue;
    }
    out.push({ tarih: null, islem: 'not', aciklama: shorten(n) });
  }
  return out;
}

export function articleHistory(text, notes) {
  const all = [...inlineEvents(text), ...footnoteEvents(notes)];
  // Aynı tarih ve aynı kaynaklı kayıtlar birleşir; metin notu ile dipnot aynı değişikliği anlatabilir.
  const seen = new Map();
  for (const e of all) {
    const key = `${e.tarih}|${e.kaynak ?? e.aciklama}|${e.islem}`;
    const prev = seen.get(key);
    if (!prev) seen.set(key, e);
    else {
      if (!prev.aciklama && e.aciklama) prev.aciklama = e.aciklama;
      if (!prev.fikra && e.fikra) prev.fikra = e.fikra;
    }
  }
  return [...seen.values()].sort((a, b) => (a.tarih ?? '9999').localeCompare(b.tarih ?? '9999'));
}
