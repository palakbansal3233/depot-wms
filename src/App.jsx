import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, getToken, setToken, AUTH_EXPIRED } from './api.js';
import { ToastProvider } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Units from './pages/Units.jsx';
import UnitDetail from './pages/UnitDetail.jsx';
import PickList from './pages/PickList.jsx';
import Stock from './pages/Stock.jsx';

const THEME_KEY = 'depot.theme';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0D1109' : '#2F3A1F');
  }, [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  return [theme, toggle];
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  // undefined = still checking the stored token; null = signed out
  const [user, setUser] = useState(getToken() ? undefined : null);

  useEffect(() => {
    if (user !== undefined) return;
    api('/auth/me')
      .then((d) => setUser(d.username))
      .catch(() => setUser(null));
  }, [user]);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED, onExpired);
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  if (user === undefined) return null;

  return (
    <ToastProvider>
      {user === null ? (
        <Login onLogin={(name) => setUser(name)} />
      ) : (
        <Routes>
          <Route element={<Layout user={user} theme={theme} onToggleTheme={toggleTheme} onLogout={logout} />}>
            <Route index element={<Dashboard />} />
            <Route path="units" element={<Units />} />
            <Route path="units/:code" element={<UnitDetail />} />
            <Route path="pick-list" element={<PickList />} />
            <Route path="stock" element={<Stock />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </ToastProvider>
  );
}
