import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getDistricts, generateReport } from '../../api';

export default function ReportGenerator() {
  const [districts, setDistricts] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [reportType, setReportType] = useState('district');
  const [config, setConfig] = useState({
    includeWeather: true,
    includeAdvisory: true,
    includeLogistics: true,
    includeMarket: true
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDistricts()
      .then(res => {
        const dArray = res.data.data || [];
        setDistricts(dArray);
        if (dArray.length > 0) {
          setTargetId(dArray[0]._id);
        }
      })
      .catch(err => console.error("Error loading districts", err));
  }, []);

  const handleCheckboxChange = (field) => {
    setConfig(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        reportType,
        targetId,
        ...config
      };
      const response = await generateReport(payload);
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Get filename from header if possible, else fallback
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'krishinexus-report.pdf';
      if (contentDisposition && contentDisposition.includes('filename="')) {
        filename = contentDisposition.split('filename="')[1].split('"')[0];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error(err);
      setError('Could not generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm max-w-2xl mx-auto"
    >
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mr-4">
          <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Generate PDF Report</h2>
          <p className="text-slate-400 text-sm">Download aggregated insights for offline use</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-6">
        
        {/* Target Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Report Level</label>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  value="district"
                  checked={reportType === 'district'}
                  onChange={(e) => setReportType(e.target.value)}
                  className="form-radio text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <span className="text-slate-300">District</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer opacity-50" title="Coming soon">
                <input 
                  type="radio" 
                  value="upazila"
                  disabled
                  className="form-radio text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <span className="text-slate-300">Upazila</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Select District</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="block w-full bg-slate-950 border border-slate-700 text-white rounded-xl py-3 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none cursor-pointer"
            >
              {districts.map(d => (
                <option key={d._id} value={d._id}>{d.name} ({d.bnName})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Configurations */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">Include Sections</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${config.includeWeather ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
              <input 
                type="checkbox" 
                checked={config.includeWeather}
                onChange={() => handleCheckboxChange('includeWeather')}
                className="form-checkbox h-5 w-5 text-emerald-500 rounded border-slate-700 bg-slate-900 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span className="ml-3 text-slate-200 font-medium">Weather Summary</span>
            </label>

            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${config.includeAdvisory ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
              <input 
                type="checkbox" 
                checked={config.includeAdvisory}
                onChange={() => handleCheckboxChange('includeAdvisory')}
                className="form-checkbox h-5 w-5 text-emerald-500 rounded border-slate-700 bg-slate-900 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span className="ml-3 text-slate-200 font-medium">Active Alerts & Crops</span>
            </label>

            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${config.includeMarket ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
              <input 
                type="checkbox" 
                checked={config.includeMarket}
                onChange={() => handleCheckboxChange('includeMarket')}
                className="form-checkbox h-5 w-5 text-emerald-500 rounded border-slate-700 bg-slate-900 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span className="ml-3 text-slate-200 font-medium">Market Prices</span>
            </label>

            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${config.includeLogistics ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
              <input 
                type="checkbox" 
                checked={config.includeLogistics}
                onChange={() => handleCheckboxChange('includeLogistics')}
                className="form-checkbox h-5 w-5 text-emerald-500 rounded border-slate-700 bg-slate-900 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span className="ml-3 text-slate-200 font-medium">Logistics Dispatches</span>
            </label>

          </div>
        </div>

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !targetId}
            className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg shadow-lg transition-all ${
              loading || !targetId 
                ? 'bg-slate-700 cursor-not-allowed opacity-70' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 transform hover:-translate-y-1'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating PDF...
              </span>
            ) : 'Generate & Download PDF'}
          </button>
        </div>

      </form>
    </motion.div>
  );
}
