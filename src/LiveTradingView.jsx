import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Clock,
} from 'lucide-react';



const WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
const CHART_ID = 'live-btc-chart';
const MAX_DATA_POINTS = 300;
const THROTTLE_MS = 250;
const UI_UPDATE_MS = 500;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export default function LiveTradingView() {
    const [isConnected, setIsConnected] = useState(false);
    const [metrics, setMetrics] = useState({
        currentPrice: null,
        prevPrice: null,
        tradeCount: 0,
        sessionHigh: 0,
        sessionLow: Infinity,
        totalVolume: 0,
    });

    const latestPriceRef = useRef(null);
    const dataRef = useRef([]);
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

    useEffect(() => {
        connectWebSocket();

        intervalRef.current = setInterval(() => {
            const price = latestPriceRef.current;
            if (price === null) return;

            dataRef.current.push({ x: Date.now(), y: price });

            if (dataRef.current.length > MAX_DATA_POINTS) {
                dataRef.current.splice(0, dataRef.current.length - MAX_DATA_POINTS);
            }

            if (chartReady.current) {
                ApexCharts.exec(CHART_ID, 'updateSeries', [
                    { data: dataRef.current },
                ], false);
            }
        }, THROTTLE_MS);

        const uiInterval = setInterval(() => {
            const price = latestPriceRef.current;
            if (price === null) return;

            setMetrics((prev) => ({
                currentPrice: price,
                prevPrice: prev.currentPrice,
                tradeCount: statsRef.current.tradeCount,
                sessionHigh: statsRef.current.sessionHigh,
                sessionLow: statsRef.current.sessionLow,
                totalVolume: statsRef.current.totalVolume,
            }));
        }, UI_UPDATE_MS);

        return () => {
            if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
            clearInterval(uiInterval);
        };
    }, [connectWebSocket]);


    const { currentPrice, prevPrice, tradeCount, sessionHigh, sessionLow, totalVolume } = metrics;

    const priceDirection = useMemo(() => {
        if (currentPrice === null || prevPrice === null) return 'neutral';
        return currentPrice > prevPrice ? 'up' : currentPrice < prevPrice ? 'down' : 'neutral';
    }, [currentPrice, prevPrice]);

    const chartOptions = useMemo(() => ({
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

    const initialSeries = useMemo(() => [{ name: 'BTC/USDT', data: [] }], []);


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
                        <span className="connection-dot" />
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
                        </div>
                    </div>
                    <div className="chart-area">
                        <Chart options={chartOptions} series={initialSeries} type="area" height="100%" width="100%" />
                    </div>
                </div>


            </main>
        </div>
    );
}
