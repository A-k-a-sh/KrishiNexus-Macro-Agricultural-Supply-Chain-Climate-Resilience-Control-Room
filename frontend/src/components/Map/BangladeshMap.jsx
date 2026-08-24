import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { useAppContext } from '../../context/AppContext';
import DistrictTooltip from './DistrictTooltip';
import RiskLegend from './RiskLegend';
import SHAPE_NAME_TO_ID from '../../data/geoNameMap.json';
import UPAZILA_SHAPE_NAME_TO_ID from '../../data/upazilaGeoNameMap.json';

const GEO_URL = '/bd-districts.geojson';
const UPAZILA_GEO_URL = '/bd-upazilas.geojson';

// Risk status → SVG fill / stroke colors from the design system
const RISK_STYLE = {
  red: { fill: '#450a0a', stroke: '#ef4444', strokeWidth: 0.8 },
  yellow: { fill: '#451a03', stroke: '#f59e0b', strokeWidth: 0.6 },
  green: { fill: '#052e16', stroke: '#00ff88', strokeWidth: 0.5 },
  default: { fill: '#1e293b', stroke: '#475569', strokeWidth: 0.4 }, // Made brighter so it never blends into the page background
};

const SELECTED_STYLE = { fill: '#1e3a5f', stroke: '#3b82f6', strokeWidth: 1.5 };

// --- GeoJSON winding-order normalization -------------------------------------
// d3-geo (used internally by react-simple-maps' geoPath) treats polygons on a
// SPHERE, not a plane. It uses ring winding order to decide which side is
// "inside": an exterior ring must wind counter-clockwise. If it winds the wrong
// way, d3 interprets the polygon as its COMPLEMENT — i.e. the entire globe minus
// the shape — and fills the whole map. The bd-upazilas.geojson asset (exported
// from geoBoundaries ADM3 via mapshaper) has every ring inverted, so on drill-in
// each upazila painted a full-canvas fill that hid all district outlines — the
// "map outline disappeared" bug. bd-districts.geojson is wound correctly, so the
// base map always worked.
//
// We can't rely on an absolute CW/CCW test here without pulling in d3-geo, but we
// don't need to: the districts are known-good, and in this projection their
// exterior rings have NEGATIVE planar (shoelace) signed area. So we normalize any
// polygon whose exterior ring has POSITIVE signed area to match. This is a no-op
// on all 64 districts and corrects all 544 upazilas. Validated with d3-geo:
// post-fix, 0 districts change, 0 upazilas remain inverted, and upazila centroids
// resolve inside their parent district (e.g. geoContains(Comilla, Barura)=true).
function ringSignedArea(ring) {
  let area = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

function normalizePolygon(rings) {
  // rings[0] is the exterior ring; holes follow. Reverse every ring together so
  // interior/exterior relationships are preserved.
  if (rings.length && ringSignedArea(rings[0]) > 0) {
    for (const ring of rings) ring.reverse();
  }
}

function normalizeWinding(featureCollection) {
  if (!featureCollection || !Array.isArray(featureCollection.features)) return featureCollection;
  for (const feature of featureCollection.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      normalizePolygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) normalizePolygon(polygon);
    }
  }
  return featureCollection;
}
// -----------------------------------------------------------------------------

