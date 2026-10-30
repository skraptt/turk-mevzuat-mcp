import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine, buildIndex, encodeIndex, decodeIndex } from '../src/engine.mjs';
import { CONCEPTS } from '../src/concepts.mjs';
import { fold, tokenize } from '../src/text.mjs';

const data = JSON.parse(readFileSync(new URL('../data/mevzuat.json', import.meta.url), 'utf8'));
const engine = createEngine(data);

test('Türkçe karakter katlama', () => {
  assert.equal(fold('KİRACININ TEMERRÜDÜ'), 'kiracinin temerrudu');
  assert.equal(fold('Işık Çağ Şöför'), 'isik cag sofor');
  assert.deepEqual(tokenize('kiracının'), tokenize('KIRACININ'));
});

test('kanun çözümleme: kısaltma, numara, ad, takma ad', () => {
  for (const k of ['TBK', 'tbk', '6098', '6098 sayılı Kanun', 'Türk Borçlar Kanunu', 'borçlar kanunu']) {
    assert.equal(engine.resolveLaw(k)?.no, '6098', k);
  }
  assert.equal(engine.resolveLaw('İş Kanunu')?.no, '4857');
  assert.equal(engine.resolveLaw('İİK')?.no, '2004');
  assert.equal(engine.resolveLaw('Gelir Vergisi Kanunu'), null);
});

