import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/20">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">Bangladesh agriculture control room</p>
      <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-text md:text-5xl">
        Real-time district risk, RAG advisories, and logistics planning.
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
        This workspace follows the project specification and is ready for the backend, data pipeline, and map-driven dashboard to be built out.
      </p>
      <div className="mt-6 flex gap-3">
        <Link className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white" to="/dashboard">
          Enter Dashboard
        </Link>
        <Link className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-text" to="/logistics">
          View Logistics
        </Link>
      </div>
    </section>
  );
}
