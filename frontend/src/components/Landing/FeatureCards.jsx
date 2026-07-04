import { Link } from 'react-router-dom';

export default function FeatureCards() {
  const cards = [
    { title: 'District Operations Center', to: '/dashboard' },
    { title: 'Supply Chain Optimizer', to: '/logistics' },
    { title: 'AI Knowledge Base', to: '/dashboard' },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.title} to={card.to} className="rounded-2xl border border-border bg-card p-5 text-sm text-text">
          {card.title}
        </Link>
      ))}
    </section>
  );
}
