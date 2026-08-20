import React from 'react';

export default function IngestionHealth({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-slate-500 text-center py-8">No ingestion logs available.</div>;
  }

  return (
    <div className="space-y-4">
      {data.map((log) => (
        <div key={log._id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-800/30">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                log.status === 'partial' ? 'bg-yellow-500/10 text-yellow-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {log.status}
              </span>
              <span className="font-semibold text-white">{log.jobName}</span>
            </div>
            <div className="text-sm text-slate-400">
              Processed: <span className="text-slate-200 font-medium">{log.documentsProcessed || 0}</span> documents
            </div>
            {log.errors && log.errors.length > 0 && (
              <div className="mt-2 text-xs text-red-400 max-h-20 overflow-y-auto pr-2">
                {log.errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-slate-500 sm:min-w-[120px]">
            <div>Started:</div>
            <div className="text-slate-300 mb-1">{new Date(log.startedAt).toLocaleString()}</div>
            {log.completedAt && (
              <div>
                Duration: <span className="text-slate-400">{((new Date(log.completedAt) - new Date(log.startedAt)) / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
