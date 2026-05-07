import { useEffect, useState } from "react";

export default function MetricCard({ title, value, hint, tone = "cyan", delay = 0 }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (typeof value !== "number") {
      setDisplayValue(value);
      return;
    }

    const duration = 800;
    const start = performance.now();

    let frameId = 0;

    function animate(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    }

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <article className={`metric-card tone-${tone}`} style={{ animationDelay: `${delay}ms` }}>
      <p>{title}</p>
      <h3>{displayValue}</h3>
      <span>{hint}</span>
    </article>
  );
}
