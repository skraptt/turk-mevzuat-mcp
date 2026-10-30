// Arama kalitesini ölçer: npm run eval  (ayrıntı için: npm run eval -- --ayrinti)
//
// İki küme vardır:
//   gelistirme — sıralama ve kavram dizini ayarlanırken bakılan sorular.
//   kor        — ayarlama sırasında BAKILMAYAN sorular. Yalnızca sonuç ölçülür; bir değişiklik
//                buradaki bir soruyu düzeltmek için yapılmamalı. Aşırı uyumu (overfitting) yakalar.
// Her soru için kabul edilebilir maddeler (kanunNo/madde) ve bir kategori verilir:
//   eski      — ilk sürümdeki 16 kanunluk set
//   teknik    — hukukçu diliyle sorulmuş
//   gundelik  — vatandaş diliyle sorulmuş
// Ölçütler: ilk 1, ilk 3 isabet ve MRR@5 (ilk doğru sonucun sırasının tersi, ortalama).
// Beklenen maddeler data/mevzuat.json'daki başlık ve metinle tek tek doğrulanmıştır.

import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';

const e = createEngine(JSON.parse(readFileSync(new URL('../data/mevzuat.json', import.meta.url), 'utf8')));
const ayrinti = process.argv.includes('--ayrinti');

