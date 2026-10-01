import { NavLink, Link, Outlet } from 'react-router-dom';
import { LayoutDashboard, Truck, ClipboardList, Boxes, Moon, Sun, LogOut } from 'lucide-react';
import { BrandMark } from './ui.jsx';
import { useNow } from '../hooks.js';
import { fmtDate } from '../format.js';

const NAV = [
  { to: '/', label: 'Control Board', short: 'Board', icon: LayoutDashboard, end: true },
  { to: '/units', label: 'Unit Issue', short: 'Units', icon: Truck },
  { to: '/pick-list', label: 'Pick List', short: 'Pick', icon: ClipboardList },
  { to: '/stock', label: 'Stock', short: 'Stock', icon: Boxes },
];

function Clock() {
  const now = useNow(15000);
  const t = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  return (
    <div className="clock" aria-label="Current time, IST">
      <strong>{t} hrs</strong>
      <span className="clock-date">{fmtDate(now)} · IST</span>
    </div>
  );
}

export default function Layout({ user, theme, onToggleTheme, onLogout }) {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <BrandMark />
          <span>
            <span className="brand-name">DEPOT ISSUE CONTROL</span>
            <span className="brand-sub">Supply Depot · 10-Minute Issue</span>
          </span>
        </Link>
        <div className="topbar-right">
          <Clock />
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
            title={theme === 'dark' ? 'Day mode' : 'Night mode'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="icon-btn" onClick={onLogout} aria-label="Sign out" title={`Sign out ${user}`}>
            <LogOut size={20} />
          </button>
        </div>
      </header>
      <div className="layout">
        <nav className="sidebar" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <div className="sidebar-foot">
            Signed in as <strong>{user}</strong>
            <br />
            Validate against authorised stock records before operational use.
          </div>
        </nav>
        <main className="main">
          <Outlet />
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {NAV.map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab-link">
            <Icon size={20} aria-hidden="true" />
            {short}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
