/** Sakarya yolcu dili → resmi yer. Chat taban prompt ve hat araması bunu kullanır. */

export const YER_TAKMA_ADLARI = [
  {
    soz: "Çarşı",
    anlam: "Adapazarı merkez (şehir çarşısı / kent merkezi)",
    eslesen: /çarş[ıi]|carsi/i,
    arama: ["çarşı", "adapazar"],
  },
] as const;

export function yerSozluguPrompt(): string {
  const maddeler = YER_TAKMA_ADLARI.map((y) => `- “${y.soz}” = ${y.anlam}.`).join("\n");
  return (
    "Yerel yer adları (Sakarya yolcu dili; durak/hat ararken bunları kullan):\n" +
    maddeler +
    "\n“Çarşıya nasıl giderim?” Adapazarı merkeze giden hattı sorar; Serdivan veya Erenler çarşısı demek değildir. " +
    "otobus_sorgula için q olarak “çarşı” veya “adapazarı” yaz."
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
