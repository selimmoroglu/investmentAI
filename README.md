# InvestmentAI

BIST ve ABD borsaları için kapsamlı hisse analizi ve portföy yönetim platformu.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688?style=flat-square&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)

## Özellikler

### Hisse Analizi
- Gerçek zamanlı fiyat, hacim, P/E, piyasa değeri verileri (Yahoo Finance)
- Teknik analiz: RSI, MACD, mum grafikleri
- Temel analiz: Gelir tablosu, bilanço, nakit akışı
- Değerleme modelleri: DCF, P/E, P/B, EV/EBITDA, PEG
- Kalite skorları: Piotroski F-Skoru, Altman Z-Skoru

### Uzun Vade Bileşik Skoru (0–100)
- **Kalite** %40 — Piotroski + Altman + marjlar
- **Değer** %30 — Çoklu değerleme çarpanları
- **Büyüme** %20 — Gelir ve kazanç büyümesi
- **Getiri** %10 — Temettü verimi ve sürdürülebilirlik

Sonuç: Çok Cazip / Cazip / Tut / Pahalı / Kaçın

### Portföy Takibi
- Pozisyon ekleme, düzenleme, silme
- TRY ve USD bazında kar/zarar takibi
- Yıllıklaştırılmış getiri hesaplama
- HHI ile konsantrasyon riski analizi
- Sektör dağılımı ve çeşitlendirme skoru

### Hisse Tarayıcı (Screener)
- Hazır stratejiler: Değer, Momentum, Büyük Şirketler, Kazananlar, Kaybedenler
- Özel filtreler: Sektör, değişim %, P/E aralığı, piyasa değeri, hacim
- BIST ve ABD hisseleri için ayrı tarama

### Piyasa & Endeks Takibi
- BIST 100, NASDAQ, Altın, BTC, USD/TRY
- Değerleme durumu (Pahalı / Ucuz / Adil)

### Yatırım Üstadları
- Buffett, Lynch gibi ünlü yatırımcıların kriterleriyle eşleşen hisseler

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Grafikler | Lightweight-charts 5 |
| Backend | FastAPI, Uvicorn |
| Veri | yfinance (Yahoo Finance) |
| İşleme | Pandas, NumPy |

## Kurulum

### Gereksinimler
- Node.js 18+
- Python 3.9+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışır.

## Proje Yapısı

```
investmentAI/
├── frontend/
│   └── src/
│       ├── app/          # Sayfalar (ana sayfa, hisse detay, screener, portföy...)
│       ├── components/   # Yeniden kullanılabilir UI bileşenleri
│       └── lib/          # API istemcisi, formatlayıcılar
│
└── backend/
    ├── routers/          # 16 API endpoint
    ├── services/         # DCF, kalite skoru, önbellek servisleri
    └── data/             # BIST & ABD hisse listeleri, TÜFE verisi
```

## Veri Kaynağı

Tüm piyasa verisi [Yahoo Finance](https://finance.yahoo.com/) üzerinden yfinance kütüphanesi ile çekilmektedir. Veritabanı gerektirmez; portföy verisi tarayıcı localStorage'ında saklanır.

## Ekran Görüntüleri

| Ana Sayfa | Hisse Detayı | Portföy |
|-----------|-------------|---------|
| Sektör bazlı hisse listesi | DCF, Piotroski, teknik analiz | P&L, risk metrikleri |

## Lisans

MIT
