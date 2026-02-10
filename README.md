## BTC Live Chart — Binance WebSocket BTC/USDT Görselleştirici

Binance WebSocket API üzerinden anlık BTC/USDT fiyat verilerini gösteren, sade ve yüksek performanslı bir React dashboard uygulaması.

### Özellikler

- **Canlı fiyat takibi**: Binance WebSocket stream üzerinden anlık BTC/USDT trade verileri
- **Akıcı grafik**: ApexCharts ile 300 noktalı kayan pencere (sliding window)
- **Oturum istatistikleri**: Session High / Low, işlem sayısı (tradeCount), oturum boyunca BTC hacmi
- **Basit durum göstergesi**: Navbar’da bağlantı durumuna göre yeşil **LIVE** / kırmızı **OFFLINE** rozeti
- **Koyu tema arayüzü**: Minimal, terminal benzeri koyu arayüz

### Performans

- WebSocket mesajları sadece `ref` günceller — state yazılmaz, gereksiz render tetiklenmez
- Grafik, React dışında `ApexCharts.exec()` ile güncellenir (performanslı canlı akış)
- UI metrikleri tek state objesi ile 500ms aralıklarla güncellenir
- `splice()` ile yerinde dizi yönetimi — gereksiz dizi kopyalama yok

### Kurulum

```bash
npm install
npm run dev
```

### Teknolojiler

- **React + Vite**
- **ApexCharts / react-apexcharts**
- **Tailwind CSS**
- **Lucide React ikonlar**
- **Binance WebSocket API**
    