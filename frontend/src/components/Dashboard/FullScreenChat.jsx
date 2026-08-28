import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { postRagQuery } from '../../api';

export default function FullScreenChat({ district }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const prevDistrictId = useRef(null);

  // Clear history when district changes
  useEffect(() => {
    if (!district) return;
    if (district._id !== prevDistrictId.current) {
      prevDistrictId.current = district._id;
      setMessages([]);
    }
  }, [district]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Suggested chips — change based on district alerts
  const chips = getSuggestedChips(district);

  async function sendMessage(text) {
    const q = (text || input).trim();
    if (!q || !district || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q, ts: new Date() }]);
    setLoading(true);

    try {
      const { data } = await postRagQuery({ question: q, districtId: district._id });
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.answer,
        queryType: data.queryType,
        sourceImages: data.sourceImages || [],
        sourceLinks: data.sourceLinks || [],
        ts: new Date()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'error',
        text: err.response?.data?.message || err.message,
        ts: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.aiDot} />
          <span style={styles.headerTitle}>KrishiNexus AI</span>
          <span style={styles.headerDistrict}>{district?.name}</span>
        </div>
        <span style={styles.headerSub}>
          Grounded in BAMIS official data
        </span>
      </div>

      {/* Message list */}
      <div style={styles.messageList}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>
              Ask anything about agriculture in {district?.name} —
              crop advisories, disease treatments, or market prices.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggested chips */}
      <div style={styles.chips}>
        {chips.map((chip, i) => (
          <button key={i} style={styles.chip} onClick={() => sendMessage(chip)}>
            {chip}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={styles.inputBar}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={`Ask about ${district?.name || 'this district'}...`}
          disabled={loading}
          style={styles.input}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{ ...styles.sendBtn, opacity: (loading || !input.trim()) ? 0.4 : 1 }}
        >
          Send
        </button>
      </div>

      <div style={styles.disclaimer}>
        Generated from BAMIS bulletins + Gemini 2.5 Flash · Not a substitute for official DAE guidance
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const isError = msg.role === 'error';

  if (isUser) {
    return (
      <div style={styles.userBubbleRow}>
        <div style={styles.userBubble}>
          <span style={styles.bubbleText}>{msg.text}</span>
          <span style={styles.timestamp}>{formatTime(msg.ts)}</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={styles.aiBubbleRow}>
        <div style={styles.errorBubble}>
          <span style={{ color: 'var(--text-danger)', fontSize: 12 }}>Error: {msg.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.aiBubbleRow}>
      <div style={styles.aiAvatar}>
        <span style={styles.aiDot} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '78%' }}>
        {/* Query type badge */}
        {msg.queryType && <QueryTypeBadge type={msg.queryType} />}

        {/* AI bubble with markdown */}
        <div style={styles.aiBubble}>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.7, fontSize: 13 }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{children}</strong>,
              li: ({ children }) => <li style={{ fontSize: 13, lineHeight: 1.7, marginLeft: 16 }}>{children}</li>,
              ul: ({ children }) => <ul style={{ margin: '4px 0' }}>{children}</ul>,
            }}
          >
            {msg.text}
          </ReactMarkdown>
        </div>

        {/* Image thumbnails */}
        {msg.sourceImages?.length > 0 && (
          <div style={styles.imageRow}>
            {msg.sourceImages.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt="BAMIS disease reference"
                  style={styles.thumbnail}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </a>
            ))}
          </div>
        )}

        {/* Source links */}
        {msg.sourceLinks?.length > 0 && (
          <div style={styles.sourceLinks}>
            {msg.sourceLinks.slice(0, 3).map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noreferrer" style={styles.sourceLink}>
                {link.label} ↗
              </a>
            ))}
          </div>
        )}

        <span style={styles.timestamp}>{formatTime(msg.ts)}</span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={styles.aiBubbleRow}>
      <div style={styles.aiAvatar}><span style={styles.aiDot} /></div>
      <div style={{ ...styles.aiBubble, padding: '12px 16px' }}>
        <div style={styles.typingDots}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ ...styles.dot, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QueryTypeBadge({ type }) {
  const labels = {
    advisory: { label: 'District Advisory', color: '#00e676', bg: 'rgba(0, 230, 118, 0.15)', border: '1px solid rgba(0, 230, 118, 0.4)' },
    general:  { label: 'General Knowledge', color: '#ffd54f', bg: 'rgba(255, 213, 79, 0.15)', border: '1px solid rgba(255, 213, 79, 0.4)' },
    market:   { label: 'Market Price', color: '#4fc3f7', bg: 'rgba(79, 195, 247, 0.15)', border: '1px solid rgba(79, 195, 247, 0.4)' },
  };
  const { label, color, bg, border } = labels[type] || labels.advisory;
  return (
    <span style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: bg, color, border, alignSelf: 'flex-start', fontWeight: 600, letterSpacing: '0.5px' }}>
      {label}
    </span>
  );
}

