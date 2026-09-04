import { Link } from "react-router-dom";
import { ChatMd } from "../components/ChatMd";
import { ornekSor } from "../components/ChatWidget";

const SENARYOLAR = [
  {
    id: "yakin",
    title: "Yakınımdaki hatlar",
    kisa: "En yakın durak",
    ozet: "Sana yakın durak ve hatlar",
    icon: IconPin,
    prompt: "Şu an bana en yakın hatlar neler?",
    turns: [
      { rol: "user" as const, icerik: "Şu an bana en yakın hatlar neler?" },
      {
        rol: "assistant" as const,
        icerik:
          "400 m içindeki duraklardan geçen hatlar:\n\n- **Adliye** — 1, 2, 27\n- **Çark Caddesi** — 5, 20, 29\n\nKonum izni verirsen mesafeyi netleştiririm.",
      },
    ],
  },
  {
    id: "carsi",
    title: "Çarşıya nasıl giderim",
    kisa: "Nasıl giderim",
    ozet: "Hedefine hangi hat gider",
    icon: IconRoute,
    prompt: "Çarşıya nasıl giderim?",
    turns: [
      { rol: "user" as const, icerik: "Çarşıya nasıl giderim?" },
      {
        rol: "assistant" as const,
        icerik:
          "**Çarşı** Adapazarı merkez demek. **5** ve **27** oraya gidiyor.\n\nEn yakın durak **Çark Caddesi** (~3 dk yürüme). 5’in sonraki seferi **14:22**.",
      },
    ],
  },
  {
    id: "saat",
    title: "Sefer saatleri",
    kisa: "Sefer saatleri",
    ozet: "Sonraki otobüs ne zaman",
    icon: IconClock,
    prompt: "5 numaranın saatleri nelerdir?",
    turns: [
      { rol: "user" as const, icerik: "5 numaranın saatleri nelerdir?" },
      {
        rol: "assistant" as const,
        icerik:
          "**5 Kampüs – Çarşı** bugün:\n\n- Sonraki kalkış **14:22** (8 dk)\n- Ardından 14:40, 15:00\n\nPazar tarifesi farklı; istersen ona da bakayım.",
      },
    ],
  },
  {
    id: "konum",
    title: "Otobüsüm nerede",
    kisa: "Otobüsüm nerede",
    ozet: "Araç şu an hangi durakta",
    icon: IconBus,
    prompt: "20 numara şu anda tam olarak nerede?",
    turns: [
      { rol: "user" as const, icerik: "20 numara şu anda tam olarak nerede?" },
      {
        rol: "assistant" as const,
        icerik:
          "**20** üzerinde 2 araç görünüyor:\n\n- **Serdivan** yakın, Çarşı yönü\n- **Orta Garaj** çıkışı\n\nKonum yaklaşık 20 sn önce güncellendi.",
      },
    ],
  },
];

export function HomePage() {
  return (
    <div className="public">
      <header className="top">
        <div className="wrap top-inner">
          <div className="brand">
            <BrandMark />
            <div>
              <strong>SAKUS Asistan</strong>
              <em>Sakarya ulaşım rehberi</em>
            </div>
          </div>
          <Link className="ghost" to="/admin">
            Yönetim
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-wash" aria-hidden />
        <div className="wrap hero-copy">
          <p className="kicker">Hat, durak ve canlı konum</p>
          <h1>Otobüs hattı, durak ve anlık konum tek sohbette.</h1>
          <p className="lead">
            SAKUS haritasındaki güzergahı durak durak öğrenip saklıyoruz. Sen neredesin, nereye gideceksin — asistan
            hangi hattın işine yaradığını ve otobüsün şu an nerede olduğunu söylemeyi hedefliyor.
          </p>
        </div>
      </section>

      <div className="wrap">
        <nav className="quick-links" aria-label="Hızlı erişim">
          {SENARYOLAR.map((item) => (
            <a key={item.id} className="quick-link" href={`#${item.id}`}>
              <item.icon />
              <span>{item.kisa}</span>
              <em>{item.ozet}</em>
            </a>
          ))}
        </nav>

        <section className="scenarios" id="senaryolar" aria-labelledby="senaryolar-baslik">
          <h2 id="senaryolar-baslik">Örnek sohbetler</h2>
          <p className="scenarios-lead">
            Yolcunun sorduğu ve asistanın yanıtladığı dört senaryo. Sağ alttaki sohbetten sen de dene — saat ve konum
            canlı veriden gelir.
          </p>
          <div className="scenario-grid">
            {SENARYOLAR.map((s) => (
              <article key={s.id} id={s.id} className="scenario">
                <header>{s.title}</header>
                <div className="scenario-log">
                  {s.turns.map((t, i) => (
                    <div key={i} className={`bubble ${t.rol}`}>
                      <ChatMd text={t.icerik} />
                    </div>
                  ))}
                </div>
                <footer>
                  <button type="button" className="scenario-ask" onClick={() => ornekSor(s.prompt)}>
                    Sohbetten sor
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>

        <section className="how">
          <h2>Nasıl çalışır?</h2>
          <ol>
            <li>
              <strong>Hatları çek</strong>
              <span>Yönetim, SAKUS’tan hatları çeker (Puppeteer ingest).</span>
            </li>
            <li>
              <strong>Canlı takip</strong>
              <span>İstenen hat için canlı takip açılır (Puppeteer + soket).</span>
            </li>
            <li>
              <strong>Sohbetten sor</strong>
              <span>Sağ alttaki sohbetten hat kodu sorulur; asistan son konumları paylaşır.</span>
            </li>
          </ol>
          <p className="note">
            Veri Sakarya Büyükşehir Belediyesi SAKUS / public API kaynaklıdır; ticari yeniden satış için değildir. Bu
            sayfa resmi Ulaşım Portalı değildir.
          </p>
        </section>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <svg className="mark" viewBox="0 0 42 42" aria-hidden>
      <circle cx="21" cy="21" r="21" fill="#06a05a" />
      <path
        d="M12 24c4-8 14-8 18 0"
        fill="none"
        stroke="#c5d100"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M11 20c5.5-7 14.5-7 20 0"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="21" cy="16" r="3.2" fill="#0c6cb3" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path
        d="M24 8c-6 0-11 5-11 11 0 8.5 11 21 11 21s11-12.5 11-21c0-6-5-11-11-11Zm0 15a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRoute() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path
        d="M12 34V16l10 8 14-12v18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="36" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="34" r="3" fill="currentColor" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M24 16v9l6 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function IconBus() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path
        d="M10 16c0-4 4-6 14-6s14 2 14 6v14H10V16Zm4 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 20h24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

