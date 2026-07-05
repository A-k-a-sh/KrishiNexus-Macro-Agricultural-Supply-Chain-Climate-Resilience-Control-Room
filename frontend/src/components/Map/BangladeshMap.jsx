import { useState, useEffect, useCallback } from 'react';
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

const GEO_URL = '/bd-districts.geojson';

// Risk status → SVG fill / stroke colors from the design system
const RISK_STYLE = {
  red: { fill: '#450a0a', stroke: '#ef4444', strokeWidth: 0.8 },
  yellow: { fill: '#451a03', stroke: '#f59e0b', strokeWidth: 0.6 },
  green: { fill: '#052e16', stroke: '#00ff88', strokeWidth: 0.5 },
  default: { fill: '#111827', stroke: '#1e3a5f', strokeWidth: 0.4 },
};

const SELECTED_STYLE = { fill: '#1e3a5f', stroke: '#3b82f6', strokeWidth: 1.5 };

export default function BangladeshMap() {
  const { allDistricts, selectedDistrict, selectDistrict } = useAppContext();

  // Build a lookup: bdapi district _id → district object (for fast access on hover/click)
  const [districtById, setDistrictById] = useState({});
  useEffect(() => {
    const map = {};
    for (const d of allDistricts) map[d._id] = d;
    setDistrictById(map);
  }, [allDistricts]);

  const [tooltip, setTooltip] = useState({ visible: false, district: null, x: 0, y: 0 });
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
  }, [selectDistrict]);

  const handleDistrictClick = useCallback((geo) => {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    if (!id) return;
    const district = districtById[id];
    if (!district) return;

    selectDistrict(district);
    // Zoom into the clicked district
    setCenter([parseFloat(district.lon), parseFloat(district.lat)]);
    setZoom(4);
  }, [districtById, selectDistrict]);

  const handleMouseEnter = useCallback((geo, evt) => {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    const district = id ? districtById[id] : null;
    setTooltip({ visible: true, district, shapeName, x: evt.clientX, y: evt.clientY });
  }, [districtById]);

  const handleMouseMove = useCallback((evt) => {
    setTooltip((t) => ({ ...t, x: evt.clientX, y: evt.clientY }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false, district: null, x: 0, y: 0 });
  }, []);

  function getGeoStyle(geo) {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    const district = id ? districtById[id] : null;

    // Selected district overrides risk color
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
          scale: 3200,
        }}
        width={800}
        height={700}
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
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => handleDistrictClick(geo)}
                  onMouseEnter={(evt) => handleMouseEnter(geo, evt)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  style={getGeoStyle(geo)}
                />
              ))
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <RiskLegend />

      {tooltip.visible && (
        <DistrictTooltip
          district={tooltip.district}
          shapeName={tooltip.shapeName}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}