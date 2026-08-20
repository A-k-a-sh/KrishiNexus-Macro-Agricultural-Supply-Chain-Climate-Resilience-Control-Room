import React from 'react';
import { motion } from 'framer-motion';
import ReportGenerator from '../components/Reports/ReportGenerator';

export default function Reports() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 tracking-tight">
            Automated Reports
          </h1>
          <p className="mt-4 text-slate-400 max-w-2xl mx-auto text-lg">
            Generate consolidated PDF reports containing climate risks, advisories, logistics, and market data for field distribution.
          </p>
        </motion.div>

        {/* Generator Component */}
        <ReportGenerator />

      </div>
    </div>
  );
}
