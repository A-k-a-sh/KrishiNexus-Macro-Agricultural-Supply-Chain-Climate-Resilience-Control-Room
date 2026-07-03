import { Link, Route, Routes } from 'react-router-dom';

function Frame({ title, children }) {
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
      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="mb-6 text-3xl font-semibold text-text">{title}</h1>
        {children}
      </main>
    </div>
  );
}

function Landing() {
  return (
    <Frame title="Landing">
      <section className="rounded-2xl border border-border bg-surface/90 p-8 shadow-2xl shadow-black/20">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">Bangladesh agriculture control room</p>
        <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-text md:text-5xl">
          Real-time district risk, RAG advisories, and logistics planning.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
          This workspace is scaffolded from the project specification and is ready for the backend,
          data pipeline, and map-driven dashboard to be built out.
        </p>
      </section>
    </Frame>
  );
}

function Dashboard() {
  return (
    <Frame title="Dashboard">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="min-h-48 rounded-2xl border border-border bg-card p-5">District map shell</div>
        <div className="min-h-48 rounded-2xl border border-border bg-card p-5">Telemetry panel shell</div>
        <div className="min-h-48 rounded-2xl border border-border bg-card p-5">AI advisory shell</div>
      </div>
    </Frame>
  );
}

function Logistics() {
  return (
    <Frame title="Logistics">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="min-h-48 rounded-2xl border border-border bg-card p-5">Deficit and risk planning shell</div>
        <div className="min-h-48 rounded-2xl border border-border bg-card p-5">Route recommendation shell</div>
        <div className="min-h-48 rounded-2xl border border-border bg-card p-5">Warehouse stock shell</div>
      </div>
    </Frame>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/logistics" element={<Logistics />} />
    </Routes>
  );
}