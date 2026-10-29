import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, extractDocument, decodeEntities } from '../scripts/lib/html.mjs';
import { parseKanun } from '../scripts/lib/parse.mjs';
import { checkLaw, compareArticles, excerpt } from '../scripts/refresh.mjs';

// mevzuat.gov.tr'deki Word HTML'sinin küçük bir örneği (yapı gerçek sayfadan alındı).
const p = (inner) => `<p class=MsoNormal style='text-align:justify;text-indent:35.45pt;line-height:\r\n127%'>${inner}</p>\r\n\r\n`;
const sp = (t) => `<span style='font-size:12.0pt;line-height:127%;color:black'>${t}</span>`;
const page = (maddeler, no = '6698') => `<html><head><style>p{margin:0}</style></head>
<link rel=stylesheet href=/x.css>
<html><head><meta http-equiv=Content-Type content="text/html; charset=Windows-1254"></head><body lang=TR>
<div class=WordSection1>
${p(`<b>${sp('ÖRNEK\r\nKANUN')}</b>`)}
${p(sp('Kanun\r\nNumarası&nbsp;&nbsp;&nbsp; : ' + no))}
${p(sp('Kabul\r\nTarihi : 24/3/2016'))}
${p(sp('Yayımlandığı\r\nResmî Gazete   : Tarih  : 7/4/2016 Sayı  :  29677'))}
${p(`<b>${sp('BİRİNCİ BÖLÜM')}</b>`)}
${p(`<b>${sp('Genel Hükümler')}</b>`)}
${maddeler}
<div><br clear=all><hr align=left size=1 width="33%">
<div id=ftn1>${p('<a href="#_ftnref1" name="_ftn1"><span class=MsoFootnoteReference>[1]</span></a><i> 1/1/2020 tarihli Kanunla değiştirilmiştir.</i>')}</div>
<div id=ftn2>${p('<a href="#_ftnref2" name="_ftn2"><span class=MsoFootnoteReference>[2]</span></a><i> İkinci dipnot.</i>')}</div>
</div></div></body></html><p id="page-end"></p><script>var x = '<p>MADDE 99- sahte</p>';</script>`;

const madde = (n, baslik, metin) =>
  p(`<b>${sp(baslik)}</b>`) + p(`<b>${sp(`MADDE ${n}- `)}</b>${sp(metin)}`);

const v1 = page(
  madde(1, 'Amaç', '(1) Bu Kanunun amacı,\r\nkişisel verilerin işlenmesinde temel hakları korumaktır.') +
  madde(2, 'Kapsam', '(1) Bu Kanun hükümleri<a href="#_ftn1" name="_ftnref1"><sup>[1]</sup></a> uygulanır.') +
  p(sp('a) Birinci bent &amp; ek.')) +
  madde(3, 'Tanımlar', '(1) Açık rıza: &#304;lgili kişinin onayı.'),
);

test('Word HTML düz metne çevrilir: paragraflar, satır içi boşluklar, varlıklar', () => {
  const t = htmlToText(v1);
  assert.match(t, /^ÖRNEK KANUN\n\nKanun Numarası    : 6698\n/);
  assert.match(t, /MADDE 1- \(1\) Bu Kanunun amacı, kişisel verilerin/);
  assert.match(t, /a\) Birinci bent & ek\./);
  assert.match(t, /İlgili kişinin onayı/);
  assert.doesNotMatch(t, /MADDE 99/); // betik içeriği alınmaz
  assert.match(t, /\[1\] 1\/1\/2020 tarihli/);
  assert.equal(decodeEntities('&lt;&#x130;&gt;&bilinmeyen;'), '<İ>&bilinmeyen;');
  assert.equal(extractDocument('<html><body><img></body></html>'), null);
});

test('çevrilen metin ayrıştırıcıyla maddelere ayrılır, dipnotlar bağlanır', () => {
  const k = parseKanun(htmlToText(v1), 'x.txt');
  assert.equal(k.no, '6698');
  assert.deepEqual(k.maddeler.map((m) => m.madde), ['1', '2', '3']);
  assert.equal(k.maddeler[1].baslik, 'Kapsam');
  assert.equal(k.maddeler[1].bolum, 'Genel Hükümler');
  assert.match(k.maddeler[1].metin, /hükümleri uygulanır\.\na\) Birinci bent/);
  assert.deepEqual(k.maddeler[1].dipnotlar, ['1/1/2020 tarihli Kanunla değiştirilmiştir.']);
});

const law = { no: '6698', tertip: 5 };
const oldText = htmlToText(v1);

