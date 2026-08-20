import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRiskTrends, getDispatchSummary, getIngestionHealth } from '../api';
import RiskTrendChart from '../components/Analytics/RiskTrendChart';
import DispatchMap from '../components/Analytics/DispatchMap';
import IngestionHealth from '../components/Analytics/IngestionHealth';

export default function Analytics() {
  const [riskDays, setRiskDays] = useState(90);
  const [dispatchDays, setDispatchDays] = useState(30);
  
  const [riskData, setRiskData] = useState([]);
  const [dispatchData, setDispatchData] = useState([]);
  const [healthData, setHealthData] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [risk, dispatch, health] = await Promise.all([
          getRiskTrends(riskDays),
          getDispatchSummary(dispatchDays),
          getIngestionHealth(20)
        ]);
        setRiskData(risk || []);
        setDispatchData(dispatch || []);
        setHealthData(health || []);
      } catch (err) {
        console.error('Failed to load analytics data', err);
        setError('Failed to load analytics data. Ensure you have admin privileges.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [riskDays, dispatchDays]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 tracking-tight">
              System Analytics
            </h1>
            <p className="mt-2 text-slate-400 max-w-2xl text-lg">
              Monitor climate risk trends, logistics efficiency, and ingestion pipeline health.
            </p>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
            {error}
          </div>
        )}

        {/* Charts Area */}
        <div className="space-y-8">
          
          {/* Risk Trends */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center">
                <span className="w-2 h-6 bg-red-500 rounded-full mr-3"></span>
                Historical Risk Trends
              </h2>
              <div className="relative">
                <select
                  value={riskDays}
                  onChange={(e) => setRiskDays(Number(e.target.value))}
                  className="appearance-none bg-slate-900 border border-slate-700 text-emerald-400 rounded-xl py-2 pl-4 pr-10 focus:outline-none focus:border-emerald-500 text-sm font-semibold transition-colors cursor-pointer shadow-inner"
                >
                  <option value={30}>Last 30 Days</option>
                  <option value={60}>Last 60 Days</option>
                  <option value={90}>Last 90 Days</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
              </div>
            ) : (
              <RiskTrendChart data={riskData} />
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Dispatch Summary */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl flex flex-col"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <span className="w-2 h-6 bg-blue-500 rounded-full mr-3"></span>
                  Logistics Routes
                </h2>
                <div className="relative">
                  <select
                    value={dispatchDays}
                    onChange={(e) => setDispatchDays(Number(e.target.value))}
                    className="appearance-none bg-slate-900 border border-slate-700 text-emerald-400 rounded-xl py-2 pl-4 pr-10 focus:outline-none focus:border-emerald-500 text-sm font-semibold transition-colors cursor-pointer shadow-inner"
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                    <option value={90}>Last 90 Days</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="h-[400px] flex flex-1 items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="flex-1">
                  <DispatchMap data={dispatchData} />
                </div>
              )}
            </motion.div>

            {/* Ingestion Health */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl flex flex-col"
            >
              <div className="border-b border-slate-800 pb-4 mb-6">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <span className="w-2 h-6 bg-emerald-500 rounded-full mr-3"></span>
                  Ingestion Pipeline Health
                </h2>
              </div>
              
              {loading ? (
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                  <IngestionHealth data={healthData} />
                </div>
              )}
            </motion.div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
