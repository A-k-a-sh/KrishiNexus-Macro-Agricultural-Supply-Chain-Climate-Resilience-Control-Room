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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="panel-label" style={{ margin: 0 }}>AI CRISIS ADVISORY</div>
        {district && !loading && (
          <button
            onClick={fetchAdvisory}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)',
              padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        )}
      </div>

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: 12, minHeight: 120,
        fontSize: 12, lineHeight: 1.7, color: 'var(--text-primary)',
        position: 'relative',
      }}>
        {!district && (
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Select a district to generate advisory...
          </span>
        )}

        {district && loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[100, 80, 90, 60].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 12, width: `${w}%` }} />
            ))}
          </div>
        )}

        {district && !loading && error && (
          <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
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

      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
        Generated from BAMIS bulletins + Gemini 2.5 Flash. Not a substitute for official DAE guidance.
      </div>
    </div>
  );
}