type Tur = { ad: string; n: number; renk: string | null };

export type HatOzetData = {
  hat: number;
  durak: number;
  guzergah: number;
  turler: Tur[];
  sonGuncelleme: string | null;
  bugunCekilen: number;
  eskiHat: number;
  arac: number;
  tazeArac: number;
  aracliHat: number;
};

function rel(iso: string | null): string {
  if (!iso) return "henüz yok";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const sa = Math.round(min / 60);
  if (sa < 24) return `${sa} sa önce`;
  const gun = Math.round(sa / 24);
  return `${gun} gün önce`;
}

export function HatlarOzet({
  ozet,
  liveCount,
  scraperUp,
}: {
  ozet: HatOzetData;
  liveCount: number;
  scraperUp: boolean;
}) {
  const turMax = Math.max(1, ...ozet.turler.map((t) => t.n));
  const tazePct = ozet.arac ? Math.round((ozet.tazeArac / ozet.arac) * 100) : 0;
  const tazeHatPct = ozet.hat ? Math.round(((ozet.hat - ozet.eskiHat) / ozet.hat) * 100) : 0;

  return (
    <div className="stat-grid">
      <article className="stat-card">
        <p className="stat-kicker">Hat ağı</p>
        <p className="stat-value">{ozet.hat}</p>
        <p className="stat-sub">kayıtlı hat</p>
        <div className="stat-meta">
          <span>{ozet.durak} durak</span>
          <span>{ozet.guzergah} güzergah</span>
        </div>
      </article>

      <article className="stat-card">
        <p className="stat-kicker">Hat türleri</p>
        <p className="stat-value">{ozet.turler.length}</p>
        <p className="stat-sub">grup</p>
        <ul className="stat-bars">
          {ozet.turler.length === 0 && <li className="muted">Henüz hat yok</li>}
          {ozet.turler.map((t) => (
            <li key={t.ad}>
              <div className="stat-bar-label">
                <span>{t.ad}</span>
                <em>{t.n}</em>
              </div>
              <div className="stat-bar-track">
                <i
                  style={{
                    width: `${Math.max(6, (t.n / turMax) * 100)}%`,
                    background: t.renk || "var(--pine)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className="stat-card">
        <p className="stat-kicker">Güncellik</p>
        <p className="stat-value">{ozet.bugunCekilen}</p>
        <p className="stat-sub">son 24 saatte çekilen</p>
        <div className="stat-bar-track fat">
          <i style={{ width: `${tazeHatPct}%` }} />
        </div>
        <div className="stat-meta">
          <span>Son: {rel(ozet.sonGuncelleme)}</span>
          <span>{ozet.eskiHat} hat 7 günden eski</span>
        </div>
      </article>

      <article className="stat-card">
        <p className="stat-kicker">Canlı filo</p>
        <p className="stat-value">{ozet.tazeArac}</p>
        <p className="stat-sub">son 90 sn içinde konum</p>
        <div className="stat-bar-track fat">
          <i style={{ width: `${tazePct}%`, background: scraperUp ? "var(--pine)" : "var(--danger)" }} />
        </div>
        <div className="stat-meta">
          <span>{ozet.arac} kayıtlı araç · {ozet.aracliHat} hat</span>
          <span>{scraperUp ? `${liveCount} canlı takip` : "scraper kapalı"}</span>
        </div>
      </article>
    </div>
  );
}
