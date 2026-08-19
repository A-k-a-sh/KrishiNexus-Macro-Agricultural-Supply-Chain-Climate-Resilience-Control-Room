import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function PriceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No price data available for chart.
      </div>
    );
  }

  // Pre-process data to display Top 15 highest priced items to prevent chart clutter
  const sortedData = [...data].sort((a, b) => b.pricePerKg - a.pricePerKg).slice(0, 15);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-emerald-500/30 shadow-2xl p-4 rounded-xl">
          <p className="text-emerald-400 font-bold mb-1">{p.commodity}</p>
          <p className="text-slate-200">
            Price: <span className="text-white font-semibold">{p.pricePerKg} {p.currency} / KG</span>
          </p>
          <p className="text-slate-400 text-sm mt-2">Source: {p.source}</p>
          <p className="text-slate-500 text-xs mt-1">{p.marketName}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#047857" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="commodity"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickMargin={15}
            angle={-45}
            textAnchor="end"
            height={70}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `৳${value}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
          <Bar dataKey="pricePerKg" radius={[6, 6, 0, 0]}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="url(#colorPrice)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
