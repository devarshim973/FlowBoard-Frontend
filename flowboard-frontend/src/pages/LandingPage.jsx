import { Link } from "react-router-dom";

const features = [
  "Workspace-driven planning and collaboration",
  "Boards, lists and cards shaped around your microservices",
  "Notifications, comments and delivery status in one surface",
  "Responsive React interface with API-first structure"
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header landing-container">
        <div className="brand">
          <span className="brand-mark">F</span>
          <div>
            <strong>FlowBoard</strong>
            <p>Task orchestration for delivery teams</p>
          </div>
        </div>
        <div className="header-actions">
          <Link className="secondary-button" to="/auth">
            Login
          </Link>
          <Link className="primary-button" to="/auth">
            Start building
          </Link>
        </div>
      </header>

      <main className="landing-hero landing-container">
        <p className="eyebrow">Case-study aligned frontend</p>
        <h1>
          Ship a Trello-inspired workflow with a clean, simple feel.
        </h1>
        <p className="landing-copy">
          FlowBoard combines board management, activity visibility, and notification-first
          collaboration so your backend services feel like one polished product instead of separate modules.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" to="/auth">
            Open workspace
          </Link>
          <a className="ghost-button" href="#feature-list">
            Explore features
          </a>
        </div>
      </main>

      <section id="feature-list" className="landing-container landing-features">
        <div className="feature-grid">
          {features.map((feature) => (
            <article key={feature} className="feature-card">
              {feature}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
