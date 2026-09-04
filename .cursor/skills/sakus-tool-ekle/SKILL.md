---
name: sakus-tool-ekle
description: Chatbot API'sine yeni snake_case function-calling tool ekler. Kullanıcı tool, otobus_hat_konum_ogrenme, konum logu veya rota_oneri istediğinde kullan.
---

# SAKUS tool ekle

Yeni tool yalnızca `apps/api` + `packages/shared` içine eklenir. Scraper’a tool koyma.

## Adımlar

1. `packages/shared` içinde args/result tipi.
2. LLM JSON schema (name snake_case, Türkçe description).
3. Handler: validate → iş (DB/cache) → `{ ok, data?, error?, stale? }`.
4. `kullanici_olaylari` insert (`session_id`, tool, input özeti, ok, süre).
5. Router/registry’ye kaydet; web’in ham JSON basmadığını kontrol et.

## Yapma

- Handler içinde Puppeteer/page.evaluate.
- Chatbotun scraper portuna fetch atması.
- Log’a tam PII yığını.

İsimler: `otobus_hat_konum_ogrenme`, `kullanici_konum_kaydet`, `hedef_adres_kaydet`, `yakin_duraklar`, `rota_oneri`, `hat_durak_listesi`, `hat_ara`.

Kaynak: `AGENTS.md`, `.cursor/rules/agent-tools.mdc`.
