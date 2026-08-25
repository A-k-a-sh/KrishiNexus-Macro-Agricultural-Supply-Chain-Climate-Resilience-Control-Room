import { useId } from 'react';
import WeatherChart from './WeatherChart';
import { sparklinePoints } from './sparklineGeometry';

const RISK_COLOR = { red: '#ef4444', yellow: '#f59e0b', green: '#00ff88' };

// Inset the sparkline path from the SVG edges so the stroke and the last-point
// dot aren't clipped.
const PAD = 2;

export default function TelemetryPanel({ district, upazila }) {
  const target = upazila || district;
  
  if (!target) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'center', paddingTop: 32 }}>
        ← Select a region on the map
      </div>
    );
  }

  const w = target.liveWeather || {};
  const riskColor = RISK_COLOR[target.riskStatus] || '#94a3b8';
  const idNum = parseInt(target._id) || 1;

  const rain7Day = Array.isArray(w.precipitationSum7Day)
    ? +w.precipitationSum7Day.reduce((sum, v) => sum + (Number(v) || 0), 0).toFixed(1)
    : null;

  // ── Deterministic Soil Dynamics ──────────────────────────────────────────
  const soilPh = +(5.6 + (idNum % 7) * 0.2).toFixed(1); // Realistic soil pH (5.6 - 6.8)
  // Higher salinity (EC) for coastal divisions (division 1 & 4)
  const isCoastal = district && (district.divisionId === '1' || district.divisionId === '4');
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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{target.name} {upazila && <span style={{fontSize: 10, color: 'var(--text-muted)'}}>(Upazila)</span>}</span>
          <span className={`badge badge-${target.riskStatus || 'green'}`} style={{ fontSize: 9 }}>
            {(target.riskStatus || 'stable').toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', paddingLeft: 16 }}>
          {target.bnName} {district && !upazila && `· Division ${district.divisionId}`}
        </div>
      </div>

      {/* Live climate metric cards */}
      <div>
        <div className="panel-label">CLIMATE TELEMETRY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MetricCard
            label="MAX TEMP"
            value={w.tempMaxToday != null ? `${w.tempMaxToday}°C` : 'N/A'}
            color="#f59e0b"
            series={w.tempMax7Day}
          />
          <MetricCard
            label="HUMIDITY"
            value={w.humidityMaxToday != null ? `${w.humidityMaxToday}%` : 'N/A'}
            color="#8b5cf6"
          />
          <MetricCard
            label="MIN TEMP"
            value={w.tempMinToday != null ? `${w.tempMinToday}°C` : 'N/A'}
            color="#22d3ee"
            series={w.tempMin7Day}
          />
          <MetricCard
            label="RAIN · 7 DAY"
            value={rain7Day != null ? `${rain7Day} mm` : 'N/A'}
            color="#3b82f6"
            series={w.precipitationSum7Day}
          />
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
      {target.activeAlerts?.length > 0 && (
        <div>
          <div className="panel-label">ACTIVE ECO-HAZARD ALERTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {target.activeAlerts.map((alert, i) => (
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
      {target.activeCrops?.length > 0 && (
        <div>
          <div className="panel-label">ACTIVE CROPS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {target.activeCrops.map((c, i) => (
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

// A 7-point trend line, drawn by hand rather than with another recharts instance:
// at this size the axes, tooltip and legend a chart brings are all cost and no
// signal — the shape of the week is the whole message. The last point is marked
// so "where we are now" reads at a glance.
function Sparkline({ series, color, width = 96, height = 22 }) {
  // useId keeps the gradient unique per instance — two cards sharing a colour
  // would otherwise emit duplicate SVG ids into the document.
  const gradientId = `spark${useId().replace(/:/g, '')}`;
  const geometry = sparklinePoints(series, width, height, PAD);
  if (!geometry) return null;

  const { xs, ys } = geometry;
  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const lastX = xs[xs.length - 1];
  const lastY = ys[ys.length - 1];

  return (
    <svg
      width="100%" height={height} viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none" aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${lastX.toFixed(1)},${height} L${PAD},${height} Z`} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="1.9" fill={color} />
    </svg>
  );
}

function MetricCard({ label, value, color, subText, series }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
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
      {series && <Sparkline series={series} color={color} />}
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