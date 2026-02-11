import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Clock, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Detail page check
    const isDetailPage = location.pathname.startsWith('/crypto/') || location.pathname.startsWith('/stocks/');

    return (
        <header className="px-4 md:px-6 py-3 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-4">
                {/* Back Button (on detail page) */}
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
