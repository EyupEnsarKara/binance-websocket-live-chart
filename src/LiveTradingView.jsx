import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    Wifi,
    WifiOff,
    BarChart3,
    Clock,
    Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────
// 🏗️ ARCHITECTURE NOTES:
//
// PERFORMANCE STRATEGY – Ref-based Buffering + Direct Chart Update
//
// WebSocket'ten gelen trade verileri saniyede 20-50+ mesaj olabilir.
// Bu verileri doğrudan React state'ine yazmak, her mesajda re-render
// tetikler ve tarayıcıyı kilitler.
//
// Çözüm:
//   1. Gelen veri → useRef buffer'ına yazılır (re-render YOK)
//   2. setInterval (250ms) → buffer'daki verileri biriktirir
//   3. ApexCharts.exec() ile DOĞRUDAN güncelleme (React re-render YOK!)
//      Bu sayede grafik baştan çizilmez, sadece yeni noktalar eklenir.
//   4. Sliding Window → Sadece son 100 veri noktası tutulur
//
// 🔑 KRİTİK: chartSeries state'i yerine ApexCharts.exec kullanıyoruz.
//    React state ile güncelleme = Chart bileşeni re-mount = grafik baştan çizilir
//    ApexCharts.exec ile güncelleme = sadece veri güncellenir = akıcı animasyon
// ─────────────────────────────────────────────────────────────────────

const WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
const CHART_ID = 'live-btc-chart';
const MAX_DATA_POINTS = 100;
const THROTTLE_MS = 250;
const CHART_RANGE_MS = 60_000; // 1 dakikalık görünür aralık
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export default function LiveTradingView() {
    // ─── UI State (sadece fiyat bilgileri ve bağlantı durumu) ───
    const [currentPrice, setCurrentPrice] = useState(null);
    const [prevPrice, setPrevPrice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [tradeCount, setTradeCount] = useState(0);
    const [sessionHigh, setSessionHigh] = useState(0);
    const [sessionLow, setSessionLow] = useState(Infinity);
    const [totalVolume, setTotalVolume] = useState(0);
    const [dataPointCount, setDataPointCount] = useState(0);

    // ─── Refs (performans: state güncellemesi olmadan veri biriktirir) ───
    // 🔑 KEY INSIGHT: bufferRef ve dataRef asla re-render tetiklemez.
    const bufferRef = useRef([]);
    const dataRef = useRef([]); // Tüm chart verisi burada tutulur (state'te DEĞİL!)
    const wsRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimer = useRef(null);
    const intervalRef = useRef(null);
    const chartMounted = useRef(false);
    const statsRef = useRef({
        tradeCount: 0,
        sessionHigh: 0,
        sessionLow: Infinity,
        totalVolume: 0,
    });

    // ─── WebSocket Bağlantı Yönetimi ───
    const connectWebSocket = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            reconnectAttempts.current = 0;
            console.log('✅ Binance WebSocket bağlantısı kuruldu');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const price = parseFloat(data.p);
            const time = data.T;
            const qty = parseFloat(data.q);

            // 🔑 PERFORMANCE: Doğrudan state'e YAZMA!
            //    Buffer'a ekle — re-render tetiklenmez.
            bufferRef.current.push({ x: time, y: price });

            // İstatistikleri ref'te biriktir (re-render yok)
            statsRef.current.tradeCount += 1;
            statsRef.current.totalVolume += qty;
            if (price > statsRef.current.sessionHigh) statsRef.current.sessionHigh = price;
            if (price < statsRef.current.sessionLow) statsRef.current.sessionLow = price;
        };

        ws.onclose = (event) => {
            setIsConnected(false);
            console.warn('⚠️ WebSocket bağlantısı kapandı:', event.code);

            // ─── AUTO-RECONNECT with exponential backoff ───
            if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                const delay = RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts.current);
                reconnectAttempts.current += 1;
                console.log(
                    `🔄 Yeniden bağlanma ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS} (${(delay / 1000).toFixed(1)}s)`
                );
                reconnectTimer.current = setTimeout(connectWebSocket, delay);
            } else {
                console.error('❌ Maksimum yeniden bağlanma denemesi aşıldı');
            }
        };

        ws.onerror = (err) => console.error('❌ WebSocket hatası:', err);
    }, []);

    // ─── Throttled Chart Update (setInterval) ───
    useEffect(() => {
        connectWebSocket();

        // 🔑 PERFORMANCE: 250ms aralıkla buffer → ApexCharts DOĞRUDAN güncelleme.
        //    React render döngüsünü ATLIYOR, bu yüzden grafik baştan çizilmez.
        intervalRef.current = setInterval(() => {
            const buffer = bufferRef.current;
            if (buffer.length === 0) return;

            // Buffer'daki tüm veriyi ana veri dizisine ekle
            dataRef.current = [...dataRef.current, ...buffer].slice(-MAX_DATA_POINTS);
            bufferRef.current = [];

            const latestPoint = dataRef.current[dataRef.current.length - 1];

            // 🔑 CRITICAL: ApexCharts.exec() ile grafiği React dışında güncelle.
            //    Bu, Chart bileşeninin re-render olmasını engeller.
            //    Grafik sadece yeni veri noktalarını ekler, baştan çizmez.
            if (chartMounted.current) {
                ApexCharts.exec(CHART_ID, 'updateSeries', [
                    { name: 'BTC/USDT', data: dataRef.current },
                ]);
            }

            // Sadece UI metriklerini state'e yaz (hafif güncelleme)
            setCurrentPrice((prev) => {
                setPrevPrice(prev);
                return latestPoint.y;
            });
            setTradeCount(statsRef.current.tradeCount);
            setSessionHigh(statsRef.current.sessionHigh);
            setSessionLow(statsRef.current.sessionLow);
            setTotalVolume(statsRef.current.totalVolume);
            setDataPointCount(dataRef.current.length);
        }, THROTTLE_MS);

        return () => {
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [connectWebSocket]);

    // ─── Price Direction ───
    const priceDirection = useMemo(() => {
        if (currentPrice === null || prevPrice === null) return 'neutral';
        if (currentPrice > prevPrice) return 'up';
        if (currentPrice < prevPrice) return 'down';
        return 'neutral';
    }, [currentPrice, prevPrice]);

    // ─── ApexCharts Konfigürasyonu (sadece bir kez oluşturulur) ───
    const chartOptions = useMemo(
        () => ({
            chart: {
                id: CHART_ID,
                type: 'area',
                animations: {
                    enabled: true,
                    easing: 'linear',
                    dynamicAnimation: {
                        enabled: true,
                        speed: THROTTLE_MS,
                    },
                },
                toolbar: { show: false },
                background: 'transparent',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                zoom: { enabled: false },
                events: {
                    // Chart mount olduğunda flag'i aç
                    mounted: () => {
                        chartMounted.current = true;
                    },
                },
            },
            colors: ['#10b981'],
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.45,
                    opacityTo: 0.05,
                    stops: [0, 90, 100],
                    colorStops: [
                        { offset: 0, color: '#10b981', opacity: 0.4 },
                        { offset: 50, color: '#10b981', opacity: 0.15 },
                        { offset: 100, color: '#10b981', opacity: 0.02 },
                    ],
                },
            },
            stroke: {
                curve: 'smooth',
                width: 2.5,
                colors: ['#10b981'],
            },
            grid: {
                borderColor: '#1e293b',
                strokeDashArray: 3,
                xaxis: { lines: { show: true } },
                yaxis: { lines: { show: true } },
                padding: { top: 0, right: 10, bottom: 0, left: 10 },
            },
            xaxis: {
                type: 'datetime',
                // 🔑 X-AXIS MANAGEMENT: Sabit 60 saniyelik aralık.
                //    Grafiğin sağdan sola "kaymasını" sağlar.
                range: CHART_RANGE_MS,
                labels: {
                    show: true,
                    style: {
                        colors: '#64748b',
                        fontSize: '10px',
                        fontFamily: "'JetBrains Mono', monospace",
                    },
                    datetimeFormatter: { second: 'HH:mm:ss' },
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                labels: {
                    style: {
                        colors: '#64748b',
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                    },
                    formatter: (val) =>
                        val
                            ? `$${val.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}`
                            : '',
                },
                forceNiceScale: true,
            },
            tooltip: {
                enabled: true,
                theme: 'dark',
                x: { format: 'HH:mm:ss' },
                y: {
                    formatter: (val) =>
                        `$${val?.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}`,
                },
                style: { fontSize: '12px' },
            },
            dataLabels: { enabled: false },
            markers: {
                size: 0,
                hover: { size: 5, sizeOffset: 3 },
            },
            theme: { mode: 'dark' },
        }),
        []
    );

    // 🔑 İlk render için boş seri — sonraki güncellemeler ApexCharts.exec() ile yapılır.
    const initialSeries = useMemo(
        () => [{ name: 'BTC/USDT', data: [] }],
        []
    );

    // ─── Formatting Helpers ───
    const formatPrice = (price) =>
        price
            ? `$${price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`
            : '—';

    const formatVolume = (vol) => {
        if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K`;
        return vol.toFixed(4);
    };

    const priceChange = currentPrice && prevPrice ? currentPrice - prevPrice : 0;
    const priceChangePercent = prevPrice ? (priceChange / prevPrice) * 100 : 0;

    // ─── Current Time ───
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="dashboard-container">
            {/* ═══════════════ HEADER ═══════════════ */}
            <header className="dashboard-header">
                <div className="header-left">
                    <div className="header-logo">
                        <BarChart3 size={28} className="logo-icon" />
                        <div>
                            <h1 className="header-title">CryptoFlow</h1>
                            <p className="header-subtitle">Real-time Trading Terminal</p>
                        </div>
                    </div>
                </div>
                <div className="header-right">
                    <div className="header-time">
                        <Clock size={14} />
                        <span>
                            {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                        </span>
                    </div>
                    <div
                        className={`connection-badge ${isConnected ? 'connected' : 'disconnected'
                            }`}
                    >
                        {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                        <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                </div>
            </header>

            {/* ═══════════════ MAIN CONTENT ═══════════════ */}
            <main className="dashboard-main">
                {/* ─── Price Hero Section ─── */}
                <div className="price-hero-card">
                    <div className="price-hero-content">
                        <div className="asset-info">
                            <div className="asset-icon-wrapper">
                                <span className="asset-icon">₿</span>
                            </div>
                            <div>
                                <h2 className="asset-pair">BTC / USDT</h2>
                                <p className="asset-label">Bitcoin • Perpetual</p>
                            </div>
                        </div>

                        <div className="price-display">
                            {/* 🔑 PRICE BADGE: Fiyat yönüne göre renk değişir */}
                            <div className={`price-value ${priceDirection}`}>
                                {priceDirection === 'up' && (
                                    <TrendingUp size={28} className="price-arrow" />
                                )}
                                {priceDirection === 'down' && (
                                    <TrendingDown size={28} className="price-arrow" />
                                )}
                                <span>{formatPrice(currentPrice)}</span>
                            </div>
                            <div className={`price-change ${priceDirection}`}>
                                <span>
                                    {priceChange >= 0 ? '+' : ''}
                                    {priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}
                                    {priceChangePercent.toFixed(4)}%)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ─── Mini Stats Row ─── */}
                    <div className="mini-stats-row">
                        <div className="mini-stat">
                            <span className="mini-stat-label">Session High</span>
                            <span className="mini-stat-value high">
                                {sessionHigh > 0 ? formatPrice(sessionHigh) : '—'}
                            </span>
                        </div>
                        <div className="mini-stat-divider" />
                        <div className="mini-stat">
                            <span className="mini-stat-label">Session Low</span>
                            <span className="mini-stat-value low">
                                {sessionLow < Infinity ? formatPrice(sessionLow) : '—'}
                            </span>
                        </div>
                        <div className="mini-stat-divider" />
                        <div className="mini-stat">
                            <span className="mini-stat-label">Trades</span>
                            <span className="mini-stat-value">
                                {tradeCount.toLocaleString()}
                            </span>
                        </div>
                        <div className="mini-stat-divider" />
                        <div className="mini-stat">
                            <span className="mini-stat-label">Volume (BTC)</span>
                            <span className="mini-stat-value">{formatVolume(totalVolume)}</span>
                        </div>
                    </div>
                </div>

                {/* ─── Chart Card ─── */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div className="chart-card-title-row">
                            <h3 className="chart-card-title">
                                <Activity size={18} className="chart-title-icon" />
                                Price Chart
                            </h3>
                            <div className="chart-badges">
                                <span className="chart-badge">1m Range</span>
                                <span className="chart-badge">
                                    <Zap size={12} />
                                    {THROTTLE_MS}ms refresh
                                </span>
                                <span className="chart-badge data-badge">
                                    {dataPointCount}/{MAX_DATA_POINTS} pts
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="chart-area">
                        {/* 🔑 Chart sadece BİR KEZ mount olur, sonra ApexCharts.exec() ile güncellenir */}
                        <Chart
                            options={chartOptions}
                            series={initialSeries}
                            type="area"
                            height="100%"
                            width="100%"
                        />
                    </div>
                </div>

                {/* ─── Performance Info Footer ─── */}
                <div className="performance-footer">
                    <div className="perf-item">
                        <span className="perf-dot green" />
                        <span>Ref Buffer — no re-render on incoming data</span>
                    </div>
                    <div className="perf-item">
                        <span className="perf-dot blue" />
                        <span>
                            Throttled at {THROTTLE_MS}ms — ~{Math.round(1000 / THROTTLE_MS)}{' '}
                            updates/s
                        </span>
                    </div>
                    <div className="perf-item">
                        <span className="perf-dot purple" />
                        <span>
                            Sliding window — max {MAX_DATA_POINTS} data points in memory
                        </span>
                    </div>
                </div>
            </main>
        </div>
    );
}
