import { useState, useRef, useEffect } from 'react';
import { postRagQuery } from '../../api';

const SAMPLE_QUESTIONS = [
  'কী কী ফসল চাষ করা যাবে?',
  'কী কী রোগ-বালাই আছে?',
  'কৃষি পরামর্শ দাও',
  'What crops can be cultivated?',
  'What are the current pest risks?',
];

export default function ChatTerminal({ district }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);
  const prevDistrictId = useRef(null);

  // Clear chat when district changes
  useEffect(() => {
    if (!district) return;
    if (district._id !== prevDistrictId.current) {
      prevDistrictId.current = district._id;
      setMessages([]);
    }
  }, [district]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(overrideQuestion) {
    const q = (typeof overrideQuestion === 'string' ? overrideQuestion : input).trim();
    if (!q || !district || loading) return;

    setInput('');
    const userMsg = { role: 'user', text: q, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await postRagQuery({ question: q, districtId: district._id });
      setMessages((prev) => [...prev, { role: 'assistant', text: data.answer, ts: new Date() }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: err.response?.data?.message || err.message, ts: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const ts = (date) =>
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="panel-label">CONTEXTUAL INTERROGATOR</div>

      {/* Message history */}
      <div style={{
        background: '#060a14',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: 10,
        height: 200,
        overflowY: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.7,
      }}>
        {!district && (
          <span style={{ color: 'var(--text-muted)' }}>
            {'>'} Select a district to begin...
          </span>
        )}

        {district && messages.length === 0 && !loading && (
          <span style={{ color: 'var(--text-muted)' }}>
            {'>'} Ready. District: {district.name}
            <span className="cursor" />
          </span>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            {msg.role === 'user' && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>[{ts(msg.ts)}] </span>
                <span style={{ color: 'var(--accent-green)' }}>{'>'} </span>
                <span style={{ color: '#a3e635' }}>{msg.text}</span>
              </div>
            )}
            {msg.role === 'assistant' && (
              <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--border)', marginTop: 3 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>[{ts(msg.ts)}] </span>
                <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{msg.text}</span>
              </div>
            )}
            {msg.role === 'error' && (
              <div style={{ color: 'var(--accent-red)', paddingLeft: 12 }}>
                ERROR: {msg.text}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ color: 'var(--text-muted)' }}>
            {'>'} <span className="cursor" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--accent-green)', alignSelf: 'center', flexShrink: 0,
        }}>
          {'>'}
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!district || loading}
          placeholder={district ? 'Enter directive or query...' : 'Select a district first'}
          style={{
            flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11,
            background: '#060a14', borderColor: 'var(--border)',
            color: 'var(--accent-green)',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!district || loading || !input.trim()}
          className="btn btn-primary"
          style={{ fontSize: 11, padding: '6px 12px', flexShrink: 0,
                   opacity: (!district || loading || !input.trim()) ? 0.4 : 1 }}
        >
          Send
        </button>
      </div>

      {district && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Context: {district.name} · Press Enter to send · Shift+Enter for newline
        </div>
      )}

      {/* Sample question chips */}
      {district && !loading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
              style={{
                padding: '3px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 3,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-blue)';
                e.currentTarget.style.color = 'var(--accent-blue)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}