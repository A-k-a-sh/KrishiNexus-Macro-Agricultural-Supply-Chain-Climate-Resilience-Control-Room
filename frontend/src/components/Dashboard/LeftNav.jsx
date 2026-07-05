import { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import AlertBadges from './AlertBadges';

const RISK_DOT = {
  red:    { bg: '#ef4444', shadow: '#ef444466' },
  yellow: { bg: '#f59e0b', shadow: '#f59e0b66' },
  green:  { bg: '#00ff88', shadow: '#00ff8866' },
};

// Group districts by divisionId, return a map: divisionId → district[]
function groupByDivision(districts) {
  const groups = {};
  for (const d of districts) {
    if (!groups[d.divisionId]) groups[d.divisionId] = [];
    groups[d.divisionId].push(d);
  }
  return groups;
}

// Division names by bdapi division id
const DIVISION_NAMES = {
  '1': 'Chattagram', '2': 'Rajshahi', '3': 'Khulna',     '4': 'Barishal',
  '5': 'Sylhet',     '6': 'Dhaka',    '7': 'Rangpur',    '8': 'Mymensingh',
};

export default function LeftNav() {
  const { allDistricts, selectedDistrict, selectDistrict, districtsLoading } = useAppContext();
  const [search, setSearch]       = useState('');
  const [openDivisions, setOpenDivisions] = useState({ '6': true }); // Dhaka open by default

  const filtered = useMemo(() => {
    if (!search.trim()) return allDistricts;
    const q = search.toLowerCase();
    return allDistricts.filter(
      (d) => d.name.toLowerCase().includes(q) || d.bnName.includes(q)
    );
  }, [allDistricts, search]);

  const groups = useMemo(() => groupByDivision(filtered), [filtered]);
  const divisionIds = Object.keys(DIVISION_NAMES);

  function toggleDivision(id) {
    setOpenDivisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (districtsLoading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 28, borderRadius: 4 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div className="panel-label">REGION SELECTOR</div>
        <input
          type="text"
          placeholder="Search district..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', fontSize: 12 }}
        />
      </div>

      {/* Division → District accordion */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {divisionIds.map((divId) => {
          const districtList = groups[divId] || [];
          const isOpen = search.trim() ? true : !!openDivisions[divId]; // auto-open when searching
          const divAlerts = districtList.filter((d) => d.riskStatus === 'red').length;

          return (
            <div key={divId} style={{ marginBottom: 2 }}>
              {/* Division header */}
              <button
                onClick={() => toggleDivision(divId)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9 }}>{isOpen ? '▼' : '▶'}</span>
                  {DIVISION_NAMES[divId]}
                </span>
                {divAlerts > 0 && (
                  <span className="badge badge-red" style={{ fontSize: 9, padding: '1px 5px' }}>
                    {divAlerts}
                  </span>
                )}
              </button>

              {/* District list */}
              {isOpen && (
                <div style={{ paddingLeft: 8 }}>
                  {districtList.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>
                      No matches
                    </div>
                  ) : (
                    districtList.map((district) => {
                      const isSelected = selectedDistrict?._id === district._id;
                      const dot = RISK_DOT[district.riskStatus] || RISK_DOT.green;
                      const alertCount = district.activeAlerts?.length ?? 0;

                      return (
                        <button
                          key={district._id}
                          onClick={() => selectDistrict(district)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                            background: isSelected ? 'var(--accent-blue-bg)' : 'transparent',
                            border: isSelected ? '1px solid var(--accent-blue)' : '1px solid transparent',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: 12, cursor: 'pointer',
                            transition: 'all 0.15s', marginBottom: 1,
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card)'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: dot.bg, boxShadow: `0 0 4px ${dot.shadow}`,
                              flexShrink: 0,
                            }} />
                            {district.name}
                          </span>
                          {alertCount > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)' }}>
                              {alertCount}⚠
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* National status badges */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <AlertBadges />
      </div>
    </div>
  );
}