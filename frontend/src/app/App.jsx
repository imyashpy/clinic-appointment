import React, { useState } from "react";
import { routes } from "./routes.jsx";
import { AuthProvider, useAuth } from "../features/auth/AuthContext.jsx";
import PatientLoginPage from "../features/auth/PatientLoginPage.jsx";
import StaffLoginPage from "../features/auth/StaffLoginPage.jsx";
import DoctorAvatar from "../shared/DoctorAvatar.jsx";

function Workspace() {
  const { user, loading, signIn, signOut } = useAuth();
  const allowedRoutes = routes.filter((route) => user && route.roles.includes(user.role));
  const [activeScreen, setActiveScreen] = useState("");
  const screen = allowedRoutes.find(({ id }) => id === activeScreen) ?? allowedRoutes[0];
  const navSections = allowedRoutes.reduce((sections, route) => {
    sections[route.section] ??= [];
    sections[route.section].push(route);
    return sections;
  }, {});

  if (loading) return <main className="loading-screen">Connecting to CuraPulse...</main>;

  // Determine login page from URL
  const path = window.location.pathname;
  if (!user) {
    // Extract clinic_id from path: /c/1, /c/2, etc.
    const clinicMatch = path.match(/^\/c\/(\d+)/);
    const clinicId = clinicMatch ? Number(clinicMatch[1]) : null;
    
    if (path.startsWith("/staff")) {
      return <StaffLoginPage onSignIn={signIn} />;
    }
    if (path === "/" || path === "") {
      return null;
    }
    if (!clinicId) {
      return <main className="auth-page"><section className="auth-panel"><p className="eyebrow">ERROR</p><h1>Clinic not specified</h1><p className="muted">Access via your clinic's unique link (e.g., /c/1).</p><a href="/" className="link-button">Back to home</a></section></main>;
    }
    return <PatientLoginPage onSignIn={signIn} clinicId={clinicId} />;
  }
  if (!screen) {
    return <main className="page-wrap"><section className="empty-state"><h1>Role not supported</h1><p>This workspace is available to patients, doctors, and receptionists.</p><button className="button" onClick={signOut} type="button">Sign out</button></section></main>;
  }

  const Screen = screen.Component;

  return (
    <div className="workspace-frame">
      <aside className="workspace-sidebar">
        <div className="brand-lockup"><span className="brand-mark">C</span><span>CuraPulse<small>CLINIC OPERATIONS</small></span></div>
        <div className="sidebar-clinic"><span className="material-symbols-outlined" aria-hidden="true">local_hospital</span><span>Clinic workspace<small>{user.role}</small></span></div>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {Object.entries(navSections).map(([section, sectionRoutes]) => <div className="sidebar-group" key={section}>
            <p className="sidebar-group-label">{section}</p>
            {sectionRoutes.map(({ id, label, icon }) => <button aria-current={screen.id === id ? "page" : undefined} className="sidebar-link" key={id} onClick={() => setActiveScreen(id)} type="button"><span className="material-symbols-outlined" aria-hidden="true">{icon}</span><span>{label}</span></button>)}
          </div>)}
        </nav>
        <div className="sidebar-account">{user.role === "doctor" ? <DoctorAvatar name={user.name} size="small" /> : <div className="account-avatar">{user.name?.slice(0, 1)?.toUpperCase() || "U"}</div>}<div className="account-name"><strong>{user.name}</strong><small>{user.role}</small></div><button aria-label="Sign out" className="sidebar-signout material-symbols-outlined" onClick={signOut} title="Sign out" type="button">logout</button></div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar"><div className="topbar-heading"><span className="topbar-title"><span className="topbar-overline">CuraPulse</span><strong>{screen.label}</strong></span></div><div className="topbar-user">{user.role === "doctor" ? <DoctorAvatar name={user.name} size="small" /> : <span className="live-dot" />}{user.name}</div></header>
        <main className="workspace-content" key={screen.id}>
          <Screen onNavigate={setActiveScreen} view={screen.view} />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthProvider><Workspace /></AuthProvider>;
}
