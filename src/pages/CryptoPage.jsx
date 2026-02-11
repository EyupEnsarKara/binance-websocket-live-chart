import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Search, Bitcoin, TrendingUp } from 'lucide-react';

// Placeholder crypto data (will come from WebSocket later)
const CRYPTO_DATA = [
    { symbol: 'BTC', name: 'Bitcoin', pair: 'BTC/USDT', price: 97245.32, change: 2.45, volume: '1.2B', marketCap: '1.91T', logo: '₿' },
    { symbol: 'ETH', name: 'Ethereum', pair: 'ETH/USDT', price: 3412.18, change: 1.87, volume: '890M', marketCap: '410B', logo: 'Ξ' },
    { symbol: 'SOL', name: 'Solana', pair: 'SOL/USDT', price: 198.45, change: -0.92, volume: '320M', marketCap: '92B', logo: '◎' },
    { symbol: 'BNB', name: 'BNB', pair: 'BNB/USDT', price: 612.33, change: 0.54, volume: '210M', marketCap: '94B', logo: '◆' },
    { symbol: 'XRP', name: 'XRP', pair: 'XRP/USDT', price: 2.41, change: -1.23, volume: '180M', marketCap: '138B', logo: '✕' },
    { symbol: 'ADA', name: 'Cardano', pair: 'ADA/USDT', price: 0.982, change: 3.12, volume: '95M', marketCap: '34B', logo: '♦' },
    { symbol: 'DOGE', name: 'Dogecoin', pair: 'DOGE/USDT', price: 0.324, change: -2.18, volume: '72M', marketCap: '47B', logo: 'Ð' },
    { symbol: 'AVAX', name: 'Avalanche', pair: 'AVAX/USDT', price: 38.92, change: 4.56, volume: '55M', marketCap: '15B', logo: '▲' },
    { symbol: 'DOT', name: 'Polkadot', pair: 'DOT/USDT', price: 7.84, change: -0.45, volume: '42M', marketCap: '10B', logo: '●' },
    { symbol: 'LINK', name: 'Chainlink', pair: 'LINK/USDT', price: 18.23, change: 1.34, volume: '38M', marketCap: '11B', logo: '⬡' },

];

export default function CryptoPage() {
    const [search, setSearch] = useState('');
    const location = useLocation();

    const filtered = CRYPTO_DATA.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
    );

    const fmt = (price) => {
        if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (price >= 1) return `$${price.toFixed(2)}`;
        return `$${price.toFixed(4)}`;
    };

    const isCrypto = location.pathname === '/' || location.pathname.startsWith('/crypto');
    const isStocks = location.pathname.startsWith('/stocks');

    return (
        <main className="flex-1 p-4 md:p-6 max-w-[1920px] mx-auto w-full">
            {/* Header with Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                {/* Tab Switcher */}
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
                    const isUp = crypto.change > 0;
                    return (
                        <Link key={crypto.symbol} to={`/crypto/${crypto.symbol.toLowerCase()}usdt`}>
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
                                            <span className="text-[10px] text-slate-500 font-mono">{crypto.pair}</span>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={isUp ? 'success' : 'destructive'}
                                        className="text-[10px] px-1.5 py-0.5 font-mono"
                                    >
                                        {isUp ? '+' : ''}{crypto.change}%
                                    </Badge>
                                </div>

                                {/* Price */}
                                <div className="mb-4">
                                    <span className={cn(
                                        "text-2xl font-mono font-bold tracking-tight",
                                        isUp ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        {fmt(crypto.price)}
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
                                        <p className="text-[10px] text-slate-600 uppercase">Volume</p>
                                        <p className="text-xs font-mono text-slate-400 font-medium">{crypto.volume}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-600 uppercase">Market Cap</p>
                                        <p className="text-xs font-mono text-slate-400 font-medium">{crypto.marketCap}</p>
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
