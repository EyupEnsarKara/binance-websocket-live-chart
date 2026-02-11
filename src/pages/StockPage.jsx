import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Search, Building2 } from 'lucide-react';

// Placeholder hisse verileri (ileride WebSocket/API ile gelecek)
const STOCK_DATA = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 234.56, change: 1.23, volume: '52M', marketCap: '3.6T', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 442.18, change: 0.87, volume: '28M', marketCap: '3.3T', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 178.92, change: -0.54, volume: '22M', marketCap: '2.2T', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 198.34, change: 1.67, volume: '35M', marketCap: '2.1T', sector: 'Consumer' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 142.67, change: 3.45, volume: '310M', marketCap: '3.5T', sector: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 345.89, change: -2.12, volume: '89M', marketCap: '1.1T', sector: 'Automotive' },
    { symbol: 'META', name: 'Meta Platforms', price: 612.45, change: 0.34, volume: '18M', marketCap: '1.6T', sector: 'Technology' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', price: 478.23, change: 0.12, volume: '3.2M', marketCap: '1.0T', sector: 'Financial' },
    { symbol: 'JPM', name: 'JPMorgan Chase', price: 234.56, change: -0.89, volume: '8.5M', marketCap: '680B', sector: 'Financial' },
    { symbol: 'V', name: 'Visa Inc.', price: 312.78, change: 0.67, volume: '6.1M', marketCap: '570B', sector: 'Financial' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', price: 156.89, change: -0.23, volume: '5.4M', marketCap: '378B', sector: 'Healthcare' },
    { symbol: 'WMT', name: 'Walmart Inc.', price: 92.34, change: 1.45, volume: '7.8M', marketCap: '625B', sector: 'Consumer' },
];

const SECTORS = ['Tümü', 'Technology', 'Financial', 'Consumer', 'Healthcare', 'Automotive'];

export default function StockPage() {
    const [search, setSearch] = useState('');
    const [selectedSector, setSelectedSector] = useState('Tümü');

    const filtered = STOCK_DATA.filter((s) => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.symbol.toLowerCase().includes(search.toLowerCase());
        const matchSector = selectedSector === 'Tümü' || s.sector === selectedSector;
        return matchSearch && matchSector;
    });

    const fmt = (price) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <main className="flex-1 p-4 md:p-6 max-w-[1920px] mx-auto w-full">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                            <TrendingUp className="text-blue-500" size={20} />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">Hisse Senedi Piyasaları</h2>
                    </div>
                    <p className="text-sm text-slate-500 ml-12">ABD borsalarından anlık hisse senedi verileri</p>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Ara... (AAPL, Tesla)"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                </div>
            </div>

            {/* Sector Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
                {SECTORS.map((sector) => (
                    <button
                        key={sector}
                        onClick={() => setSelectedSector(sector)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
                            selectedSector === sector
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
                        )}
                    >
                        {sector}
                    </button>
                ))}
            </div>

            {/* Stock Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((stock) => {
                    const isUp = stock.change > 0;
                    return (
                        <Card
                            key={stock.symbol}
                            className={cn(
                                "border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-all duration-200 cursor-pointer group relative overflow-hidden",
                                "hover:border-slate-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/50"
                            )}
                        >
                            {/* Glow */}
                            <div className={cn(
                                "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
                                isUp ? "bg-emerald-500" : "bg-red-500"
                            )} />

                            <CardContent className="p-5 relative z-10">
                                {/* Top row */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                                            <span className="text-xs font-bold text-blue-400 font-mono">{stock.symbol.slice(0, 2)}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm text-slate-200">{stock.symbol}</h3>
                                            <span className="text-[10px] text-slate-500 line-clamp-1">{stock.name}</span>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={isUp ? 'success' : 'destructive'}
                                        className="text-[10px] px-1.5 py-0.5 font-mono"
                                    >
                                        {isUp ? '+' : ''}{stock.change}%
                                    </Badge>
                                </div>

                                {/* Price */}
                                <div className="mb-4">
                                    <span className={cn(
                                        "text-2xl font-mono font-bold tracking-tight",
                                        isUp ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        {fmt(stock.price)}
                                    </span>
                                    <div className="flex items-center gap-1 mt-1">
                                        {isUp
                                            ? <ArrowUpRight size={14} className="text-emerald-500" />
                                            : <ArrowDownRight size={14} className="text-red-500" />
                                        }
                                        <span className="text-xs text-slate-500">24h değişim</span>
                                    </div>
                                </div>

                                {/* Bottom stats */}
                                <div className="flex justify-between pt-3 border-t border-slate-800/60">
                                    <div>
                                        <p className="text-[10px] text-slate-600 uppercase">Hacim</p>
                                        <p className="text-xs font-mono text-slate-400 font-medium">{stock.volume}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-600 uppercase">Piyasa Değeri</p>
                                        <p className="text-xs font-mono text-slate-400 font-medium">{stock.marketCap}</p>
                                    </div>
                                </div>

                                {/* Sector tag */}
                                <div className="mt-3 flex items-center gap-1.5">
                                    <Building2 size={10} className="text-slate-600" />
                                    <span className="text-[10px] text-slate-600 font-medium">{stock.sector}</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-slate-500 text-sm">Aramanızla eşleşen hisse bulunamadı.</p>
                </div>
            )}
        </main>
    );
}

