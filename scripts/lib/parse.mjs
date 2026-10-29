// Kanun metnini (mevzuat.gov.tr'deki künyeli düz metin) maddelere ayırır.
// Ayrıştırma mantığı mikeTR'deki import-kanunlar.ts'den alınmıştır. Bağımlılık yoktur;
// derleme betiği, güncelleme betiği ve tarayıcıdaki doğrulama aynı kodu kullanır.

// "MADDE 1-", "Madde 1 –", "Geçici Madde 2-", "EK MADDE 3 –", "Madde 1/A –", "MADDE 146 ila 149 –"
// "MADDE 61. -" (noktalı) ve tire olmadan "(Mülga: …)" ile başlayan madde başlıkları da tanınır.
export const HEADING = /^\s*(?:(ge[çÇ][iİ]c[iİ]|ek|m[üÜ]kerrer)\s+)?madde\s+(\d+(?:\/[a-zçğıöşü])?)(?:\s+ila\s+(\d+))?\s*(?:\.?\s*[-–—]\s*|(?=\((?:Mülga|İptal)))/iu;

function isTitleLine(line) {
  // Satır sonundaki dipnot işaretleri ("…verilebilir.[2]") karar verirken sayılmaz.
  const t = line.trim().replace(/(?:\s*\[\d+\])+$/, '');
  // "2. Nutuklar:" gibi iki nokta ile biten numaralı başlıklar da başlıktır.
  if (/^(?:[IVX]+|[A-ZÇĞİÖŞÜ]|\d+|[a-zçğıöşü]{1,3})\s?[.)\-–]\s+\S.{0,140}:$/u.test(t)) return true;
  return t.length > 0 && t.length < 150 && !/[.:;,]$/.test(t) && !/^\(\d+\)/.test(t);
}

// "BİRİNCİ KİTAP", "İKİNCİ KISIM", "ÜÇÜNCÜ BÖLÜM", "BİRİNCİ AYIRIM": bölüm başlıkları.
// Başlığın adı bir sonraki dolu satırdadır ("KİŞİLER HUKUKU").
// Eski kanunlarda (ör. İİK) kısım yerine "BAP" kullanılır.
const SECTION = /^\s*[A-ZÇĞİÖŞÜÂÎÛ]+(?:\s+[A-ZÇĞİÖŞÜÂÎÛ]+)?\s+(KİTAP|KISIM|BAP|BÖLÜM|AYIRIM)\s*$/u;
const SECTION_LEVEL = { KİTAP: 0, KISIM: 1, BAP: 1, BÖLÜM: 2, AYIRIM: 3 };

function titleCaseTr(text) {
  const small = new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de', 'ki']);
  return text
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1)))
    .join(' ');
}

// Her satır için o noktada geçerli bölüm yolunu (Kitap › Kısım › Bölüm › Ayırım) hesaplar.
function sectionPaths(lines) {
  const stack = [];
  const at = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SECTION);
    if (m) {
      const level = SECTION_LEVEL[m[1]];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const name = j < lines.length && isTitleLine(lines[j]) && !SECTION.test(lines[j]) && !HEADING.test(lines[j]) ? lines[j].trim() : null;
      stack.length = level;
      stack[level] = name ? titleCaseTr(name) : null;
    }
    at[i] = stack.filter(Boolean).join(' › ') || null;
  }
  return at;
}

function readKunye(lines) {
  const field = (re) => lines.find((l) => re.test(l));
  const kabul = field(/Kabul Tarihi/i)?.split(':').slice(1).join(':').trim() || null;
  // "Yayımlandığı Resmî Gazete", "Yayımlandığı R.Gazete", kaynaktaki yazım hatasıyla "Yayımlandğı"
  const rgLine = field(/Yay[ıi]mland\S*\s+R(?:esm[îi])?\.?\s*Gazete/i) || '';
  const tarih = rgLine.match(/Tarihi?\s*:\s*([\d/.]+)/i)?.[1] || null;
  const sayi = rgLine.match(/Sayı\s*:\s*(\d+)/i)?.[1] || null;
  const fmt = (d) => (d ? d.split(/[/.]/).map((p) => p.padStart(2, '0')).join('.') : null);
  return { kabul: fmt(kabul), rgTarih: fmt(tarih), rgSayi: sayi };
}

// mevzuat.gov.tr'nin web görünümünden alınan metinlerde dipnotlar "[1]" gibi işaretlerle
// gösterilir ve dosyanın sonunda listelenir. Dipnotlar değişiklik ve Anayasa Mahkemesi
// iptal bilgisi taşıdığı için atılmaz: işaretler metinden çıkarılır, dipnot metni ilgili
// maddeye "dipnotlar" olarak eklenir.
function splitFootnotes(lines) {
  const start = lines.findIndex((l, i) => /^\s*\[1\]\s/.test(l) && lines.slice(i + 1).some((x) => /^\s*\[2\]\s/.test(x)));
  if (start === -1) return { body: lines, notes: new Map() };
  const notes = new Map();
  let cur = null;
  for (const l of lines.slice(start)) {
    const m = l.match(/^\s*\[(\d+)\]\s*(.*)$/);
    if (m) {
      cur = m[1];
      notes.set(cur, m[2].trim());
    } else if (cur && l.trim()) {
      notes.set(cur, `${notes.get(cur)} ${l.trim()}`);
    }
  }
  return { body: lines.slice(0, start), notes };
}

