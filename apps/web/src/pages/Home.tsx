import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="public">
      <header className="top">
        <div className="brand">
          <span className="mark">S</span>
          <div>
            <strong>SAKUS Asistan</strong>
            <em>Sakarya ulaşım rehberi</em>
          </div>
        </div>
        <Link className="ghost" to="/admin">
          Yönetim
        </Link>
      </header>

      <section className="hero">
        <p className="kicker">Aşama 1 — hat ve canlı konum</p>
        <h1>Otobüs hattı, durak ve anlık konum tek sohbette.</h1>
        <p className="lead">
          SAKUS haritasındaki güzergahı durak durak öğrenip saklıyoruz. Sen neredesin, nereye gideceksin — asistan
          hangi hattın işine yaradığını ve otobüsün şu an nerede olduğunu söylemeyi hedefliyor.
        </p>
      </section>

      <section className="grid3">
        <article>
          <h2>Hat arşivi</h2>
          <p>Her hat için gidiş-dönüş durak sırası ve yol çizgisi veritabanında. Admin panelinden tekrar çekilir.</p>
        </article>
        <article>
          <h2>Canlı otobüs</h2>
          <p>Seçilen hat için SAKUS’un anlık araç akışı soketten gelir; sohbet ve yönetim aynı kaydı görür.</p>
        </article>
        <article>
          <h2>Konuşma kaydı</h2>
          <p>Yolcu mesajları loglanır. Sonraki aşamada konum + hedef ile rota önerisi eklenecek.</p>
        </article>
      </section>

      <section className="how">
        <h2>Nasıl çalışır?</h2>
        <ol>
          <li>Yönetim, SAKUS’tan hatları çeker (Puppeteer ingest).</li>
          <li>İstenen hat için canlı takip açılır (Puppeteer + soket).</li>
          <li>Sağ alttaki sohbetten hat kodu sorulur; asistan son konumları paylaşır.</li>
        </ol>
        <p className="note">
          Veri Sakarya Büyükşehir Belediyesi SAKUS / public API kaynaklıdır; ticari yeniden satış için değildir.
        </p>
      </section>
    </div>
  );
}
