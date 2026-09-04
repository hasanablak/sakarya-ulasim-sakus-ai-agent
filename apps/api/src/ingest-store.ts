import type { SakusLineListItem, SakusRouteAndStops, ScheduleDayPayload } from "@sakus/shared";
import { pool } from "./db.js";

function hatKodu(line: SakusLineListItem, detail: SakusRouteAndStops): string {
  const raw = (line.lineNumber ?? detail.lineNumber ?? "").trim();
  if (raw) return raw;
  const fromSlug = (line.slug ?? "")
    .replace(/^-/, "")
    .replace(/-\d+$/, "")
    .trim();
  if (fromSlug) return fromSlug.toUpperCase();
  return String(line.id);
}

function hatSlug(line: SakusLineListItem, kod: string): string {
  const slug = (line.slug ?? "").trim();
  if (slug && slug !== "-") return slug.replace(/^-/, "") || `${kod.toLowerCase()}-${line.id}`;
  return `${kod.toLowerCase()}-${line.id}`;
}

export async function upsertHatIngest(
  line: SakusLineListItem,
  detail: SakusRouteAndStops,
  scheduleDays: ScheduleDayPayload[] = [],
): Promise<void> {
  const kod = hatKodu(line, detail);
  const slug = hatSlug(line, kod);
  const ad = (line.name ?? detail.lineName ?? kod).trim() || kod;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO hatlar (id, kod, slug, ad, bus_type_id, bus_type_name, bus_type_color, asis_id, last_ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         kod = VALUES(kod),
         slug = VALUES(slug),
         ad = VALUES(ad),
         bus_type_id = VALUES(bus_type_id),
         bus_type_name = VALUES(bus_type_name),
         bus_type_color = VALUES(bus_type_color),
         asis_id = VALUES(asis_id),
         last_ingested_at = NOW()`,
      [
        line.id,
        kod,
        slug,
        ad,
        line.busTypeId,
        line.busTypeName,
        line.busTypeColor,
        line.asisIntegrationId,
      ],
    );

    const routeIds = detail.routes.map((r) => r.routeId);
    if (routeIds.length) {
      await conn.execute(`DELETE FROM hat_duraklari WHERE hat_id = ?`, [line.id]);
      const ph = routeIds.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM hat_guzergah WHERE hat_id = ? AND sakus_route_id NOT IN (${ph})`,
        [line.id, ...routeIds],
      );
    }

    for (const route of detail.routes) {
      await conn.execute(
        `INSERT INTO hat_guzergah (hat_id, sakus_route_id, yon_ad, start_location, end_location, route_type_id, geometry_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           yon_ad = VALUES(yon_ad),
           start_location = VALUES(start_location),
           end_location = VALUES(end_location),
           route_type_id = VALUES(route_type_id),
           geometry_json = VALUES(geometry_json)`,
        [
          line.id,
          route.routeId,
          route.routeName?.trim() || "Güzergah",
          route.startLocation,
          route.endLocation,
          route.routeTypeId,
          JSON.stringify(route.routeGeometry ?? { type: "MultiLineString", coordinates: [] }),
        ],
      );

      for (const stop of route.busStops ?? []) {
        const [lng, lat] = stop.busStopGeometry?.coordinates ?? [null, null];
        if (lat == null || lng == null) continue;
        await conn.execute(
          `INSERT INTO duraklar (id, ad, durak_no, lat, lng, tip_ad, akilli)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             ad = VALUES(ad),
             durak_no = VALUES(durak_no),
             lat = VALUES(lat),
             lng = VALUES(lng),
             tip_ad = VALUES(tip_ad),
             akilli = VALUES(akilli)`,
          [
            stop.id,
            stop.name?.trim() || `Durak ${stop.id}`,
            stop.busStopNumber,
            lat,
            lng,
            stop.busStopTypeName,
            stop.isSmartStop ? 1 : 0,
          ],
        );
        await conn.execute(
          `INSERT INTO hat_duraklari (hat_id, sakus_route_id, durak_id, sira)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE sira = VALUES(sira)`,
          [line.id, route.routeId, stop.id, stop.order],
        );
      }
    }

    await conn.execute(`DELETE FROM hat_seferleri WHERE hat_id = ?`, [line.id]);
    for (const day of scheduleDays) {
      for (const route of day.data?.schedules ?? []) {
        const yon = route.routeName?.trim() || "Güzergah";
        for (const trip of route.routeDetail ?? []) {
          const kalkis = (trip.startTime ?? "").trim();
          if (!kalkis) continue;
          await conn.execute(
            `INSERT INTO hat_seferleri
               (hat_id, sakus_route_id, yon_ad, gun_kod, ornek_tarih, day_parameter_value_id, sefer_no, kalkis, varis, aciklama)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               yon_ad = VALUES(yon_ad),
               ornek_tarih = VALUES(ornek_tarih),
               day_parameter_value_id = VALUES(day_parameter_value_id),
               varis = VALUES(varis),
               aciklama = VALUES(aciklama)`,
            [
              line.id,
              route.routeId,
              yon,
              day.gunKod,
              day.date,
              trip.dayParameterValueId,
              trip.tripNumber,
              kalkis,
              trip.endTime?.trim() || null,
              trip.description?.trim() || null,
            ],
          );
        }
      }
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
