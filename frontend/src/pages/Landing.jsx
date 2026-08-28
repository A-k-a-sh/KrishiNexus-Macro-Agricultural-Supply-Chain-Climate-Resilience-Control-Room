import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import '../styles/globals.css'

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
  const { alertCounts } = useAppContext();
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
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-slate-950 text-slate-300 font-sans">

      {/* Top Banner: Status Bar */}
      <div className="bg-slate-950/90 border-b border-slate-800/60 px-5 py-1.5 flex justify-between items-center text-[10px] font-mono text-slate-500 backdrop-blur-md z-50 sticky top-0">
        <div className="flex items-center gap-3">
          <span className="text-emerald-500 flex items-center gap-1.5 font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SYSTEM STABILITY: NOMINAL
          </span>
          <span>·</span>
          <span>ACTIVE PIPELINES: 3/3 ONLINE</span>
        </div>
        <div className="flex gap-4 tracking-widest">
          <span>DHAKA BST: <span className="text-slate-300">{currentTime || 'Loading...'}</span></span>
          <span className={alertCounts.red > 0 ? 'text-red-400' : 'text-amber-400'}>
            [ {alertCounts.red + alertCounts.yellow} REGIONS UNDER WEATHER ALERT ]
          </span>
        </div>
      </div>

      {/* Nav */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/40 bg-slate-950/50 backdrop-blur-md z-40">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-mono font-bold tracking-[0.1em] text-slate-200">
            [ KRISHINEXUS CONTROL ]
          </span>
        </div>
        <nav className="flex gap-8 text-[11px] font-mono font-semibold tracking-widest text-slate-400">
          <a href="#comparison" className="hover:text-emerald-400 transition-colors">WHY KRISHINEXUS</a>
          <a href="#pipeline" className="hover:text-emerald-400 transition-colors">PIPELINE</a>
          <a href="#stats" className="hover:text-emerald-400 transition-colors">RISK MATRIX</a>
        </nav>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-5 py-2 rounded-lg text-xs font-mono font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-0.5"
        >
          LAUNCH MISSION DASHBOARD →
        </button>
      </div>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 lg:py-24 relative overflow-hidden bg-slate-950">
        {/* Dynamic scanning grid lines */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        
        {/* Subtle radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-5xl w-full flex flex-col gap-14 relative z-10">
          {/* Main Hero Header */}
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-block px-5 py-1.5 bg-emerald-950/40 border border-emerald-800/60 rounded-full mb-8 backdrop-blur-sm shadow-[0_0_15px_rgba(16,185,129,0.05)]"
            >
              <span className="font-mono text-[11px] text-emerald-400 font-bold tracking-widest uppercase">
                BANGLADESH MACRO-AGRICULTURE & CLIMATE ADVISORY
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[clamp(40px,6vw,68px)] font-extrabold leading-[1.1] mb-6 tracking-tight text-slate-100"
            >
              <div className="font-sans">
                <span className="block mb-2">KrishiNexus</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  Control Room for Resilient Supply Chains
                </span>
              </div>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-400 leading-[1.7] mb-10 max-w-2xl mx-auto font-light"
            >
              A Gemini-powered Hybrid RAG advisory system grounded in real-time forecasts and official BAMIS crop data. Built for extension offices, policymakers, and logistics managers.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex gap-5 justify-center"
            >
              <button 
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-8 py-3.5 rounded-xl text-sm font-mono font-bold shadow-[0_8px_25px_rgba(16,185,129,0.25)] transition-all transform hover:-translate-y-1"
              >
                LAUNCH CONTROL CENTER
              </button>
              <button 
                onClick={() => navigate('/logistics')}
                className="bg-slate-900/50 hover:bg-slate-800/80 border border-slate-700/60 text-slate-300 px-8 py-3.5 rounded-xl text-sm font-mono font-semibold transition-all backdrop-blur-sm"
              >
                LOGISTICS RUNTIME
              </button>
            </motion.div>
          </div>

          {/* Console / Map Mockup container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden backdrop-blur-md max-w-4xl mx-auto w-full"
          >
            {/* Terminal Top bar */}
            <div className="bg-slate-950/80 border-b border-slate-800/60 px-4 py-3 flex justify-between items-center backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="font-mono text-[11px] text-slate-500 ml-3">terminal@krishinexus-rag</span>
              </div>
              <div className="flex gap-4 text-[10px] text-slate-500 font-mono tracking-widest font-semibold">
                <span>EN/BN SELECTOR</span>
                <span>SECURE HOST: L4</span>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-6 min-h-[240px] font-mono text-[13px] leading-[1.8] bg-slate-950/50 text-left">
              <AnimatePresence mode="popLayout">
                {consoleDialogue.slice(0, activeConsoleStep + 1).map((line, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`mb-3 ${
                      line.type === 'input' ? 'text-emerald-400 font-medium' : 
                      line.type === 'system' ? 'text-slate-500' : 
                      'text-slate-300 pl-4 border-l-2 border-emerald-500/50'
                    }`}
                  >
                    {line.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              <span className="inline-block w-2.5 h-[15px] bg-emerald-400/80 ml-1 animate-pulse align-middle" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* WHY KRISHINEXUS IS DIFFERENT (COMPARISON TABLE) */}
      <section id="comparison" className="px-6 py-24 bg-slate-950 border-t border-slate-800/40 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
        <div className="max-w-5xl mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-[28px] font-bold font-mono text-slate-100">How We Differ From Consumer Apps</h2>
            <p className="text-slate-400 text-sm mt-3 font-light">Moving past static micro-tips into centralized macro supply chain intelligence</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            <div className="grid grid-cols-[1.2fr_1.4fr_1.8fr] bg-slate-950/80 border-b border-slate-800/60 p-5 text-[11px] font-mono font-bold tracking-widest text-slate-400">
              <span>CAPABILITY</span>
              <span>TRADITIONAL AGRI APPS</span>
              <span className="text-emerald-400">KRISHINEXUS CONTROL ROOM</span>
            </div>

            {COMPARISONS.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1.2fr_1.4fr_1.8fr] p-6 text-sm leading-[1.7] transition-colors ${
                  i < COMPARISONS.length - 1 ? 'border-b border-slate-800/40' : ''
                } ${row.highlight ? 'bg-emerald-950/20' : 'hover:bg-slate-900/50'}`}
              >
                <span className={`font-mono font-semibold pr-4 ${row.highlight ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {row.feature}
                </span>
                <span className="text-slate-400 pr-6">{row.apps}</span>
                <span className="text-slate-300 border-l border-dashed border-slate-700/60 pl-8">{row.nexus}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAG PIPELINE TIMELINE TRACE */}
      <section id="pipeline" className="px-6 py-24 bg-slate-950 relative border-t border-slate-800/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-900/10 via-slate-950 to-slate-950 pointer-events-none"></div>
        <div className="max-w-5xl mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-teal-950/50 border border-teal-800/50 rounded text-[10px] font-bold font-mono tracking-widest text-teal-400 mb-4 uppercase">
              INTEGRATED RAG PIPELINE FLOW
            </div>
            <h2 className="text-[28px] font-bold font-mono text-slate-100">Automated Knowledge Aggregation Trace</h2>
            <p className="text-slate-400 text-sm mt-3 font-light">Vector ingestion pipeline converting raw government data to structured intelligence</p>
          </div>

          <div className="flex flex-col bg-slate-900/40 border border-slate-800/60 rounded-2xl font-mono backdrop-blur-md shadow-xl overflow-hidden">
            {[
              { step: '01', title: 'RAW DATA INGESTION', detail: 'Scrapes BAMIS district bulletins, Open-Meteo forecasts, and BBS yields.', badge: <a href='https://www.bamis.gov.bd/bulletin/district/current/0' target='__blank' className="hover:text-emerald-300">SOURCE</a> },
              { step: '02', title: 'VECTOR EMBEDDING', detail: 'Calls gemini-embedding-001 to generate 3072-dimensional semantic indices.', badge: <a href='https://ai.google.dev/gemini-api/docs/embeddings' target='__blank' className="hover:text-emerald-300">AI MODEL</a>  },
              { step: '03', title: 'ATLAS STORAGE', detail: 'Stores vectorized document chunks and configures $vectorSearch index fields.', badge: 'DATABASE' },
              { step: '04', title: 'CONTEXT RETRIEVAL', detail: 'Runs parallel vector queries to retrieve district advisories & disease thresholds.', badge: 'RAG STACK' },
              { step: '05', title: 'GROUNDED RESPONSE', detail: 'Feeds live telemetry + matched database records to Gemini 2.5 Flash for final advisory.', badge: 'SYNTHESIS' }
            ].map((node, i) => (
              <div
                key={i}
                className={`flex items-center gap-6 p-6 relative hover:bg-slate-800/30 transition-colors ${
                  i < 4 ? 'border-b border-slate-800/40' : ''
                }`}
              >
                <span className="text-xl font-extrabold text-teal-500/80">{node.step}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-200 mb-1">{node.title}</div>
                  <div className="text-xs text-slate-400 font-sans leading-relaxed">{node.detail}</div>
                </div>
                <span className="px-2 py-1 bg-teal-950/60 border border-teal-800/60 rounded text-[9px] font-bold text-teal-400 tracking-wider">
                  {node.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLIMATE RISK MATRIX TELEMETRY LIST */}
      <section id="stats" ref={statsRef} className="px-6 py-24 max-w-5xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 bg-blue-950/50 border border-blue-800/50 rounded text-[10px] font-bold font-mono tracking-widest text-blue-400 mb-4 uppercase">
            BANGLADESH CLIMATE RISK MATRIX
          </div>
          <h2 className="text-[28px] font-bold font-mono text-slate-100">Macro Yield Vulnerability Indices</h2>
        </div>

        <div className="flex flex-col gap-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 mb-12 font-mono backdrop-blur-md shadow-xl">
          <div className="grid grid-cols-[1.8fr_1.2fr_2fr] border-b border-dashed border-slate-700/60 pb-3 text-[11px] font-bold tracking-widest text-slate-500">
            <span>VULNERABILITY PARAMETER</span>
            <span>CRITICAL VALUE</span>
            <span>BBS CRITICAL DETAILS</span>
          </div>

          {[
            { label: 'Cropland Exposed to Climate Shock', value: '18,000,000 Hectares', desc: 'BBS estimates 64% of agricultural GDP exposure linked to season-specific flooding/droughts.', status: 'red' },
            { label: 'Annual Average Flood Asset Loss', value: '৳ 12,000 Crore', desc: 'Sudden flash floods in north-eastern haor and central delta wash away local reserve reserves.', status: 'yellow' },
            { label: 'Pest Fungal Outbreak Window', value: 'Humidity >= 96% @ 28°C', desc: 'Blast disease & Red-Pumpkin Beetle spreads exponentially when humidity triggers exceed thresholds.', status: 'blue' }
          ].map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1.8fr_1.2fr_2fr] text-[13px] items-center py-2.5 group hover:bg-slate-800/20 rounded px-2 -mx-2 transition-colors">
              <span className="text-slate-300 font-semibold pr-4">{item.label}</span>
              <span className={`font-bold ${item.status === 'red' ? 'text-red-400' : item.status === 'yellow' ? 'text-amber-400' : 'text-blue-400'}`}>
                {item.value}
              </span>
              <span className="text-slate-400 font-sans text-xs leading-relaxed">{item.desc}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
          {STATS.map((s) => <StatCard key={s.label} {...s} animate={statsVisible} />)}
        </div>
      </section>

      {/* FULL-WIDTH FEATURE LAUNCH TRACKS */}
      <section id="features" className="px-6 py-24 bg-slate-950 border-t border-slate-800/40 relative">
        <div className="max-w-5xl mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-purple-950/40 border border-purple-800/40 rounded text-[10px] font-bold font-mono tracking-widest text-purple-400 mb-4 uppercase">
              OPERATIONS SUITE
            </div>
            <h2 className="text-[28px] font-bold font-mono text-slate-100">Control Room Dashboards</h2>
          </div>

          <div className="flex flex-col gap-6">
            {[
              {
                num: '01',
                title: 'District Operations Center',
                desc: 'Full-scale interactive coordinate map of all 64 districts. Hover to inspect alert statuses, live open-meteo temperatures, salinity values, and crop stage arrays. Zoom and sync coordinates in real time.',
                badge: 'LIVE MAP STATUS',
                badgeColor: 'text-emerald-400 border-emerald-800/60 bg-emerald-950/40',
                action: () => navigate('/dashboard')
              },
              {
                num: '02',
                title: 'Supply Chain Routing & Silo Dispatch Optimizer',
                desc: 'Simulate weather catastrophes by shifting severity parameters. Calculate projected yield shortfalls based on district baselines, identify the closest surplus silo, and generate AI dispatch manifests.',
                badge: 'SIMULATOR ACTIVE',
                badgeColor: 'text-amber-400 border-amber-800/60 bg-amber-950/40',
                action: () => navigate('/logistics')
              },
              {
                num: '03',
                title: 'RAG Knowledge Base & Contextual Interrogator',
                desc: 'Vector-search district bulletins, crop disease libraries, and weather projections to feed the Gemini API for highly localized crop and disaster advisory suggestions.',
                badge: 'RAG PIPELINE ONLINE',
                badgeColor: 'text-blue-400 border-blue-800/60 bg-blue-950/40',
                action: () => navigate('/dashboard')
              }
            ].map((feat, i) => (
              <div
                key={i}
                className="bg-slate-900/40 border border-slate-800/60 p-8 flex items-center gap-8 flex-wrap rounded-2xl backdrop-blur-md hover:bg-slate-900/60 transition-colors shadow-lg"
              >
                <div className="font-mono text-4xl font-extrabold text-slate-700/50">{feat.num}</div>
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-slate-200">{feat.title}</h3>
                    <span className={`px-2 py-1 rounded border text-[9px] font-bold font-mono tracking-wider ${feat.badgeColor}`}>
                      {feat.badge}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-[1.8] font-light">{feat.desc}</p>
                </div>
                <button 
                  onClick={feat.action}
                  className="px-6 py-2.5 rounded-lg border border-slate-700/60 text-slate-300 font-mono text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  LAUNCH RUNTIME →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/40 py-10 px-6 text-center text-slate-500 text-xs font-mono bg-slate-950">
        Data Pipeline Ingestions: BAMIS Weather Portal · BBS Production Archive · Open-Meteo API · bdapi Admin Coordinates
        <br />
        <span className="mt-3 block opacity-60">
          @All Rights Reserved | Developed By <a href='https://www.github.com/A-k-a-sh' target='__blank' className="text-emerald-500 hover:text-emerald-400 hover:underline">Akash</a>
        </span>
      </footer>
    </div>
  );
}

function StatCard({ value, suffix, label, animate }) {
  const count = useCountUp(value, 1600, animate);
  return (
    <div className="bg-slate-900/40 border border-slate-800/60 p-8 rounded-2xl relative overflow-hidden backdrop-blur-md shadow-lg group hover:border-emerald-500/50 transition-colors">
      <div className="absolute top-0 left-0 w-[3px] h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] group-hover:bg-emerald-400 transition-colors" />
      <div className="font-mono text-[42px] font-extrabold text-emerald-400 leading-none mb-3 tracking-tight">
        {animate ? count.toLocaleString() : value}{suffix}
      </div>
      <div className="text-[11px] text-slate-400 font-mono font-bold uppercase tracking-[0.1em]">{label}</div>
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


