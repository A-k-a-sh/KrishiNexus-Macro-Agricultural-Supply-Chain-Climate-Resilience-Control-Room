export default function ProblemStats() {
  const stats = [
    '~18M hectares of cropland at climate risk',
    'Flood damage averages ৳12,000 crore/year',
    '64% of GDP exposure linked to Aman rice season',
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {stats.map((item) => (
        <article key={item} className="rounded-2xl border border-border bg-card p-5 text-sm text-text">
          {item}
        </article>
      ))}
    </section>
  );
}
