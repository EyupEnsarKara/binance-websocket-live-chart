import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Search, Bitcoin, TrendingUp, Wifi, WifiOff } from 'lucide-react';

// Crypto list with symbols
const CRYPTO_LIST = [
    { symbol: 'BTC', name: 'Bitcoin', pair: 'BTCUSDT', logo: '₿' },
    { symbol: 'ETH', name: 'Ethereum', pair: 'ETHUSDT', logo: 'Ξ' },
    { symbol: 'SOL', name: 'Solana', pair: 'SOLUSDT', logo: '◎' },
    { symbol: 'BNB', name: 'BNB', pair: 'BNBUSDT', logo: '◆' },
    { symbol: 'XRP', name: 'XRP', pair: 'XRPUSDT', logo: '✕' },
    { symbol: 'ADA', name: 'Cardano', pair: 'ADAUSDT', logo: '♦' },
    { symbol: 'DOGE', name: 'Dogecoin', pair: 'DOGEUSDT', logo: 'Ð' },
    { symbol: 'AVAX', name: 'Avalanche', pair: 'AVAXUSDT', logo: '▲' },
    { symbol: 'DOT', name: 'Polkadot', pair: 'DOTUSDT', logo: '●' },
    { symbol: 'LINK', name: 'Chainlink', pair: 'LINKUSDT', logo: '⬡' },
    { symbol: 'SHIB', name: 'Shiba Inu', pair: 'SHIBUSDT', logo: '🐕' },
    { symbol: 'POL', name: 'Polygon', pair: 'POLUSDT', logo: '⬡' },
];

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export default function CryptoPage() {
    const [search, setSearch] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [tickerData, setTickerData] = useState({});
    const location = useLocation();

    const wsRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimer = useRef(null);
    const tickerRef = useRef({});

    // Build Combined Stream URL for all tickers
    const streams = CRYPTO_LIST.map(c => `${c.pair.toLowerCase()}@ticker`).join('/');
    const WS_URL = `wss://stream.binance.com:9443/stream?streams=${streams}`;

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
            const data = message.data;

            if (data && data.s) {
                // s = symbol, c = last price, P = price change percent, 
                // v = volume, q = quote volume, h = high, l = low
                tickerRef.current[data.s] = {
                    price: parseFloat(data.c),
                    priceChange: parseFloat(data.p),
                    priceChangePercent: parseFloat(data.P),
                    high24h: parseFloat(data.h),
                    low24h: parseFloat(data.l),
                    volume: parseFloat(data.v),
                    quoteVolume: parseFloat(data.q),
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

    // Connect and update UI periodically
    useEffect(() => {
        connectWebSocket();

        // Update UI every 500ms
        const uiInterval = setInterval(() => {
            setTickerData({ ...tickerRef.current });
        }, 500);

        return () => {
            if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            clearInterval(uiInterval);
        };
    }, [connectWebSocket]);

    const filtered = CRYPTO_LIST.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
    );

    const fmt = (price) => {
        if (!price) return '---';
        if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (price >= 1) return `$${price.toFixed(2)}`;
        return `$${price.toFixed(6)}`;
    };

    const fmtVol = (v) => {
        if (!v) return '---';
        if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
        if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
        if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
        return `$${v.toFixed(2)}`;
    };

    const isCrypto = location.pathname === '/' || location.pathname.startsWith('/crypto');
    const isStocks = location.pathname.startsWith('/stocks');

    return (
        <main className="flex-1 p-4 md:p-6 max-w-[1920px] mx-auto w-full">
            {/* Header with Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                {/* Tab Switcher */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                        <Link
                            to="/"
                            className={cn(
                                "flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                isCrypto
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                            )}
                        >
                            <Bitcoin size={16} />
                            Crypto
                        </Link>
                        <Link
                            to="/stocks"
                            className={cn(
                                "flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                isStocks
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                            )}
                        >
                            <TrendingUp size={16} />
                            Stocks
                        </Link>
                    </div>

                    {/* Connection Status */}
                    <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-wider",
                        isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    )}>
                        {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {isConnected ? 'Live' : 'Offline'}
                    </div>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search... (BTC, Ethereum)"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                </div>
            </div>

            {/* Crypto Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((crypto) => {
                    const ticker = tickerData[crypto.pair] || {};
                    const price = ticker.price;
                    const change = ticker.priceChangePercent || 0;
                    const volume = ticker.quoteVolume;
                    const high = ticker.high24h;
                    const low = ticker.low24h;
                    const isUp = change >= 0;

                    return (
                        <Link key={crypto.symbol} to={`/crypto/${crypto.pair.toLowerCase()}`}>
                            <Card
                                className={cn(
                                    "border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-all duration-200 cursor-pointer group relative overflow-hidden h-full",
                                    "hover:border-slate-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/50"
                                )}
                            >
                                {/* Glow */}
                                <div className={cn(
                                    "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
                                    isUp ? "bg-emerald-500" : "bg-red-500"
                                )} />

                                <CardContent className="p-5 relative z-10">
                                    {/* Top row: Logo + Name + Badge */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-300">
                                                {crypto.logo}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm text-slate-200">{crypto.name}</h3>
                                                <span className="text-[10px] text-slate-500 font-mono">{crypto.symbol}/USDT</span>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={isUp ? 'success' : 'destructive'}
                                            className="text-[10px] px-1.5 py-0.5 font-mono"
                                        >
                                            {isUp ? '+' : ''}{change.toFixed(2)}%
                                        </Badge>
                                    </div>

                                    {/* Price */}
                                    <div className="mb-4">
                                        <span className={cn(
                                            "text-2xl font-mono font-bold tracking-tight",
                                            isUp ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            {fmt(price)}
                                        </span>
                                        <div className="flex items-center gap-1 mt-1">
                                            {isUp
                                                ? <ArrowUpRight size={14} className="text-emerald-500" />
                                                : <ArrowDownRight size={14} className="text-red-500" />
                                            }
                                            <span className="text-xs text-slate-500">24h change</span>
                                        </div>
                                    </div>

                                    {/* Bottom stats */}
                                    <div className="flex justify-between pt-3 border-t border-slate-800/60">
                                        <div>
                                            <p className="text-[10px] text-slate-600 uppercase">Volume 24h</p>
                                            <p className="text-xs font-mono text-slate-400 font-medium">{fmtVol(volume)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-600 uppercase">High / Low</p>
                                            <p className="text-xs font-mono">
                                                <span className="text-emerald-500/80">{fmt(high)}</span>
                                                <span className="text-slate-600 mx-1">/</span>
                                                <span className="text-red-500/80">{fmt(low)}</span>
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-slate-500 text-sm">No crypto found matching your search.</p>
                </div>
            )}
        </main>
    );
}