function preprocess(text) {
  let lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''));
  const { body, notes } = splitFootnotes(lines);
  lines = body;
  // Madde başlığından hemen önce gelen ve iki nokta ile biten kısa satır, eski kanunlarda
  // (ör. İİK) madde başlığıdır: "İflas daireleri:" → "İflas daireleri".
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!/:(\[\d+\])*$/.test(t) || t.length > 150 || /^\(/.test(t)) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j < lines.length && HEADING.test(lines[j])) lines[i] = lines[i].replace(/:((?:\[\d+\])*)\s*$/, '$1');
  }
  return { lines, notes };
}

function takeNotes(text, notes) {
  const ids = [...text.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
  return {
    clean: text.replace(/\[(\d+)\]/g, ''),
    notes: [...new Set(ids)].filter((id) => notes.has(id)).map((id) => notes.get(id)),
  };
}

export function parseKanun(text, fileName) {
  const pre = preprocess(text);
  const allLines = pre.lines;
  // Kanunun sonundaki "işlenemeyen hükümler" ve "değişiklik getiren mevzuat / yürürlüğe giriş
  // tarihleri" tabloları madde değildir. Başlık birkaç satıra bölünmüş olabilir.
  let tailStart = allLines.findIndex((l) => /İŞLENEMEYEN|DEĞİŞİKLİK GETİREN|YÜRÜRLÜĞE GİRİŞ TARİHİNİ GÖSTERİR/u.test(l));
  // Üstündeki "… SAYILI KANUNA EK VE" gibi büyük harfli başlık satırları da bu bölüme aittir.
  const isUpper = (l) => /\p{Lu}{3}/u.test(l) && l === l.toLocaleUpperCase('tr-TR') && !HEADING.test(l);
  for (let k = 0; tailStart > 0 && k < 5; k++) {
    let j = tailStart - 1;
    while (j > 0 && !allLines[j].trim()) j--;
    if (!isUpper(allLines[j]) || /^\s*\S+\s+(?:KİTAP|KISIM|BAP|BÖLÜM|AYIRIM)\s*$/u.test(allLines[j])) break;
    tailStart = j;
  }
  let lines = tailStart === -1 ? allLines : allLines.slice(0, tailStart);
  // Son maddeden sonra gelen "(1) SAYILI LİSTE", "(I) SAYILI CETVEL" gibi kanun ekleri (kadro
  // listeleri vb.) madde metni değildir; son maddeye eklenmemeleri için kesilir.
  const lastHeading = lines.findLastIndex((l) => HEADING.test(l));
  const annex = lines.findIndex((l, i) => i > lastHeading && /^\s*\((?:[IVX]+|\d+)\)\s*SAYILI\s+(?:LİSTE|CETVEL)\s*(?:\[\d+\])*\s*$/u.test(l));
  if (lastHeading > -1 && annex > -1) lines = lines.slice(0, annex);

  const noLine = lines.find((l) => /^\s*Kanun Numarası\s*:/i.test(l));
  const no = noLine?.split(':')[1]?.trim() || fileName.match(/^(\d+)/)?.[1];
  if (!no) throw new Error(`${fileName}: kanun numarası bulunamadı`);

  const headingIdx = lines.flatMap((l, i) => (HEADING.test(l) ? [i] : []));
  const paths = sectionPaths(lines);
  const out = [];
  let pendingTitle = [];
  for (let i = (headingIdx[0] ?? 0) - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue; // web görünümünden alınan metinlerde satır aralarında boşluk vardır
    if (!isTitleLine(lines[i]) || /Kanun Numarası|Kabul Tarihi|Yayımlandığı/u.test(lines[i])) break; // künye başlık değildir
    pendingTitle.unshift(lines[i].trim());
  }

  for (let h = 0; h < headingIdx.length; h++) {
    const start = headingIdx[h];
    const end = h + 1 < headingIdx.length ? headingIdx[h + 1] : lines.length;
    const m = lines[start].match(HEADING);
    const prefix = m[1] ? (/^ek$/i.test(m[1]) ? 'Ek ' : /^m[üÜ]/i.test(m[1]) ? 'Mükerrer ' : 'Geçici ') : '';
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
    const rawTitle = pendingTitle.slice(-2).join(' / ');
    const t1 = takeNotes(metin, pre.notes);
    const t2 = takeNotes(rawTitle, pre.notes);
    const baslik =
      t2.clean
        .split(' / ')
        .map((t) => t.replace(/\uFFFC/g, '').replace(/\s+/g, ' ').trim().replace(/\s*:$/, '').replace(/([a-zçğıöşüâîû)])\d{1,2}$/iu, '$1').trim())
        .filter(Boolean)
        .join(' / ') || null;
    const dipnotlar = [...new Set([...t2.notes, ...t1.notes])];
    out.push({ madde, baslik, metin: t1.clean.replace(/ +\n/g, '\n').trim(), bolum: paths[start] ? takeNotes(paths[start], pre.notes).clean : null, dipnotlar });
    pendingTitle = nextTitle;
  }
  return { no, kunye: readKunye(lines), maddeler: out };
}
