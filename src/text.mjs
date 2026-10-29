// Türkçe metin normalizasyonu ve basit kök bulma.
//
// Kök bulma için "ilk 5 karakter" (F5) yöntemi kullanılır: Türkçe gibi eklemeli
// dillerde bu basit kesme, bilgi erişiminde morfolojik çözümleyicilere yakın sonuç
// verir (Can vd., 2008, "Information retrieval on Turkish texts", JASIST).
// "kiracının", "kiracıya", "kiracı" → "kirac".

const FOLD = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function fold(text) {
  return String(text)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/i̇/g, 'i')
    .replace(/[çğıöşüâîû]/g, (ch) => FOLD[ch] || ch);
}

// Arama için anlamı zayıf sözcükler (katlanmış biçimde).
const STOP = new Set(
  [
    've', 'veya', 'ile', 'ya', 'da', 'de', 'ki', 'bu', 'su', 'o', 'bir', 'icin', 'gibi', 'olan', 'olarak',
    'ise', 'en', 'her', 'hem', 'ne', 'mi', 'mu', 'ya', 'yada', 'ancak', 'fakat', 'ama', 'daha', 'cok',
    'kadar', 'sonra', 'once', 'uzere', 'dair', 'iliskin', 'hakkinda', 'gore', 'karsi', 'tarafindan',
    'madde', 'maddesi', 'maddede', 'fikra', 'fikrasi', 'bent', 'bendi', 'kanun', 'kanunu', 'kanunun',
    'nedir', 'nasil', 'hangi', 'midir', 'mudur', 'olur', 'olabilir', 'var', 'yok',
    // Soru kalıplarındaki fiiller: "ne yapabilir", "ne olur", "dava açabilir mi"
    'yapabilir', 'yapabilirim', 'yapar', 'yapmali', 'yapilir', 'yapmak', 'edebilir', 'eder', 'etmek',
    'olursa', 'neler', 'gerekir', 'lazim', 'mumkun', 'durumunda', 'halinde', 'ben', 'benim', 'bana',
  ].map(fold),
);

export const STEM_LEN = 5;

export function stem(token) {
  return token.length > STEM_LEN ? token.slice(0, STEM_LEN) : token;
}

// İkinci, daha ince kök: 5 karakterlik kesmenin birleştirdiği sözcükleri ayırır
// ("güvence" ile "güvenilir" F5'te aynı köke düşer, F7'de ayrılır). Uzun kökte eşleşen
// maddeler hem iki terimden puan alır hem de uzun kökün nadirliği sayesinde öne çıkar.
export const FINE_LEN = 7;

// Metni katlanmış, köklenmiş sözcüklere ayırır. Sayılar korunur (madde atıfları için).
export function tokenize(text) {
  const out = [];
  for (const raw of fold(text).split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    if (raw.length < 2 && !/\d/.test(raw)) continue;
    out.push(stem(raw));
    if (raw.length > STEM_LEN) out.push('~' + raw.slice(0, FINE_LEN));
  }
  return out;
}
