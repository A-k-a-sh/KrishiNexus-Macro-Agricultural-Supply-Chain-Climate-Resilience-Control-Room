import { Link, Route, Routes } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Logistics from './pages/Logistics';

function Shell({ children }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-xl font-bold uppercase tracking-[0.2em]">KrishiNexus</div>
            <div className="text-sm text-muted">Macro-Agricultural Supply Chain & Climate Resilience Control Room</div>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm text-text/90">
            <Link className="transition hover:text-accent" to="/">Landing</Link>
            <Link className="transition hover:text-accent" to="/dashboard">Dashboard</Link>
            <Link className="transition hover:text-accent" to="/logistics">Logistics</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/logistics" element={<Logistics />} />
      </Routes>
    </Shell>
  );
}