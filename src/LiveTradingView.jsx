import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import { Activity, Zap, Wallet, Maximize2, AreaChart, CandlestickChart, TrendingUp, TrendingDown } from 'lucide-react';

// Shadcn UI components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Chart settings
const MAX_DATA_POINTS = 300;
const DEFAULT_MAX_CANDLES = 60;
const CANDLE_INTERVAL = 1000; // Fixed 1 second candles
const THROTTLE_MS = 250;
const UI_UPDATE_MS = 500;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

const CANDLE_COUNTS = [30, 60, 90, 120, 200];

export default function LiveTradingView() {
    const { symbol = 'btcusdt' } = useParams();
    const pairLabel = symbol.toUpperCase().replace('USDT', '/USDT');

    // Combined Stream URL - trade + 24hr ticker in single connection
    const WS_URL = `wss://stream.binance.com:9443/stream?streams=${symbol.toLowerCase()}@trade/${symbol.toLowerCase()}@ticker`;

    // ── UI State ──
    const [chartType, setChartType] = useState('area');
    const [maxCandles, setMaxCandles] = useState(DEFAULT_MAX_CANDLES);
    const [isConnected, setIsConnected] = useState(false);
    const [metrics, setMetrics] = useState({
        currentPrice: null,
        prevPrice: null,
        priceChange: 0,
        priceChangePercent: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        quoteVolume24h: 0,
        tradeCount: 0,
    });

    // ── Refs (no re-render) ──
    const chartTypeRef = useRef('area');
    const maxCandlesRef = useRef(DEFAULT_MAX_CANDLES);
    const latestPriceRef = useRef(null);
    const areaDataRef = useRef([]);
    const candleDataRef = useRef([]);
    const currentCandleRef = useRef(null);
    const wsRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimer = useRef(null);
    const intervalRef = useRef(null);
    const areaChartReady = useRef(false);
    const candleChartReady = useRef(false);
    const tickerRef = useRef({
        priceChange: 0,
        priceChangePercent: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        quoteVolume24h: 0,
        tradeCount: 0,
    });

    // State değiştiğinde ref'leri de güncelle
    useEffect(() => { chartTypeRef.current = chartType; }, [chartType]);
    useEffect(() => { maxCandlesRef.current = maxCandles; }, [maxCandles]);

    // Chart ID'leri
    const areaChartId = `area-${symbol}`;
    const candleChartId = `candle-${symbol}`;

    // ── WebSocket Connection (Combined Stream) ──
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
            const message = JSON.parse(event.data);
            const stream = message.stream;
            const data = message.data;

            // Handle trade stream
            if (stream && stream.endsWith('@trade')) {
                const price = parseFloat(data.p);
                const now = Date.now();

                latestPriceRef.current = price;

                // ── Candlestick OHLC calculation (on each trade) ──
                const candle = currentCandleRef.current;

                if (!candle || now >= candle.startTime + CANDLE_INTERVAL) {
                    // Save previous candle
                    if (candle) {
                        candleDataRef.current.push({
                            x: new Date(candle.startTime),
                            y: [candle.open, candle.high, candle.low, candle.close],
                        });
                        if (candleDataRef.current.length > maxCandlesRef.current) {
                            candleDataRef.current.splice(0, candleDataRef.current.length - maxCandlesRef.current);
                        }
                    }
                    // Start new candle
                    const candleStart = Math.floor(now / CANDLE_INTERVAL) * CANDLE_INTERVAL;
                    currentCandleRef.current = {
                        startTime: candleStart,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                    };
                } else {
                    // Update current candle
                    candle.close = price;
                    if (price > candle.high) candle.high = price;
                    if (price < candle.low) candle.low = price;
                }
            }

            // Handle 24hr ticker stream
            if (stream && stream.endsWith('@ticker')) {
                tickerRef.current = {
                    priceChange: parseFloat(data.p),        // Price change
                    priceChangePercent: parseFloat(data.P), // Price change percent
                    high24h: parseFloat(data.h),            // High price 24h
                    low24h: parseFloat(data.l),             // Low price 24h
                    volume24h: parseFloat(data.v),          // Total traded base asset volume 24h
                    quoteVolume24h: parseFloat(data.q),     // Total traded quote asset volume 24h
                    tradeCount: parseInt(data.n),           // Total number of trades 24h
                };
            }
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
    }, [WS_URL]);

    // ── Main effect: connection + periodic updates ──
    useEffect(() => {
        // Reset
        latestPriceRef.current = null;
        areaDataRef.current = [];
        candleDataRef.current = [];
        currentCandleRef.current = null;
        areaChartReady.current = false;
        candleChartReady.current = false;
        tickerRef.current = { priceChange: 0, priceChangePercent: 0, high24h: 0, low24h: 0, volume24h: 0, quoteVolume24h: 0, tradeCount: 0 };
        setMetrics({ currentPrice: null, prevPrice: null, priceChange: 0, priceChangePercent: 0, high24h: 0, low24h: 0, volume24h: 0, quoteVolume24h: 0, tradeCount: 0 });
        setIsConnected(false);

        connectWebSocket();

        // Chart update loop
        intervalRef.current = setInterval(() => {
            const price = latestPriceRef.current;
            if (price === null) return;

            // ── Update Area chart ──
            areaDataRef.current.push({ x: Date.now(), y: price });
            if (areaDataRef.current.length > MAX_DATA_POINTS) {
                areaDataRef.current.splice(0, areaDataRef.current.length - MAX_DATA_POINTS);
            }
            if (areaChartReady.current && chartTypeRef.current === 'area') {
                ApexCharts.exec(areaChartId, 'updateSeries', [
                    { data: areaDataRef.current },
                ], false);
            }

            // ── Update Candlestick chart ──
            if (candleChartReady.current && chartTypeRef.current === 'candlestick') {
                // Completed candles + open candle
                const candle = currentCandleRef.current;
                const allCandles = [...candleDataRef.current];
                if (candle) {
                    allCandles.push({
                        x: new Date(candle.startTime),
                        y: [candle.open, candle.high, candle.low, candle.close],
                    });
                }
                ApexCharts.exec(candleChartId, 'updateSeries', [
                    { data: allCandles },
                ], false);
            }
        }, THROTTLE_MS);

        // Metrics update loop
        const uiInterval = setInterval(() => {
            const price = latestPriceRef.current;
            if (price === null) return;

            const ticker = tickerRef.current;
            setMetrics((prev) => ({
                currentPrice: price,
                prevPrice: prev.currentPrice,
                priceChange: ticker.priceChange,
                priceChangePercent: ticker.priceChangePercent,
                high24h: ticker.high24h,
                low24h: ticker.low24h,
                volume24h: ticker.volume24h,
                quoteVolume24h: ticker.quoteVolume24h,
                tradeCount: ticker.tradeCount,
            }));
        }, UI_UPDATE_MS);

        return () => {
            if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
            clearInterval(uiInterval);
        };
    }, [connectWebSocket, areaChartId, candleChartId]);

    const { currentPrice, prevPrice, priceChange, priceChangePercent, high24h, low24h, volume24h, quoteVolume24h, tradeCount } = metrics;

    const priceDirection = useMemo(() => {
        if (priceChangePercent > 0) return 'up';
        if (priceChangePercent < 0) return 'down';
        return 'neutral';
    }, [priceChangePercent]);

    // ── Area Chart Config ──
    const areaChartOptions = useMemo(() => ({
        chart: {
            id: areaChartId,
            type: 'area',
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: { enabled: true, speed: THROTTLE_MS },
                animateGradually: { enabled: false },
            },
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            zoom: { enabled: false },
            events: {
                mounted: () => { areaChartReady.current = true; },
            },
        },
        colors: ['#10b981'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] },
        },
        stroke: { curve: 'smooth', width: 2, colors: ['#10b981'] },
        grid: {
            borderColor: '#1e293b', strokeDashArray: 4,
            xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } },
            padding: { top: 0, right: 0, bottom: 20, left: 10 },
        },
        xaxis: {
            type: 'datetime',
            range: MAX_DATA_POINTS * THROTTLE_MS,
            labels: {
                show: true,
                style: { colors: '#64748b', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" },
                datetimeFormatter: { hour: 'HH:mm', minute: 'HH:mm:ss', second: 'HH:mm:ss' },
                datetimeUTC: false,
            },
            axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
        },
        yaxis: {
            labels: {
                style: { colors: '#64748b', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" },
                formatter: (v) => v ? `$${v.toFixed(2)}` : '',
            },
            opposite: true,
        },
        tooltip: {
            enabled: true, theme: 'dark',
            x: { format: 'HH:mm:ss' },
            y: { formatter: (v) => `$${v?.toFixed(2)}` },
        },
        dataLabels: { enabled: false },
        theme: { mode: 'dark' },
    }), [areaChartId]);

    // ── Candlestick Chart Config ──
    // Calculate fixed time range based on maxCandles and fixed 1s interval
    const candleTimeRange = maxCandles * CANDLE_INTERVAL;

    const candleChartOptions = useMemo(() => ({
        chart: {
            id: candleChartId,
            type: 'candlestick',
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: { enabled: true, speed: THROTTLE_MS },
                animateGradually: { enabled: false },
            },
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            zoom: { enabled: false },
            events: {
                mounted: () => { candleChartReady.current = true; },
            },
        },
        plotOptions: {
            candlestick: {
                colors: {
                    upward: '#10b981',
                    downward: '#ef4444',
                },
                wick: {
                    useFillColor: true,
                },
            },
        },
        grid: {
            borderColor: '#1e293b', strokeDashArray: 4,
            xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } },
            padding: { top: 0, right: 0, bottom: 20, left: 10 },
        },
        xaxis: {
            type: 'datetime',
            range: candleTimeRange,
            labels: {
                show: true,
                style: { colors: '#64748b', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" },
                datetimeFormatter: { hour: 'HH:mm', minute: 'HH:mm:ss', second: 'HH:mm:ss' },
                datetimeUTC: false,
            },
            axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
        },
        yaxis: {
            labels: {
                style: { colors: '#64748b', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" },
                formatter: (v) => v ? `$${v.toFixed(2)}` : '',
            },
            opposite: true,
            tooltip: { enabled: true },
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
        },
        dataLabels: { enabled: false },
        theme: { mode: 'dark' },
    }), [candleChartId, candleTimeRange]);

    const areaInitialSeries = useMemo(() => [{ name: pairLabel, data: [] }], [pairLabel]);
    const candleInitialSeries = useMemo(() => [{ name: pairLabel, data: [] }], [pairLabel]);

    // ── Helpers ──
    const fmt = (p) => p ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---';
    const fmtVol = (v) => {
        if (!v) return '---';
        if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
        if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
        return v.toFixed(2);
    };
    const fmtNum = (n) => n ? n.toLocaleString('en-US') : '---';
    const priceColor = priceDirection === 'up' ? 'text-emerald-500' : priceDirection === 'down' ? 'text-red-500' : 'text-slate-200';

    return (
        <main className="flex-1 p-4 md:p-6 flex flex-col gap-5 max-w-[1920px] mx-auto w-full">

            {/* Row 1: Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Price Card */}
                <Card className="border-slate-800 bg-slate-900/40 relative overflow-hidden group">
                    <div className={cn("absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-5 blur-2xl rounded-full transition-all duration-500 group-hover:opacity-10", priceDirection === 'up' ? 'from-emerald-500' : 'from-red-500')} />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            Market Price
                            <div className="flex items-center gap-2">
                                <span className="bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-emerald-500/60 tracking-wide">
                                    {pairLabel}
                                </span>
                                <Badge variant={isConnected ? "success" : "destructive"} className="px-2 py-0.5 text-[10px]">
                                    {isConnected ? 'LIVE' : 'OFFLINE'}
                                </Badge>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-3xl font-mono font-bold tracking-tight transition-colors duration-200", priceColor)}>
                            {fmt(currentPrice)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant={priceDirection === 'up' ? 'success' : priceDirection === 'down' ? 'destructive' : 'default'} className="bg-opacity-10 text-xs px-1.5">
                                {priceChangePercent > 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                            </Badge>
                            <span className={cn("text-xs font-mono", priceDirection === 'up' ? 'text-emerald-500' : priceDirection === 'down' ? 'text-red-500' : 'text-slate-500')}>
                                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* 24h Range Card */}
                <Card className="border-slate-800 bg-slate-900/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Maximize2 size={12} /> 24h Range
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col justify-center gap-3 pt-2">
                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp size={12} className="text-emerald-500" />
                                <span className="text-[10px] font-medium text-slate-500 uppercase">High</span>
                            </div>
                            <span className="font-mono text-sm font-semibold text-emerald-400 tracking-tight">
                                {high24h > 0 ? fmt(high24h) : '---'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <div className="flex items-center gap-1.5">
                                <TrendingDown size={12} className="text-red-500" />
                                <span className="text-[10px] font-medium text-slate-500 uppercase">Low</span>
                            </div>
                            <span className="font-mono text-sm font-semibold text-red-400 tracking-tight">
                                {low24h > 0 ? fmt(low24h) : '---'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* 24h Volume Card */}
                <Card className="border-slate-800 bg-slate-900/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Wallet size={12} /> 24h Volume
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-mono font-bold text-slate-200 mt-1">
                            {fmtVol(volume24h)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                            ≈ ${fmtVol(quoteVolume24h)} USDT
                        </p>
                    </CardContent>
                </Card>

                {/* 24h Trades Card */}
                <Card className="border-slate-800 bg-slate-900/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Zap size={12} className="text-amber-500" /> 24h Trades
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-mono font-bold text-slate-200 mt-1">
                            {fmtNum(tradeCount)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Total transactions</p>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Chart */}
            <Card className="flex-1 min-h-[500px] border-slate-800 bg-slate-900/30 flex flex-col overflow-hidden shadow-xl">
                <CardHeader className="border-b border-slate-800/50 py-3 px-6 bg-slate-900/50">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-emerald-500" />
                            <span className="text-sm font-medium text-slate-300">Live Market — {pairLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")}></span>
                            <span className="text-[10px] text-slate-400 uppercase">{isConnected ? 'Real-time' : 'Connecting...'}</span>
                        </div>
                    </div>

                    {/* Controls Row */}
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Chart Type Toggle */}
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setChartType('area')}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                                    chartType === 'area'
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                                )}
                            >
                                <AreaChart size={14} />
                                Area
                            </button>
                            <button
                                onClick={() => setChartType('candlestick')}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                                    chartType === 'candlestick'
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                                )}
                            >
                                <CandlestickChart size={14} />
                                Candles
                            </button>
                        </div>

                        {/* Candle Count - only show for candlestick */}
                        {chartType === 'candlestick' && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Count</span>
                                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                                    {CANDLE_COUNTS.map((count) => (
                                        <button
                                            key={count}
                                            onClick={() => setMaxCandles(count)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all",
                                                maxCandles === count
                                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                                            )}
                                        >
                                            {count}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 relative">
                    <div className="absolute inset-0 w-full h-full pb-2 pl-2">
                        {chartType === 'area' ? (
                            <Chart
                                key={`area-${symbol}`}
                                options={areaChartOptions}
                                series={areaInitialSeries}
                                type="area"
                                height="100%"
                                width="100%"
                            />
                        ) : (
                            <Chart
                                key={`candle-${symbol}`}
                                options={candleChartOptions}
                                series={candleInitialSeries}
                                type="candlestick"
                                height="100%"
                                width="100%"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
