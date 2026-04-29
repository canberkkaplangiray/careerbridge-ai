import "./globals.css";

export const metadata = {
  title: "CareerBridge AI – Stratejik Kariyer Analiz Platformu",
  description:
    "CV'ni hedeflediğin iş ilanıyla karşılaştır, uyumluluk skorunu öğren, güçlü yönlerini keşfet ve stratejik tavsiyeler al. Yapay zeka destekli kariyer analiz platformu.",
  keywords: "CV analiz, iş ilanı eşleştirme, kariyer stratejisi, yapay zeka, uyumluluk skoru",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        <div className="bg-effects">
          <div className="bg-orb bg-orb-1"></div>
          <div className="bg-orb bg-orb-2"></div>
          <div className="bg-orb bg-orb-3"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
