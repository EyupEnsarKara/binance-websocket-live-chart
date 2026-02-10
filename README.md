# CryptoFlow — Real-time BTC/USDT Trading Terminal

Binance WebSocket API üzerinden anlık BTC/USDT fiyat verilerini görselleştiren, yüksek performanslı bir React dashboard uygulaması.

## Özellikler

- **Canlı fiyat takibi** — Binance WebSocket stream üzerinden anlık trade verileri
- **Akıcı grafik** — ApexCharts ile 300 noktalı kayan pencere (sliding window)
- **Oturum istatistikleri** — High, Low, Trade sayısı, BTC hacmi
- **Otomatik yeniden bağlanma** — Exponential backoff ile bağlantı kopma yönetimi
- **Koyu terminal teması** — Profesyonel borsa terminali görünümü

## Performans

- WebSocket mesajları sadece `ref` günceller — state yazılmaz, render tetiklenmez
- Grafik, React dışında `ApexCharts.exec()` ile güncellenir
- UI metrikleri tek state objesi ile 500ms aralıklarla güncellenir
- `splice()` ile yerinde dizi yönetimi — gereksiz kopyalama yok

## Kurulum

```bash
npm install
npm run dev
```

## Teknolojiler

- React + Vite
- ApexCharts (react-apexcharts)
- Binance WebSocket API
- Lucide React Icons
- Tailwind CSS
