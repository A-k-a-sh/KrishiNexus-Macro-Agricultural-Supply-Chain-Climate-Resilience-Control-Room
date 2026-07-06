import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STATS = [
  { value: 64, suffix: '', label: 'Districts Monitored' },
  { value: 3, suffix: ' Live', label: 'Data Pipelines' },
  { value: 2900, suffix: '+', label: 'Advisory Vectors Indexed' },
];

const COMPARISONS = [
  {
    feature: 'Target Audience',
    apps: 'Micro-scale tips for individual retail farmers.',
    nexus: 'Institutional control panel for DAE offices, policymakers, and logistics managers.',
    highlight: true
  },
  {
    feature: 'Salinity & Soil Dynamics',
    apps: 'None. Only generic static regional weather summaries.',
    nexus: 'Deterministic soil chemistry mapping (pH, NPK saturation) and coastal salinity intrusion alerts.',
    highlight: false
  },
  {
    feature: 'Supply Chain Defense',
    apps: 'Simple listing of local stores or input retailers.',
    nexus: 'Interactive Haversine-based yield deficit solver with regional warehouse stock dispatch routing.',
    highlight: false
  },
  {
    feature: 'AI Advisory Grounding',
    apps: 'Basic rule-based logic or generic LLM prompts prone to hallucination.',
    nexus: 'District-scoped multi-vector RAG indexing official government bulletins and disease matrices.',
    highlight: true
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [activeConsoleStep, setActiveConsoleStep] = useState(0);
  const [currentTime, setCurrentTime] = useState('');

  // Live typing effect strings for the demo console
  const consoleDialogue = [
    { text: "> SELECT * FROM regional_advisories WHERE district='Mymensingh';", type: 'input' },
    { text: "[SYSTEM]: Running $vectorSearch on 3072-float query embedding...", type: 'system' },
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
      setActiveConsoleStep((s) => (s + 1) % consoleDialogue.length);
    }, 3500);

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
          <a href="#comparison" style={{ textDecoration: 'none' }}>WHY KRISHINEXUS</a>
          <a href="#pipeline" style={{ textDecoration: 'none' }}>PIPELINE</a>
          <a href="#stats" style={{ textDecoration: 'none' }}>RISK MATRIX</a>
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
                {consoleDialogue.slice(0, activeConsoleStep + 1).map((line, idx) => (
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

      {/* WHY KRISHINEXUS IS DIFFERENT (COMPARISON TABLE) */}
      <section id="comparison" style={{ padding: '80px 24px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            
            <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>How We Differ From Consumer Apps</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Moving past static micro-tips into centralized macro supply chain intelligence</p>
          </div>

          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            overflow: 'hidden', boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.8fr', background: '#0c111e', borderBottom: '1px solid var(--border)', padding: '14px 20px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)' }}>
              <span>CAPABILITY</span>
              <span>TRADITIONAL AGRI APPS</span>
              <span style={{ color: 'var(--accent-green)' }}>KRISHINEXUS CONTROL ROOM</span>
            </div>

            {COMPARISONS.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.8fr',
                  padding: '18px 20px', borderBottom: i < COMPARISONS.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: 12, lineHeight: 1.6,
                  background: row.highlight ? '#0a1420' : 'transparent'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: row.highlight ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{row.feature}</span>
                <span style={{ color: 'var(--text-muted)', paddingRight: 15 }}>{row.apps}</span>
                <span style={{ color: 'var(--text-primary)', borderLeft: '1px dashed var(--border)', paddingLeft: 20 }}>{row.nexus}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAG PIPELINE TIMELINE TRACE */}
      <section id="pipeline" style={{ padding: '80px 24px', background: '#080d16', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="panel-label">INTEGRATED RAG PIPELINE FLOW</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Automated Knowledge Aggregation Trace</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Vector ingestion pipeline converting raw government data to structured intelligence</p>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-mono)'
          }}>
            {[
              { step: '01', title: 'RAW DATA INGESTION', detail: 'Scrapes BAMIS district bulletins, Open-Meteo forecasts, and BBS yields.', badge: 'SOURCE' },
              { step: '02', title: 'VECTOR EMBEDDING', detail: 'Calls gemini-embedding-001 to generate 3072-dimensional semantic indices.', badge: 'AI MODEL' },
              { step: '03', title: 'ATLAS STORAGE', detail: 'Stores vectorized document chunks and configures $vectorSearch index fields.', badge: 'DATABASE' },
              { step: '04', title: 'CONTEXT RETRIEVAL', detail: 'Runs parallel vector queries to retrieve district advisories & disease thresholds.', badge: 'RAG STACK' },
              { step: '05', title: 'GROUNDED RESPONSE', detail: 'Feeds live telemetry + matched database records to Gemini 2.5 Flash for final advisory.', badge: 'SYNTHESIS' }
            ].map((node, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px',
                  borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-blue)' }}>{node.step}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{node.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{node.detail}</div>
                </div>
                <span className="badge badge-blue" style={{ fontSize: 8 }}>{node.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLIMATE RISK MATRIX TELEMETRY LIST */}
      <section id="stats" ref={statsRef} style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="panel-label">BANGLADESH CLIMATE RISK MATRIX</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Macro Yield Vulnerability Indices</h2>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: 24, marginBottom: 40, fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr 2fr', borderBottom: '1px dashed var(--border)', paddingBottom: 10, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>VULNERABILITY PARAMETER</span>
            <span>CRITICAL VALUE</span>
            <span>BBS CRITICAL DETAILS</span>
          </div>

          {[
            { label: 'Cropland Exposed to Climate Shock', value: '18,000,000 Hectares', desc: 'BBS estimates 64% of agricultural GDP exposure linked to season-specific flooding/droughts.', status: 'red' },
            { label: 'Annual Average Flood Asset Loss', value: '৳ 12,000 Crore', desc: 'Sudden flash floods in north-eastern haor and central delta wash away local reserve reserves.', status: 'yellow' },
            { label: 'Pest Fungal Outbreak Window', value: 'Humidity >= 96% @ 28°C', desc: 'Blast disease & Red-Pumpkin Beetle spreads exponentially when humidity triggers exceed thresholds.', status: 'blue' }
          ].map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr 2fr', fontSize: 12, alignItems: 'center', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.label}</span>
              <span style={{ color: item.status === 'red' ? 'var(--accent-red)' : item.status === 'yellow' ? 'var(--accent-yellow)' : 'var(--accent-blue)', fontWeight: 700 }}>
                {item.value}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 11 }}>{item.desc}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {STATS.map((s) => <StatCard key={s.label} {...s} animate={statsVisible} />)}
        </div>
      </section>

      {/* FULL-WIDTH FEATURE LAUNCH TRACKS */}
      <section id="features" style={{ padding: '80px 24px', background: '#080d16', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="panel-label">OPERATIONS SUITE</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Control Room Dashboards</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                num: '01',
                title: 'District Operations Center',
                desc: 'Full-scale interactive coordinate map of all 64 districts. Hover to inspect alert statuses, live open-meteo temperatures, salinity values, and crop stage arrays. Zoom and sync coordinates in real time.',
                badge: 'LIVE MAP STATUS',
                badgeColor: 'badge-green',
                action: () => navigate('/dashboard')
              },
              {
                num: '02',
                title: 'Supply Chain Routing & Silo Dispatch Optimizer',
                desc: 'Simulate weather catastrophes by shifting severity parameters. Calculate projected yield shortfalls based on district baselines, identify the closest surplus silo, and generate AI dispatch manifests.',
                badge: 'SIMULATOR ACTIVE',
                badgeColor: 'badge-yellow',
                action: () => navigate('/logistics')
              },
              {
                num: '03',
                title: 'RAG Knowledge Base & Contextual Interrogator',
                desc: 'Vector-search district bulletins, crop disease libraries, and weather projections to feed the Gemini API for highly localized crop and disaster advisory suggestions.',
                badge: 'RAG PIPELINE ONLINE',
                badgeColor: 'badge-blue',
                action: () => navigate('/dashboard')
              }
            ].map((feat, i) => (
              <div
                key={i}
                className="card"
                style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: 28,
                  display: 'flex', alignItems: 'center', gap: 30, flexWrap: 'wrap'
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--border-light)' }}>{feat.num}</div>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{feat.title}</h3>
                    <span className={`badge ${feat.badgeColor}`} style={{ fontSize: 8 }}>{feat.badge}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{feat.desc}</p>
                </div>
                <button className="btn btn-outline" style={{ fontFamily: 'var(--font-mono)', padding: '10px 20px', fontSize: 12 }} onClick={feat.action}>
                  LAUNCH RUNTIME →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '30px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        Data Pipeline Ingestions: BAMIS Weather Portal · BBS Production Archive · Open-Meteo API · bdapi Admin Coordinates
        <br />
        <span style={{ marginTop: 8, display: 'block', opacity: 0.6 }}>
          @All Rights Reserved | Developed By <span > <a href='https://www.github.com/A-k-a-sh' target='__blank' style={{ textDecoration: 'none', color: 'var(--accent-green)' }}>Akash</a> </span>
        </span>
      </footer>
    </div>
  );
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


