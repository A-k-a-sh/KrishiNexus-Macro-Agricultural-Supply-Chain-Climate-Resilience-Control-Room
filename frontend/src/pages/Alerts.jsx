import { useState, useEffect } from 'react';
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
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-8 pt-24 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Alert Management
            </h1>
            <p className="text-slate-400 mt-1 text-sm md:text-base">
              Monitor and acknowledge regional climate and pest alerts.
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex flex-col items-center bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              <span className="text-xl font-bold text-red-400">{activeHigh}</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active High</span>
            </div>
            <div className="flex flex-col items-center bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
              <span className="text-xl font-bold text-amber-400">{activeMedium}</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Med</span>
            </div>
            {statusFilter === 'acknowledged' && (
              <div className="flex flex-col items-center bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
                <span className="text-xl font-bold text-slate-300">{acknowledged}</span>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ack'd</span>
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-4 items-center p-4 bg-slate-900/40 border border-slate-800 rounded-xl backdrop-blur-sm">
          <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${statusFilter === 'active' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Active Alerts
            </button>
            <button
              onClick={() => setStatusFilter('acknowledged')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${statusFilter === 'acknowledged' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Acknowledged
            </button>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Severities</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
          </select>
          
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
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

        {/* Content */}
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <AlertsTable alerts={alerts} onAcknowledge={handleAcknowledge} />
        )}
      </div>
    </div>
  );
}
