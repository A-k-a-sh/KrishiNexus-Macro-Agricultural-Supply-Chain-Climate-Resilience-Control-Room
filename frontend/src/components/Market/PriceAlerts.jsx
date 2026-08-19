import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function PriceAlerts({ data }) {
  const alerts = useMemo(() => {
    if (!data || data.length === 0) return [];

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

    const discrepancies = [];
    Object.values(commodityMap).forEach(c => {
      if (c.DAM !== null && c.WFP !== null) {
        const diff = Math.abs(c.DAM - c.WFP);
        const avg = (c.DAM + c.WFP) / 2;
        const percentDiff = (diff / avg) * 100;
        
        // Alert if discrepancy > 15%
        if (percentDiff > 15) {
          discrepancies.push({
            ...c,
            diff,
            percentDiff,
            severity: percentDiff > 30 ? 'critical' : 'warning'
          });
        }
      }
    });

    return discrepancies.sort((a, b) => b.percentDiff - a.percentDiff);
  }, [data]);

  if (alerts.length === 0) {
    return null; // Don't render anything if no alerts
  }

  return (
    <div className="w-full mt-2 mb-6">
      <div className="flex items-center mb-4">
        <span className="relative flex h-3 w-3 mr-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
        </span>
        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Volatility Alerts</h2>
      </div>

      <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide">
        {alerts.map((alert, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`min-w-[280px] rounded-2xl p-5 border backdrop-blur-md relative overflow-hidden group ${
              alert.severity === 'critical'
                ? 'bg-rose-950/40 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                : 'bg-amber-950/40 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
            }`}
          >
            {/* Glow effect */}
            <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 rounded-full blur-2xl opacity-40 ${
              alert.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
            }`}></div>

            <div className="flex justify-between items-start mb-3">
              <h3 className="text-white font-bold">{alert.commodity}</h3>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                alert.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {alert.percentDiff.toFixed(1)}% DIFF
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs uppercase mb-1">DAM Avg</p>
                <p className="text-white font-mono font-medium">৳{alert.DAM}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase mb-1">WFP Market</p>
                <p className="text-white font-mono font-medium">৳{alert.WFP}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
