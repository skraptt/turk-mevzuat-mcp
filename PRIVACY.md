# Privacy Policy / Gizlilik Politikası

**Türk Mevzuat MCP** — https://github.com/skraptt/turk-mevzuat-mcp
Last updated / Son güncelleme: 29 October 2026

## English

Türk Mevzuat MCP is a read-only server that returns the text of Turkish statutes. It has
no user accounts, no sign-in, no cookies and no analytics.

- **Data collection.** The server receives only what an MCP client sends in a request:
  the tool name and its arguments (for example a search phrase such as "kiracının
  temerrüdü" or a citation such as "TBK m. 315"). It does not ask for, and is not
  designed to receive, personal data. Please do not put personal or confidential
  information into search queries.
- **Usage and storage.** Requests are processed in memory only to produce the response.
  The server code writes no logs, and Cloudflare Workers observability (request
  logging) is disabled in the deployment configuration (`wrangler.toml`). Nothing from
  a request is stored after the response is sent.
- **Third-party sharing.** Requests are not sold, shared or forwarded. The server makes
  no outbound calls while answering; the statute data is bundled into it. The server
  runs on Cloudflare Workers. Cloudflare processes connection data such as IP addresses
  to deliver and secure the service, under the
  [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/). The daily
  freshness check runs on GitHub Actions and only downloads public pages from
  mevzuat.gov.tr; it does not involve user data.
- **Data retention.** The server retains no request data. Any connection data kept by
  Cloudflare is retained under Cloudflare's own policy.
- **Contact.** Open an issue at https://github.com/skraptt/turk-mevzuat-mcp/issues.

## Türkçe

Türk Mevzuat MCP, Türk kanunlarının metnini döndüren salt okunur bir sunucudur.
Kullanıcı hesabı, oturum açma, çerez ya da analiz aracı yoktur.

- **Toplanan veriler.** Sunucu yalnızca MCP istemcisinin istekte gönderdiğini alır:
  araç adı ve parametreleri (ör. "kiracının temerrüdü" gibi bir arama ifadesi ya da
  "TBK m. 315" gibi bir atıf). Kişisel veri istemez ve almak üzere tasarlanmamıştır.
  Arama ifadelerine kişisel ya da gizli bilgi yazmayın.
- **Kullanım ve saklama.** İstekler yalnızca cevabı üretmek için bellekte işlenir.
  Sunucu kodu kayıt (log) tutmaz ve Cloudflare Workers gözlemlenebilirlik kayıtları
  yapılandırmada kapalıdır (`wrangler.toml`). Cevap gönderildikten sonra istekten
  hiçbir şey saklanmaz.
- **Üçüncü kişilerle paylaşım.** İstekler satılmaz, paylaşılmaz, başka yere iletilmez.
  Sunucu cevap verirken dışarıya bağlanmaz; mevzuat verisi sunucunun içindedir. Sunucu
  Cloudflare Workers üzerinde çalışır. Cloudflare, hizmeti sunmak ve güvenliği sağlamak
  için IP adresi gibi bağlantı verilerini
  [kendi gizlilik politikasına](https://www.cloudflare.com/privacypolicy/) göre işler.
  Günlük güncellik kontrolü GitHub Actions'ta çalışır ve yalnızca mevzuat.gov.tr'deki
  herkese açık sayfaları indirir; kullanıcı verisiyle ilgisi yoktur.
- **Saklama süresi.** Sunucu istek verisi saklamaz. Cloudflare'in tuttuğu bağlantı
  verileri Cloudflare'in politikasına tabidir.
- **İletişim.** https://github.com/skraptt/turk-mevzuat-mcp/issues adresinde bildirim açın.
