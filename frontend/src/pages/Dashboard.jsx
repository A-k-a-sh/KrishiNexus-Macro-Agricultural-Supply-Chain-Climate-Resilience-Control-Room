import { useLocation, NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import LeftNav       from '../components/Dashboard/LeftNav';
import BangladeshMap from '../components/Map/BangladeshMap';
import TelemetryPanel from '../components/Dashboard/TelemetryPanel';
import RagAdvisory   from '../components/Dashboard/RagAdvisory';
import ChatTerminal  from '../components/Dashboard/ChatTerminal';

export default function Dashboard() {
  const { selectedDistrict } = useAppContext();
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div className="topbar">
        <span className="topbar-brand">[ KRISHINEXUS ]</span>
        <nav className="topbar-nav">
          <NavLink to="/">HOME</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>DASHBOARD</NavLink>
          <NavLink to="/logistics" className={({ isActive }) => isActive ? 'active' : ''}>LOGISTICS</NavLink>
        </nav>
        <div className="topbar-live">
          <span className="live-dot" />
          LIVE · {now}
        </div>
      </div>

      {/* Three-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — Region selector + alert badges */}
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <LeftNav />
        </div>

        {/* CENTER — Interactive map */}
        <div style={{ flex: 1, background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
          <BangladeshMap />
        </div>

        {/* RIGHT — Telemetry + AI advisory + chat */}
        <div style={{
          width: 360, flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Section label strip */}
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-muted)', letterSpacing: '0.1em',
          }}>
            INTELLIGENCE PANEL
            {selectedDistrict && (
              <span style={{ color: 'var(--accent-blue)', marginLeft: 8 }}>
                · {selectedDistrict.name}
              </span>
            )}
          </div>

          {/* Scrollable right panel */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* A: Telemetry */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <TelemetryPanel district={selectedDistrict} />
            </div>

            {/* B: RAG Advisory */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '10px 14px 0' }}>
                <div className="panel-label">AI CRISIS ADVISORY · SECTION B</div>
              </div>
              <RagAdvisory district={selectedDistrict} />
            </div>

            {/* C: Chat Terminal */}
            <div>
              <ChatTerminal district={selectedDistrict} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}