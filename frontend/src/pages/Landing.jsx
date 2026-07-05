import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STATS = [
  { value: 64, suffix: '', label: 'Districts Monitored' },
  { value: 3, suffix: ' Live', label: 'Data Pipelines' },
  { value: 2900, suffix: '+', label: 'Advisory Vectors Indexed' },
];

const METRICS = [
  { value: 18, suffix: 'M Hectares', label: 'Cropland at Climate Risk', desc: 'BBS estimates 64% of GDP exposure linked to season-specific climate shocks.', status: 'critical' },
  { value: 12000, suffix: ' Crore ৳', label: 'Annual Average Flood Damage', desc: 'Sudden flash floods in north-eastern and central wetlands disrupt grain storage.', status: 'warning' },
  { value: 98, suffix: '% Humidity', label: 'Pest Outbreak Threshold', desc: 'Blast disease & beetle surges triggered automatically when temperatures exceed 28°C.', status: 'info' }
];

const PIPELINE_NODES = [
  { category: 'DATA SOURCE', label: 'BAMIS Bulletins', icon: '📄', details: 'District advisories parsed & split by crop sections' },
  { category: 'DATA SOURCE', label: 'Open-Meteo API', icon: '📡', details: 'Live 7-day temp, humidity, & rain parameters' },
  { category: 'DATA SOURCE', label: 'BBS Statistics', icon: '📊', details: 'Historical production records & baseline yields' },
  { category: 'AI EMBEDDING', label: 'Gemini Vector Engine', icon: '🧠', details: '768-dimension coordinate generation' },
  { category: 'DATABASE', label: 'MongoDB Atlas', icon: '💾', details: '$vectorSearch matching + deterministic rules' },
  { category: 'RESPONSE', label: 'Gemini 2.5 Flash', icon: '⚡', details: 'Precise, context-grounded district advisories' }
];

function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

