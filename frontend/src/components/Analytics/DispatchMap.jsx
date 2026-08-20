import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
        <p className="text-white font-bold mb-2">{label}</p>
        <p className="text-emerald-400 text-sm"><span className="text-slate-400">Crop:</span> {data.crop}</p>
        <p className="text-blue-400 text-sm"><span className="text-slate-400">Amount:</span> {data.totalMtons} M.Tons</p>
        <p className="text-slate-300 text-sm"><span className="text-slate-400">Dispatches:</span> {data.count}</p>
        {data.latestDate && (
          <p className="text-slate-300 text-sm"><span className="text-slate-400">Latest:</span> {new Date(data.latestDate).toLocaleDateString()}</p>
        )}
      </div>
    );
  }
  return null;
};

export default function DispatchMap({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-slate-500 text-center py-8">No dispatch records found.</div>;
  }

  // format data for the chart: route name "Division -> District"
  const chartData = data.map(item => ({
    route: `${item.fromDivisionName} → ${item.toDistrictName}`,
    totalMtons: item.totalMtons,
    crop: item.crop,
    count: item.count,
    latestDate: item.latestDate
  }));

  return (
    <div className="h-[400px] w-full mt-4 overflow-x-auto custom-scrollbar">
      <div style={{ width: Math.max(600, chartData.length * 80), height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="route" 
              stroke="#94a3b8" 
              tick={{ fill: '#94a3b8', fontSize: 12 }} 
              angle={-45}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis 
              type="number" 
              stroke="#94a3b8" 
              tick={{ fill: '#94a3b8', fontSize: 12 }} 
              allowDecimals={false} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
            <Bar dataKey="totalMtons" name="Total Metric Tons" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
