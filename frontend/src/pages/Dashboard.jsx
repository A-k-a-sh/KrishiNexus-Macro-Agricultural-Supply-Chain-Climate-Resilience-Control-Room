import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import LeftNav       from '../components/Dashboard/LeftNav';
import BangladeshMap from '../components/Map/BangladeshMap';
import TelemetryPanel from '../components/Dashboard/TelemetryPanel';
import RagAdvisory   from '../components/Dashboard/RagAdvisory';
import FullScreenChat from '../components/Dashboard/FullScreenChat';

export default function Dashboard() {
  const { selectedDistrict, selectedUpazila, isDrilledIn } = useAppContext();
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'advisory' | 'chat'
  const chatSectionRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Reset when district changes
  useEffect(() => {
    setChatOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedDistrict?._id]);

  function handleOpenChat() {
    setChatOpen(true);
    // Small delay to let React render the section before scrolling
    setTimeout(() => {
      chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleBackToMap() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div style={{ width: '100vw', maxWidth: '100%', overflowX: 'hidden' }}>
      <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', width: '100%' }}>

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
              { id: 'advisory', label: 'AI ADVISORY' }
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
          </div>

          {selectedDistrict && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {!chatOpen ? (
                <button
                  onClick={handleOpenChat}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', fontSize: 12,
                    fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.target.style.borderColor = 'var(--border-accent)'}
                  onMouseLeave={e => e.target.style.borderColor = 'var(--border)'}
                >
                  ↓ Open AI Chat — {selectedDistrict.name}
                </button>
              ) : (
                <button
                  onClick={handleBackToMap}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 8,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontSize: 12,
                    fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  }}
                >
                  ↑ Back to Map
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedDistrict && chatOpen && (
        <div ref={chatSectionRef}>
          <FullScreenChat district={selectedDistrict} />
        </div>
      )}
    </div>
  );
}