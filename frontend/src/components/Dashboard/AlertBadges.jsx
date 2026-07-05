import { useAppContext } from '../../context/AppContext';

export default function AlertBadges() {
  const { alertCounts } = useAppContext();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="panel-label">NATIONAL STATUS</div>

      <Badge count={alertCounts.red}    label="SEVERE RISK" cls="badge-red"    />
      <Badge count={alertCounts.yellow} label="WARNINGS"    cls="badge-yellow" />
      <Badge count={alertCounts.green}  label="STABLE"      cls="badge-green"  />
    </div>
  );
}

function Badge({ count, label, cls }) {
  return (
    <div className={`badge ${cls}`} style={{ justifyContent: 'space-between', padding: '5px 10px', borderRadius: 'var(--radius-sm)' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{count}</span>
    </div>
  );
}