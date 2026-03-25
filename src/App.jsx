import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Home, Utensils, Dumbbell, BarChart2, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import MealPage from './pages/MealPage.jsx';
import WorkoutPage from './pages/WorkoutPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { ToastProvider } from './components/Toast.jsx';

const NAV_ITEMS = [
  { path: '/',          label: 'ホーム',    icon: Home },
  { path: '/meal',      label: '食事',      icon: Utensils },
  { path: '/workout',   label: 'トレ',      icon: Dumbbell },
  { path: '/analysis',  label: '分析',      icon: BarChart2 },
  { path: '/settings',  label: '設定',      icon: Settings },
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
            onClick={() => navigate(path)}
            aria-label={label}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span className="nav-item-label">{label}</span>
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
        <Route path="/meal"     element={<MealPage />} />
        <Route path="/workout"  element={<WorkoutPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/import"   element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <NavBar />
    </ToastProvider>
  );
}
