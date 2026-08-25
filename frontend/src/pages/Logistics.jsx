import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { calcLogistics, dispatchCargo, genManifest, getWarehouseStocks, getDispatchRecords } from '../api';

const CROPS = ['Rice', 'Wheat', 'Onion', 'Beans', 'Cabbage', 'Cauliflower', 'Garlic', 'Laushak', 'Radish', 'Tomato'];

const CROP_ICONS = {
  Rice: '🌾',
  Wheat: '🍞',
  Onion: '🧅',
  Beans: '🫘',
  Cabbage: '🥬',
  Cauliflower: '🥦',
  Garlic: '🧄',
  Laushak: '🌿',
  Radish: '🥕',
  Tomato: '🍅',
};

const SCENARIO_PRESETS = [
  { label: 'Mild (10%)', value: 0.10, desc: 'Localized weather anomaly' },
  { label: 'Standard (25%)', value: 0.25, desc: 'Seasonal monsoon stress' },
  { label: 'Severe (50%)', value: 0.50, desc: 'Major flash flood / cyclone' },
  { label: 'Catastrophic (75%)', value: 0.75, desc: 'Multi-division crop failure' },
];

export default function Logistics() {
  const { allDistricts, selectedDistrict } = useAppContext();

  const [districtId, setDistrictId]             = useState(selectedDistrict?._id || '');
  const [crop, setCrop]                         = useState('Rice');
  const [severity, setSeverity]                 = useState(0.25);
  const [plan, setPlan]                         = useState(null);
  const [calcLoading, setCalcLoading]           = useState(false);
  const [cargoWeight, setCargoWeight]           = useState('');
  const [manifest, setManifest]                 = useState('');
  const [manifestLoading, setManifestLoading]   = useState(false);
  const [manifestCopied, setManifestCopied]     = useState(false);
  const [dispatching, setDispatching]           = useState(false);
  const [dispatched, setDispatched]             = useState(false);
  const [stocks, setStocks]                     = useState([]);
  const [records, setRecords]                   = useState([]);
  
  // Table search & filter states
  const [activeTab, setActiveTab]               = useState('stocks'); // 'stocks' | 'records'
  const [stockSearch, setStockSearch]           = useState('');
  const [stockCropFilter, setStockCropFilter]   = useState('all');

  const district = allDistricts.find((d) => d._id === districtId);

  // Sync from global selectedDistrict if present or select first available
  useEffect(() => {
    if (selectedDistrict?._id) {
      setDistrictId(selectedDistrict._id);
    } else if (allDistricts.length > 0 && !districtId) {
      setDistrictId(allDistricts[0]._id);
    }
  }, [selectedDistrict, allDistricts]);

  // Load warehouse stocks + dispatch records on mount
  useEffect(() => {
    fetchStocksAndRecords();
  }, []);

  const fetchStocksAndRecords = () => {
    getWarehouseStocks()
      .then(({ data }) => setStocks(data.data || []))
      .catch((err) => console.error('Failed to fetch warehouse stocks:', err));
    getDispatchRecords()
      .then(({ data }) => setRecords(data.data || []))
      .catch((err) => console.error('Failed to fetch dispatch records:', err));
  };

  // Auto-calculate on initial load or when districtId or crop changes
  useEffect(() => {
    if (districtId && crop) {
      handleCalculate(districtId, crop, severity);
    }
  }, [districtId, crop]);

  // Live client-side calculations (slider preview before API calculation)
  const baselineMtons = plan?.baselineMtons ?? 0;
  const projectedDeficit = +(baselineMtons * severity).toFixed(2);
  const pricePressure = plan?.pricePressurePct ?? +(severity * 72).toFixed(1);
  const priceSource = plan?.priceDataSource ?? 'modelled';

  const severityPct = (severity * 100).toFixed(0);
  const severityColor =
    severity >= 0.5 ? '#ef4444' : severity >= 0.25 ? '#f59e0b' : '#10b981';

  async function handleCalculate(targetDistrictId = districtId, targetCrop = crop, targetSeverity = severity) {
    const dId = targetDistrictId || districtId;
    if (!dId) return;
    setCalcLoading(true);
    setManifest('');
    setDispatched(false);
    try {
      const { data } = await calcLogistics({
        districtId: dId,
        crop: targetCrop || crop,
        severityFactor: targetSeverity ?? severity,
      });
      setPlan(data.data);
      setCargoWeight(String(data.data.recommendedCargo || ''));
    } catch (err) {
      console.error('Calculation failed:', err);
    } finally {
      setCalcLoading(false);
    }
  }

  async function handleGenManifest() {
    if (!plan) return;
    setManifestLoading(true);
    setManifestCopied(false);
    try {
      const { data } = await genManifest({
        fromDivision: plan.surplusDivision?.divisionName,
        toDistrict: plan.districtName,
        crop,
        cargoWeightMtons: parseFloat(cargoWeight) || plan.recommendedCargo,
        reason: `Climate severity factor ${(severity * 100).toFixed(0)}% causing ${projectedDeficit} M.Ton projected deficit in ${plan.districtName}`,
      });
      setManifest(data.manifestText);
    } catch (err) {
      alert('Manifest generation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setManifestLoading(false);
    }
  }

  async function handleCopyManifest() {
    if (!manifest) return;
    try {
      await navigator.clipboard.writeText(manifest);
      setManifestCopied(true);
      setTimeout(() => setManifestCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy manifest:', err);
    }
  }

  async function handleDispatch() {
    if (!plan || !plan.surplusDivision) return;
    setDispatching(true);
    try {
      await dispatchCargo({
        fromDivisionId: plan.surplusDivision.divisionId,
        toDistrictId: districtId,
        crop,
        cargoWeightMtons: parseFloat(cargoWeight) || plan.recommendedCargo,
        severityFactor: severity,
        projectedDeficit,
        aiManifestText: manifest || null,
      });
      setDispatched(true);
      fetchStocksAndRecords();
    } catch (err) {
      alert('Dispatch failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDispatching(false);
    }
  }

  // Filtered warehouse stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      const matchSearch =
        s.divisionName?.toLowerCase().includes(stockSearch.toLowerCase()) ||
        s.crop?.toLowerCase().includes(stockSearch.toLowerCase());
      const matchCrop = stockCropFilter === 'all' || s.crop === stockCropFilter;
      return matchSearch && matchCrop;
    });
  }, [stocks, stockSearch, stockCropFilter]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pt-24 pb-16 px-4 sm:px-6 lg:px-8 selection:bg-emerald-500 selection:text-slate-950">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-10 w-[30rem] h-[30rem] bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* ── Top Header Section ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              National Logistics Control Runtime
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Supply Chain Optimizer
            </h1>
            <p className="mt-2 text-slate-400 max-w-3xl text-base sm:text-lg">
              Haversine-routed grain reallocation across Bangladesh's 8 strategic division warehouses. Simulates climate shortfalls and routes safety reserves with live market telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50" />
              <div className="text-xs">
                <span className="text-slate-400 block font-mono">SYSTEM STATUS</span>
                <span className="text-emerald-400 font-bold font-mono">FLEET READY</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Mission Control & Selector Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              {/* District Selector */}
              <div className="relative group">
                <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 ml-1">
                  Target Deficit District
                </label>
                <div className="relative">
                  <select
                    value={districtId}
                    onChange={(e) => {
                      setDistrictId(e.target.value);
                    }}
                    className="w-full bg-slate-950/80 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 text-white rounded-2xl py-3 px-4 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none cursor-pointer transition-all text-sm font-medium"
                  >
                    <option value="">— Select Target District —</option>
                    {allDistricts.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} {d.bnName ? `(${d.bnName})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Commodity Selector with Distinct Icons */}
              <div className="relative group">
                <label className="block text-xs font-semibold text-teal-400 uppercase tracking-wider mb-2 ml-1">
                  Strategic Commodity
                </label>
                <div className="relative">
                  <select
                    value={crop}
                    onChange={(e) => {
                      setCrop(e.target.value);
                    }}
                    className="w-full bg-slate-950/80 border border-slate-700 hover:border-slate-600 focus:border-teal-500 text-white rounded-2xl py-3 px-4 shadow-inner focus:outline-none focus:ring-2 focus:ring-teal-500/30 appearance-none cursor-pointer transition-all text-sm font-medium"
                  >
                    {CROPS.map((c) => (
                      <option key={c} value={c}>
                        {CROP_ICONS[c] || '🌱'} {c}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <div className="flex items-end">
              <button
                onClick={() => handleCalculate(districtId, crop, severity)}
                disabled={!districtId || calcLoading}
                className={`w-full lg:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 shadow-xl flex items-center justify-center gap-3 ${
                  !districtId || calcLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {calcLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Optimizing Route...</span>
                  </>
                ) : (
                  <>
                    <span className="text-base">⚡</span>
                    <span>Recalculate Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Dual Command Grid: Zone A & Zone B ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ═══════════════════════════════════════════════════════════
              ZONE A: DEFICIT & RISK ASSESSMENT
          ═══════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-sm shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            {/* Ambient accent top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <h2 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
                    ZONE A · Deficit & Risk Assessment
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  {district ? `${district.name} District` : 'No Target Selected'}
                </span>
              </div>

              {/* 2x2 Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
                {/* 1. BBS Baseline Yield */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-700">
                  <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    BBS BASELINE YIELD
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {baselineMtons ? `${baselineMtons.toLocaleString()}` : (calcLoading ? '...' : '—')}
                    <span className="text-xs text-slate-400 font-normal ml-1">M.Ton</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
                    Historical baseline production
                  </div>
                </div>

                {/* 2. Projected Shortfall */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-700">
                  <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    PROJECTED SHORTFALL
                  </div>
                  <div className={`text-2xl font-bold font-mono ${severity >= 0.4 ? 'text-red-400' : 'text-amber-400'}`}>
                    {baselineMtons ? `${projectedDeficit.toLocaleString()}` : (calcLoading ? '...' : '—')}
                    <span className="text-xs font-normal ml-1 opacity-80">M.Ton</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${severity >= 0.4 ? 'bg-red-400' : 'bg-amber-400'} inline-block`} />
                    {severityPct}% climate penalty yield loss
                  </div>
                </div>

                {/* 3. Climate Severity Factor */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-700">
                  <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    CLIMATE SEVERITY
                  </div>
                  <div className="text-2xl font-bold font-mono" style={{ color: severityColor }}>
                    {severityPct}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: severityColor }} />
                    Simulated impact coefficient
                  </div>
                </div>

                {/* 4. Price Pressure */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-700">
                  <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>PRICE PRESSURE</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        priceSource === 'WFP'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : priceSource === 'DAM'
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {priceSource === 'WFP' ? 'WFP' : priceSource === 'DAM' ? 'DAM' : 'EST'}
                    </span>
                  </div>
                  <div
                    className={`text-2xl font-bold font-mono ${
                      pricePressure >= 20 ? 'text-red-400' : pricePressure >= 10 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {baselineMtons ? `${pricePressure > 0 ? '+' : ''}${pricePressure}%` : (calcLoading ? '...' : '—')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    {priceSource === 'WFP'
                      ? 'Real market data · WFP/HDX'
                      : priceSource === 'DAM'
                      ? 'Real market data · DAM'
                      : 'Modelled estimate · no market data'}
                  </div>
                </div>
              </div>

              {priceSource === 'modelled' && !calcLoading && (
                <div className="mt-3 text-[11px] text-slate-400 font-mono flex items-center gap-1.5 bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-800/50">
                  <span className="text-amber-400">ℹ</span>
                  Modelled price estimate active for unlisted commodities or regional outliers.
                </div>
              )}
            </div>

            {/* Severity Slider & Scenario Controls */}
            <div className="space-y-4 pt-4 border-t border-slate-800/80">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  Simulate Climate Severity
                </span>
                <span
                  className="font-mono text-sm font-bold px-2.5 py-0.5 rounded-lg border"
                  style={{
                    color: severityColor,
                    borderColor: `${severityColor}40`,
                    backgroundColor: `${severityColor}15`,
                  }}
                >
                  {severityPct}% PENALTY
                </span>
              </div>

              {/* Slider with styled track */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="0.75"
                  step="0.01"
                  value={severity}
                  onChange={(e) => setSeverity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #f59e0b 35%, #ef4444 100%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0% Normal Yield</span>
                  <span>25% Moderate Flood</span>
                  <span>50% Severe Cyclone</span>
                  <span>75% Catastrophic</span>
                </div>
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {SCENARIO_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setSeverity(p.value);
                      handleCalculate(districtId, crop, p.value);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-mono font-medium transition-all text-center border ${
                      Math.abs(severity - p.value) < 0.001
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE B: AUTOMATED LOGISTICS ENGINE
          ═══════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-sm shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            {/* Ambient accent top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500" />

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
                  </span>
                  <h2 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
                    ZONE B · Automated Routing Engine
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  Haversine Efficiency Score
                </span>
              </div>

              {/* State: Empty Prompt */}
              {!plan && !calcLoading && (
                <div className="my-10 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-2xl mb-4 text-emerald-400 shadow-inner">
                    🧭
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Logistics Solver Standby
                  </h3>
                  <p className="text-slate-400 text-xs max-w-sm">
                    Select a target district and crop, then click <strong className="text-emerald-400">Calculate Logistics Plan</strong> to compute the optimal surplus division supplier and routing dispatch.
                  </p>
                </div>
              )}

              {/* State: Loading Skeletons */}
              {calcLoading && (
                <div className="my-6 space-y-3.5">
                  <div className="h-28 bg-slate-800/40 rounded-2xl animate-pulse border border-slate-800" />
                  <div className="h-14 bg-slate-800/40 rounded-2xl animate-pulse border border-slate-800" />
                  <div className="h-20 bg-slate-800/40 rounded-2xl animate-pulse border border-slate-800" />
                </div>
              )}

              {/* State: Active Calculated Plan */}
              {plan && !calcLoading && !dispatched && (
                <div className="mt-5 space-y-4">
                  {plan.surplusDivision ? (
                    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/30 border border-teal-500/30 rounded-2xl p-4.5 shadow-lg relative overflow-hidden">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                          RECOMMENDED SUPPLY ROUTE
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-semibold">
                          {plan.distanceKm ? `~${plan.distanceKm} km transit` : 'Distance unknown'}
                        </span>
                      </div>

                      {/* Route Path Graphic */}
                      <div className="flex items-center justify-between my-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                        <div className="text-left">
                          <span className="text-[10px] font-mono text-slate-400 block uppercase">ORIGIN WAREHOUSE</span>
                          <span className="text-sm font-bold text-white flex items-center gap-1.5">
                            🏢 {plan.surplusDivision.divisionName} Div
                          </span>
                          <span className="text-[10px] text-teal-400/80 font-mono">
                            {plan.surplusDivision.reserveMtons?.toLocaleString()} M.Ton stock
                          </span>
                        </div>

                        <div className="flex-1 flex flex-col items-center px-4">
                          <span className="text-[10px] text-slate-400 font-mono mb-1">
                            {plan.distanceKm ? `${plan.distanceKm} km` : '—'}
                          </span>
                          <div className="w-full flex items-center">
                            <div className="h-[2px] flex-1 bg-gradient-to-r from-teal-500 to-emerald-400 relative">
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                            <span className="text-emerald-400 text-xs ml-1">▶</span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono mt-1">Haversine direct</span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400 block uppercase">DEFICIT TARGET</span>
                          <span className="text-sm font-bold text-emerald-400 flex items-center justify-end gap-1.5">
                            📍 {plan.districtName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {projectedDeficit.toLocaleString()} M.Ton deficit
                          </span>
                        </div>
                      </div>

                      {/* Metric specs */}
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono">
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-400 text-[11px]">Commodity:</span>
                          <span className="text-white font-bold">{CROP_ICONS[crop] || '🌾'} {crop}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-400 text-[11px]">Recommended:</span>
                          <span className="text-emerald-400 font-bold">
                            {plan.recommendedCargo?.toLocaleString()} M.Ton
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-xs">
                      ⚠ No surplus division warehouse found with available reserves for {crop}.
                    </div>
                  )}

                  {/* Cargo Weight Input & Adjuster */}
                  {plan.surplusDivision && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                          Cargo Weight To Dispatch (M.Ton)
                        </label>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Max safe cap: {(plan.surplusDivision.reserveMtons * 0.3).toLocaleString()} M.Ton (30%)
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={cargoWeight}
                          onChange={(e) => setCargoWeight(e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-700 focus:border-teal-500 text-white rounded-xl py-2.5 px-4 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="Enter cargo weight"
                        />
                        <button
                          onClick={() => setCargoWeight(String(plan.recommendedCargo))}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-xl border border-slate-700 transition-colors"
                        >
                          Auto ({plan.recommendedCargo})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* AI Manifest Generator & Dispatch Actions */}
                  {plan.surplusDivision && (
                    <div className="space-y-3 pt-2">
                      <button
                        onClick={handleGenManifest}
                        disabled={manifestLoading}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold tracking-wider uppercase font-mono flex items-center justify-center gap-2 transition-all hover:border-slate-600"
                      >
                        {manifestLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            <span>Synthesizing Cryptographic Manifest...</span>
                          </>
                        ) : (
                          <>
                            <span>📄</span>
                            <span>Generate AI Shipping Manifest</span>
                          </>
                        )}
                      </button>

                      {/* Manifest Card Display */}
                      <AnimatePresence>
                        {manifest && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4.5 font-mono text-xs text-amber-200/90 leading-relaxed relative overflow-hidden shadow-2xl"
                          >
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-500/20">
                              <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">
                                📋 OFFICIAL CARGO MANIFEST DISPATCH ORDER
                              </span>
                              <button
                                onClick={handleCopyManifest}
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                              >
                                {manifestCopied ? '✓ Copied' : 'Copy Text'}
                              </button>
                            </div>
                            <div className="whitespace-pre-wrap text-[11px] font-mono text-slate-300">
                              {manifest}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        onClick={handleDispatch}
                        disabled={dispatching}
                        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm tracking-wide transition-all duration-300 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                      >
                        {dispatching ? (
                          <>
                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            <span>Routing Supply Fleet...</span>
                          </>
                        ) : (
                          <>
                            <span>🚛</span>
                            <span>Approve & Route Supply Chain</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* State: Dispatched Confirmation */}
              {dispatched && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="my-5 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/50 rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400 text-xl shadow-inner">
                    ✓
                  </div>
                  <h3 className="text-lg font-bold text-emerald-400 mb-1">
                    FLEET DISPATCH INITIATED
                  </h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Cargo allocation authorized. Supply convoy of <strong>{cargoWeight || plan?.recommendedCargo} M.Ton {crop}</strong> is now en route from <strong>{plan?.surplusDivision?.divisionName} Division</strong> to <strong>{plan?.districtName}</strong>.
                  </p>

                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>CONVOY TELEMETRY</span>
                      <span className="text-emerald-400">IN TRANSIT</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 w-full animate-pulse" />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-center">
                    <button
                      onClick={() => {
                        setDispatched(false);
                        setPlan(null);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-xl border border-slate-700 transition-colors"
                    >
                      Plan Another Route
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            ZONE C: NATIONAL WAREHOUSE STOCKS & RECENT DISPATCH LEDGER
        ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm shadow-xl"
        >
          {/* Header + Tabs + Search */}
          <div className="p-6 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
                  National Division Reserves & Dispatch Ledger
                </h2>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  ⚠ SIMULATED INVENTORY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time visibility into 24 division warehouse reserves and recent automated dispatch operations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Tab Switcher */}
              <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800">
                <button
                  onClick={() => setActiveTab('stocks')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'stocks'
                      ? 'bg-emerald-600/90 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Warehouse Stocks ({stocks.length})
                </button>
                <button
                  onClick={() => setActiveTab('records')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'records'
                      ? 'bg-teal-600/90 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Recent Dispatches ({records.length})
                </button>
              </div>

              {/* Table search filter if in stocks view */}
              {activeTab === 'stocks' && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter division or crop..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs text-white rounded-xl py-2 pl-3.5 pr-8 focus:outline-none focus:border-emerald-500 w-48 transition-colors"
                  />
                  <span className="absolute right-2.5 top-2 text-slate-500 text-xs">🔍</span>
                </div>
              )}
            </div>
          </div>

          {/* Tab 1: Warehouse Stocks Table */}
          {activeTab === 'stocks' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 font-mono font-semibold select-none border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Strategic Division</th>
                    <th className="px-6 py-4">Commodity</th>
                    <th className="px-6 py-4">Available Reserve</th>
                    <th className="px-6 py-4">Inventory Health Status</th>
                    <th className="px-6 py-4 text-right">Last Synchronized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-mono">
                  {filteredStocks.map((s) => {
                    const isCritical = s.reserveMtons < 10000;
                    const isLow = s.reserveMtons >= 10000 && s.reserveMtons < 20000;
                    const statusLabel = isCritical ? 'Critical' : isLow ? 'Low Reserve' : 'Adequate';
                    const statusColor = isCritical
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : isLow
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

                    const percentCapacity = Math.min(100, Math.round((s.reserveMtons / 40000) * 100));

                    return (
                      <tr key={s._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-sans font-medium text-white flex items-center gap-2">
                          <span className="text-slate-500 text-xs">🏢</span>
                          <span>{s.divisionName} Division</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-teal-300 text-xs border border-slate-700/60 font-sans font-medium">
                            {CROP_ICONS[s.crop] || '🌱'} {s.crop}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">
                            {s.reserveMtons?.toLocaleString()} <span className="text-xs text-slate-400 font-normal">M.Ton</span>
                          </div>
                          <div className="w-32 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className={`h-full ${
                                isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${percentCapacity}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-slate-400">
                          {s.lastUpdated ? new Date(s.lastUpdated).toLocaleDateString() : 'Auto-synced'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStocks.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-400 text-xs font-sans">
                        No warehouse inventory matching your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Recent Dispatch Ledger Table */}
          {activeTab === 'records' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 font-mono font-semibold select-none border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Dispatch Timestamp</th>
                    <th className="px-6 py-4">Origin Division</th>
                    <th className="px-6 py-4">Deficit Destination</th>
                    <th className="px-6 py-4">Commodity</th>
                    <th className="px-6 py-4">Cargo Allocation</th>
                    <th className="px-6 py-4">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-mono">
                  {records.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : 'Recent'}
                      </td>
                      <td className="px-6 py-4 text-white font-sans font-medium">
                        {r.fromDivisionName} Div
                      </td>
                      <td className="px-6 py-4 text-emerald-400 font-sans font-medium">
                        {r.toDistrictName} District
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-teal-300 text-xs border border-slate-700/60 font-sans">
                          {CROP_ICONS[r.crop] || '🌱'} {r.crop}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-white">
                        {r.cargoWeightMtons?.toLocaleString()} <span className="text-xs text-slate-400 font-normal">M.Ton</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {r.status?.toUpperCase() || 'DISPATCHED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 text-xs font-sans">
                        No dispatch operations logged yet in this deployment session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}