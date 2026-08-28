import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import LeftNav       from '../components/Dashboard/LeftNav';
import BangladeshMap from '../components/Map/BangladeshMap';
import TelemetryPanel from '../components/Dashboard/TelemetryPanel';
import RagAdvisory   from '../components/Dashboard/RagAdvisory';
import FullScreenChat from '../components/Dashboard/FullScreenChat';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { selectedDistrict, selectedUpazila, isDrilledIn } = useAppContext();
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'advisory' | 'chat'
  const chatSectionRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

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
    <div style={{ width: '100%', height: '100%', overflowX: 'hidden' }} className="bg-slate-950 text-slate-200">
      <div style={{ height: '100%', display: 'flex', overflow: 'hidden', width: '100%' }}>

        {/* LEFT — Region selector + alert badges */}
        <motion.div 
          initial={false}
          animate={{ width: leftOpen ? 240 : 0, opacity: leftOpen ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{
            flexShrink: 0,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }} className="border-r border-slate-800/60 bg-slate-950/80 backdrop-blur-md z-20">
          <div style={{ width: 240, height: '100%' }}>
            <LeftNav />
          </div>
        </motion.div>

        {/* CENTER — Interactive map, under a drill-path rail */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            position: 'relative'
          }} className="bg-slate-950 z-10">
          
          {/* Toggle Buttons */}
          <button 
            onClick={() => setLeftOpen(!leftOpen)}
            className="absolute top-1/2 left-0 -translate-y-1/2 z-30 bg-slate-900/80 border border-slate-700/60 border-l-0 text-slate-400 p-2 rounded-r-xl hover:bg-slate-800 hover:text-emerald-400 transition-colors shadow-md backdrop-blur-sm focus:outline-none"
            title={leftOpen ? "Collapse Left Panel" : "Expand Left Panel"}
          >
            {leftOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            )}
          </button>

          <button 
            onClick={() => setRightOpen(!rightOpen)}
            className="absolute top-1/2 right-0 -translate-y-1/2 z-30 bg-slate-900/80 border border-slate-700/60 border-r-0 text-slate-400 p-2 rounded-l-xl hover:bg-slate-800 hover:text-emerald-400 transition-colors shadow-md backdrop-blur-sm focus:outline-none"
            title={rightOpen ? "Collapse Right Panel" : "Expand Right Panel"}
          >
            {rightOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            )}
          </button>

          <div className="panel-head !bg-slate-900/40 !backdrop-blur-sm !border-slate-800/60">
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
            {/* Animated Sweeping Light Grid Overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen opacity-70 z-0">
              <defs>
                <pattern id="grid-pattern-dash" width="64" height="64" patternUnits="userSpaceOnUse">
                  <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                </pattern>
                <pattern id="grid-pattern-glow-dash" width="64" height="64" patternUnits="userSpaceOnUse">
                  <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(16,185,129,0.7)" strokeWidth="1"/>
                </pattern>
                <radialGradient id="soft-glow-dash" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="white" stopOpacity="1" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <mask id="glow-mask-dash">
                  <motion.circle 
                    r="500"
                    fill="url(#soft-glow-dash)"
                    animate={{ 
                      cx: ['-10%', '110%', '50%', '-10%'], 
                      cy: ['-10%', '50%', '110%', '-10%'] 
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-pattern-dash)" />
              <rect width="100%" height="100%" fill="url(#grid-pattern-glow-dash)" mask="url(#glow-mask-dash)" />
            </svg>

            <div className="relative z-10 w-full h-full">
              <BangladeshMap />
            </div>
            {selectedDistrict && !chatOpen && (
              <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
                <button
                  onClick={handleOpenChat}
                  style={{
                    padding: '12px 24px', borderRadius: 30,
                    background: 'var(--accent-blue, #2563eb)', color: '#ffffff', border: 'none',
                    fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                >
                  ↓ Open AI Chat — {selectedDistrict.name}
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* RIGHT — Telemetry + AI advisory + chat */}
        <motion.div 
          initial={false}
          animate={{ width: rightOpen ? 400 : 0, opacity: rightOpen ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{
            flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }} className="border-l border-slate-800/60 bg-slate-950/80 backdrop-blur-md z-20">
          <div style={{ width: 400, height: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            {/* Section label strip */}
            <div className="panel-head !bg-slate-900/40 !backdrop-blur-sm !border-slate-800/60">
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
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }} className="bg-slate-900/60 border-b border-slate-800/60 backdrop-blur-md">
            {[
              { id: 'telemetry', label: 'TELEMETRY' },
              { id: 'advisory', label: 'AI ADVISORY' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                className={`border-r border-slate-800/60 last:border-r-0 ${
                  activeTab === tab.id 
                    ? 'bg-slate-800/60 text-emerald-400 shadow-[inset_0_-2px_0_0_#34d399]' 
                    : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Tab Panel Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className={activeTab === 'telemetry' ? "flex-1 overflow-y-auto" : "hidden"}>
              <TelemetryPanel district={selectedDistrict} upazila={selectedUpazila} />
            </div>

            <div className={activeTab === 'advisory' ? "flex-1 overflow-y-auto flex flex-col" : "hidden"}>
              <RagAdvisory district={selectedDistrict} />
            </div>
          </div>
        </div>
        </motion.div>
      </div>

      {selectedDistrict && chatOpen && (
        <div ref={chatSectionRef}>
          <FullScreenChat district={selectedDistrict} />
        </div>
      )}
    </div>
  );
}