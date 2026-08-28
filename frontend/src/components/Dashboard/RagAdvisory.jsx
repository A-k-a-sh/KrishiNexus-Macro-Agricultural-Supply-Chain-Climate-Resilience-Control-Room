import { useState, useEffect, useRef } from 'react';
import { postRagQuery } from '../../api';

const AUTO_QUERY = 'Summarize the current agricultural risk situation and key advisories for this district based on current weather conditions. and বর্তমান আবহাওয়ায় কোন ফসলে কোন রোগ বা পোকার আক্রমণ হতে পারে এবং তার প্রতিকার কী? কোন ফসল চাষ করা যাবে?';

export default function RagAdvisory({ district }) {
  const [text, setText]       = useState('');
  const [displayed, setDisplayed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const intervalRef = useRef(null);
  const prevDistrictId = useRef(null);

  // Auto-fire whenever selected district changes
  useEffect(() => {
    if (!district) return;
    if (district._id === prevDistrictId.current) return;
    prevDistrictId.current = district._id;

    fetchAdvisory();
  }, [district]);

  // Typewriter effect
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(intervalRef.current);
    }, 8); // ~8ms per character ≈ fast typewriter
    return () => clearInterval(intervalRef.current);
  }, [text]);

  async function fetchAdvisory() {
    setLoading(true);
    setError(null);
    setText('');
    try {
      const { data } = await postRagQuery({
        question: AUTO_QUERY,
        districtId: district._id,
      });
      setText(data.answer);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '0 14px 14px' }}>
      <div className="flex items-center justify-between mb-3 mt-4">
        <div className="text-[10px] font-bold tracking-[0.12em] text-emerald-500 uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          AI CRISIS ADVISORY
        </div>
        {district && !loading && (
          <button
            onClick={fetchAdvisory}
            className="bg-transparent border border-slate-700/60 text-slate-400 rounded-md px-2 py-0.5 text-[10px] font-mono hover:text-slate-300 hover:bg-slate-800/40 transition-colors"
          >
            ↻ Refresh
          </button>
        )}
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-emerald-900/30 shadow-[0_0_15px_rgba(16,185,129,0.05)] rounded-2xl p-4 min-h-[140px] text-[11.5px] leading-[1.7] text-slate-300 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0 opacity-50"></div>
        {!district && (
          <span className="text-slate-500 font-mono flex items-center justify-center h-[100px]">
            Select a district to generate advisory...
          </span>
        )}

        {district && loading && (
          <div className="flex flex-col gap-2.5 animate-pulse mt-1">
            {[100, 80, 90, 60].map((w, i) => (
              <div key={i} className="bg-slate-800/80 rounded-full h-2.5" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {district && !loading && error && (
          <span className="text-red-400 font-mono text-[11px]">
            Error: {error}
          </span>
        )}

        {district && !loading && !error && displayed && (
          <>
            <span style={{ whiteSpace: 'pre-wrap' }}>{displayed}</span>
            {displayed.length < text.length && <span className="cursor" />}
          </>
        )}
      </div>

      <div className="mt-2.5 text-[9px] text-slate-500 tracking-wider">
        Generated from BAMIS bulletins + Gemini 2.5 Flash. Not a substitute for official DAE guidance.
      </div>
    </div>
  );
}