export default function HowItWorks() {
  const steps = [
    'Live Climate Ingestion',
    'AI Risk Scoring',
    'RAG Advisory Generation',
    'Supply Chain Response',
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step} className="rounded-xl border border-border bg-card p-4 text-sm text-text">
            <div className="mb-2 font-mono text-xs text-accent">Step {index + 1}</div>
            {step}
          </div>
        ))}
      </div>
    </section>
  );
}
