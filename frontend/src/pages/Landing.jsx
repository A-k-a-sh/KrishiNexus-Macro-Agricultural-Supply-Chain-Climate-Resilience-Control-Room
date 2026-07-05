import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const STATS = [
  { value: 64,     suffix: '',  label: 'Districts Monitored' },
  { value: 3,      suffix: '+', label: 'Live Data Pipelines' },
  { value: 426,    suffix: '',  label: 'Advisory Chunks Indexed' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Live Climate Ingestion',      desc: 'Open-Meteo feeds 7-day forecasts per district. BAMIS government bulletins scraped for official crop advisories.' },
  { step: '02', title: 'AI Risk Scoring',             desc: 'Backend cross-references live temperature and humidity against BAMIS crop thresholds. Flags heat stress, pest windows, flood risk.' },
  { step: '03', title: 'RAG Advisory Generation',     desc: 'User queries are embedded via Gemini, matched against the BAMIS knowledge base via vector search, and answered with grounded context.' },
  { step: '04', title: 'Supply Chain Response',       desc: 'Logistics engine calculates projected yield deficits, identifies surplus divisions, and generates routing plans for stabilising food supply.' },
];

const FEATURES = [
  { title: 'District Operations Center', desc: 'Interactive map of all 64 districts with real-time risk coloring, live weather telemetry, and AI advisory stream.', link: '/dashboard', cta: 'Open Dashboard →' },
  { title: 'Supply Chain Optimizer',     desc: 'Simulate climate shocks, calculate yield deficits, and dispatch AI-generated cargo routing plans across divisions.', link: '/logistics', cta: 'Open Logistics →' },
  { title: 'RAG Knowledge Base',         desc: 'BAMIS crop thresholds, disease matrices, and government bulletins indexed as searchable embeddings for grounded AI responses.', link: '/dashboard', cta: 'Try It →' },
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
    <div style={{ textAlign: 'center', padding: '20px 30px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 42, fontWeight: 700, color: 'var(--accent-green)', lineHeight: 1 }}>
        {animate ? count : value}{suffix}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div className="topbar">
        <span className="topbar-brand">[ KRISHINEXUS ]</span>
        <nav className="topbar-nav">
          <a href="#how-it-works" style={{ textDecoration: 'none' }}>HOW IT WORKS</a>
          <a href="#features" style={{ textDecoration: 'none' }}>FEATURES</a>
        </nav>
        <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 11 }} onClick={() => navigate('/dashboard')}>
          Enter Dashboard
        </button>
      </div>

      {/* Hero */}
      <section style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '85vh', padding: '60px 24px',
        background: 'radial-gradient(ellipse at 50% 40%, #0d1f3c 0%, var(--bg-primary) 70%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', maxWidth: 720, position: 'relative' }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)', letterSpacing: '0.2em', marginBottom: 16 }}>
            TRACK B — ENVIRONMENT & SUSTAINABILITY
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 58px)', fontWeight: 700, lineHeight: 1.15, marginBottom: 20, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--accent-green)' }}>KrishiNexus</span>
            <span className="cursor" style={{ marginLeft: 4 }} />
          </h1>

          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 8 }}>
            Macro-Agricultural Supply Chain & Climate Resilience Control Room
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 36 }}>
            Built for agricultural extension offices, supply chain managers, and policymakers in Bangladesh.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 14, padding: '10px 24px' }} onClick={() => navigate('/dashboard')}>
              Enter Dashboard →
            </button>
            <button className="btn btn-outline" style={{ fontSize: 14, padding: '10px 24px' }} onClick={() => navigate('/logistics')}>
              View Logistics →
            </button>
          </div>
        </motion.div>
      </section>

      {/* Problem stats */}
      <section ref={statsRef} style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
          {STATS.map((s) => <StatCard key={s.label} {...s} animate={statsVisible} />)}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '64px 24px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="panel-label" style={{ textAlign: 'center', marginBottom: 32 }}>HOW IT WORKS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
            <motion.div
              key={step}
              className="card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 10, opacity: 0.5 }}>
                {step}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section id="features" style={{ padding: '0 24px 64px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="panel-label" style={{ textAlign: 'center', marginBottom: 32 }}>FEATURES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {FEATURES.map(({ title, desc, link, cta }) => (
            <motion.div
              key={title}
              className="card"
              whileHover={{ borderColor: 'var(--accent-blue)', boxShadow: 'var(--shadow-glow-blue)' }}
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate(link)}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: 'var(--text-primary)' }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{desc}</div>
              <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>{cta}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        Data Sources: BAMIS (DAE, Bangladesh) · BBS Crop Production Dataset · Open-Meteo · bdapi
        <br />
        <span style={{ marginTop: 4, display: 'block', opacity: 0.6 }}>
          Built for SIC-Blitz CUET — Track B: Environment & Sustainability
        </span>
      </footer>
    </div>
  );
}
