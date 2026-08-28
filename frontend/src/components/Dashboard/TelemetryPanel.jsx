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
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor, boxShadow: `0 0 8px ${riskColor}`, flexShrink: 0 }} />
          <span className="text-lg font-bold text-slate-100 tracking-tight">{target.name} {upazila && <span className="text-xs font-normal text-slate-500 ml-1 tracking-normal">(Upazila)</span>}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            target.riskStatus === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
            target.riskStatus === 'yellow' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}>
            {(target.riskStatus || 'stable').toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-slate-500 font-mono pl-4">
          {target.bnName} {district && !upazila && `· Division ${district.divisionId}`}
        </div>
      </div>

      {/* Live climate metric cards */}
      <div>
        <div className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase mb-2 mt-2">CLIMATE TELEMETRY</div>
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
      <div className="mt-2">
        <div className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase mb-2">SOIL COMPOSITION DYNAMICS</div>
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
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden mt-1">
          <div className="flex justify-between text-[10px] font-mono text-slate-500 font-semibold tracking-wider uppercase mb-1">
            <span>PRIMARY NUTRIENTS</span>
            <span>TARGET OPTIMAL</span>
          </div>
          <NutrientRow label="Nitrogen (N)" value={npk.n} max={80} color="#3b82f6" />
          <NutrientRow label="Phosphorus (P)" value={npk.p} max={50} color="#10b981" />
          <NutrientRow label="Potassium (K)" value={npk.k} max={70} color="#f59e0b" />
        </div>
      </div>

      {/* Agricultural Economic Indices */}
      <div className="mt-2">
        <div className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase mb-2">AGRICULTURAL ECONOMIC INDICES</div>
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
        <div className="mt-2">
          <div className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase mb-2">ACTIVE ECO-HAZARD ALERTS</div>
          <div className="flex flex-col gap-2">
            {target.activeAlerts.map((alert, i) => (
              <div
                key={i}
                className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 backdrop-blur-sm"
              >
                <div className="text-red-400 font-semibold text-xs mb-1 flex items-center gap-1.5">
                  <span className="animate-pulse">⚠</span> {alert.label}
                </div>
                <div className="text-slate-300 text-[11px] font-medium">
                  {alert.cropAffected} · {alert.severity?.toUpperCase()}
                </div>
                {alert.triggerReason && (
                  <div className="text-slate-500 text-[10px] mt-1.5 leading-relaxed">
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
        <div className="mt-2">
          <div className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase mb-2">ACTIVE CROPS</div>
          <div className="flex flex-wrap gap-2">
            {target.activeCrops.map((c, i) => (
              <span key={i} className="bg-blue-900/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm">
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
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2 relative overflow-hidden group hover:bg-slate-800/40 transition-colors">
      <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 opacity-10 rounded-full blur-xl" style={{ background: color }}></div>
      <div className="text-[9px] font-mono tracking-widest text-slate-400 font-semibold uppercase">
        {label}
      </div>
      <div className="flex justify-between items-baseline z-10">
        <span className="text-lg font-mono font-extrabold tracking-tight" style={{ color }}>
          {value}
        </span>
        {subText && (
          <span className="text-[10px] font-mono text-slate-500 font-medium">
            {subText}
          </span>
        )}
      </div>
      {series && (
        <div className="mt-1 z-10">
          <Sparkline series={series} color={color} />
        </div>
      )}
    </div>
  );
}

function NutrientRow({ label, value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-bold">{value} ppm</span>
      </div>
      <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden shadow-inner">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}80` }} />
      </div>
    </div>
  );
}