export default function BangladeshMap() {
  const { 
    allDistricts, selectedDistrict, selectDistrict,
    isDrilledIn, setIsDrilledIn,
    selectedUpazila, setSelectedUpazila,
    upazilasByDistrict, setUpazilasByDistrict
  } = useAppContext();

  // Build a lookup: bdapi district _id → district object (for fast access on hover/click)
  const [districtById, setDistrictById] = useState({});
  useEffect(() => {
    const map = {};
    for (const d of allDistricts) map[d._id] = d;
    setDistrictById(map);
  }, [allDistricts]);

  useEffect(() => {
    if (isDrilledIn && selectedDistrict && !upazilasByDistrict[selectedDistrict._id]) {
      import('../../api').then(({ getUpazilas }) => {
        getUpazilas(selectedDistrict._id).then(res => {
          setUpazilasByDistrict(prev => ({ ...prev, [selectedDistrict._id]: res.data.data }));
        }).catch(console.error);
      });
    }
  }, [isDrilledIn, selectedDistrict, upazilasByDistrict, setUpazilasByDistrict]);

  // Manually fetch GeoJSON to prevent react-simple-maps from colliding cache when using multiple Geographies
  const [districtGeoData, setDistrictGeoData] = useState(null);
  const [upazilaGeoData, setUpazilaGeoData] = useState(null);

  useEffect(() => {
    fetch(GEO_URL)
      .then(res => res.json())
      .then(data => {
        // Tag features so we can distinguish them in the combined array
        data.features.forEach(f => f.properties.geoType = 'district');
        // Correct any inverted rings so d3-geo never renders a shape as its
        // whole-globe complement (no-op for the already-correct district file).
        setDistrictGeoData(normalizeWinding(data));
      })
      .catch(console.error);

    fetch(UPAZILA_GEO_URL)
      .then(res => res.json())
      .then(data => {
        data.features.forEach(f => f.properties.geoType = 'upazila');
        // The ADM3 upazila polygons ship with inverted winding — normalize so
        // they render as their real small shapes instead of full-canvas fills.
        setUpazilaGeoData(normalizeWinding(data));
      })
      .catch(console.error);
  }, []);

  // Compute the combined GeoJSON object dynamically to avoid multiple <Geographies> components
  const combinedGeoData = useMemo(() => {
    if (!districtGeoData) return null;
    
    let combinedFeatures = [...districtGeoData.features];
    
    if (isDrilledIn && upazilaGeoData && selectedDistrict) {
      const upzList = upazilasByDistrict[selectedDistrict._id] || [];
      const validIds = new Set(upzList.map(u => String(u._id)));
      
      const filteredUpazilas = upazilaGeoData.features.filter(geo => {
        const mappedId = UPAZILA_SHAPE_NAME_TO_ID[geo.properties.shapeName];
        return mappedId && validIds.has(String(mappedId));
      });
      
      combinedFeatures = [...combinedFeatures, ...filteredUpazilas];
    }
    
    return {
      type: "FeatureCollection",
      features: combinedFeatures
    };
  }, [districtGeoData, upazilaGeoData, isDrilledIn, selectedDistrict, upazilasByDistrict]);

  const [tooltip, setTooltip] = useState({ visible: false, district: null, upazila: null, x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([90.35, 23.68]); // Bangladesh centroid — ZoomableGroup pans here

  const zoomIn = useCallback(() => {
    setZoom((current) => Math.min(8, +(current + 0.75).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((current) => Math.max(1, +(current - 0.75).toFixed(2)));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setCenter([90.35, 23.68]);
    selectDistrict(null);
    setIsDrilledIn(false);
  }, [selectDistrict, setIsDrilledIn]);

  const handleDistrictClick = useCallback((geo) => {
    if (isDrilledIn) return;
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    if (!id) return;
    const district = districtById[id];
    if (!district) return;

    selectDistrict(district);
    setCenter([parseFloat(district.lon), parseFloat(district.lat)]);
    setZoom(4);
    setIsDrilledIn(true);
  }, [isDrilledIn, districtById, selectDistrict, setIsDrilledIn]);

  const handleUpazilaClick = useCallback((geo) => {
    const shapeName = geo.properties.shapeName;
    const id = UPAZILA_SHAPE_NAME_TO_ID[shapeName];
    if (!id || !selectedDistrict) return;
    const upzList = upazilasByDistrict[selectedDistrict._id] || [];
    const upz = upzList.find(u => u._id === id);
    if (upz) {
      setSelectedUpazila(upz);
    }
  }, [selectedDistrict, upazilasByDistrict, setSelectedUpazila]);

  const handleDistrictMouseEnter = useCallback((geo, evt) => {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    const district = id ? districtById[id] : null;
    setTooltip({ visible: true, district, upazila: null, shapeName, x: evt.clientX, y: evt.clientY });
  }, [districtById]);

  const handleUpazilaMouseEnter = useCallback((geo, evt) => {
    const shapeName = geo.properties.shapeName;
    const id = UPAZILA_SHAPE_NAME_TO_ID[shapeName];
    const upzList = selectedDistrict ? (upazilasByDistrict[selectedDistrict._id] || []) : [];
    const upazila = upzList.find(u => String(u._id) === String(id));
    setTooltip({ visible: true, district: selectedDistrict, upazila, shapeName, x: evt.clientX, y: evt.clientY });
  }, [selectedDistrict, upazilasByDistrict]);

  const handleMouseMove = useCallback((evt) => {
    setTooltip((t) => ({ ...t, x: evt.clientX, y: evt.clientY }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false, district: null, upazila: null, x: 0, y: 0 });
  }, []);

  function getUpazilaStyle(geo) {
    const shapeName = geo.properties.shapeName;
    const id = UPAZILA_SHAPE_NAME_TO_ID[shapeName];
    const upzList = selectedDistrict ? (upazilasByDistrict[selectedDistrict._id] || []) : [];
    const upazila = upzList.find(u => String(u._id) === String(id));
    
    if (selectedUpazila && upazila && String(upazila._id) === String(selectedUpazila._id)) {
      return {
        default: { ...SELECTED_STYLE, outline: 'none' },
        hover: { ...SELECTED_STYLE, outline: 'none' },
        pressed: { ...SELECTED_STYLE, outline: 'none' },
      };
    }
    const risk = upazila?.riskStatus || 'default';
    const s = RISK_STYLE[risk] || RISK_STYLE.default;
    return {
      default: { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, outline: 'none' },
      hover: { fill: '#1e2a42', stroke: '#3b82f6', strokeWidth: 0.5, outline: 'none', cursor: 'pointer' },
      pressed: { fill: '#1e2a42', outline: 'none' },
    };
  }

  function getDistrictStyle(geo) {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    const district = id ? districtById[id] : null;

    if (selectedDistrict && district && district._id === selectedDistrict._id) {
      return {
        default: { ...SELECTED_STYLE, outline: 'none' },
        hover: { ...SELECTED_STYLE, outline: 'none' },
        pressed: { ...SELECTED_STYLE, outline: 'none' },
      };
    }

    const risk = district?.riskStatus || 'default';
    const s = RISK_STYLE[risk] || RISK_STYLE.default;
    return {
      default: { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, outline: 'none' },
      hover: { fill: '#1e2a42', stroke: '#3b82f6', strokeWidth: 1, outline: 'none', cursor: 'pointer' },
      pressed: { fill: '#1e2a42', outline: 'none' },
    };
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100%' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 8 }}>
        {isDrilledIn && (
          <button
            onClick={() => {
              setIsDrilledIn(false);
              setZoom(1);
              setCenter([90.35, 23.68]);
            }}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', padding: '4px 10px',
              borderRadius: 'var(--radius-sm)', fontSize: 11,
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            ← Back to Districts
          </button>
        )}
        <button
          onClick={zoomOut}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '4px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          − Zoom
        </button>
        <button
          onClick={zoomIn}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '4px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          + Zoom
        </button>
        <button
          onClick={resetView}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '4px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          ↩ Reset
        </button>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 5500,
        }}
        width={900}
        height={800}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          onMoveEnd={({ zoom: z, coordinates }) => {
            setZoom(z);
            setCenter(coordinates);
          }}
        >
          {combinedGeoData && (
            <Geographies geography={combinedGeoData}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const shapeName = geo.properties.shapeName;
                  const geoType = geo.properties.geoType;

                  if (geoType === 'district') {
                    const id = SHAPE_NAME_TO_ID[shapeName];
                    const isSelected = selectedDistrict && id && String(districtById[id]?._id) === String(selectedDistrict._id);

                    return (
                      <Geography
                        key={`district-${geo.rsmKey}`}
                        geography={geo}
                        onClick={() => {
                          if (!isDrilledIn) handleDistrictClick(geo);
                        }}
                        onMouseEnter={(evt) => {
                          if (!isDrilledIn || isSelected) {
                            handleDistrictMouseEnter(geo, evt);
                          }
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        style={getDistrictStyle(geo)}
                      />
                    );
                  }

                  if (geoType === 'upazila') {
                    return (
                      <Geography
                        key={`upazila-${geo.rsmKey}`}
                        geography={geo}
                        onClick={() => handleUpazilaClick(geo)}
                        onMouseEnter={(evt) => handleUpazilaMouseEnter(geo, evt)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        style={getUpazilaStyle(geo)}
                      />
                    );
                  }

                  return null;
                })
              }
            </Geographies>
          )}
        </ZoomableGroup>
      </ComposableMap>

      <RiskLegend />

      {tooltip.visible && (
        <DistrictTooltip
          district={tooltip.district}
          upazila={tooltip.upazila}
          shapeName={tooltip.shapeName}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}