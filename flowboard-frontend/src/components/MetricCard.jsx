export default function MetricCard({ title, value, hint, tone = "cyan" }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <p>{title}</p>
      <h3>{value}</h3>
      <span>{hint}</span>
    </article>
  );
}
