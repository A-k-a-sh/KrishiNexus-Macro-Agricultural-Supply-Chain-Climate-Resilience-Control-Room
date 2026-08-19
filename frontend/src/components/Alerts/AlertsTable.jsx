import AlertRow from './AlertRow';

export default function AlertsTable({ alerts, onAcknowledge }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-medium text-slate-200">No alerts found</h3>
        <p className="text-slate-400 text-sm text-center max-w-md mt-2">
          There are no alerts matching the current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm shadow-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-800/80 border-b border-slate-700/80">
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th>
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Alert Type</th>
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Crop Affected</th>
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Severity</th>
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Raised At</th>
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <AlertRow 
              key={alert._id} 
              alert={alert} 
              onAcknowledge={onAcknowledge} 
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