function StatCard({ value, suffix, label, animate }) {
  const count = useCountUp(value, 1600, animate);
  return (
    <div className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '24px 32px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: '100%', background: 'var(--accent-green)' }} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700, color: 'var(--accent-green)', lineHeight: 1 }}>
        {animate ? count.toLocaleString() : value}{suffix}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [activeConsoleStep, setActiveConsoleStep] = useState(0);
  const [currentTime, setCurrentTime] = useState('');

  // Live typing effect strings for the demo console
  const consoleDialogue = [
    { text: "> SELECT * FROM regional_advisories WHERE district='Mymensingh';", type: 'input' },
    { text: "[SYSTEM]: Running $vectorSearch on 768-float query embedding...", type: 'system' },
    { text: "[DATABASE]: Matches found: 3 advisories (Cosine Similarity >= 0.88)", type: 'system' },
    { text: "> GENERATE ADVISORY --context --weather --temp=30.6°C --humidity=96%", type: 'input' },
    { text: "[AI ADVISORY]: Aman Rice in Mymensingh is currently at high risk for Blast disease due to elevated humidity (96%) at 30°C. Actions recommended: Maintain a 5cm water level, spray urea at 9kg/bigha, and apply fungicide if spots appear.", type: 'response' }
  ];

  useEffect(() => {
    // Scroll observer
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);

    // Live clock
    const updateTime = () => {
      const bdt = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCurrentTime(bdt);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Console animation loop
    const consoleInterval = setInterval(() => {
      setActiveConsoleStep((s) => (s + 1) % (consoleDialogue.length + 1));
    }, 4500);

    return () => {
      obs.disconnect();
      clearInterval(interval);
      clearInterval(consoleInterval);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', background: 'var(--bg-primary)' }}>

      {/* Top Banner: Status Bar */}
      <div style={{
        background: '#070a13', borderBottom: '1px solid var(--border)', padding: '6px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10,
        fontFamily: 'var(--font-mono)', color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--accent-green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', animation: 'pulse-green 1.5s infinite' }} />
            SYSTEM STABILITY: NOMINAL
          </span>
          <span>·</span>
          <span>ACTIVE PIPELINES: 3/3 ONLINE</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>DHAKA BST: <span style={{ color: 'var(--text-primary)' }}>{currentTime || 'Loading...'}</span></span>
          <span style={{ color: 'var(--accent-red)' }}>[ 14 REGIONS UNDER WEATHER ALERT ]</span>
        </div>
      </div>

      {/* Nav */}
      <div className="topbar" style={{ padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="topbar-brand" style={{ fontSize: 14 }}>[ KRISHINEXUS CONTROL ]</span>
        </div>
        <nav className="topbar-nav" style={{ display: 'flex', gap: 8 }}>
          <a href="#pipeline" style={{ textDecoration: 'none' }}>PIPELINE</a>
          <a href="#stats" style={{ textDecoration: 'none' }}>CLIMATE RISK</a>
          <a href="#features" style={{ textDecoration: 'none' }}>FEATURES</a>
        </nav>
        <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 11, fontFamily: 'var(--font-mono)' }} onClick={() => navigate('/dashboard')}>
          LAUNCH MISSION DASHBOARD →
        </button>
      </div>

      {/* Hero */}
      <section style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px 80px',
        background: 'radial-gradient(circle at 50% 30%, #0d1e38 0%, var(--bg-primary) 80%)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Dynamic scanning grid lines */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '30px 30px', pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: 1100, width: '100%', display: 'grid', gridTemplateColumns: '1fr', gap: 40, position: 'relative', zIndex: 2 }}>
          {/* Main Hero Header */}
          <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ display: 'inline-block', padding: '4px 10px', background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#60a5fa', fontWeight: 600, letterSpacing: '0.1em' }}>
                BANGLADESH MACRO-AGRICULTURE & CLIMATE ADVISORY
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 20, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}
            >
              Control Room for <br />
              <span style={{ color: 'var(--accent-green)', textShadow: '0 0 20px rgba(0,255,136,0.15)' }}>Resilient Supply Chains</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 36, maxWidth: 680, margin: '0 auto 36px' }}
            >
              Grounded, Gemini-powered RAG models mapping real-time Open-Meteo forecasts, BBS historical baselines, and official BAMIS crop thresholds. Developed for extension offices, policymakers, and logistics handlers.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              style={{ display: 'flex', gap: 16, justifyContent: 'center' }}
            >
              <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 28px', fontFamily: 'var(--font-mono)' }} onClick={() => navigate('/dashboard')}>
                LAUNCH CONTROL CENTER
              </button>
              <button className="btn btn-outline" style={{ fontSize: 14, padding: '12px 28px', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }} onClick={() => navigate('/logistics')}>
                LOGISTICS RUNTIME
              </button>
            </motion.div>
          </div>

          {/* Console / Map Mockup container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="card"
            style={{
              background: '#0b111e', border: '1px solid var(--border)', padding: 0, borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 24px rgba(59,130,246,0.05)', overflow: 'hidden'
            }}
          >
            {/* Terminal Top bar */}
            <div style={{ background: '#0e1726', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>terminal@krishinexus-rag</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>EN/BN SELECTOR</span>
                <span>SECURE HOST: L4</span>
              </div>
            </div>

            {/* Terminal Body */}
            <div style={{ padding: 24, minHeight: 220, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8, background: '#080d17', textAlign: 'left' }}>
              <AnimatePresence mode="popLayout">
                {consoleDialogue.slice(0, activeConsoleStep === 0 ? 1 : activeConsoleStep).map((line, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      color: line.type === 'input' ? 'var(--accent-green)' : line.type === 'system' ? 'var(--text-muted)' : 'var(--text-primary)',
                      marginBottom: 10,
                      paddingLeft: line.type === 'response' ? 12 : 0,
                      borderLeft: line.type === 'response' ? '2px solid var(--accent-blue)' : 'none'
                    }}
                  >
                    {line.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              <span className="cursor" />
            </div>
          </motion.div>

        </div>
      </section>

      {/* RAG Pipeline Grid */}
      <section id="pipeline" style={{ padding: '80px 24px', background: '#080d16', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="panel-label">INTEGRATED RAG PIPELINE</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Vectorized Agricultural Knowledge Flow</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>How KrishiNexus ingests, parses, embeds, indexes and queries data dynamically</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {PIPELINE_NODES.map((node, i) => (
              <div key={i} className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: 24, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-blue)', letterSpacing: '0.1em' }}>{node.category}</span>
                  <span style={{ fontSize: 20 }}>{node.icon}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{node.label}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{node.details}</p>
                <div style={{
                  position: 'absolute', bottom: 12, right: 16,
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)'
                }}>
                  NODE_0{i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics / Risk Stats */}
      <section id="stats" ref={statsRef} style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <div className="panel-label">BANGLADESH CLIMATE RISK MATRIX</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Macro Yield Vulnerability Indices</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
          {METRICS.map((metric, i) => (
            <div key={i} className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${metric.status === 'critical' ? 'badge-red' : metric.status === 'warning' ? 'badge-yellow' : 'badge-blue'}`}>
                  {metric.status.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>SOURCE: BBS</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: metric.status === 'critical' ? 'var(--accent-red)' : metric.status === 'warning' ? 'var(--accent-yellow)' : 'var(--accent-blue)' }}>
                {metric.value.toLocaleString()}{metric.suffix}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{metric.label}</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{metric.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {STATS.map((s) => <StatCard key={s.label} {...s} animate={statsVisible} />)}
        </div>
      </section>

      {/* Feature cards */}
      <section id="features" style={{ padding: '80px 24px', background: '#080d16', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="panel-label">OPERATIONS SUITE</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Control Room Dashboards</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🗺️</span>
                <span className="badge badge-green">LIVE STATUS</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>1. District Operations Center</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Full-scale SVG coordinate map of all 64 districts. Hover to inspect district alert states, live temperatures, and humidity percentages. Click to zoom and synchronize panels.
              </p>
              <button className="btn btn-outline" style={{ marginTop: 'auto', alignSelf: 'flex-start', fontSize: 11, padding: '6px 14px' }} onClick={() => navigate('/dashboard')}>
                Open Dashboard →
              </button>
            </div>

            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🚚</span>
                <span className="badge badge-yellow">SIMULATOR ACTIVE</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>2. Supply Chain Optimizer</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Simulate weather catastrophes by moving the severity slider. Instantly calculate projected yield deficits, identify the closest surplus reserve division, and generate AI dispatch orders.
              </p>
              <button className="btn btn-outline" style={{ marginTop: 'auto', alignSelf: 'flex-start', fontSize: 11, padding: '6px 14px' }} onClick={() => navigate('/logistics')}>
                Open Logistics →
              </button>
            </div>

            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🤖</span>
                <span className="badge badge-blue">RAG MATCHING</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>3. Contextual Interrogator</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Query-time vector search retrieves district-specific advisories from the database, combined with 7-day weather forecasts and disease patterns, passing them directly to Gemini for grounded advisories.
              </p>
              <button className="btn btn-outline" style={{ marginTop: 'auto', alignSelf: 'flex-start', fontSize: 11, padding: '6px 14px' }} onClick={() => navigate('/dashboard')}>
                Try RAG Chat →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '30px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        Data Pipeline Ingestions: BAMIS Weather Portal · BBS Production Archive · Open-Meteo API · bdapi Admin Coordinates
        <br />
        <span style={{ marginTop: 8, display: 'block', opacity: 0.6 }}>
          KrishiNexus — Built for SIC-Blitz CUET (Track B: Environment & Sustainability)
        </span>
      </footer>
    </div>
  );
}

