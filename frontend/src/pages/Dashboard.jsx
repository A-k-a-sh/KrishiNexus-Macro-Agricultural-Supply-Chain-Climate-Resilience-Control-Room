import { useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import LeftNav       from '../components/Dashboard/LeftNav';
import BangladeshMap from '../components/Map/BangladeshMap';
import TelemetryPanel from '../components/Dashboard/TelemetryPanel';
import RagAdvisory   from '../components/Dashboard/RagAdvisory';
import ChatTerminal  from '../components/Dashboard/ChatTerminal';

export default function Dashboard() {
  const { selectedDistrict } = useAppContext();
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'advisory' | 'chat'
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
          width: 400, flexShrink: 0,
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
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>INTELLIGENCE PANEL</span>
            {selectedDistrict && (
              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                {selectedDistrict.name.toUpperCase()}
              </span>
            )}
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            background: '#0c111d',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}>
            {[
              { id: 'telemetry', label: 'TELEMETRY' },
              { id: 'advisory', label: 'AI ADVISORY' },
              { id: 'chat', label: 'INTERROGATOR' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-muted)',
                  borderRight: '1px solid var(--border)',
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Tab Panel Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeTab === 'telemetry' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <TelemetryPanel district={selectedDistrict} />
              </div>
            )}

            {activeTab === 'advisory' && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px 14px 0' }}>
                  {/* <div className="panel-label">AI CRISIS ADVISORY</div> */}
                </div>
                <RagAdvisory district={selectedDistrict} />
              </div>
            )}

            {activeTab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <ChatTerminal district={selectedDistrict} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}