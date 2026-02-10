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
// 🏗️ ARCHITECTURE NOTES — v4 (Butter-Smooth Streaming)
//
// ÖNCEKİ SORUNLAR:
//   v1: chartData state → Chart re-mount → grafik baştan çizilir
//   v2: ApexCharts.exec + tüm buffer → 100 nokta = 2sn veri, 60sn eksen → sıkışma
//   v3: 250ms tick + animations:false → "tık tık" adım adım kayma
//
// ÇÖZÜM (v4):
//   1. Tick hızı 250ms → 100ms: daha sık, daha küçük adımlar
//   2. dynamicAnimation.speed = 100ms: her güncelleme smooth interpolasyon
//   3. 300 nokta × 100ms = 30 saniyelik pencere (aynı zaman aralığı)
//   4. CSS transition ile SVG path ek yumuşaklık
//   5. initialAnimation kapalı = mount zıplaması yok
// ─────────────────────────────────────────────────────────────────────

const WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
const CHART_ID = 'live-btc-chart';
const MAX_DATA_POINTS = 300;        // 300 × 100ms = 30 sn
const THROTTLE_MS = 100;            // Her 100ms'de 1 nokta → butter-smooth
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export default function LiveTradingView() {
    // ─── UI State (sadece metrikleri günceller, Chart'ı DEĞİL) ───
    const [currentPrice, setCurrentPrice] = useState(null);
    const [prevPrice, setPrevPrice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [tradeCount, setTradeCount] = useState(0);
    const [sessionHigh, setSessionHigh] = useState(0);
    const [sessionLow, setSessionLow] = useState(Infinity);
    const [totalVolume, setTotalVolume] = useState(0);
    const [dataPointCount, setDataPointCount] = useState(0);

    // ─── Refs ───
    const latestPriceRef = useRef(null);   // 🔑 Buffer yerine sadece son fiyat
    const dataRef = useRef([]);            // Chart verisi (state dışı)
    const wsRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimer = useRef(null);
    const intervalRef = useRef(null);
    const chartReady = useRef(false);
    const statsRef = useRef({
        tradeCount: 0,
        sessionHigh: 0,
        sessionLow: Infinity,
        totalVolume: 0,
    });

    // ─── WebSocket ───
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
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const price = parseFloat(data.p);
            const qty = parseFloat(data.q);

            // 🔑 PERFORMANCE: Sadece son fiyatı tut. Her mesajda ref güncelle.
            //    State'e YAZMA → sıfır re-render.
            latestPriceRef.current = price;

            statsRef.current.tradeCount += 1;
            statsRef.current.totalVolume += qty;
            if (price > statsRef.current.sessionHigh) statsRef.current.sessionHigh = price;
            if (price < statsRef.current.sessionLow) statsRef.current.sessionLow = price;
        };

        ws.onclose = () => {
            setIsConnected(false);
            if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                const delay = RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts.current);
                reconnectAttempts.current += 1;
                reconnectTimer.current = setTimeout(connectWebSocket, delay);
            }
        };

        ws.onerror = () => { };
    }, []);

    // ─── Throttled Tick: her 100ms'de 1 nokta ekle (butter-smooth) ───
    useEffect(() => {
        connectWebSocket();

        // 🔑 Chart update tick — her 100ms'de yalnızca grafiği güncelle
        //    React state'e DOKUNMAZ → sıfır re-render, sadece SVG path değişir
        intervalRef.current = setInterval(() => {
            const price = latestPriceRef.current;
            if (price === null) return;

            // 🔑 Her tick'te TAM 1 NOKTA ekle.
            //    x = Date.now() → noktalar arası mesafe her zaman 100ms
            //    Bu sayede grafik eşit aralıklı, düzgün bir çizgi oluşturur.
            const point = { x: Date.now(), y: price };
            dataRef.current.push(point);

            // 🔑 SLIDING WINDOW: En fazla 300 nokta tut
            if (dataRef.current.length > MAX_DATA_POINTS) {
                dataRef.current = dataRef.current.slice(-MAX_DATA_POINTS);
            }

            // 🔑 ApexCharts.exec — React render döngüsü DIŞINDA güncelleme.
            //    Chart bileşeni asla re-mount olmaz.
            //    true = dynamicAnimation tetikle → smooth interpolasyon
            if (chartReady.current) {
                ApexCharts.exec(CHART_ID, 'updateSeries', [
                    { data: [...dataRef.current] },
                ], true);  // true = dynamicAnimation (smooth geçiş)
            }
        }, THROTTLE_MS);

        // 🔑 UI state tick — her 300ms'de metrik state'lerini güncelle
        //    React re-render'ı sadece burada tetiklenir (3x daha seyrek)
        const uiInterval = setInterval(() => {
            const price = latestPriceRef.current;
            if (price === null) return;

            setCurrentPrice((prev) => {
                setPrevPrice(prev);
                return price;
            });
            setTradeCount(statsRef.current.tradeCount);
            setSessionHigh(statsRef.current.sessionHigh);
            setSessionLow(statsRef.current.sessionLow);
            setTotalVolume(statsRef.current.totalVolume);
            setDataPointCount(dataRef.current.length);
        }, 300);

        return () => {
            if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
            clearInterval(uiInterval);
        };
    }, [connectWebSocket]);

    // ─── Price Direction ───
    const priceDirection = useMemo(() => {
        if (currentPrice === null || prevPrice === null) return 'neutral';
        return currentPrice > prevPrice ? 'up' : currentPrice < prevPrice ? 'down' : 'neutral';
    }, [currentPrice, prevPrice]);

    // ─── ApexCharts Config (DAİMA SABİT — asla değişmez) ───
    const chartOptions = useMemo(() => ({
        chart: {
            id: CHART_ID,
            type: 'area',
            // 🔑 v4: initialAnimation kapalı (mount zıplaması yok)
            //    dynamicAnimation açık + speed=THROTTLE_MS → her güncelleme smooth interpolasyon
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: {
                    enabled: true,
                    speed: THROTTLE_MS,  // 100ms → tick hızıyla senkron
                },
                animateGradually: { enabled: false },
            },
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            zoom: { enabled: false },
            events: {
                mounted: () => { chartReady.current = true; },
            },
        },
        colors: ['#10b981'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.02,
                stops: [0, 90, 100],
                colorStops: [
                    { offset: 0, color: '#10b981', opacity: 0.35 },
                    { offset: 60, color: '#10b981', opacity: 0.1 },
                    { offset: 100, color: '#10b981', opacity: 0.01 },
                ],
            },
        },
        stroke: { curve: 'smooth', width: 2.5, colors: ['#10b981'], lineCap: 'round' },
        grid: {
            borderColor: '#1e293b',
            strokeDashArray: 3,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } },
            padding: { top: 5, right: 15, bottom: 0, left: 15 },
        },
        xaxis: {
            type: 'datetime',
            // 🔑 X-AXIS: Son 30 saniyelik pencere (120 nokta × 250ms)
            range: MAX_DATA_POINTS * THROTTLE_MS,
            labels: {
                show: true,
                style: { colors: '#64748b', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" },
                datetimeFormatter: { second: 'HH:mm:ss' },
                datetimeUTC: false,
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            labels: {
                style: { colors: '#64748b', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" },
                formatter: (v) => v ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
            },
            forceNiceScale: true,
            tickAmount: 6,
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            x: { format: 'HH:mm:ss' },
            y: { formatter: (v) => `$${v?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        },
        dataLabels: { enabled: false },
        markers: { size: 0, hover: { size: 4 } },
        theme: { mode: 'dark' },
    }), []);

    // 🔑 Sabit boş seri — Chart bileşeni bununla mount olur, bir daha değişmez.
    const initialSeries = useMemo(() => [{ name: 'BTC/USDT', data: [] }], []);

    // ─── Helpers ───
    const fmt = (p) => p ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
    const fmtVol = (v) => v >= 1000 ? `${(v / 1000).toFixed(2)}K` : v.toFixed(4);
    const chg = currentPrice && prevPrice ? currentPrice - prevPrice : 0;
    const chgPct = prevPrice ? (chg / prevPrice) * 100 : 0;

    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="dashboard-container">
            {/* ═══ HEADER ═══ */}
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
                        <span>{currentTime.toLocaleTimeString('en-US', { hour12: false })}</span>
                    </div>
                    <div className={`connection-badge ${isConnected ? 'connected' : 'disconnected'}`}>
                        {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                        <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                </div>
            </header>

            {/* ═══ MAIN ═══ */}
            <main className="dashboard-main">
                {/* ─ Price Hero ─ */}
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
                            <div className={`price-value ${priceDirection}`}>
                                {priceDirection === 'up' && <TrendingUp size={28} className="price-arrow" />}
                                {priceDirection === 'down' && <TrendingDown size={28} className="price-arrow" />}
                                <span>{fmt(currentPrice)}</span>
                            </div>
                            <div className={`price-change ${priceDirection}`}>
                                <span>
                                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)} ({chgPct >= 0 ? '+' : ''}{chgPct.toFixed(4)}%)
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="mini-stats-row">
                        <div className="mini-stat">
                            <span className="mini-stat-label">Session High</span>
                            <span className="mini-stat-value high">{sessionHigh > 0 ? fmt(sessionHigh) : '—'}</span>
                        </div>
                        <div className="mini-stat-divider" />
                        <div className="mini-stat">
                            <span className="mini-stat-label">Session Low</span>
                            <span className="mini-stat-value low">{sessionLow < Infinity ? fmt(sessionLow) : '—'}</span>
                        </div>
                        <div className="mini-stat-divider" />
                        <div className="mini-stat">
                            <span className="mini-stat-label">Trades</span>
                            <span className="mini-stat-value">{tradeCount.toLocaleString()}</span>
                        </div>
                        <div className="mini-stat-divider" />
                        <div className="mini-stat">
                            <span className="mini-stat-label">Volume (BTC)</span>
                            <span className="mini-stat-value">{fmtVol(totalVolume)}</span>
                        </div>
                    </div>
                </div>

                {/* ─ Chart ─ */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div className="chart-card-title-row">
                            <h3 className="chart-card-title">
                                <Activity size={18} className="chart-title-icon" />
                                Price Chart
                            </h3>
                            <div className="chart-badges">
                                <span className="chart-badge">30s Window</span>
                                <span className="chart-badge"><Zap size={12} />{THROTTLE_MS}ms smooth</span>
                                <span className="chart-badge data-badge">{dataPointCount}/{MAX_DATA_POINTS} pts</span>
                            </div>
                        </div>
                    </div>
                    <div className="chart-area">
                        <Chart options={chartOptions} series={initialSeries} type="area" height="100%" width="100%" />
                    </div>
                </div>

                {/* ─ Footer ─ */}
                <div className="performance-footer">
                    <div className="perf-item"><span className="perf-dot green" /><span>Ref-only data — zero re-renders on WS messages</span></div>
                    <div className="perf-item"><span className="perf-dot blue" /><span>1 point/{THROTTLE_MS}ms — ApexCharts.exec() bypass</span></div>
                    <div className="perf-item"><span className="perf-dot purple" /><span>Sliding window — {MAX_DATA_POINTS} pts max</span></div>
                </div>
            </main>
        </div>
    );
}
