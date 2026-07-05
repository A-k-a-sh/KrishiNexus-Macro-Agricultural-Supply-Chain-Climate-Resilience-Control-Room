import WeatherChart from './WeatherChart';

const RISK_COLOR = { red: '#ef4444', yellow: '#f59e0b', green: '#00ff88' };

export default function TelemetryPanel({ district }) {
  if (!district) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'center', paddingTop: 32 }}>
        ← Select a district on the map
      </div>
    );
  }

  const w = district.liveWeather || {};
  const riskColor = RISK_COLOR[district.riskStatus] || '#94a3b8';

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* District header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor, boxShadow: `0 0 6px ${riskColor}`, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{district.name}</span>
          <span className={`badge badge-${district.riskStatus || 'green'}`} style={{ fontSize: 9 }}>
            {(district.riskStatus || 'stable').toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', paddingLeft: 16 }}>
          {district.bnName} · Division {district.divisionId}
        </div>
      </div>

      {/* Live metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricCard label="MAX TEMP" value={w.tempMaxToday != null ? `${w.tempMaxToday}°C` : 'N/A'} color="#f59e0b" />
        <MetricCard label="MIN TEMP" value={w.tempMinToday != null ? `${w.tempMinToday}°C` : 'N/A'} color="#3b82f6" />
        <MetricCard label="HUMIDITY" value={w.humidityMaxToday != null ? `${w.humidityMaxToday}%` : 'N/A'} color="#8b5cf6" />
        <MetricCard label="ALERTS"   value={district.activeAlerts?.length ?? 0} color={riskColor} />
      </div>

      {/* Weather chart */}
      <WeatherChart liveWeather={w} />

      {/* Active alerts */}
      {district.activeAlerts?.length > 0 && (
        <div>
          <div className="panel-label">ACTIVE ECO-HAZARD ALERTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {district.activeAlerts.map((alert, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--accent-red-bg)',
                  border: '1px solid var(--accent-red)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  fontSize: 11,
                }}
              >
                <div style={{ color: 'var(--accent-red)', fontWeight: 600, marginBottom: 2 }}>
                  ⚠ {alert.label}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                  {alert.cropAffected} · {alert.severity?.toUpperCase()}
                </div>
                {alert.triggerReason && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3 }}>
                    {alert.triggerReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active crops */}
      {district.activeCrops?.length > 0 && (
        <div>
          <div className="panel-label">ACTIVE CROPS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {district.activeCrops.map((c, i) => (
              <span key={i} className="badge badge-blue" style={{ fontSize: 10 }}>
                {c.crop}{c.stage ? ` · ${c.stage}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '8px 10px',
    }}>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}