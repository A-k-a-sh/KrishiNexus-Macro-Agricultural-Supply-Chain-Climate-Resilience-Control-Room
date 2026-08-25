import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import LeftNav       from '../components/Dashboard/LeftNav';
import BangladeshMap from '../components/Map/BangladeshMap';
import TelemetryPanel from '../components/Dashboard/TelemetryPanel';
import RagAdvisory   from '../components/Dashboard/RagAdvisory';
import ChatTerminal  from '../components/Dashboard/ChatTerminal';

export default function Dashboard() {
  const { selectedDistrict, selectedUpazila, isDrilledIn } = useAppContext();
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'advisory' | 'chat'

  return (
    // 100% of the space App leaves below TopNav, not 100vh — the page is one
    // fixed frame with its own scrolling panels, so nothing here may overflow.
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        {/* CENTER — Interactive map, under a drill-path rail */}
        <div style={{
          flex: 1, minWidth: 0,
          background: 'var(--bg-primary)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div className="panel-head">
            <span className="drill-path">
              <span>Bangladesh</span>
              {selectedDistrict && (
                <>
                  <span className="drill-path-sep">/</span>
                  <span className="panel-head-value">{selectedDistrict.name}</span>
                </>
              )}
              {selectedUpazila && (
                <>
                  <span className="drill-path-sep">/</span>
                  <span className="panel-head-value is-upazila">{selectedUpazila.name}</span>
                </>
              )}
            </span>
            <span className="panel-head-note">
              {isDrilledIn ? 'Scroll to zoom · drag to pan' : 'Click a district to drill in'}
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <BangladeshMap />
          </div>
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
          <div className="panel-head">
            <span>Intelligence panel</span>
            {selectedDistrict && (
              <span className={`panel-head-value${selectedUpazila ? ' is-upazila' : ''}`}>
                {selectedUpazila ? selectedUpazila.name : selectedDistrict.name}
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
                <TelemetryPanel district={selectedDistrict} upazila={selectedUpazila} />
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