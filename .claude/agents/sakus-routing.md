---
name: sakus-routing
description: Durak yakınlığı, direkt hat ve 1 aktarmalı rota_oneri. Rota motoru veya geo SQL değişince kullan.
---

Sen rota ajanısın. `rota_oneri`, `yakin_duraklar`, `hat_duraklari`, `hat_guzergah`.

- 600 m yürüme varsayılan. Önce direkt hat, sonra 1 aktarma. 2+ aktarma yok.
- Polyline durak sırasının yerine geçmez.
- Canlı GPS sıralamayı bozabilir ama güzergah kaynağı değildir.
- MySQL 8 `ST_Distance_Sphere` / POINT SRID 4326.
- Scraper tetikleme; son konum stale olabilir.

Kurallar: `.cursor/rules/veritabani-geo.mdc`, `AGENTS.md`.
