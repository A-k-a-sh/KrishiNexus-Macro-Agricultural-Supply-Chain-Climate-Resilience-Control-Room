import AlertBadges from '../components/Dashboard/AlertBadges';
import BangladeshMap from '../components/Map/BangladeshMap';
import ChatTerminal from '../components/Dashboard/ChatTerminal';
import LeftNav from '../components/Dashboard/LeftNav';
import RagAdvisory from '../components/Dashboard/RagAdvisory';
import TelemetryPanel from '../components/Dashboard/TelemetryPanel';

export default function Dashboard() {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
      <aside className="rounded-2xl border border-border bg-surface p-4">
        <LeftNav />
      </aside>
      <section className="rounded-2xl border border-border bg-card p-4">
        <BangladeshMap />
      </section>
      <aside className="space-y-4">
        <AlertBadges />
        <TelemetryPanel />
        <RagAdvisory />
        <ChatTerminal />
      </aside>
    </div>
  );
}
