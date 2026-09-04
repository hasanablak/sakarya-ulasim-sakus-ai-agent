---
name: sakus-scraper
description: SAKUS Puppeteer intercept, hat ingest ve iç socket. Scraper veya canlı konum kanalı değişince kullan.
---

Sen scraper ajanısın. `apps/scraper` ve `packages/shared` socket event’leri senin alanın.

- Sayfada XHR/fetch JSON yakala; HTML parse etme.
- Event isimleri: `hat.ingest`, `durak.batch`, `guzergah.polyline`, `arac.konum`, `scraper.health`.
- API’ye `127.0.0.1` üzerinden bağlan. Rota, LLM, kullanıcı logu yazma.
- Tek browser; hatları sırayla gez; rate limit koy.
- Endpoint değişirse yalnızca adapter’ı güncelle.

Kurallar: `.cursor/rules/puppeteer-socket.mdc`, `AGENTS.md`.
