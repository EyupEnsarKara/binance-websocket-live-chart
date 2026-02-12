import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import CryptoPage from './pages/CryptoPage';
import StockPage from './pages/StockPage';
import LiveTradingView from './LiveTradingView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
        <Navbar />
        <Routes>
          <Route path="/" element={<CryptoPage />} />
          <Route path="/crypto/:symbol" element={<LiveTradingView />} />
          <Route path="/stocks" element={<StockPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
