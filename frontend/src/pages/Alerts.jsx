import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAlerts, acknowledgeAlert } from '../api';
import AlertsTable from '../components/Alerts/AlertsTable';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (severityFilter) filters.severity = severityFilter;
      if (divisionFilter) filters.divisionId = divisionFilter;
      
      const data = await getAlerts(statusFilter, filters);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter, divisionFilter]);

  const handleAcknowledge = async (alertId, notes) => {
    try {
      await acknowledgeAlert(alertId, notes);
      fetchAlerts(); // Refresh the list
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    }
  };

  const activeHigh = alerts.filter(a => a.status === 'active' && a.severity === 'high').length;
  const activeMedium = alerts.filter(a => a.status === 'active' && a.severity === 'medium').length;
  const acknowledged = alerts.filter(a => a.status === 'acknowledged').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        >
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent tracking-tight">
              Alert Management
            </h1>
            <p className="text-slate-400 mt-2 text-lg max-w-2xl">
              Monitor and acknowledge regional climate and pest alerts.
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-red-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative flex flex-col items-center bg-slate-900 border border-red-500/30 rounded-xl px-5 py-3">
                <span className="text-2xl font-bold text-red-400">{activeHigh}</span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Active High</span>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-amber-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative flex flex-col items-center bg-slate-900 border border-amber-500/30 rounded-xl px-5 py-3">
                <span className="text-2xl font-bold text-amber-400">{activeMedium}</span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Active Med</span>
              </div>
            </div>
            
            {statusFilter === 'acknowledged' && (
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-slate-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative flex flex-col items-center bg-slate-900 border border-slate-700 rounded-xl px-5 py-3">
                  <span className="text-2xl font-bold text-slate-300">{acknowledged}</span>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Ack'd</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Filter Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-4 items-center p-5 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-sm"
        >
          <div className="flex bg-slate-950 rounded-xl p-1.5 border border-slate-800/80">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${statusFilter === 'active' ? 'bg-emerald-600/90 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
            >
              Active Alerts
            </button>
            <button
              onClick={() => setStatusFilter('acknowledged')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${statusFilter === 'acknowledged' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
            >
              Acknowledged
            </button>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden md:block"></div>

          <div className="relative group flex-1 min-w-[200px] max-w-xs">
            <label className="absolute -top-2.5 left-3 bg-slate-900 px-1 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="block w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer transition-colors"
            >
              <option value="">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>
          </div>
          
          <div className="relative group flex-1 min-w-[200px] max-w-xs">
            <label className="absolute -top-2.5 left-3 bg-slate-900 px-1 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Division</label>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="block w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer transition-colors"
            >
              <option value="">All Divisions</option>
              <option value="1">Chattogram</option>
              <option value="2">Rajshahi</option>
              <option value="3">Khulna</option>
              <option value="4">Barisal</option>
              <option value="5">Sylhet</option>
              <option value="6">Dhaka</option>
              <option value="7">Rangpur</option>
              <option value="8">Mymensingh</option>
            </select>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {loading ? (
            <div className="flex justify-center items-center h-64 bg-slate-900/30 border border-slate-800 rounded-3xl">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <AlertsTable alerts={alerts} onAcknowledge={handleAcknowledge} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
