import AlertRow from './AlertRow';

export default function AlertsTable({ alerts, onAcknowledge }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-slate-900/40 rounded-3xl border border-slate-800 backdrop-blur-sm">
        <div className="text-5xl mb-4 opacity-80">✅</div>
        <h3 className="text-xl font-bold text-slate-200">No alerts found</h3>
        <p className="text-slate-400 text-sm text-center max-w-md mt-2">
          Everything looks great! There are no alerts matching the current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 font-semibold select-none border-b border-slate-800/80">
            <tr>
              <th className="px-6 py-5">Location</th>
              <th className="px-6 py-5">Alert Type</th>
              <th className="px-6 py-5">Crop Affected</th>
              <th className="px-6 py-5">Severity</th>
              <th className="px-6 py-5">Raised At</th>
              <th className="px-6 py-5">Status</th>
              <th className="px-6 py-5">Actions</th>
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
    </div>
  );
}
