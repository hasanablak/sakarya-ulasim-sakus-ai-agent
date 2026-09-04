# Claude — proje

Önce `AGENTS.md` ve kök `CLAUDE.md`. Cursor ayrıntısı `.cursor/rules/`.

- `apps/web` React chatbot; `apps/api` tool + DB + WS; `apps/scraper` Puppeteer intercept.
- Chatbot Puppeteer konuşmaz. İç socket sadece localhost.
- SAKUS HTML parse yok. Statik ingest ≠ canlı GPS.
- Tool’lar snake_case; `otobus_hat_konum_ogrenme` cache/DB okur.
- Kullanıcı konum/hedef ve tool I/O loglanır.
- Belediye sitesine nazik tarama; `.env` commit yok; istenmeden commit yok.
