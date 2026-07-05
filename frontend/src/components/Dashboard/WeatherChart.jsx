import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

export default function WeatherChart({ liveWeather }) {
  if (!liveWeather?.forecastDates) {
    return (
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          No weather data
        </span>
      </div>
    );
  }

  const data = liveWeather.forecastDates.map((date, i) => ({
    date: date.slice(5), // "MM-DD"
    precip: liveWeather.precipitationSum7Day?.[i] ?? 0,
    tempMax: liveWeather.tempMax7Day?.[i] ?? 0,
    tempMin: liveWeather.tempMin7Day?.[i] ?? 0,
  }));

  return (
    <div>
      <div className="panel-label" style={{ marginBottom: 8 }}>7-DAY FORECAST</div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="precipGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#1e3a5f" strokeDasharray="3 3" />

          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false}
          />

          {/* Heavy rain reference line at 10mm */}
          <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1}
            label={{ value: '10mm', fill: '#ef4444', fontSize: 9, fontFamily: 'JetBrains Mono' }}
          />

          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono',
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />

          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}
          />

          <Area
            type="monotone" dataKey="precip" name="Precip (mm)"
            stroke="#3b82f6" fill="url(#precipGrad)" strokeWidth={1.5}
          />
          <Area
            type="monotone" dataKey="tempMax" name="Temp Max °C"
            stroke="#f59e0b" fill="url(#tempGrad)" strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}