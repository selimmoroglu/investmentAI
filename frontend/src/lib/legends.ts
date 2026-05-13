export interface LegendCriterion {
  /** UI'da gösterilecek kısa kural */
  label: string;
  /** Hangi metriği baz aldığı (görsel highlight için) */
  metric?: "pe" | "pb" | "peg" | "roe" | "netMargin" | "grossMargin" | "debtToEquity" | "revenueGrowth" | "earningsGrowth" | "currentRatio" | "dividendYield";
}

export interface Legend {
  id: string;
  name: string;
  era: string;
  nickname: string;
  philosophy: string;
  bio: string;
  approach: string[];
  criteria: LegendCriterion[];
  avoid: string[];
  quotes: string[];
  /** Renk vurgusu için ana ton */
  accent: string;
  /** Hero/banner için ikinci gradient rengi */
  accent2: string;
  /** Tarihsel performans göstergeleri */
  stats: {
    annualReturn: string;
    activeYears: string;
    benchmark?: string;
    aum?: string;
  };
  /** Stil etiketleri (kısa rozetler) */
  style: string[];
}

export const LEGENDS: Legend[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    era: "1930 –",
    nickname: "Omaha Kahini",
    philosophy: "Harika bir şirketi makul fiyata almak, vasat bir şirketi ucuza almaktan iyidir.",
    bio: "Berkshire Hathaway'in CEO'su. Mentor'u Benjamin Graham'dan değer yatırımını öğrendi, ancak ortağı Charlie Munger ile birlikte kalite + uzun vadeli sahiplik ekolünü geliştirdi. 60+ yıllık ortalama yıllık getirisi piyasanın iki katından fazla.",
    approach: [
      "Anladığın işletmelere yatırım yap (yetkinlik çemberinin içinde kal).",
      "Rekabet avantajı (moat) güçlü, sürdürülebilir kar üreten şirketler ara.",
      "Yöneticilerin dürüst, sermayeyi akıllıca dağıtan kişiler olmasına dikkat et.",
      "Hisseyi şirketin küçük bir parçası olarak gör — fiyat değil değer önemli.",
      "Mr. Market'i kullan ama dinleme — borsa hizmetkarın olsun, efendin değil.",
      "Uzun vadeli düşün; favori tutuş süresi 'sonsuza kadar'.",
    ],
    criteria: [
      { label: "Tutarlı yüksek özsermaye karlılığı (ROE > %12-15)", metric: "roe" },
      { label: "Yüksek net kar marjı (>%8-10)", metric: "netMargin" },
      { label: "Düşük borç oranı (D/E < 80-100)", metric: "debtToEquity" },
      { label: "Makul fiyat: F/K < 25-30, kalite arttıkça tolere edilebilir", metric: "pe" },
      { label: "Pozitif gelir büyümesi", metric: "revenueGrowth" },
      { label: "Marka gücü, fiyatlama gücü, yüksek brüt marj", metric: "grossMargin" },
    ],
    avoid: [
      "Anlamadığın iş modelleri (özellikle hızlı değişen teknoloji başlangıçları).",
      "Yüksek sermaye gerektiren, düşük karlı sanayi şirketleri.",
      "Borç yükü ağır, döngüsel sektör hisseleri (hava yolu vb.).",
      "Aşırı hype'lı, defter değerinin çok üstünde fiyatlanan IPO'lar.",
    ],
    quotes: [
      "Kural 1: Para kaybetme. Kural 2: 1. kuralı asla unutma.",
      "Sürü davrandığında çekingen, sürü çekingen olduğunda açgözlü ol.",
      "Tutuş süremiz sonsuzluktur.",
    ],
    accent: "#0ea5e9",
    accent2: "#1e40af",
    stats: { annualReturn: "~%19.8", activeYears: "60+ yıl", benchmark: "S&P 500 (~%10)", aum: "$870 milyar" },
    style: ["Değer", "Kalite", "Uzun Vade", "Konsantre"],
  },
  {
    id: "graham",
    name: "Benjamin Graham",
    era: "1894 – 1976",
    nickname: "Değer Yatırımının Babası",
    philosophy: "Güvenlik marjı (margin of safety) — defter değerinden ucuza al ki yanılma payın olsun.",
    bio: "Modern menkul kıymet analizinin kurucusu. Columbia'da Buffett'a hocalık yaptı. 'Akıllı Yatırımcı' (1949) ve 'Security Analysis' (1934) klasikleri. Net-net stratejisiyle 1929 sonrası kurtuldu.",
    approach: [
      "Defter değeri yakını veya altında işlem gören şirketleri bul.",
      "Düşük F/K (genelde < 15) + düşük PD/DD (< 1.5) ikilisini ara.",
      "Sağlam bilanço: kısa vadeli borçlardan en az 2 kat dönen varlık.",
      "10 yıllık karlılık geçmişi şart — hiç zarar yılı olmamalı.",
      "Uzun süredir kesintisiz temettü ödeyen şirketleri tercih et.",
      "Mr. Market'in irrasyonel fiyatlamalarından faydalan, takip etme.",
    ],
    criteria: [
      { label: "F/K < 15", metric: "pe" },
      { label: "PD/DD < 1.5 (veya F/K × PD/DD < 22.5)", metric: "pb" },
      { label: "Cari Oran > 1.5-2", metric: "currentRatio" },
      { label: "Borç/Özsermaye < 80", metric: "debtToEquity" },
      { label: "Pozitif net kar (zarar etmemiş)", metric: "roe" },
      { label: "Tercihen düzenli temettü dağıtımı", metric: "dividendYield" },
    ],
    avoid: [
      "Spekülatif hisseler — büyüme hikayesine fiyat biçilen şirketler.",
      "Gizli borçlu şirketler.",
      "Karı tutarsız, döngüsel zarar yapan işletmeler.",
      "Defter değerinin çok üstünde fiyatlanan modern teknoloji.",
    ],
    quotes: [
      "Kısa vadede borsa bir oylama makinası, uzun vadede bir tartı.",
      "Yatırımcının en büyük düşmanı muhtemelen kendisidir.",
    ],
    accent: "#a855f7",
    accent2: "#6b21a8",
    stats: { annualReturn: "~%14.7", activeYears: "1926-1956 (30 yıl)", benchmark: "Piyasa ortalaması (~%8)" },
    style: ["Derin Değer", "Margin of Safety", "Net-Net", "Bilanço"],
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    era: "1944 –",
    nickname: "Magellan'ın Efsane Yöneticisi",
    philosophy: "Bildiklerine yatırım yap — günlük hayatında gözlemlediğin büyüyen iyi şirketleri bul.",
    bio: "1977-1990 yılları arasında Fidelity Magellan fonunu yönetti, %29.2 yıllık ortalama getiri. 'One Up On Wall Street' kitabıyla GARP yaklaşımını popülerleştirdi. 'Ten-bagger' (10 katına çıkan hisse) terimini icat etti.",
    approach: [
      "Günlük hayatında kullandığın ve büyüdüğünü gördüğün şirketleri araştır.",
      "PEG oranı (F/K ÷ Büyüme%) < 1 ise hisse uygun fiyatlı sayılır.",
      "Şirketi 6 kategoriye ayır: yavaş büyüyen, kararlı, hızlı büyüyen, döngüsel, dönüşüm, varlık değerli.",
      "Hızlı büyüyen küçük/orta şirketlerde 'ten-bagger' fırsatı ara.",
      "Yatırımdan önce 'iki dakika hikayesi' yapabilmelisin: neden bu hisse, ne bekliyorsun.",
      "Kurumsal sahipliği henüz düşük olan, Wall Street'in görmezden geldiği şirketler altın madenidir.",
    ],
    criteria: [
      { label: "PEG < 1 (ideal), 1.5'e kadar tolere edilebilir", metric: "peg" },
      { label: "Gelir büyümesi > %10-15 (büyüyen şirket)", metric: "revenueGrowth" },
      { label: "Kazanç büyümesi > %15", metric: "earningsGrowth" },
      { label: "F/K büyüme oranını aşmamalı", metric: "pe" },
      { label: "Düşük borç (D/E < 60-80)", metric: "debtToEquity" },
      { label: "Pozitif ROE (>%10)", metric: "roe" },
    ],
    avoid: [
      "'Sıcak' sektörlerin 'sıcak' hisseleri — herkesin aldığı şeyleri kaçır.",
      "Çoklu sermaye artırımı yapan şirketler.",
      "Wall Street'in 'next big thing' olarak pazarladığı şirketler.",
      "İş modelini 5 cümlede anlatamadığın şirketler.",
    ],
    quotes: [
      "Almak istediğin hisseyi 5 sınıf çocuğa anlatamıyorsan, ondan uzak dur.",
      "En iyi araştırma alışveriş merkezinde yapılır.",
      "Fiyat-kazanç oranının büyüme oranına eşit olduğu hisse adil fiyatlıdır.",
    ],
    accent: "#22c55e",
    accent2: "#15803d",
    stats: { annualReturn: "~%29.2", activeYears: "1977-1990 (13 yıl)", benchmark: "S&P 500 (~%15)", aum: "$14 milyar" },
    style: ["GARP", "Büyüme", "Ten-Bagger", "Sezgisel"],
  },
  {
    id: "greenblatt",
    name: "Joel Greenblatt",
    era: "1957 –",
    nickname: "Magic Formula'nın Mucidi",
    philosophy: "İyi şirketleri ucuza al — formülleştirilebilir, mekanik bir değer yatırımı.",
    bio: "Gotham Capital kurucusu. 'You Can Be a Stock Market Genius' (1997) ve 'Magic Formula' (2005) kitaplarıyla mekanik değer yatırımını popülerleştirdi. 20 yıllık fonu yıllık %40 getiri sağladı.",
    approach: [
      "İki basit ölçüye odaklan: yüksek sermaye getirisi (ROC) + yüksek kazanç verimi (1/F-K).",
      "Tüm hisseleri her iki ölçüde sırala, toplam sıraları en düşük olanları al.",
      "20-30 hisse al, yıllık olarak portföyü revize et — duygu yok, sadece formül.",
      "Düşük F/K çok ucuz şirket gibi görünebilir, ama yüksek ROC kalitelileri ayırt eder.",
      "Aşırı düşük piyasa değeri, finansal ve kamu hizmeti hisselerini hariç tut.",
    ],
    criteria: [
      { label: "Yüksek ROE (>%15)", metric: "roe" },
      { label: "Yüksek kazanç verimi: 1/F/K > %7 (yani F/K < 14)", metric: "pe" },
      { label: "Pozitif ve istikrarlı kazançlar", metric: "earningsGrowth" },
      { label: "Sektör çeşitliliği — minimum 20-30 hisse", metric: "roe" },
    ],
    avoid: [
      "Çok küçük piyasa değerli (mikro-cap) şirketler — likidite riski.",
      "Bankalar ve sigorta şirketleri (ROC hesabı yanıltıcı olabilir).",
      "Tek seferlik karlardan kaynaklı şişmiş kazançlar.",
    ],
    quotes: [
      "Borsada başarılı olmak için zeki olmaya değil, sabırlı olmaya ihtiyacın var.",
      "Magic Formula sıkıcıdır — bu yüzden işe yarar.",
    ],
    accent: "#f59e0b",
    accent2: "#b45309",
    stats: { annualReturn: "~%40", activeYears: "1985-2005 (Gotham)", benchmark: "S&P 500 (~%12)" },
    style: ["Mekanik", "Magic Formula", "Sayısal", "Sistematik"],
  },
  {
    id: "munger",
    name: "Charlie Munger",
    era: "1924 – 2023",
    nickname: "Buffett'ın Sağ Kolu",
    philosophy: "Adil fiyata harika bir işletme almak, harika fiyata adil bir işletmeden çok daha iyidir.",
    bio: "Berkshire Hathaway başkan yardımcısı. Buffett'ı saf Graham değer yatırımından kalite-odaklı yaklaşıma yönlendiren kişi. 'Mental modeller', 'tersine çevirme' ve disiplinler arası düşünce yöntemiyle ünlü.",
    approach: [
      "Olağanüstü işletmelere odaklan — kalite her şeyden önemli.",
      "Yüksek sermaye getirisi (ROIC) sürdürebilen şirketler ara.",
      "Brüt marj yüksekse fiyatlama gücü vardır — bu sürdürülebilir bir avantajdır.",
      "Mental modelleri kullan: tersine çevirme, fırsat maliyeti, second-order düşünme.",
      "Eylemsizlik bir erdemdir — gerçekten ikna olduğun zaman büyük bahis yap.",
      "Büyük bahisleri saymak için bir el yeter — onlarca pozisyon dağılımdır.",
    ],
    criteria: [
      { label: "Çok yüksek ROE (>%18-20)", metric: "roe" },
      { label: "Yüksek brüt marj (>%30) — fiyatlama gücü", metric: "grossMargin" },
      { label: "Yüksek net kar marjı (>%10-15)", metric: "netMargin" },
      { label: "Çok düşük borç (D/E < 60)", metric: "debtToEquity" },
      { label: "Makul-yüksek F/K tolere edilebilir (kalite için)", metric: "pe" },
    ],
    avoid: [
      "Aptal şeyler yapmaya çalışmak yerine, aptal şeylerden kaçın.",
      "Aşırı aktif portföy yönetimi.",
      "Anlamadığın karmaşık finansal ürünler.",
      "Ego ile yapılan kararlar.",
    ],
    quotes: [
      "Tersine çevir, her zaman tersine çevir.",
      "Beyninde elinden geldiğince çok mental model topla.",
      "Bir adamın yapacağı en akıllıca şey, bekleyebilmektir.",
    ],
    accent: "#ec4899",
    accent2: "#9d174d",
    stats: { annualReturn: "~%19.8 (Berkshire)", activeYears: "1962-2023 (60+ yıl)", benchmark: "S&P 500 (~%10)" },
    style: ["Kalite", "Mental Model", "Disiplin", "Sabır"],
  },
  {
    id: "fisher",
    name: "Philip Fisher",
    era: "1907 – 2004",
    nickname: "Büyüme Yatırımının Babası",
    philosophy: "Sıradan olmayan kalitedeki büyüme şirketlerini bul ve uzun yıllar tut.",
    bio: "'Common Stocks and Uncommon Profits' (1958) yazarı. Buffett'ın kendi yaklaşımının %15 Graham + %85 Fisher olduğunu söyler. 'Scuttlebutt' yöntemiyle (müşteri/rakip/çalışanlardan bilgi toplama) ünlü.",
    approach: [
      "Uzun yıllar boyunca sektör ortalamasının üzerinde gelir/kar büyümesi sağlayan şirketleri bul.",
      "Yönetim kalitesi, dürüstlüğü ve ARGE yatırımları kritik.",
      "Sektörün geleceği var mı, şirketin pazar payı genişliyor mu?",
      "Marjlar yüksek ve istikrarlı mı? Maliyet kontrolü iyi mi?",
      "Çok satım yapma — kazanan büyüme şirketlerini tutmak en büyük hatadır.",
      "15 sorudan oluşan kontrol listesini her hisseye uygula.",
    ],
    criteria: [
      { label: "Tutarlı yüksek gelir büyümesi (>%10-15)", metric: "revenueGrowth" },
      { label: "Yüksek kazanç büyümesi (>%15)", metric: "earningsGrowth" },
      { label: "ROE > %12 — sermaye verimliliği", metric: "roe" },
      { label: "Yüksek brüt marj — sektör ortalamasının üstünde", metric: "grossMargin" },
      { label: "Düşük-orta borç (D/E < 80)", metric: "debtToEquity" },
    ],
    avoid: [
      "Temelleri sağlam olsa da büyümesi durmuş şirketler.",
      "Düşük ARGE harcaması yapan teknoloji şirketleri.",
      "Tek müşteriye/ürüne aşırı bağımlı işletmeler.",
      "Yönetimi kapalı, soru cevaplamaktan kaçan firmalar.",
    ],
    quotes: [
      "Doğru hisseyi bulduğunda, satmak için bir sebep neredeyse hiç yoktur.",
      "Borsa kayıplarının çoğu, başarılı yatırımları erken satmaktan gelir.",
    ],
    accent: "#10b981",
    accent2: "#065f46",
    stats: { annualReturn: "~%20+ (tahmin)", activeYears: "1931-1999 (68 yıl)", benchmark: "S&P (~%10)" },
    style: ["Büyüme", "Kalite", "Scuttlebutt", "Konsantre"],
  },
  {
    id: "druckenmiller",
    name: "Stanley Druckenmiller",
    era: "1953 –",
    nickname: "Makro Ustası",
    philosophy: "Asıl önemli olan ne kadar haklı olduğunla değil, haklıyken ne kadar para kazandığınla, haksızken ne kadar az kaybettiğinle ölçülür.",
    bio: "Quantum Fund'da George Soros ile 1992'de İngiliz Sterlini'ni 'kıran' işlemin mimarı. Kendi Duquesne Capital'i 30 yıl boyunca yıllık %30 getiri sağladı, hiç zarar yılı yaşamadı.",
    approach: [
      "Makro resmi oku: faiz, dolar, emtia, jeopolitik.",
      "Likidite akışlarını izle — para nereye akıyor?",
      "Konsantre pozisyonlar al — gerçekten ikna olduğun trade'lere büyük bahis yap.",
      "Hata yaptığında hızla çık, kazandığında pozisyonu büyüt.",
      "Hızlı büyüyen, momentum sahibi şirketleri tercih et.",
      "Şirketin gelecekte ne olacağı bugünkü kazançlardan önemlidir.",
    ],
    criteria: [
      { label: "Yüksek kazanç büyümesi (>%15)", metric: "earningsGrowth" },
      { label: "Yüksek gelir büyümesi (>%10)", metric: "revenueGrowth" },
      { label: "ROE > %12", metric: "roe" },
      { label: "Pozitif sektör momentumu", metric: "revenueGrowth" },
    ],
    avoid: [
      "Yavaş büyüyen olgun sektörler.",
      "Likiditesi düşük şirketler.",
      "Kararsız makro ortamda riskli pozisyonlar.",
    ],
    quotes: [
      "Asıl önemli olan haklı olmak değil, haklıyken ne kadar kazandığındır.",
      "Hata yaptığını fark ettiğinde tek doğru yol pozisyonu kapatmaktır.",
    ],
    accent: "#ef4444",
    accent2: "#991b1b",
    stats: { annualReturn: "~%30 (Duquesne)", activeYears: "1981-2010 (30 yıl)", benchmark: "S&P 500 (~%11)", aum: "$12 milyar" },
    style: ["Makro", "Momentum", "Konsantre", "Esnek"],
  },
];

export function getLegend(id: string): Legend | undefined {
  return LEGENDS.find((l) => l.id === id);
}
