import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function RiskTrendChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-slate-500 text-center py-8">No risk trend data available for this period.</div>;
  }

  return (
    <div className="h-[400px] w-full mt-4 overflow-x-auto custom-scrollbar">
      <div style={{ width: Math.max(800, data.length * 40), height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="districtName" 
              stroke="#94a3b8" 
              angle={-45} 
              textAnchor="end"
              height={70}
              tick={{ fill: '#94a3b8', fontSize: 12 }} 
              interval={0}
            />
            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.75rem', color: '#f8fafc' }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="redDays" name="High Risk (Red)" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
          <Bar dataKey="yellowDays" name="Medium Risk (Yellow)" stackId="a" fill="#f59e0b" />
          <Bar dataKey="greenDays" name="Low Risk (Green)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
