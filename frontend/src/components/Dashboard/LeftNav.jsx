import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { buildRegionTree } from './regionTree';
import AlertBadges from './AlertBadges';

const RISK_DOT = {
  red:    { bg: '#ef4444', shadow: '#ef444466' },
  yellow: { bg: '#f59e0b', shadow: '#f59e0b66' },
  green:  { bg: '#00ff88', shadow: '#00ff8866' },
};

// One row renderer for both districts and upazilas: risk dot, name, alert count.
//
// `state` is 'active' for the region the intelligence panel is reporting on,
// 'ancestor' for the district you are currently inside, or null. Those are
// deliberately different weights rather than two equal boxes: an active row gets
// a full accent border, an ancestor only a left edge, so the pair reads as a path
// down to one selection instead of two competing ones. Accent follows the map —
// cyan for a district, magenta for an upazila.
function RegionRow({ region, level, state, indent, onSelect, caret, onToggleCaret, rowId }) {
  const dot = RISK_DOT[region.riskStatus] || RISK_DOT.green;
  const alertCount = region.activeAlerts?.length ?? 0;
  const isUpazila = level === 'upazila';
  const accent = isUpazila ? 'var(--scope-upazila)' : 'var(--scope-district)';
  const isActive = state === 'active';
  const isAncestor = state === 'ancestor';

  const baseBg = isActive
    ? (isUpazila ? 'rgba(244, 114, 182, 0.10)' : 'rgba(34, 211, 238, 0.10)')
    : isAncestor ? 'rgba(34, 211, 238, 0.045)' : 'transparent';

  return (
    <div
      data-region-row={rowId}
      style={{
        display: 'flex', alignItems: 'center',
        borderRadius: 'var(--radius-sm)', marginBottom: 1,
        background: baseBg,
        border: `1px solid ${isActive ? accent : 'transparent'}`,
        boxShadow: isAncestor ? 'inset 2px 0 0 var(--scope-district)' : undefined,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-card)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = baseBg; }}
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
        aria-current={isActive ? 'true' : undefined}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 6,
          padding: '5px 8px 5px 4px', background: 'transparent',
          color: isActive || isAncestor ? 'var(--text-primary)' : 'var(--text-secondary)',
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
  const listRef = useRef(null);          // the scrolling tree container
  const pendingScrollRef = useRef(null); // rowId still waiting to be scrolled to

  const query = search.trim().toLowerCase();

  // Searching has to look inside districts the user never opened, which needs the
  // national upazila list. Fetch it once, and only once a query is worth running.
  useEffect(() => {
    if (query.length >= 2) ensureAllUpazilas();
  }, [query, ensureAllUpazilas]);

  // Reveal the selected district: its division always, and its own subtree once
  // we're drilled in. Without the division part, a district clicked on the map
  // could sit inside a collapsed group with nothing in the nav to show for it.
  useEffect(() => {
    if (!selectedDistrict) return;
    setOpenDivisions((prev) => (
      prev[selectedDistrict.divisionId] ? prev : { ...prev, [selectedDistrict.divisionId]: true }
    ));
    if (!isDrilledIn) return;
    setOpenDistricts((prev) => (
      prev[selectedDistrict._id] ? prev : { ...prev, [selectedDistrict._id]: true }
    ));
    ensureUpazilas(selectedDistrict._id);
  }, [isDrilledIn, selectedDistrict, ensureUpazilas]);

  // Scroll the selection into view. A region picked on the map can be anywhere in
  // a 64-district tree, and off-screen it looks like the click did nothing.
  //
  // The target is queued in a ref and fulfilled on whichever render actually
  // mounts the row, because the effect above may still have to expand a division
  // and a district first — on the render that changed the selection, the row
  // usually isn't in the DOM yet. Clearing the ref on success is what stops it
  // re-firing and yanking the list while the user scrolls or opens carets.
  const activeRowId = selectedUpazila ? `u:${selectedUpazila._id}`
    : selectedDistrict ? `d:${selectedDistrict._id}`
    : null;

  useEffect(() => { pendingScrollRef.current = activeRowId; }, [activeRowId]);

  useEffect(() => {
    const target = pendingScrollRef.current;
    if (!target || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-region-row="${target}"]`);
    if (!row) return;
    pendingScrollRef.current = null;

    // Already on screen? Leave the list alone. Otherwise clicking a row in the nav
    // would scroll it out from under the pointer, which is worse than not moving.
    const view = listRef.current.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top >= view.top && rect.bottom <= view.bottom) return;

    row.scrollIntoView({
      // A district is about to open its upazilas beneath it, so centre it and
      // leave room for them. An upazila is already within reach — move the least
      // that puts it on screen.
      block: target.startsWith('d:') ? 'center' : 'nearest',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto' : 'smooth',
    });
  });

  const tree = useMemo(
    () => buildRegionTree(allDistricts, upazilasByDistrict, query),
    [allDistricts, upazilasByDistrict, query],
  );

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

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
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
                const isThisDistrict = selectedDistrict?._id === district._id;

                return (
                  <div key={district._id}>
                    <RegionRow
                      region={district}
                      level="district"
                      rowId={`d:${district._id}`}
                      indent={8}
                      state={isThisDistrict ? (selectedUpazila ? 'ancestor' : 'active') : null}
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
                              rowId={`u:${upazila._id}`}
                              indent={0}
                              state={selectedUpazila?._id === upazila._id ? 'active' : null}
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
