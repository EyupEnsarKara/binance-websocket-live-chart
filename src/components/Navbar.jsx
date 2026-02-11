import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Clock, TrendingUp, Bitcoin, ArrowLeft } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useState, useEffect } from 'react';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Detay sayfasında mıyız?
    const isDetailPage = location.pathname.startsWith('/crypto/') || location.pathname.startsWith('/stocks/');

    // Aktif tab
    const isCrypto = location.pathname === '/' || location.pathname.startsWith('/crypto');
    const isStocks = location.pathname.startsWith('/stocks');

    const navTabs = [
        { to: '/', label: 'Crypto', icon: Bitcoin, active: isCrypto, color: 'emerald' },
        { to: '/stocks', label: 'Stocks', icon: TrendingUp, active: isStocks, color: 'blue' },
    ];

    return (
        <header className="px-4 md:px-6 py-3 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-4">
                {/* Geri Butonu (detay sayfasında) */}
                {isDetailPage && (
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
                    >
                        <ArrowLeft size={18} />
                    </button>
                )}

                {/* Logo */}
                <Link to="/" className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <BarChart3 className="text-emerald-500" size={20} />
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="font-bold text-lg tracking-tight leading-none">TradeView</h1>
                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Live Dashboard</span>
                    </div>
                </Link>

                {/* ── Tab Switcher (büyük ve belirgin) ── */}
                {!isDetailPage && (
                    <nav className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 ml-2 md:ml-6">
                        {navTabs.map(({ to, label, icon: Icon, active, color }) => (
                            <Link
                                key={to}
                                to={to}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                                    active
                                        ? cn(
                                            "shadow-md",
                                            color === 'emerald' && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                                            color === 'blue' && "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                        )
                                        : "text-slate-500 hover:text-slate-300 border border-transparent hover:bg-slate-800/40"
                                )}
                            >
                                <Icon size={16} />
                                <span>{label}</span>
                            </Link>
                        ))}
                    </nav>
                )}
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                    <Clock size={12} />
                    {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                </div>
            </div>
        </header>
    );
}
