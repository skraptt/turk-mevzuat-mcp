// Desteklenen kanunların künye bilgileri. Ad, kısaltma ve tertip elle tutulur;
// Resmî Gazete tarihi ve sayısı derleme sırasında metnin künyesinden okunur.
// Tertip, mevzuat.gov.tr bağlantısı için gereklidir (1960 öncesi kanunlar 3. tertip).
// Metnin tarihi ve son kontrol günü data/sources.json'da tutulur (scripts/refresh.mjs).

export const LAWS = [
  { no: '4721', name: 'Türk Medeni Kanunu', abbr: 'TMK', aliases: ['medeni kanun'], tertip: 5 },
  { no: '4722', name: 'Türk Medeni Kanununun Yürürlüğü ve Uygulama Şekli Hakkında Kanun', abbr: 'TMK Yürürlük', aliases: [], tertip: 5,
    // Kaynak metindeki künyede sayı "246007" olarak yazılmış; TMK ile aynı Resmî Gazete'de yayımlandı.
    rgSayi: '24607' },
  { no: '5846', name: 'Fikir ve Sanat Eserleri Kanunu', abbr: 'FSEK', aliases: ['telif kanunu'], tertip: 3 },
  { no: '5941', name: 'Çek Kanunu', abbr: 'Çek K.', aliases: ['çek kanunu'], tertip: 5 },
  { no: '6098', name: 'Türk Borçlar Kanunu', abbr: 'TBK', aliases: ['borçlar kanunu'], tertip: 5 },
  { no: '6100', name: 'Hukuk Muhakemeleri Kanunu', abbr: 'HMK', aliases: [], tertip: 5 },
  { no: '6101', name: 'Türk Borçlar Kanununun Yürürlüğü ve Uygulama Şekli Hakkında Kanun', abbr: 'TBK Yürürlük', aliases: [], tertip: 5 },
  { no: '6102', name: 'Türk Ticaret Kanunu', abbr: 'TTK', aliases: ['ticaret kanunu'], tertip: 5 },
  { no: '6103', name: 'Türk Ticaret Kanununun Yürürlüğü ve Uygulama Şekli Hakkında Kanun', abbr: 'TTK Yürürlük', aliases: [], tertip: 5 },
  { no: '6362', name: 'Sermaye Piyasası Kanunu', abbr: 'SPK', aliases: [], tertip: 5 },
  { no: '6502', name: 'Tüketicinin Korunması Hakkında Kanun', abbr: 'TKHK', aliases: ['tüketici kanunu'], tertip: 5 },
  { no: '6698', name: 'Kişisel Verilerin Korunması Kanunu', abbr: 'KVKK', aliases: ['kvk kanunu'], tertip: 5 },
  { no: '6769', name: 'Sınai Mülkiyet Kanunu', abbr: 'SMK', aliases: [], tertip: 5 },
  { no: '2004', name: 'İcra ve İflas Kanunu', abbr: 'İİK', aliases: ['icra kanunu', 'icra iflas kanunu'], tertip: 3 },
  { no: '4857', name: 'İş Kanunu', abbr: 'İş K.', aliases: ['iş kanunu', 'is kanunu'], tertip: 5 },
  { no: '5237', name: 'Türk Ceza Kanunu', abbr: 'TCK', aliases: ['ceza kanunu'], tertip: 5 },
  // v0.5: usul, kamu ve bilişim hukuku
  { no: '2709', name: 'Türkiye Cumhuriyeti Anayasası', abbr: 'AY', aliases: ['anayasa', 'türkiye cumhuriyeti anayasası'], tertip: 5 },
  { no: '5271', name: 'Ceza Muhakemesi Kanunu', abbr: 'CMK', aliases: ['ceza muhakemesi kanunu', 'ceza muhakemeleri kanunu'], tertip: 5 },
  { no: '2577', name: 'İdari Yargılama Usulü Kanunu', abbr: 'İYUK', aliases: ['idari yargılama usulü kanunu'], tertip: 5 },
  { no: '6325', name: 'Hukuk Uyuşmazlıklarında Arabuluculuk Kanunu', abbr: 'HUAK', aliases: ['arabuluculuk kanunu'], tertip: 5 },
  { no: '7036', name: 'İş Mahkemeleri Kanunu', abbr: 'İş Mah. K.', aliases: ['iş mahkemeleri kanunu'], tertip: 5 },
  { no: '5326', name: 'Kabahatler Kanunu', abbr: 'Kab. K.', aliases: ['kabahatler kanunu'], tertip: 5 },
  { no: '634', name: 'Kat Mülkiyeti Kanunu', abbr: 'KMK', aliases: ['kat mülkiyeti kanunu'], tertip: 5 },
  { no: '1136', name: 'Avukatlık Kanunu', abbr: 'Av. K.', aliases: ['avukatlık kanunu'], tertip: 5 },
  { no: '213', name: 'Vergi Usul Kanunu', abbr: 'VUK', aliases: ['vergi usul kanunu'], tertip: 4 },
  { no: '5651', name: 'İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun', abbr: '5651 s. K.', aliases: ['internet kanunu', '5651 sayılı kanun'], tertip: 5 },
  { no: '6563', name: 'Elektronik Ticaretin Düzenlenmesi Hakkında Kanun', abbr: 'ETDHK', aliases: ['elektronik ticaret kanunu', 'e-ticaret kanunu'], tertip: 5 },
];

export function mevzuatUrl(no, tertip) {
  return `https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=${no}&MevzuatTur=1&MevzuatTertip=${tertip}`;
}

// Kanunun tam metnini veren sayfa (Word'den aktarılmış HTML). Güncelleme betiği bunu okur.
export function metinUrl(no, tertip) {
  return `https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=${no}&MevzuatTertip=${tertip}`;
}
