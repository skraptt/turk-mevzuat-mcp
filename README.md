# Türk Mevzuat MCP

**Türk kanunları için açık kaynak bir [Model Context Protocol](https://modelcontextprotocol.io) sunucusu.**
Claude gibi AI asistanlarına bağlanır; kanun maddelerini arar, tam metni getirir ve
her sonucu atıf ("TBK m. 315"), Resmî Gazete künyesi ve mevzuat.gov.tr bağlantısıyla
döndürür.

> ⚠️ **Hukuki görüş değildir.** Sunucu kanun metnine erişim sağlar; metnin belirli bir
> tarihteki hâlini döndürür. Güncel değişiklikleri mevzuat.gov.tr üzerinden doğrulayın.

*English summary below.*

## Araçlar

| Araç | Ne yapar |
|---|---|
| `search_legislation` | Doğal dil sorgusuyla madde arar ("kiracının temerrüdü", "açık rıza olmadan veri işleme"). Sorgu bir atıfsa ("TBK m. 315", "6098/344", "TMK geçici m. 1") doğrudan o maddeyi döndürür. `kanun` ile tek kanunda aranabilir. |
| `get_article` | Bir maddenin tam metnini getirir. `madde`: "315", "1/A", "Geçici 1", "Ek 3", en fazla 10 maddelik aralık ("344-347") ya da fıkra ve bent ("315/2", "5/2-ç"). Fıkra istenirse ilgili bölüm ayrıca `alinti` olarak döner. |
| `list_laws` | Kapsanan kanunları künyeleriyle listeler. |

Bütün araçlar salt okunurdur (`readOnlyHint: true`). Kanun metni çıktıda
`<kanun_metni>` etiketleri içinde, veri olarak verilir.

## Kapsam (v0.1)

13 kanun, 4.388 madde. Metin tarihi: **10.10.2026**.

| Kısaltma | Kanun |
|---|---|
| TMK | 4721 sayılı Türk Medeni Kanunu (ve 4722 sayılı Yürürlük Kanunu) |
| TBK | 6098 sayılı Türk Borçlar Kanunu (ve 6101 sayılı Yürürlük Kanunu) |
| TTK | 6102 sayılı Türk Ticaret Kanunu (ve 6103 sayılı Yürürlük Kanunu) |
| HMK | 6100 sayılı Hukuk Muhakemeleri Kanunu |
| TKHK | 6502 sayılı Tüketicinin Korunması Hakkında Kanun |
| KVKK | 6698 sayılı Kişisel Verilerin Korunması Kanunu |
| FSEK | 5846 sayılı Fikir ve Sanat Eserleri Kanunu |
| SMK | 6769 sayılı Sınai Mülkiyet Kanunu |
| SPK | 6362 sayılı Sermaye Piyasası Kanunu |
| Çek K. | 5941 sayılı Çek Kanunu |

Henüz kapsanmayanlar: İş Kanunu (4857), İcra ve İflas Kanunu (2004), Türk Ceza
Kanunu (5237), yönetmelikler ve içtihat.

## Arama nasıl çalışır?

- **Sözcük araması (BM25):** Türkçe karakterler katlanır ("kiracinin" = "kiracının")
  ve sözcükler iki düzeyde köklenir (ilk 5 ve ilk 7 karakter). Madde başlıkları
  gövdeden daha ağır sayılır.
- **Kavram dizini** (`src/concepts.mjs`): Kanunun kullanmadığı gündelik terimleri
  ilgili maddeye bağlar; örneğin kanun "depozito" demez, TBK m. 342 "güvence" der.
  Kanun kitaplarının sonundaki kavram dizini gibi çalışır ve hukukçular tarafından
  genişletilebilir.
- **Bölüm yolu:** Her madde, bulunduğu "Kitap › Kısım › Bölüm › Ayırım" başlıklarıyla
  birlikte dizine eklenir (ör. TTK m. 409: "Ticaret Şirketleri › Anonim Şirket › Genel
  Kurul"). Böylece "anonim şirket genel kurul toplantısı" gibi konu aramaları doğru bölüme
  gider. Bölüm yolu sonuçlarda `bolum` alanında da gösterilir.
- **Atıf tanıma:** "TBK m. 315", "Borçlar Kanunu m.315", "6098/315", "KVKK m. 5/2-ç",
  "KVKK m. 5 f.2 b.ç" gibi yazımlar.

Ağ erişimi ve dış servis yoktur; veri sunucunun içine gömülüdür.

**Ölçülen kalite** (`npm run eval`, 30 sorguluk küçük bir deneme seti): doğru madde
ilk sonuçta 17/30, ilk üç sonuçta 23/30. Sözcük araması anlam benzerliğini
yakalayamaz; anlamsal arama (embedding) bir sonraki sürümün konusu.

## Kurulum ve çalıştırma

Bağımlılık yoktur; Node.js 20+ yeterlidir.

```bash
npm test             # birim ve protokol testleri
npm run eval         # arama kalitesi
npm run dev          # yerel sunucu: http://localhost:8787/mcp
```

### Cloudflare Workers'a yayımlama

```bash
npx wrangler@4 login
npm run deploy       # → https://turk-mevzuat-mcp.<hesabınız>.workers.dev/mcp
```

Veri dosyası (sıkıştırılmış ~1,4 MB) Worker'ın içine gömülür; ücretsiz planın paket
sınırına sığar.

### Claude'a bağlama

Claude'da özel connector olarak ekleyin ve sunucu adresi olarak
`https://<worker-adresiniz>/mcp` girin. Kimlik doğrulama gerekmez.

## Veriyi güncelleme

1. `sources/` klasöründeki `.txt` dosyalarını mevzuat.gov.tr'deki güncel metinle
   değiştirin (künyeli düz metin biçimi).
2. Yeni bir kanun ekliyorsanız `scripts/laws.mjs` dosyasına künyesini ekleyin.
3. `node scripts/build-data.mjs --snapshot YYYY-MM-DD` ile veriyi ve dizini yeniden
   üretin, `npm test` ile kontrol edin.

## Veri kaynağı ve lisans

Kanun metinleri [mevzuat.gov.tr](https://www.mevzuat.gov.tr)'den alınmıştır. FSEK
m. 31 uyarınca resmen yayımlanan kanunların çoğaltılması, yayılması ve işlenmesi
serbesttir. Madde ayrıştırma, dizin ve sunucu kodu Apache-2.0 lisanslıdır.
Bu proje T.C. Cumhurbaşkanlığı Mevzuat Bilgi Sistemi ile bağlantılı değildir.

## Gizlilik

- Sunucu kullanıcı hesabı, çerez ya da kimlik doğrulama kullanmaz.
- Gönderdiğiniz sorgular yalnızca cevabı üretmek için işlenir; sunucu tarafından
  kaydedilmez, saklanmaz ve üçüncü kişilerle paylaşılmaz. Kodda kayıt (log) tutan
  bir bölüm yoktur ve Cloudflare gözlemlenebilirlik kayıtları kapalıdır
  (`wrangler.toml`).
- Sunucu Cloudflare Workers üzerinde çalışır. Cloudflare, hizmeti sunmak ve
  güvenliği sağlamak için IP adresi gibi bağlantı verilerini kendi
  [gizlilik politikasına](https://www.cloudflare.com/privacypolicy/) göre işler.
- Saklama: Sunucu kişisel veri saklamaz.
- İletişim: [GitHub'da bildirim açın](https://github.com/skraptt/turk-mevzuat-mcp/issues).

---

## English

**An open-source MCP server for Turkish legislation.** It lets AI assistants such
as Claude search Turkish statutes, fetch the full text of an article, and cite it
with the official short form (e.g. "TBK m. 315"), the Official Gazette (Resmî
Gazete) reference and a link to mevzuat.gov.tr, the government's legislation
portal.

- **Tools:** `search_legislation` (Turkish natural-language search or a citation),
  `get_article` (full text of an article, a range of up to 10, or a single
  paragraph/sub-paragraph such as "KVKK m. 5/2-ç"), `list_laws`.
  All tools are read-only.
- **Coverage:** 13 core statutes, 4,388 articles: Civil Code, Code of Obligations,
  Commercial Code, Civil Procedure, Consumer Protection, Personal Data Protection
  (KVKK), copyright, industrial property, capital markets, cheques. Text as of
  10 October 2026.
- **Provenance:** every result carries a citation, a stable id (`6098/315`), the
  Official Gazette date and number, the source URL and the text date. Statute text
  is returned inside `<kanun_metni>` tags and must be treated as data.
- **No authentication, no external calls, no logging.** Runs on Cloudflare
  Workers with the data bundled in.
- **Licence:** code Apache-2.0. Statute texts are free to reproduce under
  Art. 31 of the Turkish Law on Intellectual and Artistic Works.
- **Not legal advice.**
