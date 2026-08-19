import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getDistricts, getLatestMarketPrices } from '../api';
import PriceChart from '../components/Market/PriceChart';
import ComparisonChart from '../components/Market/ComparisonChart';
import PriceAlerts from '../components/Market/PriceAlerts';

export default function Market() {
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Table state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'commodity', direction: 'asc' });

  useEffect(() => {
    getDistricts()
      .then(res => {
        const districtsArray = res.data.data || [];
        setDistricts(districtsArray);
        if (districtsArray.length > 0) {
          // Default to Dhaka (district id usually 40 or 1 in bdapi, let's just pick the first)
          const dhaka = districtsArray.find(d => d.name && d.name.toLowerCase() === 'dhaka');
          const defaultId = dhaka ? dhaka._id : districtsArray[0]._id;
          setSelectedDistrict(defaultId);
        }
      })
      .catch(err => {
        console.error('Failed to fetch districts', err);
        setError('Could not load districts.');
      });
  }, []);

  useEffect(() => {
    if (!selectedDistrict) return;
    setLoading(true);
    setError(null);
    getLatestMarketPrices(selectedDistrict)
      .then(res => {
        setPrices(res.data);
      })
      .catch(err => {
        console.error('Failed to fetch prices', err);
        setError('Failed to load market prices.');
      })
      .finally(() => setLoading(false));
  }, [selectedDistrict]);

  const wfpPrices = prices.filter(p => p.source === 'WFP');
  const damPrices = prices.filter(p => p.source === 'DAM');

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredPrices = React.useMemo(() => {
    let result = [...prices];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => p.commodity.toLowerCase().includes(lower) || (p.marketName && p.marketName.toLowerCase().includes(lower)));
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [prices, searchTerm, sortConfig]);

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="ml-1 opacity-20">↕</span>;
    return <span className="ml-1 text-emerald-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

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
              Market Intelligence
            </h1>
            <p className="mt-2 text-slate-400 max-w-2xl text-lg">
              Real-time agricultural commodity prices synced across WFP and DAM.
            </p>
          </div>

          <div className="w-full md:w-72 relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative">
              <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 ml-1">
                Select District
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="block w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer transition-colors"
              >
                {districts.map(d => (
                  <option key={d._id} value={d._id}>{d.name} ({d.bnName})</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
            {error}
          </div>
        )}

        <PriceAlerts data={prices} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm"
            >
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <span className="w-2 h-6 bg-emerald-500 rounded-full mr-3"></span>
                Top Commodities Overview
              </h2>
              
              {loading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <PriceChart data={prices} />
              )}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm"
            >
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <span className="w-2 h-6 bg-teal-500 rounded-full mr-3"></span>
                DAM vs WFP Source Comparison
              </h2>
              
              {loading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
                </div>
              ) : (
                <ComparisonChart data={prices} />
              )}
            </motion.div>
          </div>

          {/* Stats Sidebar */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
              <h3 className="text-emerald-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Commodities</h3>
              <p className="text-5xl font-extrabold text-white">{prices.length}</p>
              <div className="mt-4 flex items-center text-sm text-emerald-200/70">
                <span>Updated today</span>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
              <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4">Data Sources</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <span className="text-slate-300 font-medium">DAM Average</span>
                  <span className="bg-teal-500/20 text-teal-400 py-1 px-3 rounded-full text-xs font-bold">{damPrices.length} Items</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-medium">WFP Market</span>
                  <span className="bg-blue-500/20 text-blue-400 py-1 px-3 rounded-full text-xs font-bold">{wfpPrices.length} Items</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Detailed Data Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm"
        >
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white flex items-center">
              <span className="w-2 h-6 bg-blue-500 rounded-full mr-3"></span>
              Price Index Table
            </h2>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search commodities or markets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-sm text-white rounded-full py-2 pl-4 pr-10 focus:outline-none focus:border-emerald-500 w-64 transition-colors"
                />
                <svg className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-sm text-slate-500">{prices.length > 0 ? prices[0].date : 'N/A'}</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/50 text-slate-400 font-semibold select-none">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('commodity')}>
                    Commodity <SortIcon columnKey="commodity" />
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('pricePerKg')}>
                    Price / KG <SortIcon columnKey="pricePerKg" />
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('source')}>
                    Source <SortIcon columnKey="source" />
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('marketName')}>
                    Market Details <SortIcon columnKey="marketName" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {sortedAndFilteredPrices.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{p.commodity}</td>
                    <td className="px-6 py-4 font-bold text-emerald-400">৳ {p.pricePerKg}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.source === 'DAM' ? 'bg-teal-500/10 text-teal-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {p.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{p.marketName}</td>
                  </tr>
                ))}
                {sortedAndFilteredPrices.length === 0 && !loading && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      No price data found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
        
      </div>
    </div>
  );
}
