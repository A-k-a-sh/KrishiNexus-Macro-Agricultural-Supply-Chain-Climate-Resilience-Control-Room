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

const GEO_URL = '/bd-districts.geojson';

// Map each GeoJSON shapeName to the bdapi district _id.
// shapeName comes from the geoBoundaries file's properties.shapeName field.
// Some names differ from bdapi — add aliases here as needed.
// This is intentionally kept in the map component so it's easy to patch.
const SHAPE_NAME_TO_ID = {
  'Barguna': '47', 'Barisal': '4', 'Bhola': '49', 'Jhalokati': '50',
  'Patuakhali': '51', 'Pirojpur': '52', 'Bandarban': '1', 'Brahmanbaria': '2',
  'Chandpur': '3', 'Chattogram': '5', 'Chittagong': '5', 'Cox\'s Bazar': '6',
  'Cox’s Bazar': '6',
  'Comilla': '7', 'Cumilla': '7', 'Feni': '8', 'Khagrachhari': '9',
  'Lakshmipur': '10', 'Noakhali': '11', 'Rangamati': '12',
  'Brahamanbaria': '2',
  'Dhaka': '26', 'Faridpur': '27', 'Gazipur': '28', 'Gopalganj': '29',
  'Kishoreganj': '30', 'Madaripur': '31', 'Manikganj': '32', 'Munshiganj': '33',
  'Narayanganj': '34', 'Narsingdi': '35', 'Rajbari': '36', 'Shariatpur': '37',
  'Tangail': '38', 'Bagerhat': '13', 'Chuadanga': '14', 'Jessore': '15',
  'Jashore': '15', 'Jhenaidah': '16', 'Jhenaidaha': '16', 'Khulna': '17',
  'Kushtia': '18', 'Magura': '19', 'Meherpur': '20', 'Narail': '21',
  'Satkhira': '22', 'Jamalpur': '39', 'Mymensingh': '40', 'Netrokona': '41',
  'Netrakona': '41', 'Sherpur': '42', 'Bogura': '23', 'Bogra': '23',
  'Chapai Nawabganj': '24', 'Joypurhat': '25', 'Naogaon': '43', 'Natore': '44',
  'Nawabganj': '24', 'Pabna': '45', 'Rajshahi': '46', 'Sirajganj': '48',
  'Dinajpur': '53', 'Gaibandha': '54', 'Kurigram': '55', 'Lalmonirhat': '56',
  'Nilphamari': '57', 'Panchagarh': '58', 'Rangpur': '59', 'Thakurgaon': '60',
  'Habiganj': '61', 'Maulvibazar': '62', 'Moulvibazar': '62',
  'Sunamganj': '63', 'Sylhet': '64',
};

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
  const [center, setCenter] = useState([90.35, 23.68]); // Bangladesh centroid

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
          center: [90.35, 23.6],
          scale: 5500,
        }}
        width={500}
        height={600}
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