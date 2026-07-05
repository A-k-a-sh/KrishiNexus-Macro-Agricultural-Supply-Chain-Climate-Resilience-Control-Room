import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { calcLogistics, dispatchCargo, genManifest, getWarehouseStocks, getDispatchRecords } from '../api';

const CROPS = ['Rice', 'Wheat', 'Onion'];

export default function Logistics() {
  const { allDistricts, selectedDistrict, selectDistrict } = useAppContext();

  const [districtId, setDistrictId]       = useState(selectedDistrict?._id || '');
  const [crop, setCrop]                   = useState('Rice');
  const [severity, setSeverity]           = useState(0.25);
  const [plan, setPlan]                   = useState(null);
  const [calcLoading, setCalcLoading]     = useState(false);
  const [cargoWeight, setCargoWeight]     = useState('');
  const [manifest, setManifest]           = useState('');
  const [manifestLoading, setManifestLoading] = useState(false);
  const [dispatching, setDispatching]     = useState(false);
  const [dispatched, setDispatched]       = useState(false);
  const [stocks, setStocks]               = useState([]);
  const [records, setRecords]             = useState([]);

  const district = allDistricts.find((d) => d._id === districtId);

  // Sync from global selectedDistrict
  useEffect(() => {
    if (selectedDistrict) setDistrictId(selectedDistrict._id);
  }, [selectedDistrict]);

  // Load warehouse stocks + dispatch records on mount
  useEffect(() => {
    getWarehouseStocks().then(({ data }) => setStocks(data.data)).catch(() => {});
    getDispatchRecords().then(({ data }) => setRecords(data.data)).catch(() => {});
  }, []);

  // Live client-side calculations (no API call while slider moves)
  const baselineMtons = plan?.baselineMtons ?? 0;
  const projectedDeficit = +(baselineMtons * severity).toFixed(2);
  const pricePressure = +(severity * 72).toFixed(1);

  async function handleCalculate() {
    if (!districtId) return;
    setCalcLoading(true);
    setPlan(null);
    setManifest('');
    setDispatched(false);
    try {
      const { data } = await calcLogistics({ districtId, crop, severityFactor: severity });
      setPlan(data.data);
      setCargoWeight(String(data.data.recommendedCargo));
    } catch (err) {
      alert('Calculation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setCalcLoading(false);
    }
  }

  async function handleGenManifest() {
    if (!plan) return;
    setManifestLoading(true);
    try {
      const { data } = await genManifest({
        fromDivision: plan.surplusDivision.divisionName,
        toDistrict: plan.districtName,
        crop,
        cargoWeightMtons: parseFloat(cargoWeight),
        reason: `Climate severity factor ${(severity * 100).toFixed(0)}% causing ${projectedDeficit} M.Ton projected deficit`,
      });
      setManifest(data.manifestText);
    } catch (err) {
      alert('Manifest generation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setManifestLoading(false);
    }
  }

  async function handleDispatch() {
    if (!plan) return;
    setDispatching(true);
    try {
      await dispatchCargo({
        fromDivisionId: plan.surplusDivision.divisionId,
        toDistrictId: districtId,
        crop,
        cargoWeightMtons: parseFloat(cargoWeight),
        severityFactor: severity,
        projectedDeficit,
        aiManifestText: manifest || null,
      });
      setDispatched(true);
      // Refresh records
      getDispatchRecords().then(({ data }) => setRecords(data.data)).catch(() => {});
    } catch (err) {
      alert('Dispatch failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDispatching(false);
    }
  }

  const severityPct = (severity * 100).toFixed(0);
  const severityColor = severity >= 0.5 ? '#ef4444' : severity >= 0.25 ? '#f59e0b' : '#00ff88';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div className="topbar">
        <span className="topbar-brand">[ KRISHINEXUS ]</span>
        <nav className="topbar-nav">
          <NavLink to="/">HOME</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>DASHBOARD</NavLink>
          <NavLink to="/logistics" className={({ isActive }) => isActive ? 'active' : ''}>LOGISTICS</NavLink>
        </nav>
        <div className="topbar-live">
          <span className="live-dot" />
          SUPPLY CHAIN RUNTIME
        </div>
      </div>

      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header + selectors */}
        <div>
          <div className="panel-label">LOGISTICS & NATIONAL SUPPLY-CHAIN OPTIMIZATION RUNTIME</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">— Select District —</option>
              {allDistricts.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
            <select value={crop} onChange={(e) => setCrop(e.target.value)}>
              {CROPS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary" onClick={handleCalculate} disabled={!districtId || calcLoading}>
              {calcLoading ? 'Calculating...' : 'Calculate Logistics Plan'}
            </button>
          </div>
        </div>

        {/* Zones A + B side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── ZONE A: Deficit & Risk Assessment ── */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel-label">ZONE A — DEFICIT & RISK ASSESSMENT</div>

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MetricCard
                label="BBS BASELINE YIELD"
                value={baselineMtons ? `${baselineMtons.toLocaleString()} M.Ton` : '—'}
                sub="Historical production baseline"
              />
              <MetricCard
                label="PROJECTED SHORTFALL"
                value={baselineMtons ? `${projectedDeficit.toLocaleString()} M.Ton` : '—'}
                sub={`${severityPct}% climate penalty`}
                valueColor={severity >= 0.4 ? '#ef4444' : '#f59e0b'}
              />
              <MetricCard
                label="CLIMATE SEVERITY"
                value={`${severityPct}%`}
                sub="Simulated risk factor"
                valueColor={severityColor}
              />
              <MetricCard
                label="PRICE PRESSURE"
                value={baselineMtons ? `+${pricePressure}%` : '—'}
                sub="Surge risk estimate"
                valueColor="#f59e0b"
              />
            </div>

            {/* Severity slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Simulate Climate Severity Factor</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: severityColor, fontWeight: 700 }}>
                  {severityPct}%
                </span>
              </div>
              <input
                type="range" min="0" max="0.75" step="0.01"
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: severityColor }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>0% (No risk)</span><span>75% (Catastrophic)</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                Drag to model different climate scenario severities. Numbers update in real time.
              </div>
            </div>
          </div>

          {/* ── ZONE B: Automated Logistics Engine ── */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="panel-label">ZONE B — AUTOMATED LOGISTICS ENGINE</div>

            {!plan && !calcLoading && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)', flex: 1, display: 'flex', alignItems: 'center' }}>
                Run "Calculate Logistics Plan" to generate routing recommendation.
              </div>
            )}

            {calcLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 24 }} />)}
              </div>
            )}

            {plan && !calcLoading && !dispatched && (
              <>
                {/* Route card */}
                {plan.surplusDivision ? (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                      RECOMMENDED SUPPLY ROUTE
                    </div>
                    <RouteRow label="FROM" value={`${plan.surplusDivision.divisionName} Division`} />
                    <RouteRow label="TO"   value={`${plan.districtName} District`} />
                    <RouteRow label="CROP" value={crop} />
                    <RouteRow label="AVAILABLE RESERVE" value={`${plan.surplusDivision.reserveMtons?.toLocaleString()} M.Ton`} />
                    <RouteRow label="DISTANCE" value={plan.distanceKm ? `${plan.distanceKm} km` : 'N/A'} />
                    <RouteRow label="RECOMMENDED CARGO" value={`${plan.recommendedCargo?.toLocaleString()} M.Ton`} color="#00ff88" />
                  </div>
                ) : (
                  <div style={{ color: 'var(--accent-yellow)', fontSize: 12 }}>
                    ⚠ No surplus division found for {crop}.
                  </div>
                )}

                {/* Cargo weight input */}
                {plan.surplusDivision && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>Cargo Weight to Dispatch (M.Ton)</div>
                    <input
                      type="number" value={cargoWeight}
                      onChange={(e) => setCargoWeight(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {/* Action buttons */}
                {plan.surplusDivision && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button className="btn btn-outline" onClick={handleGenManifest} disabled={manifestLoading} style={{ justifyContent: 'center' }}>
                      {manifestLoading ? 'Generating...' : '📄 Generate AI Shipping Manifest'}
                    </button>

                    {manifest && (
                      <div style={{
                        background: '#f8f4e8', border: '1px solid #d4a', borderRadius: 'var(--radius-sm)',
                        padding: 12, fontFamily: 'Georgia, serif', fontSize: 12,
                        color: '#1a1a1a', lineHeight: 1.8,
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 11, letterSpacing: '0.1em' }}>
                          CARGO MANIFEST DISPATCH ORDER
                        </div>
                        {manifest}
                      </div>
                    )}

                    <button className="btn btn-green" onClick={handleDispatch} disabled={dispatching} style={{ justifyContent: 'center' }}>
                      {dispatching ? 'Routing...' : '🚛 Approve & Route Supply Chain'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Dispatched confirmation */}
            {dispatched && (
              <div style={{
                background: 'var(--accent-green-bg)', border: '1px solid var(--accent-green)',
                borderRadius: 'var(--radius-sm)', padding: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6 }}>
                  ✓ DISPATCHED
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Cargo routing initiated. Supply fleet en route from{' '}
                  <strong>{plan?.surplusDivision?.divisionName}</strong> to{' '}
                  <strong>{plan?.districtName}</strong>.
                </div>
                {/* Cosmetic progress bar */}
                <div style={{ marginTop: 12, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: 'var(--accent-green)',
                    width: '100%',
                    animation: 'none',
                    transition: 'width 3s linear',
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ZONE C: National Warehouse Stocks ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div className="panel-label" style={{ margin: 0 }}>ZONE C — NATIONAL WAREHOUSE STOCKS</div>
            <span style={{
              fontSize: 10, color: 'var(--accent-yellow)', background: 'var(--accent-yellow-bg)',
              border: '1px solid var(--accent-yellow)', borderRadius: 'var(--radius-sm)',
              padding: '2px 7px', fontFamily: 'var(--font-mono)',
            }}>
              ⚠ SIMULATED DATA
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Division', 'Crop', 'Reserve (M.Ton)', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => {
                  const statusLabel = s.reserveMtons < 10000 ? 'Critical 🔴' : s.reserveMtons < 20000 ? 'Low ⚠️' : 'Adequate ✓';
                  const statusColor = s.reserveMtons < 10000 ? '#ef4444' : s.reserveMtons < 20000 ? '#f59e0b' : '#00ff88';
                  return (
                    <tr key={s._id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '7px 12px', color: 'var(--text-primary)' }}>{s.divisionName}</td>
                      <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.crop}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{s.reserveMtons?.toLocaleString()}</td>
                      <td style={{ padding: '7px 12px', color: statusColor, fontSize: 11 }}>{statusLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Dispatch records */}
          {records.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="panel-label">RECENT DISPATCH RECORDS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'From', 'To', 'Crop', 'Cargo (M.Ton)', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '5px 10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>{r.fromDivisionName}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>{r.toDistrictName}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)' }}>{r.crop}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                        {r.cargoWeightMtons?.toLocaleString()}
                      </td>
                      <td style={{ padding: '5px 10px', color: '#00ff88', fontSize: 10 }}>
                        {r.status?.toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, valueColor }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700, color: valueColor || 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function RouteRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ fontSize: 11, color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}