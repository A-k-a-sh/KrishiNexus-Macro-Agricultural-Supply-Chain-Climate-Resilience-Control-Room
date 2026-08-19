import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function ComparisonChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group prices by commodity
    const commodityMap = {};
    data.forEach(item => {
      if (!commodityMap[item.commodity]) {
        commodityMap[item.commodity] = { commodity: item.commodity, DAM: null, WFP: null };
      }
      if (item.source === 'DAM') {
        commodityMap[item.commodity].DAM = item.pricePerKg;
      } else if (item.source === 'WFP') {
        commodityMap[item.commodity].WFP = item.pricePerKg;
      }
    });

    // Filter only commodities that have both DAM and WFP prices
    const overlapping = Object.values(commodityMap).filter(c => c.DAM !== null && c.WFP !== null);

    // Sort by largest discrepancy
    overlapping.sort((a, b) => Math.abs(b.DAM - b.WFP) - Math.abs(a.DAM - a.WFP));

    // Limit to top 10 to avoid clutter
    return overlapping.slice(0, 10);
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-6 text-center">
        <svg className="w-12 h-12 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>No overlapping commodities found between DAM and WFP for this district to compare.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 shadow-2xl p-4 rounded-xl">
          <p className="text-white font-bold mb-3 border-b border-slate-700 pb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-6 mb-1">
              <span className="flex items-center text-sm" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }}></span>
                {entry.name}
              </span>
              <span className="text-white font-semibold text-sm">৳{entry.value}</span>
            </div>
          ))}
          {payload.length === 2 && (
            <div className="mt-3 pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
              <span>Discrepancy:</span>
              <span className="text-rose-400 font-bold">
                ৳{Math.abs(payload[0].value - payload[1].value).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <defs>
            <linearGradient id="colorDAM" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="colorWFP" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.6} />
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.5 }} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="DAM" name="DAM Average" fill="url(#colorDAM)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="WFP" name="WFP Market" fill="url(#colorWFP)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