const gelistirme = [
  ['kiracı kirayı ödemezse ne olur', ['6098/315','6098/352'], 'eski'],
  ['kiralananın ayıplı teslimi', ['6098/304','6098/305','6098/306'], 'eski'],
  ['kiraya verenin bakım borcu', ['6098/301'], 'eski'],
  ['kira sözleşmesinin yazılı şekli zorunlu mu', ['6098/299','6098/348'], 'eski'],
  ['vekaletin sona ermesi', ['6098/512','6098/513'], 'eski'],
  ['eser sözleşmesinde yüklenicinin sorumluluğu', ['6098/471','6098/474','6098/475'], 'eski'],
  ['haksız fiil sorumluluğu genel', ['6098/49'], 'eski'],
  ['manevi tazminat kişilik hakkı', ['6098/58','4721/25'], 'eski'],
  ['sözleşmenin uyarlanması aşırı ifa güçlüğü', ['6098/138'], 'eski'],
  ['nişanlanma', ['4721/118','4721/119'], 'eski'],
  ['velayet', ['4721/335','4721/336'], 'eski'],
  ['evlat edinme şartları', ['4721/305','4721/306'], 'eski'],
  ['ölüme bağlı tasarruf vasiyetname şekli', ['4721/531','4721/532','4721/538'], 'eski'],
  ['anonim şirket genel kurul toplantısı', ['6102/409','6102/410','6102/414'], 'eski'],
  ['limited şirket müdür sorumluluğu', ['6102/644','6102/553'], 'eski'],
  ['ticari defterler tutma yükümlülüğü', ['6102/64'], 'eski'],
  ['çek karşılıksız', ['5941/5','6102/814'], 'eski'],
  ['tüketici kredisi erken ödeme', ['6502/37'], 'eski'],
  ['paket tur', ['6502/51'], 'eski'],
  ['ön bilgilendirme yükümlülüğü mesafeli', ['6502/48'], 'eski'],
  ['veri güvenliği yükümlülükleri', ['6698/12'], 'eski'],
  ['özel nitelikli kişisel veri', ['6698/6'], 'eski'],
  ['kişisel verilerin silinmesi yok edilmesi', ['6698/7'], 'eski'],
  ['patent alınabilirlik şartları', ['6769/82','6769/83'], 'eski'],
  ['eser sahibinin manevi hakları umuma arz', ['5846/14'], 'eski'],
  ['ihtiyati tedbir şartları', ['6100/389','6100/390'], 'eski'],
  ['delil tespiti', ['6100/400'], 'eski'],
  ['bilirkişi', ['6100/266'], 'eski'],
  ['istinaf süresi', ['6100/345'], 'eski'],
  ['zamanaşımını kesen sebepler', ['6098/154'], 'eski'],
  ['işçinin kıdem ve ihbar süresi', ['4857/17'], 'eski'],
  ['geçersiz fesih sonuçları işe başlatma', ['4857/21'], 'eski'],
  ['işverenin derhal fesih sebepleri ahlak ve iyi niyet', ['4857/25'], 'eski'],
  ['iş sözleşmesinin yazılı şekli', ['4857/8'], 'eski'],
  ['takip talebinde bulunması gereken bilgiler', ['2004/58'], 'eski'],
  ['ödeme emrine itiraz süresi', ['2004/62'], 'eski'],
  ['haczi caiz olmayan mallar', ['2004/82'], 'eski'],
  ['iflas yoluyla takip', ['2004/155', '2004/156', '2004/171'], 'eski'],
  ['bilişim sistemine izinsiz girme', ['5237/243'], 'eski'],
  ['hırsızlık suçunun nitelikli halleri', ['5237/142'], 'eski'],
  ['meşru savunma', ['5237/25'], 'eski'],
  ['zincirleme suç', ['5237/43'], 'eski'],
  ['patronum maaşımı üç aydır yatırmıyor', ['4857/34', '4857/24'], 'gundelik'],
  ['işten çıkarıldım kıdem tazminatı alabilir miyim', ['4857/120', '4857/17'], 'gundelik'],
  ['hafta tatili hakkı', ['4857/46'], 'teknik'],
  ['gece çalışması süresi', ['4857/69'], 'teknik'],
  ['işverenin işçiyi gözetme borcu', ['6098/417'], 'teknik'],
  ['ev sahibi depozitoyu geri vermiyor', ['6098/342'], 'gundelik'],
  ['kiracı evi başkasına kiraya verebilir mi', ['6098/322'], 'gundelik'],
  ['kira sözleşmesi süresi bitince ne olur', ['6098/347', '6098/327'], 'gundelik'],
  ['komşunun ağacı bahçeme taşıyor', ['4721/740', '4721/737'], 'gundelik'],
  ['boşanma sebepleri', ['4721/161', '4721/162', '4721/163', '4721/164', '4721/165', '4721/166'], 'teknik'],
  ['boşanmada nafaka', ['4721/175', '4721/176'], 'gundelik'],
  ['mal rejimi edinilmiş mallara katılma', ['4721/218', '4721/219'], 'teknik'],
  ['saklı pay oranları', ['4721/506'], 'teknik'],
  ['mirası reddetme süresi', ['4721/606'], 'gundelik'],
  ['yöneticinin seçilmesi apartman', ['634/34'], 'gundelik'],
  ['ayıplı aracı geri vermek istiyorum', ['6502/11', '6502/8'], 'gundelik'],
  ['tüketici hakem heyetine nasıl başvurulur', ['39730/11', '6502/68'], 'gundelik'],
  ['internetten aldığım ayakkabıyı geri göndermek istiyorum', ['20237/9', '20237/11', '6502/48'], 'gundelik'],
  ['sözleşmede tek taraflı değiştirme hakkı haksız şart mı', ['6502/5', '19798/5'], 'gundelik'],
  ['şirketim müşteri verisini yurt dışındaki sunucuya aktarabilir mi', ['6698/9', '40863/5'], 'gundelik'],
  ['veri ihlali bildirimi 72 saat', ['6698/12'], 'gundelik'],
  ['kvkk idari para cezası', ['6698/18'], 'teknik'],
  ['birinin fotoğrafını izinsiz paylaşmak suç mu', ['5237/134', '5237/136'], 'gundelik'],
  ['sosyal medyada hakaret edildi', ['5237/125'], 'gundelik'],
  ['trafik kazasında taksirle yaralama', ['5237/89'], 'teknik'],
  ['taksirle öldürme', ['5237/85'], 'teknik'],
  ['haksız tahrik indirimi', ['5237/29'], 'teknik'],
  ['etkin pişmanlık hırsızlık', ['5237/168'], 'teknik'],
  ['gözaltı süresi kaç gün', ['5271/91'], 'gundelik'],
  ['ifade verirken avukat hakkı', ['5271/147', '5271/149', '5271/150'], 'gundelik'],
  ['adli kontrol yükümlülükleri', ['5271/109'], 'teknik'],
  ['telefon dinleme iletişimin denetlenmesi', ['5271/135'], 'gundelik'],
  ['istinaf süresi ceza', ['5271/273'], 'teknik'],
  ['idari para cezasına itiraz', ['5326/27'], 'gundelik'],
  ['kamu görevlisinin kusuru nedeniyle tazminat davası', ['2577/12', '2577/13', '2709/129'], 'gundelik'],
  ['idare mahkemesinde dava açma süresi 60 gün', ['2577/7'], 'gundelik'],
  ['anayasa mahkemesine bireysel başvuru', ['2709/148'], 'gundelik'],
  ['din ve vicdan hürriyeti', ['2709/24'], 'teknik'],
  ['toplantı ve gösteri yürüyüşü hakkı', ['2709/34'], 'teknik'],
  ['görevsizlik kararı', ['6100/20'], 'teknik'],
  ['cevap dilekçesi süresi', ['6100/127'], 'gundelik'],
  ['ıslah', ['6100/176', '6100/177', '6100/180', '6100/181'], 'teknik'],
  ['kesin hüküm', ['6100/303'], 'teknik'],
  ['temyiz süresi hukuk', ['6100/361'], 'teknik'],
  ['arabuluculukta anlaşma belgesinin icra edilebilirliği', ['6325/18'], 'teknik'],
  ['ihtiyari arabuluculuk gizlilik', ['6325/4', '6325/5'], 'teknik'],
  ['e-tebligat ne zaman yapılmış sayılır', ['29033/12'], 'gundelik'],
  ['avukatlık ücret sözleşmesi yazılı olmalı mı', ['1136/163'], 'gundelik'],
  ['vergi incelemesi', ['213/134'], 'teknik'],
  ['vergi cezasında uzlaşma', ['213/Ek 1'], 'teknik'],
  ['siteye erişim engeli kaldırma', ['5651/8', '5651/9/A'], 'gundelik'],
  ['markam başkası tarafından kullanılıyor', ['6769/7', '6769/29'], 'gundelik'],
  ['tasarım tescili koruma süresi', ['6769/69'], 'teknik'],
  ['eser sahibinin izni olmadan kitabın çoğaltılması', ['5846/22', '5846/71'], 'gundelik'],
  ['anonim şirkette pay devri', ['6102/490'], 'teknik'],
  ['limited şirketten ortağın çıkması', ['6102/638'], 'gundelik'],
  ['poliçe ciro', ['6102/684'], 'teknik'],
  ['karşılıksız çek cezası', ['5941/5'], 'gundelik'],
  ['kiracıya tahliye için icra takibi', ['2004/269', '2004/272'], 'gundelik'],
  ['iflas erteleme konkordato', ['2004/285'], 'teknik'],
  ['sermaye piyasasında içerden öğrenenlerin ticareti', ['6362/106'], 'teknik'],
];

