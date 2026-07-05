export default function RiskLegend() {
  const items = [
    { color: '#ef4444', label: 'Severe Risk' },
    { color: '#f59e0b', label: 'Warning'     },
    { color: '#00ff88', label: 'Stable'      },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>
        DISTRICT RISK
      </div>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}88`, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}