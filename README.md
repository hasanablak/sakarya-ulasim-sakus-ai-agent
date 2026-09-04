# SAKUS Asistan

Sakarya Büyükşehir Belediyesi [SAKUS haritasındaki](https://sakus.sakarya.bel.tr/harita) hat, durak ve anlık otobüs konumunu öğrenen; yolcuya sohbetle yardımcı olan bir sistem.

Yolcu sohbeti tarayıcıdan LLM’e gitmez. İstekler bizim API’den geçer, loglanır ve admin gelen kutusunda görünür.

Veri [SAKUS / public API](https://ulasim.sakarya.bel.tr/kullanim-sartlari) kaynaklıdır; ticari yeniden satış için değildir. Belediye sitesine nazik ol: tek tarayıcı, sıra, cache.

## Ne var

| Adres | Ne işe yarar |
|---|---|
| `/` | Tanıtım + sağ alt sohbet widget |
| `/admin` | Hatlar, canlı takip, ingest |
| `/admin/sohbetler` | Gelen kutusu |
| `/admin/agentler` · `/toollar` · `/webchatler` | Asistan, tool, pencere tasarımı ve embed |

İki scraper süreci karıştırılmaz:

1. **Ingest** — hat listesi, güzergah, durak, sefer saati → MySQL
2. **Live** — bir hat için anlık araç → iç soket → API → dış soket

Chatbot Puppeteer’a bağlanmaz. Hub her zaman API’dir. SAKUS HTML’i parse edilmez; XHR/fetch/SSE yakalanır.

## Mimari

```
React (web)  ←→  Fastify API  ←→  MySQL
                      ↑
                 iç socket
                      ↑
              Puppeteer scraper
```

```
apps/web        React + Vite
apps/api        Fastify + Socket.IO + MySQL
apps/scraper    Puppeteer ingest + live
packages/shared paylaşılan tipler
```

## Gereksinimler

- Node.js 20+
- Docker Desktop (MySQL 3307 + Chromium scraper 3102)

## Çalıştırma

```bash
docker compose up -d --build
cp .env.example .env    # yoksa
npm install
npm run dev
```

- Site: [http://127.0.0.1:5173](http://127.0.0.1:5173) (port doluysa Vite bir sonrakini dener)
- API: [http://127.0.0.1:3001](http://127.0.0.1:3001)
- Admin şifresi: `.env` içindeki `ADMIN_PASSWORD` (örnek: `admin`)

İlk açılışta API şemayı migrate eder.

## İlk kullanım

1. `/admin` → giriş.
2. Hatları SAKUS’tan çek (tümü veya tek hat). Ingest sırayla yürür; paralel tab yok.
3. İstediğin hat için canlı takibi aç.
4. **Agent** oluştur: sistem prompt, LLM, model, API anahtarı, tool’lar.
5. **Webchat**’e o agent’ı bağla; varsayılan kayıt ana sitede görünür.
6. Sohbeti dene. Geçmiş `/admin/sohbetler` altında.

## Sohbet ve LLM

`POST /api/chat` webchat’in agent’ını kullanır. Public widget yalnızca müşteri / asistan metnini görür; tool JSON’u admin’dedir.

Kod fonksiyonları API’de yaşar; admin tool kaydı bir fonksiyona bağlanır:

| Fonksiyon | Ne döner |
|---|---|
| `otobus_sorgula` | Hat özeti |
| `otobus_guzergah_sorgula` | Durak sırası veya yön özeti |
| `otobus_anlik_konum_sorgula` | Son araç konumları (`stale` 30 sn) |
| `otobus_saat_sorgula` | Hareket saatleri |
| `yakin_duraklar` | 600 m yürüme, durak + geçen hatlar |
| `yerden_gecen_hatlar` | Çarşı (Adapazarı merkez) dairesinden geçen hatlar |
| `rota_oneri` | Yakın durak ∩ hedef (Çarşı) — direkt hat |

Başka siteye gömmek için admin’deki webchat embed script’ini kullan (`embed_key`).

## Ortam

Kök `.env` (commit etme). Şablon: `.env.example`.

| Değişken | Ne |
|---|---|
| `MYSQL_*` | `127.0.0.1:3307`, kullanıcı `sakus` |
| `API_PORT` | `3001` |
| `ADMIN_PASSWORD` | Yönetim girişi |
| `INTERNAL_SECRET` | Scraper → API iç çağrı |
| `SCRAPER_URL` | `http://127.0.0.1:3102` |
| `VITE_CARTO_API_KEY` | Admin harita karoları (CARTO Voyager); filigranı kaldırır |

## Geliştirme

Ayrıntılı model, fazlar ve sert kurallar: [`AGENTS.md`](AGENTS.md). Cursor kuralları `.cursor/rules/`, Claude `CLAUDE.md`.

```bash
npx tsc -p apps/web --noEmit
npx tsc -p apps/api --noEmit
```

## Lisans

[GPL-3.0](LICENSE)