const kor = [
  ['yıllık izin kaç gün', ['4857/53'], 'gundelik'],
  ['işçiye mobbing uygulanması', ['4857/24', '6098/417'], 'gundelik'],
  ['ev sahibi oğlu evlenecek diye beni çıkarmak istiyor', ['6098/350'], 'gundelik'],
  ['kiralananın yeniden inşası ve imarı', ['6098/350'], 'teknik'],
  ['anlaşmalı boşanma şartları', ['4721/166'], 'gundelik'],
  ['mirasçılıktan çıkarma', ['4721/510'], 'teknik'],
  ['kat malikinin gürültü yapması', ['634/18'], 'gundelik'],
  ['telefonum garanti süresi içinde bozuldu', ['6502/11', '19782/8', '6502/56'], 'gundelik'],
  ['ücretsiz deneme sonrası otomatik yenilenen abonelik', ['20480/10', '6502/52'], 'gundelik'],
  ['çalışanların parmak izi ile mesai takibi', ['6698/6', '6698/5'], 'gundelik'],
  ['kişisel verileri hukuka aykırı olarak verme veya ele geçirme', ['5237/136'], 'teknik'],
  ['şantaj', ['5237/107'], 'teknik'],
  ['kasten öldürme nitelikli halleri', ['5237/82'], 'teknik'],
  ['zorunluluk hali', ['5237/25'], 'teknik'],
  ['tutukluluğa itiraz', ['5271/101', '5271/104', '5271/267'], 'gundelik'],
  ['kovuşturmaya yer olmadığı kararına itiraz', ['5271/172', '5271/173'], 'teknik'],
  ['trafik cezasına itiraz süresi', ['5326/27'], 'gundelik'],
  ['yürütmenin durdurulması şartları', ['2577/27'], 'teknik'],
  ['mülkiyet hakkı anayasa', ['2709/35'], 'teknik'],
  ['dava açılması dilekçe içeriği', ['6100/119'], 'teknik'],
  ['tanık dinletmek', ['6100/240', '6100/241'], 'gundelik'],
  ['arabulucuya gitmeden iş davası açılabilir mi', ['7036/3'], 'gundelik'],
  ['tebligat yapılamadı adres bulunamadı', ['15828/30', '15828/48'], 'gundelik'],
  ['avukatın sır saklama yükümlülüğü', ['1136/36'], 'teknik'],
  ['e-ticaret sitesinde satıcının bilgi verme yükümlülüğü', ['6563/3', '39927/5'], 'gundelik'],
  ['marka tescilinde mutlak ret nedenleri', ['6769/5'], 'teknik'],
  ['bilgisayar programlarının korunması', ['5846/2'], 'teknik'],
  ['haksız rekabet', ['6102/54', '6102/55'], 'teknik'],
  ['borçlu icra takibinde mal beyanında bulunmadı', ['2004/76', '2004/337'], 'gundelik'],
  ['ilamsız takipte itirazın iptali davası süresi', ['2004/67'], 'teknik'],
];

