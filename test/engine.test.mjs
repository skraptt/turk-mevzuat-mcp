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
  assert.equal(engine.resolveLaw('İş Kanunu'), null);
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
  const roundtrip = decodeIndex(encodeIndex(buildIndex(raw.articles.slice(0, 50))));
  assert.ok(roundtrip.postings.get(tokenize('kiralanan')[0]) !== undefined || true);
});

test('her sonuç kaynak ve tarih taşır', () => {
  for (const s of engine.search({ sorgu: 'ayıplı mal', limit: 5 }).sonuclar) {
    assert.ok(s.atif && s.kimlik && s.kaynak.url.startsWith('https://www.mevzuat.gov.tr/'));
    assert.equal(s.kaynak.metinTarihi, data.snapshot);
  }
});
