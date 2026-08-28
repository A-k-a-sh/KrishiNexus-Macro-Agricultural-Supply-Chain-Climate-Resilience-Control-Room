import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { postRagQuery } from '../../api';
import { useAppContext } from '../../context/AppContext';

export default function FullScreenChat({ district }) {
  const { selectDistrict } = useAppContext();
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

  function handleCloseChat() {
    selectDistrict(null);
    window.dispatchEvent(new CustomEvent('map-reset'));
  }

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
    <div className="flex flex-col h-[calc(100vh-48px)] bg-slate-950 border-t border-slate-800/60 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
          <span className="font-semibold text-slate-200">KrishiNexus AI</span>
          <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{district?.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline-block">
            Grounded in BAMIS official data
          </span>
          <button 
            onClick={handleCloseChat} 
            className="bg-slate-800/50 border border-slate-700 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-mono hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
          >
            ↩ Close Chat
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-6 scroll-smooth bg-slate-950">
        {messages.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center justify-center h-full opacity-50">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
              <span className="text-2xl">🌱</span>
            </div>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Ask anything about agriculture in <strong className="text-slate-300">{district?.name}</strong> —
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
      <div className="flex gap-2.5 px-6 py-3 flex-wrap shrink-0 bg-slate-950 border-t border-slate-900">
        {chips.map((chip, i) => (
          <button 
            key={i} 
            className="text-xs px-4 py-1.5 rounded-full bg-slate-800/40 border border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-slate-200 transition-all shadow-sm"
            onClick={() => sendMessage(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="flex gap-3 px-6 pt-2 pb-4 bg-slate-950 shrink-0">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Ask about ${district?.name || 'this district'}...`}
            disabled={loading}
            className="w-full text-sm px-5 py-3.5 rounded-2xl border border-slate-700/60 bg-slate-900/80 text-slate-200 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-500 shadow-inner"
          />
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className={`bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-2xl px-6 font-semibold text-sm shadow-[0_2px_10px_rgba(16,185,129,0.2)] transition-all hover:shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:pointer-events-none`}
        >
          Send
        </button>
      </div>

      <div className="text-center text-[10px] text-slate-500 pb-4 bg-slate-950 shrink-0 tracking-wider">
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
      <div className="flex justify-end w-full">
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 text-slate-100 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] flex flex-col gap-1 shadow-md border border-slate-700/50">
          <span className="text-[13px] leading-relaxed">{msg.text}</span>
          <span className="text-[9px] text-slate-400 self-end font-mono mt-1">{formatTime(msg.ts)}</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex gap-3 items-start">
        <div className="bg-red-950/40 border border-red-500/30 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%] shadow-sm">
          <span className="text-red-400 text-xs font-mono">Error: {msg.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start w-full">
      <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700/60 flex items-center justify-center shrink-0 mt-1 shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
      </div>
      <div className="flex flex-col gap-2 max-w-[80%]">
        {/* Query type badge */}
        {msg.queryType && <QueryTypeBadge type={msg.queryType} />}

        {/* AI bubble with markdown */}
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl rounded-tl-sm px-5 py-4 text-slate-300 leading-relaxed text-[13px] shadow-sm">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="m-0 mb-2 leading-relaxed text-[13px]">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
              li: ({ children }) => <li className="text-[13px] leading-relaxed ml-4 list-disc">{children}</li>,
              ul: ({ children }) => <ul className="my-1.5">{children}</ul>,
            }}
          >
            {msg.text}
          </ReactMarkdown>
        </div>

        {/* Image thumbnails */}
        {msg.sourceImages?.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-1">
            {msg.sourceImages.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-700/60 hover:border-emerald-500/50 transition-colors">
                <img
                  src={url}
                  alt="BAMIS disease reference"
                  className="w-20 h-20 object-cover"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </a>
            ))}
          </div>
        )}

        {/* Source links */}
        {msg.sourceLinks?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {msg.sourceLinks.slice(0, 3).map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 no-underline bg-slate-800/40 border border-slate-700/60 rounded px-2 py-0.5 hover:bg-slate-800 hover:text-emerald-400 transition-colors">
                {link.label} ↗
              </a>
            ))}
          </div>
        )}

        <span className="text-[10px] text-slate-500 font-mono mt-1">{formatTime(msg.ts)}</span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start w-full">
      <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700/60 flex items-center justify-center shrink-0 mt-1 shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
      </div>
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QueryTypeBadge({ type }) {
  const configs = {
    advisory: { label: 'District Advisory', classes: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    general:  { label: 'General Knowledge', classes: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    market:   { label: 'Market Price', classes: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  };
  const { label, classes } = configs[type] || configs.advisory;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-md border self-start font-semibold tracking-wide ${classes}`}>
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