test('aynı metin: fark yok', () => {
  const r = checkLaw(law, v1, oldText);
  assert.equal(r.fark.ayni, true);
  assert.equal(r.maddeSayisi, 3);
});

test('değişen, eklenen ve çıkan maddeler bulunur', () => {
  const v2 = page(
    madde(1, 'Amaç', '(1) Bu Kanunun amacı, kişisel verilerin işlenmesinde özel hayatın gizliliğini korumaktır.') +
    madde(2, 'Kapsam', '(1) Bu Kanun hükümleri<a href="#_ftn1" name="_ftnref1"><sup>[1]</sup></a> uygulanır.') +
    p(sp('a) Birinci bent &amp; ek.')) +
    madde(3, 'Tanımlar', '(1) Açık rıza: İlgili kişinin onayı.') +
    madde('3/A', 'Yeni', '(1) Yeni hüküm.'),
  );
  const r = checkLaw(law, v2, oldText);
  assert.equal(r.fark.ayni, false);
  assert.deepEqual(r.fark.degisen.map((d) => d.madde), ['1']);
  assert.deepEqual(r.fark.eklenen.map((d) => d.madde), ['3/A']);
  const x = excerpt(r.fark.degisen[0].eski.metin, r.fark.degisen[0].yeni.metin);
  assert.match(x.eski, /temel hakları/);
  assert.match(x.yeni, /özel hayatın gizliliğini/);

  const c = compareArticles(parseKanun(oldText, 'x').maddeler, parseKanun(htmlToText(page(madde(1, 'Amaç', '(1) Bu Kanunun amacı, kişisel verilerin işlenmesinde temel hakları korumaktır.'))), 'x').maddeler);
  assert.deepEqual(c.cikan.map((m) => m.madde), ['2', '3']);
});

test('emniyet freni: yanlış kanun, boş sayfa, madde sayısında düşüş', () => {
  assert.throws(() => checkLaw(law, page(madde(1, 'A', 'x'), '6098'), oldText), /beklenen 6698/);
  assert.throws(() => checkLaw(law, '<html><body>Bakım çalışması</body></html>', oldText), /kanun metni bulunamadı/);
  assert.throws(() => checkLaw(law, page(madde(1, 'Amaç', '(1) Bu Kanunun amacı.')), oldText), /şüpheli düşüş/);
});

test('dipnot işaretiyle biten son cümle sonraki maddenin başlığına kaymaz', () => {
  const html = page(
    madde(1, 'Amaç', '(1) Birinci cümle. İkinci cümle verilebilir.<a href="#_ftn1" name="_ftnref1"><span class=MsoFootnoteReference>[1]</span></a>') +
    p(`<b>${sp('6 – İtirazın hükmü:')}</b>`) +
    p(`<b>${sp('MADDE 2- ')}</b>${sp('(1) Tekrar atıf (…)</span><sup><span class=MsoFootnoteReference>2</span></sup><span> bildirilir.')}`),
  );
  const [m1, m2] = parseKanun(htmlToText(html), 'x').maddeler;
  assert.match(m1.metin, /İkinci cümle verilebilir\.$/);
  assert.deepEqual(m1.dipnotlar, ['1/1/2020 tarihli Kanunla değiştirilmiştir.']);
  assert.equal(m2.baslik, '6 – İtirazın hükmü'); // tireli, iki noktalı alt başlık
  assert.match(m2.metin, /\(…\) bildirilir\.$/); // bağlantısız üst simge dipnot sayılır
  assert.deepEqual(m2.dipnotlar, ['İkinci dipnot.']);
});

test('üst simge olmayan dipnot atfı ve kanun ekleri', () => {
  const html = page(
    madde(1, 'Amaç', '(1) Kararın (…)</span><span class=MsoFootnoteReference>2</span><span> tebliğinden itibaren.') +
    madde(2, 'Yürütme', '(1) Bu Kanun hükümlerini Cumhurbaşkanı yürütür.') +
    p(sp('(I) SAYILI CETVEL')) + p(sp('KADRO LİSTESİ')) + '<table><tr><td>GİH</td><td>Uzman</td></tr></table>',
  );
  const [m1, m2] = parseKanun(htmlToText(html), 'x').maddeler;
  assert.match(m1.metin, /\(…\) tebliğinden/);
  assert.deepEqual(m1.dipnotlar, ['İkinci dipnot.']);
  assert.equal(m2.metin, '(1) Bu Kanun hükümlerini Cumhurbaşkanı yürütür.');
});
