# CLAUDE.md — SAKUS AI Agent

Sen bu repoda Claude Code’sun. Ürün, mimari ve sıra **AGENTS.md** dosyasındadır; önce onu oku. Cursor kuralları `.cursor/rules/`; Claude ekleri `.claude/`.

## Bu repoda kim nesin

- React (chatbot UI) ve Node.js (API + Puppeteer scraper) yazarsın.
- SAKUS canlı verisi Puppeteer intercept → iç socket → API. Chatbot Puppeteer’a bağlanmaz.
- Tool’lar API’de yaşar. İlki: `otobus_hat_konum_ogrenme`. Kullanıcı origin/hedef ve her tool çağrısı loglanır.

## Sert kurallar

- SAKUS HTML’ini parse etme; XHR/fetch JSON yakala.
- Belediye sitesine paralel tab / agresif polling yok. Statik hat-durak cache; GPS ayrı kanal.
- Scraper yalnızca `127.0.0.1` iç sockete yazar. Dışarıya araç JSON’u API normalize ederek gider.
- Ticari veri satışı / rakip servis yok. Nazik tarama, rate limit, cache.
- `.env` ve sırları commit etme.
- İstenmeden git commit/push yapma.
- Mevcut dosya stilini koru; kapsam dışı refactor yok.

## Çalışırken

1. İlgili glob kuralını aç: React → `react.mdc`, API → `nodejs.mdc`, scraper → `puppeteer-socket.mdc`, tool → `agent-tools.mdc`, SQL/geo → `veritabani-geo.mdc`.
2. Paylaşılan tip ve event adları `packages/shared` dışında çoğaltılma.
3. Bitirmeden: typecheck, ilgili test veya elle `curl`/socket duman testi.

Detaylı model, tool tablosu ve fazlar: `AGENTS.md`.
