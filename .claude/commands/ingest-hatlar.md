# ingest-hatlar

SAKUS hat ingest’ini çalıştır veya eksik job’ı yaz.

1. Scraper ayakta mı, iç socket API’de mi kontrol et.
2. Mümkünse tek hat kanıtı: `a1-adaray-51` durak + polyline DB’de mi.
3. Tüm hatları sırayla gez; delay; idempotent upsert.
4. Canlı GPS ingest ile karıştırma.
5. Bitince `hatlar` / `duraklar` / `hat_duraklari` / `hat_guzergah` sayılarını raporla.

`AGENTS.md` faz 1–2. Puppeteer HTML parse yok.
