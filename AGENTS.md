# SAKUS AI Agent

Sakarya Büyükşehir Belediyesi [SAKUS haritasından](https://sakus.sakarya.bel.tr/harita) hat, durak ve anlık otobüs konumunu öğrenen; yolcuya mevcut konum + hedef için en uygun hattı öneren; canlı konumu sohbetle paylaşan bir sistem.

Bu dosya proje beynidir. Cursor kuralları `.cursor/rules/`, Claude kuralları `CLAUDE.md` ve `.claude/` altındadır.

## Ürün yüzeyleri

- **Public site (`/`):** sistemi tanıtan sayfa; sağ altta sohbet widget.
- **Admin:** hatlar (DB), hat özelinde SAKUS güncelleme, anlık otobüs, geçmiş konuşmalar, **AI Agent ve Tool’lar** (agent tanımı + tool→fonksiyon), **Webchat’ler** (agent seçimi + pencere tasarımı + embed script).
- **İki Puppeteer süreci (karıştırma):**
  1. **Ingest** — hat listesi + güzergah/durak + sefer saatleri. Admin “tümünü çek” veya “bu hattı güncelle” ile tekrar çalışır. Sonuç DB.
  2. **Live** — bir hat için anlık araç. SAKUS AJAX/SSE yakalanır, iç sokete basılır; API DB + dış soket.

## Mimari (değiştirme)

- Hub: `React ↔ API ↔ (MySQL | scraper)`. Chatbot Puppeteer’a bağlanmaz.
- SAKUS HTML parse yok. Sayfa origin’inden giden XHR/fetch/SSE `page.waitForResponse` / `page.on('response')` ile yakalanır.
- Bilinen uçlar (sayfa bunları çağırır): `sbbpublicapi.sakarya.bel.tr`
  - `GET /api/v1/Ulasim?busType=3869` ve `5731` — hat listesi
- `GET /api/v1/Ulasim/route-and-busstops/{lineId}` — güzergah + durak
- `GET /api/v1/Ulasim/line-schedule?date=YYYY-MM-DD&lineId=` — sefer saatleri (tarihe göre; hafta içi / Ctesi / Pazar)
- `GET /api/v1/VehicleTracking?AsisId=` — anlık (poll)
  - `GET /api/v1/sakus/vehicle-tracking/stream?AsisId=` — SSE `vehicle-update`
- Tek tarayıcı, hatlar arası delay. [Non-commercial](https://ulasim.sakarya.bel.tr/kullanim-sartlari) kamu verisi; agresif tarama yok.

## Monorepo

```
apps/web       React + Vite — public + chat widget + admin
apps/api       Fastify + Socket.IO + MySQL
apps/scraper   Puppeteer ingest + live
packages/shared
```

Çalıştırma: `docker compose up -d --build` (MySQL 3307 + Puppeteer/Chrome 3102) → kökte `.env` → `npm run dev`. Ingest: admin veya konteyner `POST /ingest`. Live: admin.

## Veri modeli

`hatlar`, `duraklar`, `hat_guzergah`, `hat_duraklari`, `hat_seferleri`, `arac_son_konum`, `ingest_jobs`, `sohbet_oturumlari` (webchat_id, agent_id, host_origin), `sohbet_mesajlari` (rol user|assistant|tool, tool_ad, fonksiyon_kod, meta_json), `kullanici_olaylari`, `toollar`, `agentler`, `agent_toollar`, `webchatler`.

## Chatbot tool’ları

Kod fonksiyonları API’de yaşar; admin’deki tool kaydı bir fonksiyona bağlanır, agent hangi tool’ları kullanacağını seçer.

Yolcu sohbeti tarayıcıdan LLM’e gitmez. `POST /api/chat` webchat’in agent’ını (token, model, sistem prompt, tool’lar) kullanarak sağlayıcıya istek atar. Her tur `sohbet_oturumlari` + `sohbet_mesajlari` + `kullanici_olaylari`’na yazılır. Admin **Gelen kutusu** (`/admin/sohbetler`) webchat, müşteri/asistan metni, tool çağrıları ve host’u gösterir.

Public widget yalnızca `user` / `assistant` metinlerini görür; tool JSON’u admin’dedir. Token admin yanıtında maskelenir.

| Fonksiyon | Ne döner |
|---|---|
| `otobus_sorgula` | Hat özeti (kod, ad, durak/sefer/araç sayısı) |
| `otobus_guzergah_sorgula` | Hat varsa durak sırası; yoksa tüm hat yön özeti |
| `otobus_anlik_konum_sorgula` | Bir hattın son araç konumları (`stale` 30 sn) |
| `otobus_saat_sorgula` | Hareket saatleri |
| `yakin_duraklar` | lat/lng + 600 m yürüme; durak + geçen hatlar |

`rota_oneri` henüz yok. Yolcu sohbeti: OpenAI / Claude / Gemini / Groq / OpenRouter.

## Rota motoru (sonraki faz)

600 m yürüme, direkt hat, sonra 1 aktarma.

## Socket

- İç (`/internal`): live scraper → `arac.konum`; ingest progress.
- Dış: web/admin `arac.konum`. Ham SAKUS JSON’u normalize et.
