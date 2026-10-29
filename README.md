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
| `get_article_history` | Bir maddenin değişiklik geçmişini tarih sırasıyla verir: hangi tarihte, hangi kanun ya da KHK maddesiyle değiştirildiği, eklendiği, yürürlükten kaldırıldığı ya da Anayasa Mahkemesince iptal edildiği ve hangi fıkrada. mevzuat.gov.tr metnindeki notlardan ve dipnotlardan çıkarılır. |
| `list_laws` | Kapsanan kanunları künyeleriyle listeler. |

Bütün araçlar salt okunurdur (`readOnlyHint: true`). Kanun metni çıktıda
`<kanun_metni>` etiketleri içinde, veri olarak verilir.

## Kapsam

27 kanun, yaklaşık 6.900 madde. Her sonuç iki tarih taşır: `metinTarihi` (metnin alındığı gün) ve
`sonKontrol` (metnin mevzuat.gov.tr'deki güncel hâliyle en son karşılaştırıldığı gün).
Metinler her gün otomatik olarak kontrol edilir (bkz. [Güncellik](#güncellik)).

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
| İş K. | 4857 sayılı İş Kanunu |
| İİK | 2004 sayılı İcra ve İflas Kanunu |
| TCK | 5237 sayılı Türk Ceza Kanunu |
| CMK | 5271 sayılı Ceza Muhakemesi Kanunu |
| Kab. K. | 5326 sayılı Kabahatler Kanunu |
| AY | 2709 sayılı Türkiye Cumhuriyeti Anayasası |
| İYUK | 2577 sayılı İdari Yargılama Usulü Kanunu |
| HUAK | 6325 sayılı Hukuk Uyuşmazlıklarında Arabuluculuk Kanunu |
| İş Mah. K. | 7036 sayılı İş Mahkemeleri Kanunu |
| KMK | 634 sayılı Kat Mülkiyeti Kanunu |
| Av. K. | 1136 sayılı Avukatlık Kanunu |
| VUK | 213 sayılı Vergi Usul Kanunu |
| 5651 s. K. | 5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi … Hakkında Kanun |
| ETDHK | 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun |

Henüz kapsanmayanlar: diğer vergi kanunları, yönetmelikler ve içtihat.

**İçtihat için:** Bu sunucu yalnızca kanun metni verir. Yargıtay, Danıştay ve Anayasa Mahkemesi
kararları için açık kaynak [Yargı MCP](https://github.com/saidsurucu/yargi-mcp) sunucusunu
birlikte kullanabilirsiniz: biri kanunun güncel metnini, öteki o maddeyi uygulayan kararları getirir.

mevzuat.gov.tr'deki dipnotlar (değişiklik ve Anayasa Mahkemesi iptal kararı notları)
atılmaz; ilgili maddenin sonucunda `dipnotlar` alanında döner.

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
- **Atıf tanıma:** "VUK mükerrer m. 257", "TBK m. 315", "Borçlar Kanunu m.315", "6098/315", "KVKK m. 5/2-ç",
  "KVKK m. 5 f.2 b.ç" gibi yazımlar.

Ağ erişimi ve dış servis yoktur; veri sunucunun içine gömülüdür.

**Ölçülen kalite** (`npm run eval`, 42 sorguluk küçük bir deneme seti): doğru madde
ilk sonuçta 26/42, ilk üç sonuçta 34/42. Setin bir kısmı kavram dizinindeki terimleri
içerdiği için bu oran gerçek kullanımdakinden iyimser olabilir. Sözcük araması anlam benzerliğini
yakalayamaz; anlamsal arama (embedding) bir sonraki sürümün konusu.

## Kurulum ve çalıştırma

Bağımlılık yoktur; Node.js 20+ yeterlidir.

```bash
npm test             # veriyi derler, birim ve protokol testlerini çalıştırır
npm run eval         # arama kalitesi
npm run dev          # yerel sunucu: http://localhost:8787/mcp
```

### Cloudflare Workers'a yayımlama

```bash
npx wrangler@4 login
npm run deploy       # → https://turk-mevzuat-mcp.<hesabınız>.workers.dev/mcp
```

Veri dosyası (sıkıştırılmış ~2,2 MB) Worker'ın içine gömülür; ücretsiz planın paket
sınırına sığar.

### Claude'a bağlama

Claude'da özel connector olarak ekleyin ve sunucu adresi olarak
`https://<worker-adresiniz>/mcp` girin. Kimlik doğrulama gerekmez.

## Güncellik

Kanun metinleri GitHub Actions ile her gün mevzuat.gov.tr'deki güncel hâlleriyle
karşılaştırılır ([`refresh.yml`](.github/workflows/refresh.yml)):

1. Her kanunun tam metin sayfası indirilir, düz metne çevrilir (`scripts/lib/html.mjs`) ve
   maddelere ayrılır (`scripts/lib/parse.mjs`).
2. Yeni metin, mevcut metinle **madde madde** karşılaştırılır.
3. **Fark yoksa** `data/sources.json`'daki kontrol tarihi işlenir ve sunucu yeniden yayımlanır;
   sonuçlardaki `sonKontrol` alanı o günü gösterir.
4. **Fark varsa** değişen, eklenen ve çıkan maddeleri gösteren bir rapor ile PR açılır.
   Metin değişikliği, PR bir insan tarafından incelenip birleştirilmeden yayına girmez.
5. **Emniyet freni:** sayfa alınamazsa, sayfada beklenen kanun yoksa ya da madde sayısı
   şüpheli biçimde düşerse o kanuna dokunulmaz ve bir issue açılır.

Elle çalıştırmak için:

```bash
npm run refresh                       # tüm kanunlar; rapor: refresh-report.md
node scripts/refresh.mjs --only 6098 --dry-run
```

Yeni kanun eklemek için `scripts/laws.mjs` dosyasına künyesini, `data/sources.json`
dosyasına boş bir metinle kaydını ekleyip `npm run refresh` çalıştırın.

Kurulum (bir kez): depoda `CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID` secret'ları
tanımlanmalı ve *Settings › Actions › General* altında "Allow GitHub Actions to create and
approve pull requests" açık olmalıdır.

## Veri kaynağı ve lisans

Kanun metinleri [mevzuat.gov.tr](https://www.mevzuat.gov.tr)'den alınmıştır. FSEK
m. 31 uyarınca resmen yayımlanan kanunların çoğaltılması, yayılması ve işlenmesi
serbesttir. Madde ayrıştırma, dizin ve sunucu kodu Apache-2.0 lisanslıdır.
Bu proje T.C. Cumhurbaşkanlığı Mevzuat Bilgi Sistemi ile bağlantılı değildir.

## Gizlilik

Ayrıntılı ve İngilizce metin: [PRIVACY.md](PRIVACY.md).

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
  paragraph/sub-paragraph such as "KVKK m. 5/2-ç"), `get_article_history` (when and
  by which law an article was amended, repealed or annulled), `list_laws`.
- **Case law:** not included; pair it with the open-source
  [Yargı MCP](https://github.com/saidsurucu/yargi-mcp) for court decisions.
  All tools are read-only.
- **Freshness:** a daily GitHub Action compares every statute with mevzuat.gov.tr
  article by article. Unchanged texts get a new `sonKontrol` (last checked) date;
  changes open a pull request with a diff report for human review.
- **Coverage:** 27 statutes, about 6,900 articles: the Constitution, Civil Code, Code of
  Obligations, Commercial Code, Civil, Criminal and Administrative Procedure, mediation,
  Labour Law and labour courts, Enforcement and Bankruptcy Law, Criminal Code,
  misdemeanours, condominium, the Attorneys Act, tax procedure, internet and e-commerce law, Consumer Protection, Personal Data Protection (KVKK), copyright,
  industrial property, capital markets, cheques. Each result states its text date.
- **Provenance:** every result carries a citation, a stable id (`6098/315`), the
  Official Gazette date and number, the source URL and the text date. Statute text
  is returned inside `<kanun_metni>` tags and must be treated as data.
- **No authentication, no external calls, no logging.** Runs on Cloudflare
  Workers with the data bundled in.
- **Licence:** code Apache-2.0. Statute texts are free to reproduce under
  Art. 31 of the Turkish Law on Intellectual and Artistic Works.
- **Privacy policy:** [PRIVACY.md](PRIVACY.md). No accounts, no cookies, no logging;
  queries are processed in memory only.
- **Not legal advice.**
