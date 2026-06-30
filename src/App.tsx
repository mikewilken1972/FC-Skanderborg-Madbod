import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { PublicView } from './components/PublicView';
import { AdminView } from './components/AdminView';
import { ShiftHelpersView } from './components/ShiftHelpersView';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <header className="bg-blue-800 text-white shadow-md">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-blue-900 shadow-sm border-2 border-white">
                FCS
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase">FC Skanderborg Madbod 2026</h1>
                <p className="text-blue-200 text-xs font-medium">Vagtplaner</p>
              </div>
            </Link>
            
            <Link to="/admin" className="p-2 bg-blue-900 hover:bg-blue-700 rounded-full transition-colors text-yellow-400">
              <ShieldAlert className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<PublicView />} />
            <Route path="/admin" element={<AdminView />} />
            <Route path="/shift/:shiftId/helpers" element={<ShiftHelpersView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