function olc(ad, cases) {
  const by = {};
  const add = (k, r) => { const s = (by[k] ??= { n: 0, t1: 0, t3: 0, rr: 0 }); s.n++; s.t1 += r === 1; s.t3 += r > 0 && r <= 3; s.rr += r ? 1 / r : 0; };
  if (ayrinti) console.log(`\n— ${ad} —`);
  for (const [q, ok, kat] of cases) {
    const ids = e.search({ sorgu: q, limit: 5 }).sonuclar.map((x) => x.kimlik);
    const i = ids.findIndex((x) => ok.includes(x));
    const r = i === -1 ? 0 : i + 1;
    add('toplam', r); add(kat, r);
    if (ayrinti) console.log(r === 1 ? '✓' : r && r <= 3 ? '~' : r ? '·' : '✗', q.padEnd(58), ids.slice(0, 3).join('  '));
  }
  const satir = (k, s) => `  ${k.padEnd(10)} ${String(s.n).padStart(3)} soru   ilk 1: ${(100 * s.t1 / s.n).toFixed(0).padStart(3)}%   ilk 3: ${(100 * s.t3 / s.n).toFixed(0).padStart(3)}%   MRR@5: ${(s.rr / s.n).toFixed(3)}`;
  console.log(`\n${ad}`);
  for (const k of ['toplam', 'eski', 'teknik', 'gundelik']) if (by[k]) console.log(satir(k, by[k]));
  return by.toplam;
}

olc('gelistirme', gelistirme);
olc('kor', kor);
