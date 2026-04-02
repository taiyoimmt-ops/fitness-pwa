import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Home, Utensils, Dumbbell, BarChart2, Settings, TrendingUp, Calendar } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import MealPage from './pages/MealPage.jsx';
import WorkoutPage from './pages/WorkoutPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { haptics } from './utils/haptics.js';

const NAV_ITEMS = [
  { path: '/',         label: 'Dash', icon: Home },
  { path: '/calendar', label: '履歴',   icon: Calendar },
  { path: '/meal',     label: '食事',   icon: Utensils },
  { path: '/workout',  label: 'トレ',   icon: Dumbbell },
  { path: '/analysis', label: 'AI',     icon: BarChart2 },
  { path: '/settings', label: '設定',   icon: Settings },
];


function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="nav-bar">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => { haptics.light(); navigate(path); }}
            aria-label={label}
          >
            <Icon size={24} strokeWidth={active ? 2.4 : 1.8} />
            <span className="nav-item-label" style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/"         element={<Dashboard />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/meal"     element={<MealPage />} />
        <Route path="/workout"  element={<WorkoutPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/stats"    element={<StatsPage />} />
        <Route path="/import"   element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <NavBar />
    </ToastProvider>
  );
}
