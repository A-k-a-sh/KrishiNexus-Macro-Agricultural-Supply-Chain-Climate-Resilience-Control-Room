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
  const idNum = parseInt(district._id) || 1;

  // ── Deterministic Soil Dynamics ──────────────────────────────────────────
  const soilPh = +(5.6 + (idNum % 7) * 0.2).toFixed(1); // Realistic soil pH (5.6 - 6.8)
  // Higher salinity (EC) for coastal divisions (division 1 & 4)
  const isCoastal = district.divisionId === '1' || district.divisionId === '4';
  const soilSalinity = isCoastal 
    ? +(3.2 + (idNum % 6) * 0.9).toFixed(1) // High salinity: 3.2 - 7.7 dS/m
    : +(0.6 + (idNum % 4) * 0.3).toFixed(1); // Low salinity: 0.6 - 1.5 dS/m
  
  const npk = {
    n: (idNum % 8) * 6 + 25,  // Nitrogen ppm
    p: (idNum % 6) * 4 + 12,  // Phosphorus ppm
    k: (idNum % 9) * 5 + 18   // Potassium ppm
  };

  // ── Deterministic Economic & Cost Indices ──────────────────────────────────
  const cropMarketIndex = +(105.4 + (idNum % 10) * 1.8).toFixed(1); // 105.4 - 121.6 (Base: 100)
  const marketChange = +((idNum % 3 === 0) ? -1.2 - (idNum % 3) : 0.8 + (idNum % 4) * 0.6).toFixed(1);
  const inputCostIndex = +(120.1 + (idNum % 8) * 2.5).toFixed(1); // 120.1 - 137.6

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

      {/* Live climate metric cards */}
      <div>
        <div className="panel-label">CLIMATE TELEMETRY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MetricCard label="MAX TEMP" value={w.tempMaxToday != null ? `${w.tempMaxToday}°C` : 'N/A'} color="#f59e0b" />
          <MetricCard label="HUMIDITY" value={w.humidityMaxToday != null ? `${w.humidityMaxToday}%` : 'N/A'} color="#8b5cf6" />
        </div>
      </div>

      {/* Weather chart */}
      <WeatherChart liveWeather={w} />

      {/* Soil Composition Dynamics */}
      <div>
        <div className="panel-label">SOIL COMPOSITION DYNAMICS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <MetricCard 
            label="SOIL PH" 
            value={soilPh} 
            color={soilPh < 6.0 ? '#ef4444' : '#00ff88'} 
            subText={soilPh < 6.0 ? 'Acidic' : 'Optimal'}
          />
          <MetricCard 
            label="SALINITY (EC)" 
            value={`${soilSalinity} dS/m`} 
            color={soilSalinity > 2.0 ? '#ef4444' : '#00ff88'} 
            subText={soilSalinity > 2.0 ? 'Saline Warning' : 'Stable'}
          />
        </div>
        
        {/* N-P-K Nutrient Bar Graphs */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            <span>PRIMARY NUTRIENTS</span>
            <span>TARGET OPTIMAL</span>
          </div>
          <NutrientRow label="Nitrogen (N)" value={npk.n} max={80} color="#3b82f6" />
          <NutrientRow label="Phosphorus (P)" value={npk.p} max={50} color="#10b981" />
          <NutrientRow label="Potassium (K)" value={npk.k} max={70} color="#f59e0b" />
        </div>
      </div>

      {/* Agricultural Economic Indices */}
      <div>
        <div className="panel-label">AGRICULTURAL ECONOMIC INDICES</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MetricCard 
            label="CROP MARKET INDEX" 
            value={cropMarketIndex} 
            color="#00ff88"
            subText={
              <span style={{ color: marketChange < 0 ? '#ef4444' : '#00ff88' }}>
                {marketChange < 0 ? '▼' : '▲'} {Math.abs(marketChange)}%
              </span>
            }
          />
          <MetricCard 
            label="INPUT COST INDEX" 
            value={inputCostIndex} 
            color="#3b82f6" 
            subText="Inflation baseline"
          />
        </div>
      </div>

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

function MetricCard({ label, value, color, subText }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '8px 10px',
      display: 'flex', flexDirection: 'column', justify: 'space-between'
    }}>
      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>
          {value}
        </span>
        {subText && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {subText}
          </span>
        )}
      </div>
    </div>
  );
}

function NutrientRow({ label, value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value} ppm</span>
      </div>
      <div style={{ height: 4, background: '#0e1726', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}