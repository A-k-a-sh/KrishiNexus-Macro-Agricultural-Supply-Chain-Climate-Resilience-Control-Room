import { useEffect, useState } from 'react';

const RISK_COLOR = { red: '#ef4444', yellow: '#f59e0b', green: '#00ff88' };

export default function DistrictTooltip({ district, upazila, shapeName, x, y }) {
  const [pos, setPos] = useState({ left: x + 14, top: y - 10 });

  useEffect(() => {
    // Keep tooltip inside viewport
    const padding = 12;
    const tooltipW = 200;
    const tooltipH = 100;
    let left = x + 14;
    let top  = y - 10;
    if (left + tooltipW > window.innerWidth - padding)  left = x - tooltipW - 8;
    if (top  + tooltipH > window.innerHeight - padding) top  = y - tooltipH - 8;
    setPos({ left, top });
  }, [x, y]);

  const target = upazila || district;
  const riskColor = target ? (RISK_COLOR[target.riskStatus] || '#94a3b8') : '#94a3b8';

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 1000,
        background: 'var(--bg-surface)',
        border: `1px solid ${riskColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        minWidth: 180,
        pointerEvents: 'none',
        boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 8px ${riskColor}44`,
      }}
    >
      {target ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: riskColor, flexShrink: 0,
                boxShadow: `0 0 6px ${riskColor}`,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
              {target.name} {upazila && <span style={{fontSize: 10, color: 'var(--text-muted)'}}>(Upazila)</span>}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
            {target.bnName}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
            <Row label="Status"  value={target.riskStatus?.toUpperCase()} color={riskColor} />
            <Row label="Temp"    value={target.liveWeather?.tempMaxToday != null ? `${target.liveWeather.tempMaxToday}°C` : 'N/A'} />
            <Row label="Humidity" value={target.liveWeather?.humidityMaxToday != null ? `${target.liveWeather.humidityMaxToday}%` : 'N/A'} />
            <Row label="Alerts"  value={target.activeAlerts?.length ?? 0} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {shapeName || 'Unknown region'}
          <div style={{ fontSize: 10, marginTop: 4 }}>Not in database</div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ fontSize: 11, color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}