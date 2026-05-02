import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function Shell({ children, title, subtitle, actions, notificationCount = 0, membershipLabel = "Collaborator" }) {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);

  function goToSection(hash) {
    navigate(`/app${hash}`);
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("flowboard-theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/app">
          <span className="brand-mark">F</span>
          <div>
            <strong>FlowBoard</strong>
            <p>Command your delivery flow</p>
          </div>
        </Link>

        <nav className="nav-stack">
          <NavLink to="/app" end className="nav-pill">
            Dashboard
          </NavLink>
          <button type="button" className="nav-pill" onClick={() => goToSection("#boards")}>
            Boards
          </button>
          <button type="button" className="nav-pill" onClick={() => goToSection("#timeline")}>
            Timeline
          </button>
          <button type="button" className="nav-pill" onClick={() => goToSection("#notifications")}>
            Alerts
          </button>
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Live Sync</p>
          <h3>Backend-ready structure</h3>
          <p>Connected around auth, workspace, board, list, card, comment and notification services.</p>
        </div>

        <button className="ghost-button" onClick={logout}>
          Sign out
        </button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{title}</p>
            <h1>{subtitle}</h1>
          </div>

          <div className="topbar-actions">
            <button type="button" className="theme-toggle app-theme-toggle" onClick={toggleTheme}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            {actions}
            <div className="notification-chip">
              <span>Alerts</span>
              <strong>{notificationCount}</strong>
            </div>
            <div className="user-pill">
              <div className="avatar-ring">{(profile?.fullName || "U").slice(0, 1)}</div>
              <div>
                <strong>{profile?.fullName || "FlowBoard User"}</strong>
                <p>{membershipLabel}</p>
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
