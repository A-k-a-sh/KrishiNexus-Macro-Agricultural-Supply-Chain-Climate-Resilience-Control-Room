import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DispatchMap({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-slate-500 text-center py-8">No dispatch records found.</div>;
  }

  // format data for the chart: route name "Division -> District"
  const chartData = data.map(item => ({
    route: `${item.fromDivisionName} → ${item.toDistrictName}`,
    totalMtons: item.totalMtons,
    crop: item.crop,
    count: item.count
  }));

  return (
    <div className="h-[400px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis 
            dataKey="route" 
            type="category" 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 12 }} 
            width={100}
          />
          <Tooltip 
            cursor={{ fill: '#1e293b' }}
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.75rem', color: '#f8fafc' }}
          />
          <Bar dataKey="totalMtons" name="Total Metric Tons" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