function getSuggestedChips(district) {
  if (!district) return [];
  const hasFlood = district.activeAlerts?.some(a => a.type === 'flood');
  const hasPest  = district.activeAlerts?.some(a => a.type === 'pest');
  return [
    'কী কী রোগ আছে?',
    hasPest ? 'কীটনাশক পরামর্শ দাও' : 'কী ফসল চাষ করা যাবে?',
    hasFlood ? 'বন্যার প্রভাব কী?' : 'সার ব্যবস্থাপনা',
    'What are the current pest risks?',
  ];
}

function formatTime(date) {
  return date?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) || '';
}

// Inline styles — matching globals.css dark theme variables
const styles = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: 'var(--bg-primary)', borderTop: '1px solid var(--border)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  aiDot: { width: 8, height: 8, borderRadius: '50%', background: '#00ff88', display: 'inline-block',
            boxShadow: '0 0 6px #00ff88' },
  headerTitle: { fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' },
  headerDistrict: { fontSize: 12, color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' },
  headerSub: { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  messageList: {
    flex: 1, overflowY: 'auto', padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  emptyState: { textAlign: 'center', padding: '40px 0' },
  emptyText: { color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 },
  userBubbleRow: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: {
    background: 'var(--accent-blue, #2563eb)', color: '#ffffff',
    borderRadius: '16px 16px 4px 16px', padding: '10px 14px',
    maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 4,
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },
  aiBubbleRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  aiAvatar: { width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-card)',
               border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
               justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  aiBubble: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: '4px 16px 16px 16px', padding: '12px 16px',
    color: 'var(--text-primary)', lineHeight: 1.7,
  },
  errorBubble: {
    background: 'var(--bg-danger)', border: '1px solid var(--border-danger)',
    borderRadius: '4px 16px 16px 16px', padding: '10px 14px',
  },
  bubbleText: { fontSize: 13, lineHeight: 1.6 },
  timestamp: { fontSize: 10, color: 'var(--text-muted)', alignSelf: 'flex-end' },
  imageRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  thumbnail: {
    width: 80, height: 80, objectFit: 'cover', borderRadius: 6,
    border: '1px solid var(--border)', cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  sourceLinks: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  sourceLink: {
    fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '2px 7px',
  },
  typingDots: { display: 'flex', gap: 4, alignItems: 'center' },
  dot: {
    width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
    animation: 'bounce 1.2s infinite',
  },
  chips: { display: 'flex', gap: 8, padding: '10px 24px', flexWrap: 'wrap', flexShrink: 0 },
  chip: {
    fontSize: 11, padding: '5px 12px', borderRadius: 99,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s',
  },
  inputBar: {
    display: 'flex', gap: 12, padding: '16px 24px',
    borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0,
  },
  input: { 
    flex: 1, fontSize: 14, padding: '12px 16px', borderRadius: 8, 
    border: '1px solid var(--border)', background: 'var(--bg-primary)', 
    color: 'var(--text-primary)', outline: 'none',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
  },
  sendBtn: {
    background: 'var(--accent-blue, #2563eb)', color: '#ffffff', border: 'none',
    borderRadius: 8, padding: '0 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'opacity 0.2s',
  },
  disclaimer: {
    textAlign: 'center', fontSize: 10, color: 'var(--text-muted)',
    padding: '6px 0 10px', flexShrink: 0,
  },
};
