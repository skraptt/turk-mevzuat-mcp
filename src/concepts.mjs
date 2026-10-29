// Kavram dizini: gündelik dilde ya da uygulamada kullanılan bir kavramı, kanunun o
// kavramı düzenleyen maddelerine bağlar. Bir kanun kitabının sonundaki "kavram dizini"
// gibi çalışır ve sözcük eşleşmesinin yakalayamadığı durumları kapatır (ör. kanun
// "depozito" demez, "güvence" der).
//
// Eşleşme, sorgunun katlanmış (fold) biçiminde ifadenin geçmesine bakar. İfadeler
// eklerden bağımsız olsun diye kök hâlinde yazılır ("kira artis" → "kira artışı",
// "kira artışında"). Yeni kavram eklerken maddenin gerçekten o kavramı düzenlediğinden
// emin olun; testler her maddenin veride var olduğunu doğrular.

export const CONCEPTS = [
  { ifadeler: ['depozito', 'guvence bedel'], maddeler: ['6098/342'] },
  { ifadeler: ['tahliye taahhud', 'tahliye taahhut'], maddeler: ['6098/352'] },
  { ifadeler: ['iki hakli ihtar'], maddeler: ['6098/352'] },
  { ifadeler: ['kira artis', 'kira zam', 'kira artiş'], maddeler: ['6098/344'] },
  { ifadeler: ['kira tespit', 'kira bedelinin tespit'], maddeler: ['6098/344', '6098/345'] },
  { ifadeler: ['kiracinin temerrud', 'kira odenmez', 'kirayi odem'], maddeler: ['6098/315'] },
  { ifadeler: ['muacceliyet', 'ceza kosulu kira', 'kiraciya ceza'], maddeler: ['6098/346'] },
  { ifadeler: ['alt kira'], maddeler: ['6098/322'] },
  { ifadeler: ['aile konut'], maddeler: ['4721/194', '6098/349'] },
  { ifadeler: ['kira sozlesmesinin feshi', 'kiraci cikmak', 'kira sozlesmesi bildirim'], maddeler: ['6098/347'] },
  { ifadeler: ['ihtiyac nedeniyle tahliye', 'gereksinim nedeniyle tahliye', 'konut ihtiyac'], maddeler: ['6098/350'] },
  { ifadeler: ['genel zamanasim', 'on yillik zamanasim'], maddeler: ['6098/146'] },
  { ifadeler: ['bes yillik zamanasim', 'kira alacagi zamanasim'], maddeler: ['6098/147'] },
  { ifadeler: ['temerrut ihtar', 'ihtarla temerrut', 'borclunun temerrud'], maddeler: ['6098/117'] },
  { ifadeler: ['ayip ihbar'], maddeler: ['6098/223'] },
  { ifadeler: ['cayma hak'], maddeler: ['6502/48'] },
  { ifadeler: ['ayipli mal'], maddeler: ['6502/8', '6502/11'] },
  { ifadeler: ['abonelik iptal', 'abonelik fesih', 'abonelikten cik'], maddeler: ['6502/52'] },
  { ifadeler: ['hakem heyet'], maddeler: ['6502/68', '6502/70'] },
  { ifadeler: ['haksiz sart'], maddeler: ['6502/5'] },
  { ifadeler: ['acik riza'], maddeler: ['6698/3', '6698/5'] },
  { ifadeler: ['aydinlatma metn', 'aydinlatma yukumlulug'], maddeler: ['6698/10'] },
  { ifadeler: ['yurt disina aktar', 'yurtdisina aktar', 'yurt disina veri'], maddeler: ['6698/9'] },
  { ifadeler: ['ilgili kisinin hak', 'veri sahibinin hak'], maddeler: ['6698/11', '6698/13'] },
  { ifadeler: ['rekabet yasag'], maddeler: ['6098/444'] },
  { ifadeler: ['cezai sart', 'ceza kosul'], maddeler: ['6098/420'] },
  { ifadeler: ['kefalet sekl', 'kefaletin sekl', 'kefil olma sekl'], maddeler: ['6098/583'] },
  { ifadeler: ['yetki sozlesme'], maddeler: ['6100/17', '6100/18'] },
  { ifadeler: ['yasal mirasci', 'kanuni mirasci'], maddeler: ['4721/495'] },
  { ifadeler: ['marka basvuru', 'marka tescil'], maddeler: ['6769/11'] },
];
