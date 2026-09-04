/** Sakarya yolcu dili → resmi yer + durak dairesi. Chat prompt, hat adı ve geo arama bunu kullanır. */

export type YerMerkez = { lat: number; lng: number };

export type YerKayit = {
  soz: string;
  anlam: string;
  eslesen: RegExp;
  arama: readonly string[];
  /** Durak tablosundaki tohum nokta (Adapazarı Uzun Çarşı). */
  merkez?: YerMerkez;
  yari_cap_m?: number;
};

export const YER_TAKMA_ADLARI: YerKayit[] = [
  {
    soz: "Çarşı",
    anlam: "Adapazarı merkez (Uzun Çarşı / kent merkezi). Orta Garaj ve O. Garaj bu dairenin içinde.",
    eslesen: /çarş[ıi]|carsi|adapazar[ıi]?\s*merkez|kent merkez|orta\s*garaj|o\.?\s*garaj/i,
    arama: ["çarşı", "adapazar", "orta garaj"],
    // duraklar.ad = "Uzun Çarşı" (Hendek Uzunçarşı değil)
    merkez: { lat: 40.77853, lng: 30.40174 },
    yari_cap_m: 850,
  },
];

export function eslesenYer(q: string): YerKayit | null {
  const raw = q.trim();
  if (!raw) return null;
  for (const y of YER_TAKMA_ADLARI) {
    if (y.eslesen.test(raw)) return y;
  }
  return null;
}

export function yerSozluguPrompt(): string {
  const maddeler = YER_TAKMA_ADLARI.map((y) => {
    const geo = y.merkez
      ? ` Durak koordinatıyla da bulunur (~${y.yari_cap_m} m); hat adında “çarşı” yazmak zorunda değildir.`
      : "";
    return `- “${y.soz}” = ${y.anlam}.${geo}`;
  }).join("\n");
  return (
    "Yerel yer adları (Sakarya yolcu dili):\n" +
    maddeler +
    "\n“Çarşıya nasıl giderim?” Adapazarı merkeze giden hattı sorar. " +
    "Konum varsa rota_oneri(hedef=çarşı) kullan (yakın durak ∩ Çarşı hatları). " +
    "Konum yoksa izin iste. yerden_gecen_hatlar onlarca hat döner; konum varken onu listeleme."
  );
}

/** Hat aramasında “çarşıya” gibi çekimli sözü kanonik terimlere açar. */
export function genisletAramaToken(t: string): string[] {
  const raw = t.trim();
  if (!raw) return [];
  for (const y of YER_TAKMA_ADLARI) {
    if (y.eslesen.test(raw)) return [...y.arama];
  }
  return [raw];
}
