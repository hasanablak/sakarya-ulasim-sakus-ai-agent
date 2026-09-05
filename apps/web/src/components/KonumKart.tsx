import type { KonumNeden } from "../konum";

export type KonumKartDurum = "bekliyor" | "yok" | "var" | KonumNeden;

export function KonumKart({
  durum,
  busy,
  onIste,
}: {
  durum: KonumKartDurum;
  busy?: boolean;
  onIste: () => void;
}) {
  const varMi = durum === "var";
  const bekliyor = durum === "bekliyor";
  const kopya = metin(durum);

  return (
    <article className={`chat-konum-kart ${varMi ? "is-var" : bekliyor ? "is-bekliyor" : "is-yok"}`}>
      <span className="chat-konum-ikon" aria-hidden>
        {varMi ? <IkonOk /> : bekliyor ? <IkonBekle /> : <IkonPin />}
      </span>
      <div className="chat-konum-govde">
        <strong>{kopya.baslik}</strong>
        <p>{kopya.metin}</p>
        {!varMi && !bekliyor && (
          <button type="button" disabled={busy} onClick={onIste}>
            {durum === "yok" ? "Konumu paylaş" : "Tekrar dene"}
          </button>
        )}
      </div>
    </article>
  );
}

function metin(durum: KonumKartDurum): { baslik: string; metin: string } {
  if (durum === "var") {
    return {
      baslik: "Konumun alındı",
      metin: "Yakın durak ve “nasıl giderim” sorularını buna göre yanıtlarım. Konumu sohbette göstermem.",
    };
  }
  if (durum === "bekliyor") {
    return {
      baslik: "Konumun isteniyor",
      metin: "Tarayıcıdaki izin penceresini onayla. Yalnızca en yakın durak ve hattı bulmak için kullanılır.",
    };
  }
  if (durum === "reddedildi") {
    return {
      baslik: "Konum kapalı",
      metin: "Adres çubuğundaki kilitten konum iznini aç, sonra tekrar dene. İstersen durak adını yazarak da sorabilirsin.",
    };
  }
  if (durum === "zaman_asimi") {
    return {
      baslik: "Konum alınamadı",
      metin: "İzin penceresi zaman aşımına uğradı. Tekrar dene veya en yakın durağın adını yaz.",
    };
  }
  if (durum === "destek_yok") {
    return {
      baslik: "Konum paylaşılamıyor",
      metin: "Bu tarayıcı konum vermiyor. En yakın durağın adını yazarsan yine yardımcı olurum.",
    };
  }
  if (durum === "hata") {
    return {
      baslik: "Konum alınamadı",
      metin: "Bir sorun çıktı. İzni kontrol edip tekrar dene, ya da durak adını yaz.",
    };
  }
  return {
    baslik: "En yakın durak için konumun lazım",
    metin: "“Çarşıya nasıl giderim?” ve yakın hatlar için bulunduğun yeri paylaş. Haritada işaretlenmez; yalnızca rota için kullanılır.",
  };
}

function IkonPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.2" />
    </svg>
  );
}

function IkonOk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IkonBekle() {
  return (
    <svg className="chat-konum-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.2" />
      <path d="M20 12a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
