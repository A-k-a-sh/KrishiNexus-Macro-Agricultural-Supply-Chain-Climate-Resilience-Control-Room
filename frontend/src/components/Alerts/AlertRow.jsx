import { useState } from 'react';

export default function AlertRow({ alert, onAcknowledge }) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [notes, setNotes] = useState('');

  const handleAcknowledge = async () => {
    await onAcknowledge(alert._id, notes);
    setIsAcknowledging(false);
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'high':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/50">High</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50">Medium</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/50">Low</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/50">{severity}</span>;
    }
  };

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
      <td className="px-6 py-5">
        <div className="font-medium text-slate-200">{alert.sourceName}</div>
        <div className="text-xs text-slate-400 capitalize">{alert.sourceType}</div>
      </td>
      <td className="px-6 py-5">
        <div className="text-sm text-slate-200">{alert.label}</div>
        <div className="text-xs text-slate-400">{alert.alertType}</div>
      </td>
      <td className="px-6 py-5 text-sm text-slate-300">{alert.cropAffected}</td>
      <td className="px-6 py-5">{getSeverityBadge(alert.severity)}</td>
      <td className="px-6 py-5 text-sm text-slate-300">
        {new Date(alert.raisedAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-5">
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${alert.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-500/20 text-slate-400 border-slate-500/50'}`}>
          {alert.status}
        </span>
      </td>
      <td className="px-6 py-5">
        {alert.status === 'active' && (
          isAcknowledging ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Notes..."
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-emerald-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                onClick={handleAcknowledge}
                className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setIsAcknowledging(false)}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
             <button
              onClick={() => setIsAcknowledging(true)}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 rounded hover:bg-emerald-600/30 transition-colors"
            >
              Acknowledge
            </button>
          )
        )}
        {alert.status === 'acknowledged' && alert.notes && (
          <div className="text-xs text-slate-400 truncate max-w-[150px]" title={alert.notes}>
            📝 {alert.notes}
          </div>
        )}
      </td>
    </tr>
  );
}
