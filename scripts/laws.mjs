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
  // v0.7: seçili yönetmelikler (MevzuatTur 7 = kurum ve kuruluş yönetmeliği) ve tebliğler (9).
  { no: '24276', name: 'Veri Sorumluları Sicili Hakkında Yönetmelik', abbr: 'VSS Yön.', aliases: ['verbis yönetmeliği', 'sicil yönetmeliği'], tertip: 5, tur: 7, rgTarih: '30.12.2017' },
  { no: '24038', name: 'Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik', abbr: 'Silme ve İmha Yön.', aliases: ['imha yönetmeliği'], tertip: 5, tur: 7, rgTarih: '28.10.2017' },
  { no: '40863', name: 'Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik', abbr: 'Yurt Dışı Aktarım Yön.', aliases: ['yurt dışı aktarım yönetmeliği'], tertip: 5, tur: 7, rgTarih: '10.07.2024' },
  { no: '24454', name: 'Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ', abbr: 'Aydınlatma Tebliği', aliases: ['aydınlatma tebliği'], tertip: 5, tur: 9, rgTarih: '10.03.2018' },
  { no: '24455', name: 'Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ', abbr: 'Başvuru Tebliği', aliases: ['veri sorumlusuna başvuru tebliği'], tertip: 5, tur: 9, rgTarih: '10.03.2018' },
  { no: '20914', name: 'Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik', abbr: 'Ticari İleti Yön.', aliases: ['ticari elektronik ileti yönetmeliği'], tertip: 5, tur: 7, rgTarih: '15.07.2015' },
  { no: '39927', name: 'Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik', abbr: 'E-Ticaret Yön.', aliases: ['e-ticaret yönetmeliği', 'elektronik ticaret yönetmeliği'], tertip: 5, tur: 7, rgTarih: '29.12.2022' },
  { no: '20237', name: 'Mesafeli Sözleşmeler Yönetmeliği', abbr: 'Mesafeli Sözl. Yön.', aliases: ['mesafeli sözleşmeler yönetmeliği'], tertip: 5, tur: 7, rgTarih: '27.11.2014' },
  { no: '39730', name: 'Tüketici Hakem Heyetleri Yönetmeliği', abbr: 'THH Yön.', aliases: ['hakem heyetleri yönetmeliği'], tertip: 5, tur: 7, rgTarih: '21.09.2022' },
  { no: '19782', name: 'Garanti Belgesi Yönetmeliği', abbr: 'Garanti Belgesi Yön.', aliases: [], tertip: 5, tur: 7, rgTarih: '13.06.2014' },
  { no: '19783', name: 'Satış Sonrası Hizmetler Yönetmeliği', abbr: 'Satış Sonrası Hiz. Yön.', aliases: [], tertip: 5, tur: 7, rgTarih: '13.06.2014' },
  { no: '20480', name: 'Abonelik Sözleşmeleri Yönetmeliği', abbr: 'Abonelik Sözl. Yön.', aliases: [], tertip: 5, tur: 7, rgTarih: '24.01.2015' },
  { no: '20435', name: 'Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği', abbr: 'Ticari Reklam Yön.', aliases: ['reklam yönetmeliği'], tertip: 5, tur: 7, rgTarih: '10.01.2015' },
  { no: '19798', name: 'Tüketici Sözleşmelerindeki Haksız Şartlar Hakkında Yönetmelik', abbr: 'Haksız Şartlar Yön.', aliases: [], tertip: 5, tur: 7, rgTarih: '17.06.2014' },
  { no: '20238', name: 'Ön Ödemeli Konut Satışları Hakkında Yönetmelik', abbr: 'Ön Ödemeli Konut Yön.', aliases: [], tertip: 5, tur: 7, rgTarih: '27.11.2014' },
  { no: '20446', name: 'Paket Tur Sözleşmeleri Yönetmeliği', abbr: 'Paket Tur Yön.', aliases: [], tertip: 5, tur: 7, rgTarih: '14.01.2015' },
  { no: '20447', name: 'Taksitle Satış Sözleşmeleri Hakkında Yönetmelik', abbr: 'Taksitle Satış Yön.', aliases: [], tertip: 5, tur: 7, rgTarih: '14.01.2015' },
  { no: '24638', name: 'Hukuk Uyuşmazlıklarında Arabuluculuk Kanunu Yönetmeliği', abbr: 'HUAK Yön.', aliases: ['arabuluculuk yönetmeliği'], tertip: 5, tur: 7, rgTarih: '02.06.2018' },
  { no: '15828', name: 'Tebligat Kanununun Uygulanmasına Dair Yönetmelik', abbr: 'Tebligat Yön.', aliases: ['tebligat yönetmeliği'], tertip: 5, tur: 7, rgTarih: '25.01.2012' },
  { no: '29033', name: 'Elektronik Tebligat Yönetmeliği', abbr: 'E-Tebligat Yön.', aliases: ['elektronik tebligat yönetmeliği', 'e-tebligat yönetmeliği'], tertip: 5, tur: 7, rgTarih: '06.12.2018' },
];

// mevzuat.gov.tr mevzuat türleri: 1 kanun, 7 kurum ve kuruluş yönetmeliği, 9 tebliğ.
export const TUR_ADI = { 1: 'Kanun', 7: 'Yönetmelik', 9: 'Tebliğ' };

export function mevzuatUrl(no, tertip, tur = 1) {
  return `https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=${no}&MevzuatTur=${tur}&MevzuatTertip=${tertip}`;
}

// Kanunun tam metnini veren sayfa (Word'den aktarılmış HTML). Güncelleme betiği bunu okur.
export function metinUrl(no, tertip, tur = 1) {
  return `https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=${tur}&MevzuatNo=${no}&MevzuatTertip=${tertip}`;
}
