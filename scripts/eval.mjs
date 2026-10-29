// Arama kalitesini ölçer: node scripts/eval.mjs
// Her sorgu için kabul edilebilir maddeler listelenir; ilk 1 ve ilk 3 isabet oranı yazdırılır.
// Arama ya da kavram dizini değiştiğinde çalıştırın; yeni sorgular ekleyerek seti büyütün.

import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';

const e = createEngine(JSON.parse(readFileSync(new URL('../data/mevzuat.json', import.meta.url), 'utf8')));

const cases = [
  // [sorgu, kabul edilebilir maddeler (kanunNo/madde)]
 ['kiracı kirayı ödemezse ne olur', ['6098/315','6098/352']],
 ['kiralananın ayıplı teslimi', ['6098/304','6098/305','6098/306']],
 ['kiraya verenin bakım borcu', ['6098/301']],
 ['kira sözleşmesinin yazılı şekli zorunlu mu', ['6098/299','6098/348']],
 ['vekaletin sona ermesi', ['6098/512','6098/513']],
 ['eser sözleşmesinde yüklenicinin sorumluluğu', ['6098/471','6098/474','6098/475']],
 ['haksız fiil sorumluluğu genel', ['6098/49']],
 ['manevi tazminat kişilik hakkı', ['6098/58','4721/25']],
 ['sözleşmenin uyarlanması aşırı ifa güçlüğü', ['6098/138']],
 ['nişanlanma', ['4721/118','4721/119']],
 ['velayet', ['4721/335','4721/336']],
 ['evlat edinme şartları', ['4721/305','4721/306']],
 ['ölüme bağlı tasarruf vasiyetname şekli', ['4721/531','4721/532','4721/538']],
 ['anonim şirket genel kurul toplantısı', ['6102/409','6102/410','6102/414']],
 ['limited şirket müdür sorumluluğu', ['6102/644','6102/553']],
 ['ticari defterler tutma yükümlülüğü', ['6102/64']],
 ['çek karşılıksız', ['5941/5','6102/814']],
 ['tüketici kredisi erken ödeme', ['6502/37']],
 ['paket tur', ['6502/51']],
 ['ön bilgilendirme yükümlülüğü mesafeli', ['6502/48']],
 ['veri güvenliği yükümlülükleri', ['6698/12']],
 ['özel nitelikli kişisel veri', ['6698/6']],
 ['kişisel verilerin silinmesi yok edilmesi', ['6698/7']],
 ['patent alınabilirlik şartları', ['6769/82']],
 ['eser sahibinin manevi hakları umuma arz', ['5846/14']],
 ['ihtiyati tedbir şartları', ['6100/389','6100/390']],
 ['delil tespiti', ['6100/400']],
 ['bilirkişi', ['6100/266']],
 ['istinaf süresi', ['6100/345']],
 ['zamanaşımını kesen sebepler', ['6098/154']],
];

let top1 = 0;
let top3 = 0;
for (const [q, ok] of cases) {
  const r = e.search({ sorgu: q, limit: 3 }).sonuclar.map((x) => x.kimlik);
  const a = ok.includes(r[0]);
  const b = r.some((x) => ok.includes(x));
  if (a) top1++;
  if (b) top3++;
  console.log(b ? (a ? '✓' : '~') : '✗', q.padEnd(44), r.join('  '));
}
console.log(`\nilk 1: ${top1}/${cases.length}   ilk 3: ${top3}/${cases.length}`);