test('madde getirme: normal, harfli, geçici, aralık', () => {
  const r = engine.getArticle({ kanun: 'TBK', madde: '315' });
  assert.equal(r.maddeler[0].atif, 'TBK m. 315');
  assert.match(r.maddeler[0].metin, /muaccel olan kira bedelini/);
  assert.equal(r.maddeler[0].kaynak.url, 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6098&MevzuatTur=1&MevzuatTertip=5');
  assert.equal(engine.getArticle({ kanun: 'FSEK', madde: '1/a' }).maddeler[0].madde, '1/A');
  assert.equal(engine.getArticle({ kanun: 'TMK', madde: 'geçici 1' }).maddeler[0].atif, 'TMK geçici m. 1');
  assert.equal(engine.getArticle({ kanun: 'TBK', madde: 'Geçici madde 2' }).maddeler[0].atif, 'TBK geçici m. 2');
  const range = engine.getArticle({ kanun: '6098', madde: '344-347' });
  assert.deepEqual(range.maddeler.map((m) => m.madde), ['344', '345', '346', '347']);
});

test('madde getirme: anlaşılır hatalar', () => {
  assert.match(engine.getArticle({ kanun: 'KVKK', madde: '99' }).error, /bulunamadı/);
  assert.match(engine.getArticle({ kanun: 'Yok Kanunu', madde: '1' }).error, /Kanun bulunamadı/);
  assert.match(engine.getArticle({ kanun: 'TBK', madde: '1-50' }).error, /en fazla 10/);
});

test('atıf olarak yazılan sorgu doğrudan maddeyi döndürür', () => {
  for (const q of ['TBK m. 315', 'tbk md 315', '6098/315', 'Borçlar Kanunu m.315', 'TBK 315']) {
    const r = engine.search({ sorgu: q });
    assert.equal(r.dogrudanAtif, true, q);
    assert.equal(r.sonuclar[0].kimlik, '6098/315', q);
  }
});

test('kanun filtresi', () => {
  const r = engine.search({ sorgu: 'cayma hakkı', kanun: 'TKHK' });
  assert.ok(r.sonuclar.length > 0);
  assert.ok(r.sonuclar.every((s) => s.kanun.no === '6502'));
});

test('kavram dizinindeki her madde veride var', () => {
  for (const c of CONCEPTS) {
    for (const id of c.maddeler) {
      const [k, m] = id.split('/');
      assert.ok(engine.getArticle({ kanun: k, madde: m }).maddeler?.length, `${id} veride yok`);
    }
  }
});

test('derlenmiş dizin, çalışma anında kurulanla aynı sonucu verir', () => {
  const { index, ...raw } = data;
  const live = createEngine(raw);
  for (const q of ['kiracının temerrüdü', 'açık rıza', 'rekabet yasağı işçi', 'yetki sözleşmesi']) {
    assert.deepEqual(
      engine.search({ sorgu: q }).sonuclar.map((s) => s.kimlik),
      live.search({ sorgu: q }).sonuclar.map((s) => s.kimlik),
      q,
    );
  }
  // Kodlama kayıpsızdır: her terimin kayıtları aynen geri gelir.
  const built = buildIndex(raw.articles.slice(0, 300));
  const roundtrip = decodeIndex(encodeIndex(built));
  for (const [t, p] of built.postings) assert.deepEqual(roundtrip.postings.get(t), p, t);
  assert.deepEqual([...roundtrip.docLen], [...built.docLen]);
});

test('her sonuç kaynak ve tarih taşır', () => {
  for (const s of engine.search({ sorgu: 'ayıplı mal', limit: 5 }).sonuclar) {
    assert.ok(s.atif && s.kimlik && s.kaynak.url.startsWith('https://www.mevzuat.gov.tr/'));
    assert.match(s.kaynak.metinTarihi, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('fıkra ve bent atıfları', () => {
  const b = engine.getArticle({ kanun: 'KVKK', madde: '5/2-ç' }).maddeler[0];
  assert.equal(b.atif, 'KVKK m. 5/2-ç');
  assert.match(b.alinti, /^ç\) Veri sorumlusunun hukuki yükümlülüğünü/);
  assert.match(b.metin, /^\(1\) Kişisel veriler/); // maddenin tamamı da döner
  assert.match(engine.getArticle({ kanun: 'KVKK', madde: '5/2-c' }).maddeler[0].alinti, /^c\) Bir sözleşmenin/);
  assert.equal(engine.getArticle({ kanun: 'KVKK', madde: '5 f.2 b.ç' }).maddeler[0].atif, 'KVKK m. 5/2-ç');
  // Numarasız fıkralı madde: her paragraf bir fıkra
  assert.match(engine.getArticle({ kanun: 'TBK', madde: '315/2' }).maddeler[0].alinti, /^Kiracıya verilecek süre en az on gün/);
  // Harfli madde fıkra sanılmaz
  assert.equal(engine.getArticle({ kanun: 'FSEK', madde: '1/A' }).maddeler[0].atif, 'FSEK m. 1/A');
  assert.match(engine.getArticle({ kanun: 'TBK', madde: '315/9' }).error, /2 fıkradan/);
  const s = engine.search({ sorgu: 'KVKK m. 5/2-ç' });
  assert.equal(s.dogrudanAtif, true);
  assert.equal(s.sonuclar[0].atif, 'KVKK m. 5/2-ç');
});

test('maddeler bölüm yolunu taşır', () => {
  const a = engine.getArticle({ kanun: 'TBK', madde: '315' }).maddeler[0];
  assert.match(a.bolum, /Kira Sözleşmesi/);
  assert.match(engine.getArticle({ kanun: 'TTK', madde: '409' }).maddeler[0].bolum, /Anonim Şirket › Genel Kurul/);
});

test('mevzuat.gov.tr web metinleri: dipnotlar ayrılır, başlıklar korunur', () => {
  const a = engine.getArticle({ kanun: 'İİK', madde: '2' }).maddeler[0];
  assert.equal(a.baslik, 'İflas daireleri'); // "İflas daireleri:" başlığı tanındı
  for (const s of engine.search({ sorgu: 'icra dairesi', kanun: 'İİK', limit: 20 }).sonuclar) {
    assert.doesNotMatch(s.ozet, /\[\d+\]/); // dipnot işareti metinde kalmaz
  }
  const dip = engine.getArticle({ kanun: 'İş K.', madde: '18' }).maddeler[0];
  assert.ok(dip.dipnotlar?.length > 0);
  assert.match(dip.kaynak.metinTarihi, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(dip.kaynak.sonKontrol >= dip.kaynak.metinTarihi); // kontrol günü metin tarihinden önce olamaz
  assert.equal(engine.getArticle({ kanun: 'TCK', madde: '157' }).maddeler[0].baslik, 'Dolandırıcılık');
});

test('mükerrer maddeler ve üç haneli kanun numaraları', () => {
  const mini = createEngine({
    snapshot: '2026-10-29',
    laws: [{ no: '213', name: 'Vergi Usul Kanunu', abbr: 'VUK', aliases: [], url: 'https://www.mevzuat.gov.tr/x', resmiGazete: {}, maddeSayisi: 2 }],
    articles: [
      { k: '213', m: '257', b: 'Maliye Bakanlığının yetkisi', y: null, t: '(1) Birinci.' },
      { k: '213', m: 'Mükerrer 257', b: 'Yetki', y: null, t: '(1) Mükerrer madde metni.' },
    ],
  });
  assert.equal(mini.getArticle({ kanun: '213', madde: 'mükerrer 257' }).maddeler[0].atif, 'VUK mükerrer m. 257');
  assert.equal(mini.getArticle({ kanun: 'VUK', madde: 'Mükerrer Madde 257' }).maddeler[0].metin, '(1) Mükerrer madde metni.');
  assert.equal(mini.getArticle({ kanun: 'VUK', madde: '257' }).maddeler[0].baslik, 'Maliye Bakanlığının yetkisi');
  const s = mini.search({ sorgu: 'VUK mükerrer m. 257' });
  assert.equal(s.dogrudanAtif, true);
  assert.equal(s.sonuclar[0].kimlik, '213/Mükerrer 257');
  assert.equal(mini.resolveLaw('213 sayılı Kanun')?.no, '213');
});

test('paket Cloudflare Workers ücretsiz plan sınırının altında', async () => {
  const { gzipSync } = await import('node:zlib');
  const size = gzipSync(readFileSync(new URL('../data/mevzuat.json', import.meta.url)), { level: 9 }).length;
  // Sınır 3 MiB (sıkıştırılmış, kod dahil). Kod ve yuvarlama payı için 2,8 MB'ta uyar.
  assert.ok(size < 2.8e6, `veri sıkıştırılmış hâlde ${(size / 1e6).toFixed(2)} MB; sınıra yaklaşıldı`);
});

test('madde tarihçesi: metin notları, dipnotlar, AYM kararları', async () => {
  const { articleHistory } = await import('../src/history.mjs');
  const h = articleHistory(
    '(1) Birinci fıkra.\n(2) (Değişik: 16/7/2026-7589/19 md.) İkinci fıkra.\n(3) (Ek: 2/7/2018-KHK/700/145 md.; Mülga: 1/1/2020 - 7200/3 md.)\n(4) (İptal: Anayasa Mahkemesinin 11/10/2023 tarihli ve E.: 2020/76; K.: 2023/172 sayılı Kararı ile.)',
    ['24/6/2026 tarihli ve 7587 sayılı Kanunun 10 uncu maddesi ile bu bentte yer alan “iki” ibaresi “beş” şeklinde değiştirilmiştir.', 'Bu hükmün uygulanmasında ek 1 inci maddeye bakınız.'],
  );
  assert.deepEqual(
    h.map((e) => [e.tarih, e.islem, e.kaynak, e.fikra ?? null]),
    [
      ['2018-07-02', 'ekleme', '700 sayılı KHK m. 145', 3],
      ['2020-01-01', 'yürürlükten kaldırma', '7200 sayılı Kanun m. 3', 3],
      ['2023-10-11', 'iptal', 'AYM E. 2020/76, K. 2023/172', 4],
      ['2026-06-24', 'değişiklik', '7587 sayılı Kanun m. 10', null],
      ['2026-07-16', 'değişiklik', '7589 sayılı Kanun m. 19', 2],
      [null, 'not', undefined, null],
    ],
  );
  const r = engine.getHistory({ kanun: 'HMK', madde: '107' });
  assert.equal(r.atif, 'HMK m. 107');
  assert.ok(r.olaylar.some((e) => e.tarih === '2026-07-16' && e.islem === 'yürürlükten kaldırma' && e.kaynak === '7589 sayılı Kanun m. 19'));
  assert.match(engine.getHistory({ kanun: 'HMK', madde: '9999' }).error, /bulunamadı/);
});

test('gündelik dil genişletmesi: kanunda geçmeyen "patron" sözcüğü "işveren" ile eşleşir', () => {
  assert.ok(!JSON.stringify(data.articles).toLocaleLowerCase('tr-TR').includes('patron'));
  const r = engine.search({ sorgu: 'patron', kanun: 'İş Kanunu', limit: 3 }).sonuclar;
  assert.ok(r.length > 0 && r.every((x) => fold(x.baslik).includes("isveren")), r.map((x) => x.baslik).join(" | "));
});

test('sorguda adı geçen kanun öne çıkar', () => {
  const r = engine.search({ sorgu: 'kvkk idari para cezası', limit: 1 }).sonuclar;
  assert.equal(r[0].kimlik, '6698/18');
});

test('amaç, kapsam ve yürürlük maddeleri konu sorularında geri çekilir', () => {
  const r = engine.search({ sorgu: 'elektronik ticaret hizmet sağlayıcı', limit: 3 }).sonuclar.map((x) => x.baslik || '');
  assert.ok(!r.some((b) => /^(Amaç|Kapsam|Yürürlük|Yürütme)$/u.test(b.split(' / ').pop())), r.join(' | '));
});

test('konuşma dili sözcükleri yalnızca sorguda atılır', () => {
  assert.deepEqual(tokenize('geri vermek istiyorum', { query: true }).filter((t) => !t.startsWith('~')), ['geri', 'verme']);
  assert.ok(tokenize('istiyorum').length > 0);
});
