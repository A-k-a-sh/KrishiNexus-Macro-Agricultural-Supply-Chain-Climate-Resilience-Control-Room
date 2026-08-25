import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import AlertBadges from './AlertBadges';

const RISK_DOT = {
  red:    { bg: '#ef4444', shadow: '#ef444466' },
  yellow: { bg: '#f59e0b', shadow: '#f59e0b66' },
  green:  { bg: '#00ff88', shadow: '#00ff8866' },
};

// Division names by bdapi division id
const DIVISION_NAMES = {
  '1': 'Chattagram', '2': 'Rajshahi', '3': 'Khulna',     '4': 'Barishal',
  '5': 'Sylhet',     '6': 'Dhaka',    '7': 'Rangpur',    '8': 'Mymensingh',
};
const DIVISION_IDS = Object.keys(DIVISION_NAMES);

// One row renderer for both districts and upazilas: risk dot, name, alert count.
// The two levels differ only in indent and in which accent marks "selected" —
// cyan for a district, magenta for an upazila, matching the map's palette.
function RegionRow({ region, level, selected, indent, onSelect, caret, onToggleCaret }) {
  const dot = RISK_DOT[region.riskStatus] || RISK_DOT.green;
  const alertCount = region.activeAlerts?.length ?? 0;
  const accent = level === 'upazila' ? 'var(--scope-upazila)' : 'var(--scope-district)';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center',
        borderRadius: 'var(--radius-sm)', marginBottom: 1,
        background: selected ? 'rgba(34, 211, 238, 0.09)' : 'transparent',
        border: `1px solid ${selected ? accent : 'transparent'}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--bg-card)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {caret !== undefined ? (
        <button
          onClick={onToggleCaret}
          aria-label={caret ? `Collapse ${region.name}` : `Expand ${region.name}`}
          aria-expanded={caret}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            fontSize: 8, lineHeight: 1, padding: '5px 3px 5px 6px',
            marginLeft: indent, flexShrink: 0,
          }}
        >
          {caret ? '▼' : '▶'}
        </button>
      ) : (
        <span style={{ width: indent + 15, flexShrink: 0 }} />
      )}

      <button
        onClick={onSelect}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 6,
          padding: '5px 8px 5px 4px', background: 'transparent',
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: 12, textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: dot.bg, boxShadow: `0 0 4px ${dot.shadow}`,
            flexShrink: 0,
          }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {region.name}
          </span>
        </span>
        {alertCount > 0 && (
          <span style={{ fontSize: 10, color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            {alertCount}⚠
          </span>
        )}
      </button>
    </div>
  );
}

export default function LeftNav() {
  const {
    allDistricts, selectedDistrict, selectDistrict, districtsLoading,
    isDrilledIn, setIsDrilledIn,
    upazilasByDistrict, selectedUpazila, selectUpazila,
    ensureUpazilas, ensureAllUpazilas, allUpazilasLoaded,
  } = useAppContext();
  const [search, setSearch] = useState('');
  const [openDivisions, setOpenDivisions] = useState({ '6': true }); // Dhaka open by default
  const [openDistricts, setOpenDistricts] = useState({});

  const query = search.trim().toLowerCase();
  const matches = useCallback(
    (value) => !!value && String(value).toLowerCase().includes(query),
    [query],
  );

  // Searching has to look inside districts the user never opened, which needs the
  // national upazila list. Fetch it once, and only once a query is worth running.
  useEffect(() => {
    if (query.length >= 2) ensureAllUpazilas();
  }, [query, ensureAllUpazilas]);

  // Keep the drilled-in district open in the tree, and make sure its upazilas
  // are on their way so the subtree isn't empty when it expands.
  useEffect(() => {
    if (!isDrilledIn || !selectedDistrict) return;
    setOpenDistricts((prev) => ({ ...prev, [selectedDistrict._id]: true }));
    setOpenDivisions((prev) => ({ ...prev, [selectedDistrict.divisionId]: true }));
    ensureUpazilas(selectedDistrict._id);
  }, [isDrilledIn, selectedDistrict, ensureUpazilas]);

  // Build the visible tree. With a query, a district survives if its own name
  // matches, its division's name matches, or any of its upazilas match; a
  // district with upazila hits shows just those, expanded.
  const tree = useMemo(() => {
    const byDivision = {};
    for (const d of allDistricts) (byDivision[d.divisionId] ||= []).push(d);

    return DIVISION_IDS.map((divId) => {
      const divisionMatches = !!query && matches(DIVISION_NAMES[divId]);
      const rows = [];

      for (const district of byDivision[divId] || []) {
        const all = upazilasByDistrict[district._id] || [];
        const districtMatches = !!query && (matches(district.name) || matches(district.bnName));
        const hits = query && !districtMatches && !divisionMatches
          ? all.filter((u) => matches(u.name) || matches(u.bnName))
          : [];

        if (query && !divisionMatches && !districtMatches && !hits.length) continue;
        rows.push({ district, upazilas: hits.length ? hits : all, forceOpen: hits.length > 0 });
      }

      if (query && !rows.length) return null;
      return {
        id: divId,
        name: DIVISION_NAMES[divId],
        rows,
        redCount: rows.filter((r) => r.district.riskStatus === 'red').length,
      };
    }).filter(Boolean);
  }, [allDistricts, upazilasByDistrict, query, matches]);

  const shownDistricts = tree.reduce((n, div) => n + div.rows.length, 0);

  function toggleDivision(id) {
    setOpenDivisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleDistrict(district) {
    const open = !openDistricts[district._id];
    setOpenDistricts((prev) => ({ ...prev, [district._id]: open }));
    if (open) ensureUpazilas(district._id);
  }

  if (districtsLoading) {
    return (
      <>
        <div className="panel-head"><span>Region selector</span></div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 28, borderRadius: 4 }} />
          ))}
        </div>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-head">
        <span>Region selector</span>
        <span className="panel-head-note">
          {query ? `${shownDistricts} of ${allDistricts.length}` : `${allDistricts.length} districts`}
        </span>
      </div>

      <div style={{ padding: '10px 12px 8px' }}>
        <input
          type="text"
          placeholder="Search division, district, upazila..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', fontSize: 12 }}
        />
        {query.length >= 2 && !allUpazilasLoaded && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 5 }}>
            Loading upazilas…
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {isDrilledIn && (
          <button
            onClick={() => setIsDrilledIn(false)}
            style={{
              width: '100%', textAlign: 'left', background: 'transparent',
              color: 'var(--accent-blue)', fontSize: 11, fontFamily: 'var(--font-mono)',
              padding: '5px 8px', marginBottom: 4,
            }}
          >
            ← All districts
          </button>
        )}

        {tree.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>
            No region matches “{search.trim()}”.
          </div>
        )}

        {tree.map((division) => {
          const isOpen = query ? true : !!openDivisions[division.id];

          return (
            <div key={division.id} style={{ marginBottom: 2 }}>
              <button
                onClick={() => toggleDivision(division.id)}
                aria-expanded={isOpen}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9 }}>{isOpen ? '▼' : '▶'}</span>
                  {division.name}
                </span>
                {division.redCount > 0 && (
                  <span className="badge badge-red" style={{ fontSize: 9, padding: '1px 5px' }}>
                    {division.redCount}
                  </span>
                )}
              </button>

              {isOpen && division.rows.map(({ district, upazilas, forceOpen }) => {
                const districtOpen = forceOpen || !!openDistricts[district._id];
                const isDistrictSelected = selectedDistrict?._id === district._id && !selectedUpazila;

                return (
                  <div key={district._id}>
                    <RegionRow
                      region={district}
                      level="district"
                      indent={8}
                      selected={isDistrictSelected}
                      caret={districtOpen}
                      onToggleCaret={() => toggleDistrict(district)}
                      onSelect={() => selectDistrict(district, { drillIn: true })}
                    />

                    {districtOpen && (
                      <div style={{ marginLeft: 20, borderLeft: '1px solid var(--border)' }}>
                        {upazilas.length === 0 ? (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 10px', fontFamily: 'var(--font-mono)' }}>
                            {allUpazilasLoaded ? 'No upazilas on record' : 'Loading…'}
                          </div>
                        ) : (
                          upazilas.map((upazila) => (
                            <RegionRow
                              key={upazila._id}
                              region={upazila}
                              level="upazila"
                              indent={0}
                              selected={selectedUpazila?._id === upazila._id}
                              onSelect={() => selectUpazila(district, upazila)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
