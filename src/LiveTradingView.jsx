import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import { Activity, BarChart3, Clock, Zap, Wallet, Maximize2 } from 'lucide-react';

// Shadcn UI Bileşenleri (Otomatik kurdukların)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// --- LOGIC KISMI (DOKUNULMADI - PERFORMANS İÇİN AYNEN KORUNDU) ---
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

    // ApexCharts konfigürasyonu
    const chartOptions = useMemo(() => ({
        chart: {
            id: CHART_ID,
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
                mounted: () => { chartReady.current = true; },
            },
        },
        colors: ['#10b981'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 100],
            },
        },
        stroke: { curve: 'smooth', width: 2, colors: ['#10b981'] },
        grid: {
            borderColor: '#1e293b',
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, right: 0, bottom: 20, left: 10 },
        },
        xaxis: {
            type: 'datetime',
            range: MAX_DATA_POINTS * THROTTLE_MS,
            labels: { 
                show: true,
                style: { colors: '#64748b', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" },
                datetimeFormatter: { 
                    year: 'yyyy', 
                    month: "MMM 'yy", 
                    day: 'dd MMM', 
                    hour: 'HH:mm', 
                    minute: 'HH:mm:ss', 
                    second: 'HH:mm:ss' 
                },
                datetimeUTC: false, 
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
            tooltip: { enabled: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#64748b', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" },
                formatter: (v) => v ? `$${v.toFixed(2)}` : '',
            },
            opposite: true,
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            x: { format: 'HH:mm:ss' },
            y: { formatter: (v) => `$${v?.toFixed(2)}` },
        },
        dataLabels: { enabled: false },
        theme: { mode: 'dark' },
    }), []);

    const initialSeries = useMemo(() => [{ name: 'BTC/USDT', data: [] }], []);
    const fmt = (p) => p ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---';
    const fmtVol = (v) => v >= 1000 ? `${(v / 1000).toFixed(2)}K` : v.toFixed(4);
    const chg = currentPrice && prevPrice ? currentPrice - prevPrice : 0;
    const chgPct = prevPrice ? (chg / prevPrice) * 100 : 0;
    const priceColor = priceDirection === 'up' ? 'text-emerald-500' : priceDirection === 'down' ? 'text-red-500' : 'text-slate-200';

    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // --- RENDER (UI) ---
    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
            
            {/* Navbar */}
            <header className="px-6 py-4 border-b border-slate-800/60 bg-slate-900/20 backdrop-blur-sm flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <BarChart3 className="text-emerald-500" size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight leading-none">CryptoFlow</h1>
                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Pro Terminal</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                        <Clock size={12} />
                        {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                    </div>
                    <Badge variant={isConnected ? "success" : "destructive"} className="px-3 py-1">
                        {isConnected ? 'LIVE' : 'OFFLINE'}
                    </Badge>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 flex flex-col gap-6 max-w-[1920px] mx-auto w-full">
                
                {/* Row 1: Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Fiyat Kartı */}
                    <Card className="border-slate-800 bg-slate-900/40 relative overflow-hidden group">
                        <div className={cn("absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-5 blur-2xl rounded-full transition-all duration-500 group-hover:opacity-10", priceDirection === 'up' ? 'from-emerald-500' : 'from-red-500')} />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                Market Price
                                <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">BTCUSDT</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-3xl font-mono font-bold tracking-tight transition-colors duration-200", priceColor)}>
                                {fmt(currentPrice)}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant={priceDirection === 'up' ? 'success' : priceDirection === 'down' ? 'destructive' : 'secondary'} className="bg-opacity-10 text-xs px-1.5">
                                    {chgPct > 0 ? '+' : ''}{chgPct.toFixed(2)}%
                                </Badge>
                                <span className="text-xs text-slate-500 font-mono">
                                    {chg > 0 ? '+' : ''}{chg.toFixed(2)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Range Kartı */}
                    <Card className="border-slate-800 bg-slate-900/40">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Maximize2 size={12} /> Session Range
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col justify-center gap-3 pt-2">
                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                                <span className="text-[10px] font-medium text-slate-500 uppercase">High</span>
                                <span className="font-mono text-sm font-semibold text-emerald-400 tracking-tight">
                                    {sessionHigh > 0 ? fmt(sessionHigh) : '---'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-[10px] font-medium text-slate-500 uppercase">Low</span>
                                <span className="font-mono text-sm font-semibold text-red-400 tracking-tight">
                                    {sessionLow < Infinity ? fmt(sessionLow) : '---'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Hacim Kartı */}
                    <Card className="border-slate-800 bg-slate-900/40">
                         <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Wallet size={12} /> 24h Volume
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-mono font-bold text-slate-200 mt-1">
                                {fmtVol(totalVolume)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Total traded BTC</p>
                        </CardContent>
                    </Card>

                    {/* İşlem Sayısı Kartı */}
                    <Card className="border-slate-800 bg-slate-900/40">
                         <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Zap size={12} className="text-amber-500" /> Active Trades
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-mono font-bold text-slate-200 mt-1">
                                {tradeCount.toLocaleString()}
                            </div>
                            
                        </CardContent>
                    </Card>
                </div>

                {/* Row 2: Chart */}
                <Card className="flex-1 min-h-[500px] border-slate-800 bg-slate-900/30 flex flex-col overflow-hidden shadow-xl">
                    <CardHeader className="border-b border-slate-800/50 py-3 px-6 flex flex-row items-center justify-between bg-slate-900/50">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-emerald-500" />
                            <span className="text-sm font-medium text-slate-300">Live Market Depth</span>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span className="text-[10px] text-slate-400 uppercase">Real-time</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative">
                        <div className="absolute inset-0 w-full h-full pb-2 pl-2">
                            <Chart 
                                options={chartOptions} 
                                series={initialSeries} 
                                type="area" 
                                height="100%" 
                                width="100%" 
                            />
                        </div>
                    </CardContent>
                </Card>

            </main>
        </div>
    );
}